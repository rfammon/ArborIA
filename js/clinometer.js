// js/clinometer.js (v66.0 - Lógica Final)

import { showToast } from './utils.js';

// Estado interno
let stream = null;
let currentAngle = 0;
let distance = 10; // Metros (padrão inicial)
let angleBase = null; // Ângulo da base (em graus)
let angleTop = null;  // Ângulo do topo (em graus)

// Referências DOM (Lidas na inicialização do main.js)
const videoEl = document.getElementById('camera-feed');
const angleDisplay = document.getElementById('clinometer-angle');
const steps = {
    distance: document.getElementById('step-distance'),
    base: document.getElementById('step-base'),
    top: document.getElementById('step-top'),
    result: document.getElementById('step-result')
};

/**
 * Inicia o Clinômetro (Câmera + Sensores).
 */
export async function startClinometer() {
    // 1. Resetar Estado e UI
    resetMeasurement();

    // 2. Define o valor inicial da distância no input do Clinômetro
    // Agora ele sempre começa com 'distance' (padrão 10 ou último valor do Clinômetro)
    if (document.getElementById('clino-distance')) {
        document.getElementById('clino-distance').value = distance;
    }

    // 3. Acessar Câmera
    try {
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: { exact: "environment" } } 
        }).catch(() => {
            return navigator.mediaDevices.getUserMedia({ video: true }); // Fallback
        });
        
        if (videoEl) {
            videoEl.srcObject = stream;
            videoEl.setAttribute("playsinline", true); 
            videoEl.play();
        }
    } catch (err) {
        console.error("Erro na câmera:", err);
        showToast("Erro ao acessar câmera. Verifique permissões.", "error");
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
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    if (videoEl) videoEl.srcObject = null;
    window.removeEventListener('deviceorientation', handleOrientation);
}

/**
 * Lógica do Sensor de Orientação.
 */
function handleOrientation(event) {
    const rawBeta = event.beta; 
    if (rawBeta !== null) {
        const calibratedAngle = rawBeta - 90; 
        currentAngle = (currentAngle * 0.9) + (calibratedAngle * 0.1); 
        
        if (angleDisplay) angleDisplay.textContent = `${currentAngle.toFixed(1)}°`;
    }
}

// === FLUXO DE MEDIÇÃO ===

function showStep(stepName) {
    Object.values(steps).forEach(el => { if(el) el.classList.remove('active'); });
    if (steps[stepName]) steps[stepName].classList.add('active');
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
            const calcBtn = document.querySelector('[data-target="calculadora-risco"]');
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
            distance = val; // Atualiza a variável 'distance' interna do módulo
            
            // NÃO HÁ MAIS CAMPO risk-distancia-obs PARA SINCRONIZAR
            
            showStep('base');
            showToast(`Distância definida: ${distance}m`, "success");
        });
    }

    // Passo 2: Capturar Base
    const baseBtn = document.getElementById('btn-capture-base');
    if (baseBtn) {
        baseBtn.addEventListener('click', () => {
            angleBase = currentAngle;
            showToast(`Base capturada: ${angleBase.toFixed(1)}°`, "info");
            setTimeout(() => showStep('top'), 300);
        });
    }

    // Passo 3: Capturar Topo e Calcular
    const topBtn = document.getElementById('btn-capture-top');
    if (topBtn) {
        topBtn.addEventListener('click', () => {
            angleTop = currentAngle;
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
                showToast("Altura salva no cadastro!", "success");
                
                // Volta para a calculadora
                stopClinometer();
                const calcBtn = document.querySelector('[data-target="calculadora-risco"]');
                if (calcBtn) calcBtn.click();
            }
        });
    }
}

function calculateHeight() {
    const radTop = angleTop * (Math.PI / 180);
    const radBase = angleBase * (Math.PI / 180);

    let height = distance * (Math.tan(radTop) - Math.tan(radBase));

    if (height < 0) height = Math.abs(height); 
    
    document.getElementById('tree-height-result').textContent = `${height.toFixed(1)} m`;
    showStep('result');
}

function resetMeasurement() {
    angleBase = null;
    angleTop = null;
    showStep('distance');
}
