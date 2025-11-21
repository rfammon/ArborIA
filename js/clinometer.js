/* js/clinometer.js (vFinal)
   Módulo Clinômetro: Medição de Altura de Árvores.
   Usa Câmera (Video Feed) + Acelerômetro (DeviceOrientation).
*/

import Utils from './utils.js';
import Features from './features.js';

const Clinometer = {
    // Estado Interno
    stream: null,
    currentAngle: 0,
    distance: 10,
    angleBase: null,
    angleTop: null,
    isRunning: false,

    // Elementos DOM
    elements: {
        view: document.getElementById('clinometer-view'),
        video: document.getElementById('camera-feed'),
        angleDisplay: document.getElementById('clinometer-angle'),
        steps: {
            distance: document.getElementById('step-distance'),
            base: document.getElementById('step-base'),
            top: document.getElementById('step-top'),
            result: document.getElementById('step-result')
        },
        inputs: {
            distance: document.getElementById('clino-distance'),
            resultDisplay: document.getElementById('tree-height-result')
        }
    },

    init() {
        console.log('[Clinometer] Inicializando...');
        this.setupListeners();
    },

    setupListeners() {
        // Botão Sair (Fecha câmera e reseta)
        const btnClose = document.getElementById('close-clinometer');
        if (btnClose) {
            btnClose.addEventListener('click', () => this.stop());
        }

        // Botão Iniciar Medição (Passo 1 -> Passo 2)
        const btnStart = document.getElementById('btn-start-measure');
        if (btnStart) {
            btnStart.addEventListener('click', async () => {
                // Tenta permissão de sensores (iOS)
                const granted = await Features.requestDeviceOrientation();
                if (granted) {
                    this.distance = parseFloat(this.elements.inputs.distance.value) || 10;
                    this.setStep('base');
                    Features.hapticFeedback();
                }
            });
        }

        // Botão Capturar Base (Passo 2 -> Passo 3)
        const btnBase = document.getElementById('btn-capture-base');
        if (btnBase) {
            btnBase.addEventListener('click', () => {
                this.angleBase = this.currentAngle;
                Utils.showToast(`Base: ${this.angleBase.toFixed(1)}°`);
                this.setStep('top');
                Features.successFeedback();
            });
        }

        // Botão Capturar Topo (Passo 3 -> Resultado)
        const btnTop = document.getElementById('btn-capture-top');
        if (btnTop) {
            btnTop.addEventListener('click', () => {
                this.angleTop = this.currentAngle;
                this.calculateHeight();
                this.setStep('result');
                Features.successFeedback();
            });
        }

        // Botão Nova Medição (Resultado -> Passo 1)
        const btnReset = document.getElementById('btn-reset-measure');
        if (btnReset) {
            btnReset.addEventListener('click', () => {
                this.resetMeasurement();
                this.setStep('distance');
            });
        }

        // Botão Salvar no Cadastro
        const btnSave = document.getElementById('btn-save-height');
        if (btnSave) {
            btnSave.addEventListener('click', () => {
                const heightVal = this.elements.inputs.resultDisplay.textContent.replace(' m', '');
                
                // Injeta no formulário principal
                const formInput = document.getElementById('risk-altura');
                if (formInput) {
                    formInput.value = heightVal;
                    Utils.showToast(`Altura de ${heightVal}m salva no formulário!`);
                }
                
                this.stop(); // Fecha o clinômetro
            });
        }

        // Listener Global para abrir o clinômetro (seja pelo menu ou botão do form)
        // Monitoramos se a view se tornou visível para ligar a câmera
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

    // === CONTROLE DA CÂMERA E SENSORES ===

    async start() {
        if (this.isRunning) return;
        this.isRunning = true;

        console.log('[Clinometer] Iniciando câmera e sensores...');
        
        // 1. Inicia Câmera
        try {
            const constraints = { 
                video: { 
                    facingMode: 'environment', // Câmera traseira
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }, 
                audio: false 
            };
            
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.elements.video.srcObject = this.stream;
            
            // Ativa Wake Lock (Tela não apaga)
            Features.requestWakeLock();

        } catch (err) {
            console.error('[Clinometer] Erro na câmera:', err);
            Utils.showToast('Erro ao acessar câmera. Verifique permissões.', 'error');
            this.stop();
            return;
        }

        // 2. Inicia Listener de Orientação
        window.addEventListener('deviceorientation', this.handleOrientationBound);
        
        // 3. Prepara UI
        this.resetMeasurement();
        this.setStep('distance');
    },

    stop() {
        if (!this.isRunning) return;
        this.isRunning = false;

        console.log('[Clinometer] Parando...');

        // 1. Para Câmera
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        this.elements.video.srcObject = null;

        // 2. Remove Sensores
        window.removeEventListener('deviceorientation', this.handleOrientationBound);
        
        // 3. Libera Recursos
        Features.releaseWakeLock();

        // 4. Esconde View (Volta para App)
        // A lógica de "Voltar" do main.js deve tratar de reexibir o conteúdo anterior
        // Aqui forçamos o fechamento da view atual
        this.elements.view.style.display = 'none';
        
        // Reabilita o botão "Voltar" do painel se estivermos no mobile
        const backBtn = document.getElementById('btn-voltar-painel');
        const nav = document.querySelector('.mapa-navegacao');
        const content = document.getElementById('manual-view');
        
        if (backBtn && window.innerWidth <= 768) {
            backBtn.style.display = 'flex';
            nav.classList.add('hidden');
            content.style.display = 'block';
        } else {
            // Desktop: mostra menu
            if (nav) {
                nav.style.display = 'block';
                nav.classList.remove('hidden');
            }
            if (content) content.style.display = 'block';
        }
    },

    // Função Bound para poder remover o listener corretamente
    handleOrientationBound(e) {
        Clinometer.handleOrientation(e);
    },

    handleOrientation(event) {
        // Beta é a inclinação frente/trás (-180 a 180)
        // 90 graus é o celular em pé (vertical)
        let beta = event.beta;
        
        if (beta === null) return;

        // Corrige para leitura intuitiva (0º = Horizonte)
        // Se celular está em pé (90), queremos ler 0.
        // Se aponta pra cima (>90), ângulo positivo.
        // Se aponta pra baixo (<90), ângulo negativo.
        
        // Ajuste fino: Depende da orientação da tela, mas assumindo Portrait:
        let angle = beta - 90; 
        
        // Suavização simples (Média móvel seria ideal, mas direto funciona bem)
        this.currentAngle = angle;
        
        // Atualiza Display
        if (this.elements.angleDisplay) {
            this.elements.angleDisplay.textContent = `${angle.toFixed(1)}°`;
            
            // Muda cor se estiver travado
            const color = Math.abs(angle) < 2 ? '#4caf50' : '#fff'; // Verde no horizonte
            this.elements.angleDisplay.style.color = color;
        }
    },

    // === LÓGICA DE NEGÓCIO ===

    setStep(stepName) {
        // Esconde todos os passos
        Object.values(this.elements.steps).forEach(el => {
            if(el) el.style.display = 'none';
            if(el) el.classList.remove('active');
        });

        // Mostra o atual
        const activeEl = this.elements.steps[stepName];
        if (activeEl) {
            activeEl.style.display = 'flex'; // Flex para centralizar
            activeEl.classList.add('active');
        }
    },

    calculateHeight() {
        // Fórmula Tangente: h = d * (tan(top) - tan(base))
        // Converter graus para radianos
        const radTop = Utils.deg2rad(this.angleTop);
        const radBase = Utils.deg2rad(this.angleBase);

        // O sinal de menos é porque o ângulo da base geralmente é negativo (olhando pra baixo)
        // Se olharmos pra cima (base alta), a matemática se mantém (subtração).
        
        // Math.tan espera radianos
        // Altura = Distancia * (tan(a) - tan(b))
        
        /* Cenário Comum:
           Topo = +45° (tan 1)
           Base = -10° (tan -0.17)
           H = 10 * (1 - (-0.17)) = 11.7m
        */
        
        let height = this.distance * (Math.tan(radTop) - Math.tan(radBase));
        
        // Garante positivo
        height = Math.abs(height);

        this.elements.inputs.resultDisplay.textContent = `${height.toFixed(1)} m`;
    },

    resetMeasurement() {
        this.angleBase = null;
        this.angleTop = null;
        this.elements.inputs.resultDisplay.textContent = "0.0 m";
    }
};

/* EXPORTAÇÃO PADRÃO */
export default Clinometer;
