/**
 * ARBORIA 2.0 - DAP ESTIMATOR (v5.1 Refatorado)
 * Estimativa de diâmetro via Realidade Aumentada (Giroscópio Horizontal).
 */

import { showToast } from './utils.js';

// Estado interno
let stream = null;
let currentGamma = 0; // Ângulo horizontal (rotação eixo Z)
let distance = 10; 
let angleLeftCapture = null; 
let angleRightCapture = null;

// Referências DOM (sob demanda)
const getElements = () => ({
    videoEl: document.getElementById('dap-camera-feed'),
    angleDisplay: document.getElementById('dap-current-angle'),
    distInput: document.getElementById('dap-distance-input'),
    steps: {
        distance: document.getElementById('dap-step-distance'),
        left: document.getElementById('dap-step-left'),
        right: document.getElementById('dap-step-right'),
        result: document.getElementById('dap-step-result')
    }
});

/**
 * Inicia o Estimador de DAP.
 */
export async function startDAPEstimator() {
    const els = getElements();
    
    resetMeasurement();
    showStep('distance'); 

    // 1. Sincroniza distância inicial com o formulário principal
    const mainDistInput = document.getElementById('risk-distancia-obs');
    
    if (mainDistInput && mainDistInput.value && parseFloat(mainDistInput.value) > 0) {
        distance = parseFloat(mainDistInput.value);
    }
    
    if (els.distInput) {
        els.distInput.value = distance;
    }

    // 2. Acessar Câmera
    try {
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: { exact: "environment" } } 
        }).catch(() => {
            return navigator.mediaDevices.getUserMedia({ video: true });
        });
        
        if (els.videoEl) {
            els.videoEl.srcObject = stream;
            els.videoEl.setAttribute("playsinline", true); 
            els.videoEl.play().catch(e => console.warn("Play error:", e));
        }
    } catch (err) {
        console.error(err);
        showToast("Erro ao acessar câmera. Verifique permissões.", "error");
    }

    // 3. Acessar Giroscópio
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(response => {
                if (response === 'granted') {
                    window.addEventListener('deviceorientation', handleOrientation);
                } else {
                    showToast("Permissão de giroscópio negada.", "error");
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
export function stopDAPEstimator() {
    const els = getElements();
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    if (els.videoEl) els.videoEl.srcObject = null;
    window.removeEventListener('deviceorientation', handleOrientation);
}

/**
 * Lógica do Sensor.
 */
function handleOrientation(event) {
    const els = getElements();
    const rawGamma = event.gamma; // Rotação Esquerda/Direita (Eixo Z)
    const rawBeta = event.beta;   // Inclinação Frente/Trás (Eixo X) - Usado para nível

    // Feedback visual: Nível (Bolha Virtual)
    if (rawBeta !== null && els.angleDisplay) {
        // O ideal é manter o celular em pé (Beta ~90)
        const level = 90 - Math.abs(rawBeta); 
        
        els.angleDisplay.textContent = `Nível: ${level.toFixed(1)}°`;
        
        // Muda a cor se estiver muito inclinado (fora de prumo)
        if (Math.abs(level) > 15) {
            els.angleDisplay.style.color = '#ff5252'; // Vermelho (Ruim)
        } else {
            els.angleDisplay.style.color = '#00e676'; // Verde (Bom)
        }
    }

    if (rawGamma !== null) {
        // Suavização do valor (Média Exponencial)
        currentGamma = (currentGamma * 0.8) + (rawGamma * 0.2); 
    }
}

// === FLUXO DE UI ===

function showStep(stepName) {
    const els = getElements();
    Object.values(els.steps).forEach(el => { 
        if(el) el.classList.remove('active'); 
    });
    
    if (els.steps[stepName]) {
        els.steps[stepName].classList.add('active');
    }
}

/**
 * Inicializa os listeners dos botões (Chamado no main.js)
 */
export function initDAPEstimatorListeners() {
    // Botão Fechar
    const closeBtn = document.getElementById('close-dap-estimator');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            stopDAPEstimator();
            // CORREÇÃO: ID da nova UI
            const calcBtn = document.querySelector('.topico-btn[data-target="calculadora-view"]');
            if (calcBtn) calcBtn.click();
        });
    }

    // 1. Confirmar Distância e Ir para Esquerda
    const nextBtn = document.getElementById('btn-dap-next-step');
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            const distInput = document.getElementById('dap-distance-input');
            const val = parseFloat(distInput.value);
            if (!val || val <= 0) {
                showToast("Distância inválida.", "error");
                return;
            }
            distance = val;
            
            // Sincroniza de volta com o formulário principal
            const formDist = document.getElementById('risk-distancia-obs');
            if(formDist) formDist.value = distance;

            showStep('left');
            showToast("Mire na borda ESQUERDA do tronco.", "info");
        });
    }

    // 2. Capturar Esquerda e Ir para Direita
    const leftBtn = document.getElementById('btn-dap-capture-left');
    if (leftBtn) {
        leftBtn.addEventListener('click', () => {
            angleLeftCapture = currentGamma;
            showToast("Esquerda capturada. Gire para a DIREITA.", "info");
            setTimeout(() => showStep('right'), 500);
        });
    }

    // 3. Capturar Direita e Calcular
    const rightBtn = document.getElementById('btn-dap-capture-right');
    if (rightBtn) {
        rightBtn.addEventListener('click', () => {
            angleRightCapture = currentGamma;
            calculateDAP();
        });
    }

    // 4. Ações Finais (Reset)
    const resetBtn = document.getElementById('btn-dap-reset');
    if (resetBtn) resetBtn.addEventListener('click', resetMeasurement);

    // 5. Ações Finais (Salvar)
    const saveBtn = document.getElementById('btn-dap-save');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const resultText = document.getElementById('dap-estimated-result').textContent;
            const numericDAP = parseFloat(resultText);
            
            const dapInput = document.getElementById('risk-dap');
            if (dapInput) {
                dapInput.value = numericDAP.toFixed(1);
                showToast("DAP salvo no cadastro!", "success");
                
                stopDAPEstimator();
                const calcBtn = document.querySelector('.topico-btn[data-target="calculadora-view"]');
                if (calcBtn) calcBtn.click();
            }
        });
    }
}

/**
 * Cálculo Trigonométrico do DAP
 */
function calculateDAP() {
    // Diferença angular absoluta entre as bordas
    let delta = Math.abs(angleRightCapture - angleLeftCapture);
    
    // Correção para virada de eixo (passagem pelo zero/360)
    // Ex: Esquerda 179°, Direita -179° (delta nominal 358, real 2)
    if (delta > 180) delta = 360 - delta;

    // Validação básica
    if (Math.abs(delta) < 0.1) {
        showToast("Erro: Ângulo muito pequeno. Tente novamente.", "warning");
        return;
    }

    // Conversão para Radianos
    const radDelta = delta * (Math.PI / 180);
    
    // FÓRMULA: Largura = Distancia * tan(Delta)
    // Como medimos de borda a borda a partir de um centro pivot, 
    // a aproximação linear Dist * tan(delta) funciona para DAP pequeno vs Distância grande.
    const widthMetros = distance * Math.tan(radDelta);
    const dapCentimetros = widthMetros * 100;

    document.getElementById('dap-estimated-result').textContent = `${dapCentimetros.toFixed(1)} cm`;
    showStep('result');
}

function resetMeasurement() {
    angleLeftCapture = null;
    angleRightCapture = null;
    showStep('distance');
}
