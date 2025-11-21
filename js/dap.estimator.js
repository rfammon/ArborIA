/* js/dap.estimator.js (vFinal)
   Módulo DAP: Estimativa de Diâmetro à Altura do Peito.
   Usa Câmera + Giroscópio (Alpha/Rotação) para medir largura do tronco.
*/

import Utils from './utils.js';
import Features from './features.js';

const DapEstimator = {
    // Estado Interno
    stream: null,
    currentAngle: 0,
    distance: 10,
    angleLeft: null,
    angleRight: null,
    isRunning: false,

    // Elementos DOM
    elements: {
        view: document.getElementById('dap-estimator-view'),
        video: document.getElementById('dap-camera-feed'),
        angleDisplay: document.getElementById('dap-current-angle'),
        inputs: {
            distance: document.getElementById('dap-distance-input'),
            resultDisplay: document.getElementById('dap-estimated-result')
        },
        steps: {
            distance: document.getElementById('dap-step-distance'),
            left: document.getElementById('dap-step-left'),
            right: document.getElementById('dap-step-right'),
            result: document.getElementById('dap-step-result')
        }
    },

    init() {
        console.log('[DapEstimator] Inicializando...');
        this.setupListeners();
    },

    setupListeners() {
        // Botão Sair
        const btnClose = document.getElementById('close-dap-estimator');
        if (btnClose) {
            btnClose.addEventListener('click', () => this.stop());
        }

        // Passo 1: Iniciar (Configurar Distância)
        const btnNext = document.getElementById('btn-dap-next-step');
        if (btnNext) {
            btnNext.addEventListener('click', async () => {
                // Solicita permissão de sensor (iOS)
                const granted = await Features.requestDeviceOrientation();
                if (granted) {
                    this.distance = parseFloat(this.elements.inputs.distance.value) || 10;
                    this.setStep('left');
                    Features.hapticFeedback();
                }
            });
        }

        // Passo 2: Capturar Esquerda
        const btnLeft = document.getElementById('btn-dap-capture-left');
        if (btnLeft) {
            btnLeft.addEventListener('click', () => {
                this.angleLeft = this.currentAngle;
                Utils.showToast(`Esq: ${this.angleLeft.toFixed(1)}°`);
                this.setStep('right');
                Features.successFeedback();
            });
        }

        // Passo 3: Capturar Direita e Calcular
        const btnRight = document.getElementById('btn-dap-capture-right');
        if (btnRight) {
            btnRight.addEventListener('click', () => {
                this.angleRight = this.currentAngle;
                this.calculateDap();
                this.setStep('result');
                Features.successFeedback();
            });
        }

        // Resultado: Nova Medição
        const btnReset = document.getElementById('btn-dap-reset');
        if (btnReset) {
            btnReset.addEventListener('click', () => {
                this.resetMeasurement();
                this.setStep('distance');
            });
        }

        // Resultado: Salvar
        const btnSave = document.getElementById('btn-dap-save');
        if (btnSave) {
            btnSave.addEventListener('click', () => {
                // Extrai apenas o número (remove " cm")
                const dapVal = parseFloat(this.elements.inputs.resultDisplay.textContent);
                
                const formInput = document.getElementById('risk-dap');
                if (formInput) {
                    formInput.value = dapVal;
                    Utils.showToast(`DAP de ${dapVal} cm salvo!`);
                }
                this.stop();
            });
        }

        // Observer para auto-start/stop baseado na visibilidade da div
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    const isVisible = this.elements.view.style.display !== 'none';
                    if (isVisible && !this.isRunning) {
                        this.start();
                    } else if (!isVisible && this.isRunning) {
                        this.stop();
                    }
                }
            });
        });
        
        if (this.elements.view) {
            observer.observe(this.elements.view, { attributes: true });
        }
    },

    // === CONTROLE DE HARDWARE ===

    async start() {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log('[DapEstimator] Iniciando...');

        try {
            const constraints = { 
                video: { 
                    facingMode: 'environment', 
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }, 
                audio: false 
            };
            
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.elements.video.srcObject = this.stream;
            
            Features.requestWakeLock(); // Mantém tela ligada

        } catch (err) {
            console.error('[DapEstimator] Erro Câmera:', err);
            Utils.showToast('Erro ao acessar câmera.', 'error');
            this.stop();
            return;
        }

        window.addEventListener('deviceorientation', this.handleOrientationBound);
        
        this.resetMeasurement();
        this.setStep('distance');
    },

    stop() {
        if (!this.isRunning) return;
        this.isRunning = false;
        console.log('[DapEstimator] Parando...');

        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        this.elements.video.srcObject = null;

        window.removeEventListener('deviceorientation', this.handleOrientationBound);
        Features.releaseWakeLock();

        // Fecha visualização e restaura App
        this.elements.view.style.display = 'none';
        
        // Lógica de restauração da UI principal (Mobile/Desktop)
        const backBtn = document.getElementById('btn-voltar-painel');
        const nav = document.querySelector('.mapa-navegacao');
        const content = document.getElementById('manual-view');
        
        if (backBtn && window.innerWidth <= 768) {
            backBtn.style.display = 'flex';
            content.style.display = 'block';
        } else {
            if (nav) nav.style.display = 'block';
            if (nav) nav.classList.remove('hidden');
            if (content) content.style.display = 'block';
        }
    },

    // Wrapper para binding correto do 'this'
    handleOrientationBound(e) {
        DapEstimator.handleOrientation(e);
    },

    handleOrientation(event) {
        // Alpha: Rotação em torno do eixo Z (Bússola/Giroscópio) 0 a 360
        let alpha = event.alpha;
        
        if (alpha === null) return;

        // Estabilização básica
        this.currentAngle = alpha;
        
        if (this.elements.angleDisplay) {
            this.elements.angleDisplay.textContent = `${alpha.toFixed(1)}°`;
        }
    },

    // === LÓGICA DE UI ===

    setStep(stepName) {
        Object.values(this.elements.steps).forEach(el => {
            if(el) {
                el.style.display = 'none';
                el.classList.remove('active');
            }
        });

        const activeEl = this.elements.steps[stepName];
        if (activeEl) {
            activeEl.style.display = 'flex';
            activeEl.classList.add('active');
        }
    },

    resetMeasurement() {
        this.angleLeft = null;
        this.angleRight = null;
        this.elements.inputs.resultDisplay.textContent = "0.0 cm";
    },

    // === MATEMÁTICA DO DAP ===

    calculateDap() {
        if (this.angleLeft === null || this.angleRight === null) return;

        // 1. Calcular a diferença angular (Delta)
        let delta = Math.abs(this.angleLeft - this.angleRight);

        // Correção para passagem pelo Norte (360 -> 0)
        // Ex: Esq 355°, Dir 5° -> Diferença real é 10°, não 350°
        if (delta > 180) {
            delta = 360 - delta;
        }

        // 2. Converter para Radianos
        const deltaRad = Utils.deg2rad(delta);

        // 3. Calcular Largura (DAP)
        // Fórmula trigonométrica: Largura = 2 * Distancia * tan(angulo/2)
        // (Assumindo triângulo isósceles a partir do observador)
        
        // Distância em metros -> Resultado em metros
        const widthMeters = 2 * this.distance * Math.tan(deltaRad / 2);

        // Converter para CM
        const widthCm = widthMeters * 100;

        this.elements.inputs.resultDisplay.textContent = `${widthCm.toFixed(1)} cm`;
    }
};

/* EXPORTAÇÃO PADRÃO (Módulo) */
export default DapEstimator;
