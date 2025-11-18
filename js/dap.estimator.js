// js/dap.estimator.js (v72.0 - Estimador de DAP Didático)

import { showToast } from './utils.js';

// Estado interno
let stream = null;
let currentGamma = 0; // Ângulo horizontal (rotação eixo Z)
let distance = 10; 
let angleLeftCapture = null; 
let angleRightCapture = null;

// Referências DOM (Mapeadas para o index.html v72.0)
const videoEl = document.getElementById('dap-camera-feed');
const angleDisplay = document.getElementById('dap-current-angle'); 
const steps = {
    distance: document.getElementById('dap-step-distance'),
    left: document.getElementById('dap-step-left'),
    right: document.getElementById('dap-step-right'),
    result: document.getElementById('dap-step-result')
};

/**
 * Inicia o Estimador de DAP.
 */
export async function startDAPEstimator() {
    resetMeasurement();
    showStep('distance');

    // 1. Sincroniza distância inicial com o formulário (se houver valor)
    const mainDistInput = document.getElementById('risk-distancia-obs');
    const dapDistInput = document.getElementById('dap-distance-input');
    
    if (mainDistInput && mainDistInput.value) {
        distance = parseFloat(mainDistInput.value);
        if(dapDistInput) dapDistInput.value = distance;
    } else {
        distance = 10; // Valor padrão
        if(dapDistInput) dapDistInput.value = 10;
    }

    // 2. Acessar Câmera
    try {
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: { exact: "environment" } } 
        }).catch(() => {
            return navigator.mediaDevices.getUserMedia({ video: true });
        });
        
        if (videoEl) {
            videoEl.srcObject = stream;
            videoEl.setAttribute("playsinline", true); 
            videoEl.play();
        }
    } catch (err) {
        console.error(err);
        showToast("Erro ao acessar câmera.", "error");
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
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    if (videoEl) videoEl.srcObject = null;
    window.removeEventListener('deviceorientation', handleOrientation);
}

/**
 * Lógica do Sensor.
 * Para DAP, usamos Gamma (rotação no eixo Z/vertical) se o celular estiver em pé.
 */
function handleOrientation(event) {
    const rawGamma = event.gamma; // Rotação Esquerda/Direita (Eixo Z)
    const rawBeta = event.beta;   // Inclinação Frente/Trás (Eixo X)

    // Feedback visual: Mostra inclinação vertical para ajudar o usuário a manter o nível
    if (rawBeta !== null && angleDisplay) {
        // Beta ~90 graus é o celular em pé.
        const level = 90 - rawBeta;
        angleDisplay.textContent = `Nível: ${level.toFixed(1)}°`;
        
        // Opcional: mudar cor se estiver muito inclinado
        if (Math.abs(level) > 10) {
            angleDisplay.style.color = '#ff5252'; // Vermelho se desnivelado
        } else {
            angleDisplay.style.color = '#FFEB3B'; // Amarelo normal
        }
    }

    if (rawGamma !== null) {
        // Suavização simples
        currentGamma = (currentGamma * 0.8) + (rawGamma * 0.2); 
    }
}

// === FLUXO ===

function showStep(stepName) {
    Object.values(steps).forEach(el => { if(el) el.classList.remove('active'); });
    if (steps[stepName]) steps[stepName].classList.add('active');
}

export function initDAPEstimatorListeners() {
    // Botão Fechar
    const closeBtn = document.getElementById('close-dap-estimator');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            stopDAPEstimator();
            const calcBtn = document.querySelector('.topico-btn[data-target="calculadora-risco"]');
            if (calcBtn) calcBtn.click();
        });
    }

    // 1. Confirmar Distância
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
            
            // Sincroniza com o formulário principal
            const formDist = document.getElementById('risk-distancia-obs');
            if(formDist) formDist.value = distance;

            showStep('left');
            showToast("Mire na borda ESQUERDA.", "info");
        });
    }

    // 2. Capturar Esquerda
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

    // 4. Ações Finais
    const resetBtn = document.getElementById('btn-dap-reset');
    if (resetBtn) resetBtn.addEventListener('click', resetMeasurement);

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
                document.querySelector('.topico-btn[data-target="calculadora-risco"]').click();
            }
        });
    }
}

function calculateDAP() {
    // Diferença angular absoluta
    let delta = Math.abs(angleRightCapture - angleLeftCapture);
    
    // Correção para virada de eixo (ex: passar de 89 para -89 ou 179 para -179)
    // Como estamos usando Gamma (-90 a 90), a lógica é simples, mas protegemos contra loops
    if (delta > 90) {
        // Se girou demais, provavelmente houve erro de leitura ou virada de celular
        showToast("Erro: Giro excessivo. Mantenha o celular estável.", "warning");
        resetMeasurement();
        return;
    }

    if (delta < 0.1) {
        showToast("Erro: Ângulo muito pequeno.", "warning");
        return;
    }

    // Conversão para radianos
    const radDelta = delta * (Math.PI / 180);
    
    // FÓRMULA: Largura = Distancia * tan(Delta)
    // (Considerando que o usuário gira o celular a partir de um eixo central)
    const widthMetros = distance * Math.tan(radDelta);
    const dapCentimetros = widthMetros * 100;

    document.getElementById('dap-estimated-result').textContent = `${dapCentimetros.toFixed(1)} cm`;
    showStep('result');
}

function resetMeasurement() {
    angleLeftCapture = null;
    angleRightCapture = null;
    currentGamma = 0;
    showStep('distance');
}
