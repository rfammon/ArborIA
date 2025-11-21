/**
 * ARBORIA 2.0 - CLINOMETER (v66.2 Sensor Fix)
 * Correção: Prioriza o pedido de permissão dos sensores antes da câmera
 * para evitar perda do "User Gesture" no iOS.
 */

import { showToast } from './utils.js';

// Estado interno
let stream = null;
let currentAngle = 0;
let distance = 10; 
let angleBase = null; 
let angleTop = null;  

// Referências DOM
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
 * Inicia o Clinômetro.
 * IMPORTANTE: A ordem aqui é vital. Sensores primeiro, Câmera depois.
 */
export async function startClinometer() {
    const els = getElements();
    
    // 1. Resetar UI
    resetMeasurement();

    // 2. Sincronizar Distância
    const mainDistInput = document.getElementById('risk-distancia-obs');
    if (mainDistInput && mainDistInput.value && parseFloat(mainDistInput.value) > 0) {
        distance = parseFloat(mainDistInput.value);
    }
    if (els.distInput) els.distInput.value = distance;

    // 3. ATIVAR SENSORES (Prioridade Máxima)
    // Tentamos conectar o giroscópio antes de qualquer operação pesada (como câmera)
    if (typeof DeviceOrientationEvent !== 'undefined') {
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            // iOS 13+ (Precisa de permissão explícita)
            try {
                const permissionState = await DeviceOrientationEvent.requestPermission();
                if (permissionState === 'granted') {
                    window.addEventListener('deviceorientation', handleOrientation);
                } else {
                    showToast("Permissão de sensores negada. O ângulo não funcionará.", "error");
                }
            } catch (e) {
                console.warn("Erro ao solicitar permissão iOS:", e);
                // Tenta adicionar mesmo assim (alguns Androids antigos)
                window.addEventListener('deviceorientation', handleOrientation);
            }
        } else {
            // Android / iOS antigo (Permissão automática)
            window.addEventListener('deviceorientation', handleOrientation);
        }
    } else {
        showToast("Seu dispositivo não possui giroscópio.", "error");
    }

    // 4. ATIVAR CÂMERA (Secundário)
    try {
        // Tenta câmera traseira (environment)
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "environment" } 
        }).catch(() => {
            // Fallback para qualquer câmera
            return navigator.mediaDevices.getUserMedia({ video: true }); 
        });
        
        if (els.videoEl) {
            els.videoEl.srcObject = stream;
            els.videoEl.setAttribute("playsinline", true); // iOS fix
            els.videoEl.play().catch(e => console.warn("Erro ao iniciar vídeo:", e));
        }
    } catch (err) {
        console.error("Erro na câmera:", err);
        showToast("Erro ao acessar câmera. Verifique se é HTTPS.", "error");
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
 * Lógica do Sensor de Orientação (Beta = Inclinação Vertical)
 */
function handleOrientation(event) {
    const els = getElements();
    const rawBeta = event.beta; 
    
    if (rawBeta === null) return; // Sensor não disponível

    // Calibração:
    // Beta 90° = Celular em pé (Retrato)
    // Beta 0° = Celular deitado (Mesa)
    // Queremos: 0° no horizonte (celular em pé apontando pro horizonte)
    // Então: Angulo = Beta - 90
    
    const calibratedAngle = rawBeta - 90; 
    
    // Filtro Suavizador (Low-pass) para evitar tremedeira nos números
    currentAngle = (currentAngle * 0.9) + (calibratedAngle * 0.1); 
    
    if (els.angleDisplay) {
        // Mostra valor absoluto para o usuário não ver negativo
        els.angleDisplay.textContent = `${Math.abs(currentAngle).toFixed(1)}°`;
        
        // Muda cor se estiver muito inclinado (feedback visual)
        if (Math.abs(currentAngle) > 85) els.angleDisplay.style.color = '#ff5252';
        else els.angleDisplay.style.color = '#00e676';
    }
}

// === FLUXO DE MEDIÇÃO (UI) ===

function showStep(stepName) {
    const els = getElements();
    Object.values(els.steps).forEach(el => { if(el) el.classList.remove('active'); });
    if (els.steps[stepName]) els.steps[stepName].classList.add('active');
}

export function initClinometerListeners() {
    // Botão Fechar
    const closeBtn = document.getElementById('close-clinometer');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            stopClinometer();
            const calcBtn = document.querySelector('.topico-btn[data-target="calculadora-view"]');
            if (calcBtn) calcBtn.click();
        });
    }

    // Passo 1: Iniciar
    const startBtn = document.getElementById('btn-start-measure');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            const distInput = document.getElementById('clino-distance');
            const val = parseFloat(distInput.value);
            if (!val || val <= 0) {
                showToast("Distância inválida.", "error");
                return;
            }
            distance = val;
            
            // Sincroniza reverso
            const mainDistInput = document.getElementById('risk-distancia-obs');
            if(mainDistInput) mainDistInput.value = distance;
            
            showStep('base');
            showToast("Aponte para a base do tronco.", "info");
        });
    }

    // Passo 2: Capturar Base
    const baseBtn = document.getElementById('btn-capture-base');
    if (baseBtn) {
        baseBtn.addEventListener('click', () => {
            angleBase = currentAngle;
            showToast(`Base: ${Math.abs(angleBase).toFixed(1)}°`, "success");
            setTimeout(() => showStep('top'), 400);
        });
    }

    // Passo 3: Capturar Topo
    const topBtn = document.getElementById('btn-capture-top');
    if (topBtn) {
        topBtn.addEventListener('click', () => {
            angleTop = currentAngle;
            calculateHeight();
        });
    }

    // Passo 4: Ações
    const resetBtn = document.getElementById('btn-reset-measure');
    if (resetBtn) resetBtn.addEventListener('click', resetMeasurement);

    const saveBtn = document.getElementById('btn-save-height');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const resultText = document.getElementById('tree-height-result').textContent;
            const heightInput = document.getElementById('risk-altura');
            
            if (heightInput) {
                heightInput.value = parseFloat(resultText).toFixed(1);
                showToast("Altura salva!", "success");
                
                stopClinometer();
                const calcBtn = document.querySelector('.topico-btn[data-target="calculadora-view"]');
                if (calcBtn) calcBtn.click();
            }
        });
    }
}

function calculateHeight() {
    // h = d * (tan(top) - tan(base))
    const radTop = angleTop * (Math.PI / 180);
    const radBase = angleBase * (Math.PI / 180);
    
    let height = distance * (Math.tan(radTop) - Math.tan(radBase));
    height = Math.abs(height); 
    
    document.getElementById('tree-height-result').textContent = `${height.toFixed(1)} m`;
    showStep('result');
}

function resetMeasurement() {
    angleBase = null;
    angleTop = null;
    showStep('distance');
}
