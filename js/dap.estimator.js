// js/dap.estimator.js (v5.0 - Estimador de DAP Final)

import { showToast } from './utils.js';

// Estado interno
let stream = null;
let currentGamma = 0; // Ângulo horizontal (rotação eixo Z)
let distance = 10; 
let angleLeftCapture = null; 
let angleRightCapture = null;

// Referências DOM
const videoEl = document.getElementById('dap-camera-feed');
const angleDisplay = document.getElementById('dap-current-angle'); 

// Mapeamento dos passos (IDs do HTML)
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
    // Garante que o primeiro passo é mostrado ao abrir
    showStep('distance'); 

    // 1. Sincroniza distância inicial com o formulário principal (se existir)
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
 */
function handleOrientation(event) {
    const rawGamma = event.gamma; // Rotação Esquerda/Direita (Eixo Z)
    const rawBeta = event.beta;   // Inclinação Frente/Trás (Eixo X)

    // Feedback visual: Mostra inclinação vertical para ajudar o usuário a manter o nível (90 graus)
    if (rawBeta !== null && angleDisplay) {
        const level = 90 - rawBeta;
        angleDisplay.textContent = `Nível: ${level.toFixed(1)}°`;
        
        // Muda a cor se estiver muito inclinado (dica visual)
        if (Math.abs(level) > 10) {
            angleDisplay.style.color = '#ff5252'; 
        } else {
            angleDisplay.style.color = '#FFEB3B';
        }
    }

    if (rawGamma !== null) {
        // Suavização do valor (Média Exponencial)
        currentGamma = (currentGamma * 0.8) + (rawGamma * 0.2); 
    }
}

// === FLUXO DE UI ===

function showStep(stepName) {
    // Remove a classe .active de todos os passos
    Object.values(steps).forEach(el => { 
        if(el) el.classList.remove('active'); 
    });
    
    // Adiciona .active apenas no passo atual
    if (steps[stepName]) {
        steps[stepName].classList.add('active');
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
            const calcBtn = document.querySelector('.topico-btn[data-target="calculadora-risco"]');
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
            
            // Sincroniza de volta com o formulário principal (opcional)
            const formDist = document.getElementById('risk-distancia-obs');
            if(formDist) formDist.value = distance;

            showStep('left');
            showToast("Mire na borda ESQUERDA.", "info");
        });
    }

    // 2. Capturar Esquerda e Ir para Direita
    const leftBtn = document.getElementById('btn-dap-capture-left');
    if (leftBtn) {
        leftBtn.addEventListener('click', () => {
            angleLeftCapture = currentGamma;
            showToast("Esquerda capturada. Gire para a DIREITA.", "info");
            // Pequeno delay para evitar clique duplo acidental
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
                const calcBtn = document.querySelector('.topico-btn[data-target="calculadora-risco"]');
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
    
    // Correção para virada de eixo (ex: passar de 179 para -179)
    if (delta > 180) delta = 360 - delta;

    // Validação básica
    if (Math.abs(delta) < 0.1) {
        showToast("Erro: Ângulo muito pequeno. Tente novamente.", "warning");
        return;
    }

    // Conversão para Radianos
    const radDelta = delta * (Math.PI / 180);
    
    // FÓRMULA: Largura = Distancia * tan(Delta)
    // (Para pequenos ângulos, tan(x) ~= x, mas usamos a tangente completa)
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
