/**
 * ARBORIA 2.0 - CLINOMETER (v66.1 Refatorado)
 * Lógica de medição de altura via Realidade Aumentada (Câmera + Giroscópio).
 */

import { showToast } from './utils.js';

// Estado interno
let stream = null;
let currentAngle = 0;
let distance = 10; // Metros (padrão inicial)
let angleBase = null; // Ângulo da base (em graus)
let angleTop = null;  // Ângulo do topo (em graus)

// Referências DOM (capturadas sob demanda para evitar erros de init)
const getElements = () => ({
    videoEl: document.getElementById('camera-feed'),
    angleDisplay: document.getElementById('clinometer-angle'),
    distInput: document.getElementById('clino-distance'),
    steps: {
        distance: document.getElementById('step-distance'),
        base: document.getElementById('step-base'),
        top: document.getElementById('step-top'),
        result: document.getElementById('step-result')
    }
});

/**
 * Inicia o Clinômetro (Câmera + Sensores).
 */
export async function startClinometer() {
    const els = getElements();
    
    // 1. Resetar Estado e UI
    resetMeasurement();

    // 2. Sincroniza distância: Tenta pegar do form principal se tiver valor
    const mainDistInput = document.getElementById('risk-distancia-obs');
    if (mainDistInput && mainDistInput.value && parseFloat(mainDistInput.value) > 0) {
        distance = parseFloat(mainDistInput.value);
    }
    
    if (els.distInput) {
        els.distInput.value = distance;
    }

    // 3. Acessar Câmera
    try {
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: { exact: "environment" } } 
        }).catch(() => {
            return navigator.mediaDevices.getUserMedia({ video: true }); // Fallback
        });
        
        if (els.videoEl) {
            els.videoEl.srcObject = stream;
            els.videoEl.setAttribute("playsinline", true); 
            els.videoEl.play().catch(e => console.warn("Play error:", e));
        }
    } catch (err) {
        console.error("Erro na câmera:", err);
        showToast("Erro ao acessar câmera. Verifique permissões no navegador.", "error");
    }

    // 4. Acessar Giroscópio (DeviceOrientation)
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(response => {
                if (response === 'granted') {
                    window.addEventListener('deviceorientation', handleOrientation);
                } else {
                    showToast("Permissão de giroscópio negada. O ângulo não funcionará.", "error");
                }
            })
            .catch(console.error);
    } else {
        window.addEventListener('deviceorientation', handleOrientation);
    }
}

/**
 * Para a câmera e remove listeners.
 */
export function stopClinometer() {
    const els = getElements();
    
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    if (els.videoEl) els.videoEl.srcObject = null;
    window.removeEventListener('deviceorientation', handleOrientation);
}

/**
 * Lógica do Sensor de Orientação.
 */
function handleOrientation(event) {
    const els = getElements();
    const rawBeta = event.beta; 
    
    // Filtro simples para evitar saltos se o sensor falhar momentaneamente
    if (rawBeta !== null) {
        // Ajuste de calibração: Beta 90 = Celular em pé. Subtraímos 90 para que o horizonte seja 0.
        const calibratedAngle = rawBeta - 90; 
        
        // Suavização (Low-pass filter) para o número não tremer demais
        currentAngle = (currentAngle * 0.85) + (calibratedAngle * 0.15); 
        
        // Inverte sinal se necessário (depende da orientação do device, mas geralmente olhar pra cima deve ser positivo)
        // Vamos usar Math.abs na visualização se preferir, mas matematicamente precisamos do sinal.
        // Aqui assumimos o padrão do navegador.
        
        if (els.angleDisplay) {
             // Mostra valor absoluto para não confundir usuário com negativo
            els.angleDisplay.textContent = `${Math.abs(currentAngle).toFixed(1)}°`;
        }
    }
}

// === FLUXO DE MEDIÇÃO ===

function showStep(stepName) {
    const els = getElements();
    Object.values(els.steps).forEach(el => { if(el) el.classList.remove('active'); });
    if (els.steps[stepName]) els.steps[stepName].classList.add('active');
}

/**
 * Inicializa os botões do Clinômetro (Chamado uma vez no main.js).
 */
export function initClinometerListeners() {
    // Botão Fechar (Volta para a calculadora)
    const closeBtn = document.getElementById('close-clinometer');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            stopClinometer();
            // CORREÇÃO: Usa o seletor correto do novo HTML (calculadora-view)
            // Tenta simular clique na navegação
            const calcBtn = document.querySelector('.topico-btn[data-target="calculadora-view"]');
            if (calcBtn) calcBtn.click();
        });
    }

    // Passo 1: Iniciar (Lê a distância do input do Clinômetro)
    const startBtn = document.getElementById('btn-start-measure');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            const distInput = document.getElementById('clino-distance');
            const val = parseFloat(distInput.value);
            if (!val || val <= 0) {
                showToast("Informe uma distância válida (> 0m).", "error");
                return;
            }
            distance = val;
            
            // Atualiza também o formulário principal para manter consistência
            const mainDistInput = document.getElementById('risk-distancia-obs');
            if(mainDistInput) mainDistInput.value = distance;
            
            showStep('base');
            showToast(`Distância definida: ${distance}m`, "success");
        });
    }

    // Passo 2: Capturar Base
    const baseBtn = document.getElementById('btn-capture-base');
    if (baseBtn) {
        baseBtn.addEventListener('click', () => {
            angleBase = currentAngle; // Salva ângulo atual
            showToast(`Base: ${Math.abs(angleBase).toFixed(1)}°`, "info");
            setTimeout(() => showStep('top'), 300);
        });
    }

    // Passo 3: Capturar Topo e Calcular
    const topBtn = document.getElementById('btn-capture-top');
    if (topBtn) {
        topBtn.addEventListener('click', () => {
            angleTop = currentAngle; // Salva ângulo atual
            calculateHeight();
        });
    }

    // Passo 4: Resultado e Ações
    const resetBtn = document.getElementById('btn-reset-measure');
    if (resetBtn) resetBtn.addEventListener('click', resetMeasurement);

    const saveBtn = document.getElementById('btn-save-height');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const resultText = document.getElementById('tree-height-result').textContent;
            const numericHeight = parseFloat(resultText);
            
            const heightInput = document.getElementById('risk-altura');
            if (heightInput) {
                heightInput.value = numericHeight.toFixed(1);
                showToast("Altura salva no formulário!", "success");
                
                // Volta para a calculadora
                stopClinometer();
                const calcBtn = document.querySelector('.topico-btn[data-target="calculadora-view"]');
                if (calcBtn) calcBtn.click();
            }
        });
    }
}

function calculateHeight() {
    // Matemática Trigonométrica: h = d * (tan(top) - tan(base))
    // Conversão para Radianos
    const radTop = angleTop * (Math.PI / 180);
    const radBase = angleBase * (Math.PI / 180);

    // O cálculo depende se a base está abaixo ou acima do nível dos olhos (horizonte)
    // Se angleBase for negativo (olhando pra baixo) e angleTop positivo (olhando pra cima),
    // a tangente de base será negativa. Subtrair um negativo = somar. A fórmula funciona universalmente.
    
    let height = distance * (Math.tan(radTop) - Math.tan(radBase));

    // Tratamento de erro/sinal
    height = Math.abs(height); 
    
    document.getElementById('tree-height-result').textContent = `${height.toFixed(1)} m`;
    showStep('result');
}

function resetMeasurement() {
    angleBase = null;
    angleTop = null;
    showStep('distance');
}
