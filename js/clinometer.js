/**
 * ARBORIA 2.1 - CLINOMETER UI ENHANCEMENTS
 * Added inline validation messaging and better UX feedback
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

export async function startClinometer() {
    const els = getElements();
    resetMeasurement();

    if (els.distInput) els.distInput.value = distance;

    if (typeof DeviceOrientationEvent !== 'undefined') {
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            try {
                const permissionState = await DeviceOrientationEvent.requestPermission();
                if (permissionState === 'granted') {
                    window.addEventListener('deviceorientation', handleOrientation);
                } else {
                    showToast("Permissão de sensores negada. O ângulo não funcionará.", "error");
                }
            } catch (e) {
                
                window.addEventListener('deviceorientation', handleOrientation);
            }
        } else {
            window.addEventListener('deviceorientation', handleOrientation);
        }
    } else {
        showToast("Seu dispositivo não possui giroscópio.", "error");
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
        
        showToast("Erro ao acessar câmera. Verifique se é HTTPS.", "error");
    }
}

export function stopClinometer() {
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
    const rawBeta = event.beta; 
    
    if (rawBeta === null) return;

    const calibratedAngle = rawBeta - 90; 
    currentAngle = (currentAngle * 0.9) + (calibratedAngle * 0.1); 
    
    if (els.angleDisplay) {
        els.angleDisplay.textContent = Math.abs(currentAngle).toFixed(1) + "°";
        
        if (Math.abs(currentAngle) > 85) els.angleDisplay.style.color = '#ff5252';
        else els.angleDisplay.style.color = '#00e676';
    }
}

function showStep(stepName) {
    const els = getElements();
    Object.values(els.steps).forEach(el => { if(el) el.classList.remove('active'); });
    if (els.steps[stepName]) els.steps[stepName].classList.add('active');
}

export function initClinometerListeners() {
    const closeBtn = document.getElementById('close-clinometer');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            stopClinometer();
            const calcBtn = document.querySelector('.topico-btn[data-target="calculadora-view"]');
            if (calcBtn) calcBtn.click();
        });
    }

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
            
            showStep('base');
            showToast("Aponte para a base do tronco.", "info");
        });
    }

    const baseBtn = document.getElementById('btn-capture-base');
    if (baseBtn) {
        baseBtn.addEventListener('click', () => {
            angleBase = currentAngle;
            showToast("Base: " + Math.abs(angleBase).toFixed(1) + "°", "success");
            setTimeout(() => showStep('top'), 400);
        });
    }

    const topBtn = document.getElementById('btn-capture-top');
    if (topBtn) {
        topBtn.addEventListener('click', () => {
            angleTop = currentAngle;
            calculateHeight();
        });
    }

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

function calculateTreeHeight(distance, angleBase, angleTop) {
    const radTop = angleTop * (Math.PI / 180);
    const radBase = angleBase * (Math.PI / 180);
    
    // A fórmula tan(Top) - tan(Base) lida corretamente com casos onde o ângulo da base é negativo
    // (abaixo da linha do horizonte), pois tan(ângulo_negativo) é negativo, efetivamente somando as magnitudes.
    let height = distance * (Math.tan(radTop) - Math.tan(radBase));
    
    // Retorna a altura absoluta, pois a altura deve ser um valor positivo neste contexto.
    return Math.abs(height);
}

function calculateHeight() {
    let height = calculateTreeHeight(distance, angleBase, angleTop);
    
    document.getElementById('tree-height-result').textContent = height.toFixed(1) + " m";
    showStep('result');
}

function resetMeasurement() {
    angleBase = null;
    angleTop = null;
    showStep('distance');
}
