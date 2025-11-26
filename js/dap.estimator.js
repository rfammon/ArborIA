/**
 * ARBORIA 2.1 - DAP ESTIMATOR UI ENHANCEMENTS
 * Improved usability and inline validation messages
 */

import { showToast } from './utils.js';

// Estado interno
let stream = null;
let currentGamma = 0; 
let distance = 10; 
let angleLeftCapture = null; 
let angleRightCapture = null;

// Referências DOM
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

export async function startDAPEstimator() {
    const els = getElements();
    resetMeasurement();
    showStep('distance'); 

    if (els.distInput) els.distInput.value = distance;

    if (typeof DeviceOrientationEvent !== 'undefined') {
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            try {
                const response = await DeviceOrientationEvent.requestPermission();
                if (response === 'granted') {
                    window.addEventListener('deviceorientation', handleOrientation);
                } else {
                    showToast("Permissão de sensores negada.", "error");
                }
            } catch (e) {
                
                window.addEventListener('deviceorientation', handleOrientation);
            }
        } else {
            window.addEventListener('deviceorientation', handleOrientation);
        }
    }

    try {
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "environment" } 
        }).catch(() => {
            return navigator.mediaDevices.getUserMedia({ video: true });
        });
        
        if (els.videoEl) {
            els.videoEl.srcObject = stream;
            els.videoEl.setAttribute("playsinline", true);
            els.videoEl.play().catch(e => {});
        }
    } catch (err) {
        
        showToast("Erro na câmera. Verifique HTTPS.", "error");
    }
}

export function stopDAPEstimator() {
    const els = getElements();
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    if (els.videoEl) els.videoEl.srcObject = null;
    window.removeEventListener('deviceorientation', handleOrientation);
}

function handleOrientation(event) {
    const els = getElements();
    const rawGamma = event.gamma;
    const rawBeta = event.beta;

    if (rawBeta !== null && els.angleDisplay) {
        const level = 90 - Math.abs(rawBeta);
        els.angleDisplay.textContent = 'Nível: ' + level.toFixed(1) + '°';
        
        if (Math.abs(level) > 15) els.angleDisplay.style.color = '#ff5252';
        else els.angleDisplay.style.color = '#00e676';
    }

    if (rawGamma !== null) {
        currentGamma = (currentGamma * 0.8) + (rawGamma * 0.2);
    }
}

function showStep(stepName) {
    const els = getElements();
    Object.values(els.steps).forEach(el => { if(el) el.classList.remove('active'); });
    if (els.steps[stepName]) els.steps[stepName].classList.add('active');
}

export function initDAPEstimatorListeners() {
    const closeBtn = document.getElementById('close-dap-estimator');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            stopDAPEstimator();
            const calcBtn = document.querySelector('.topico-btn[data-target="calculadora-view"]');
            if (calcBtn) calcBtn.click();
        });
    }

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

            showStep('left');
            showToast("Mire na borda ESQUERDA.", "info");
        });
    }

    const leftBtn = document.getElementById('btn-dap-capture-left');
    if (leftBtn) {
        leftBtn.addEventListener('click', () => {
            angleLeftCapture = currentGamma;
            showToast("Capturado! Agora a borda DIREITA.", "success");
            setTimeout(() => showStep('right'), 500);
        });
    }

    const rightBtn = document.getElementById('btn-dap-capture-right');
    if (rightBtn) {
        rightBtn.addEventListener('click', () => {
            angleRightCapture = currentGamma;
            calculateDAP();
        });
    }

    const resetBtn = document.getElementById('btn-dap-reset');
    if (resetBtn) resetBtn.addEventListener('click', resetMeasurement);

    const saveBtn = document.getElementById('btn-dap-save');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const resultText = document.getElementById('dap-estimated-result').textContent;
            const dapInput = document.getElementById('risk-dap');
            
            if (dapInput) {
                dapInput.value = parseFloat(resultText).toFixed(1);
                showToast("DAP salvo!", "success");
                stopDAPEstimator();
                const calcBtn = document.querySelector('.topico-btn[data-target="calculadora-view"]');
                if (calcBtn) calcBtn.click();
            }
        });
    }
}

function _calculateDAPInternal(distance, angleLeft, angleRight) {
    // Convert angles from degrees to radians
    const radLeft = angleLeft * (Math.PI / 180);
    const radRight = angleRight * (Math.PI / 180);

    // Calculate the angular width in radians
    const angularWidthRad = Math.abs(radRight - radLeft);

    // If the angular width is very small, it's effectively zero.
    // This helps avoid issues with tan(0) being 0 but very small angles
    // might lead to imprecise results if not handled.
    if (angularWidthRad < 0.0001) { // ~0.0057 degrees
        return 0;
    }

    // Apply the simplified trigonometric formula
    const widthMetros = 2 * distance * Math.tan(angularWidthRad / 2);

    // Convert meters to centimeters
    const dapCentimetros = widthMetros * 100;

    return dapCentimetros;
}


function calculateDAP() {
    let delta = Math.abs(angleRightCapture - angleLeftCapture);

    if (Math.abs(delta) < 0.1) {
        showToast("Erro: Ângulo muito pequeno.", "warning");
        return;
    }

    const dapCentimetros = _calculateDAPInternal(distance, angleLeftCapture, angleRightCapture);

    document.getElementById('dap-estimated-result').textContent = dapCentimetros.toFixed(1) + " cm";
    showStep('result');
}

function resetMeasurement() {
    angleLeftCapture = null;
    angleRightCapture = null;
    showStep('distance');
}
