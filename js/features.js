/* js/features.js (vFinal)
   Gerenciador de Recursos de Hardware e PWA.
   Controla: Wake Lock (Tela Ligada), Fullscreen, Vibração e Permissões.
*/

import Utils from './utils.js';

const Features = {
    wakeLockSentinel: null,

    init() {
        console.log('[Features] Inicializando gerenciador de hardware...');
        // Tenta ativar o Wake Lock automaticamente se o navegador permitir
        this.requestWakeLock();
    },

    // === 1. WAKE LOCK (Manter tela ligada durante medições) ===
    
    async requestWakeLock() {
        if ('wakeLock' in navigator) {
            try {
                this.wakeLockSentinel = await navigator.wakeLock.request('screen');
                console.log('[Features] Wake Lock ativo (Tela não desligará).');
                
                // Se a aba perder o foco e voltar, reativar
                this.wakeLockSentinel.addEventListener('release', () => {
                    console.log('[Features] Wake Lock liberado.');
                });
                
                document.addEventListener('visibilitychange', async () => {
                    if (this.wakeLockSentinel !== null && document.visibilityState === 'visible') {
                        await this.requestWakeLock();
                    }
                });

            } catch (err) {
                console.warn(`[Features] Falha no Wake Lock: ${err.name}, ${err.message}`);
            }
        } else {
            console.log('[Features] Wake Lock API não suportada neste navegador.');
        }
    },

    releaseWakeLock() {
        if (this.wakeLockSentinel) {
            this.wakeLockSentinel.release();
            this.wakeLockSentinel = null;
        }
    },

    // === 2. FULLSCREEN (Imersão para Câmera) ===

    toggleFullScreen(element = document.documentElement) {
        if (!document.fullscreenElement) {
            if (element.requestFullscreen) {
                element.requestFullscreen().catch(err => {
                    console.warn(`[Features] Erro ao entrar em tela cheia: ${err.message}`);
                });
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    },

    // === 3. PERMISSÕES DE SENSOR (iOS 13+ requer permissão manual) ===

    async requestDeviceOrientation() {
        // Dispositivos Android/PC geralmente não precisam disso
        if (typeof DeviceOrientationEvent !== 'undefined' && 
            typeof DeviceOrientationEvent.requestPermission === 'function') {
            
            try {
                const response = await DeviceOrientationEvent.requestPermission();
                if (response === 'granted') {
                    Utils.showToast('Sensores calibrados!', 'success');
                    return true;
                } else {
                    Utils.showToast('Permissão de sensores negada.', 'error');
                    return false;
                }
            } catch (error) {
                console.error(error);
                return false;
            }
        }
        return true; // Não requer permissão explícita (Android)
    },

    // === 4. FEEDBACK HÁPTICO (Vibração) ===

    vibrate(pattern = 50) {
        if ('vibrate' in navigator) {
            navigator.vibrate(pattern);
        }
    },

    // Feedback tátil suave para cliques de UI
    hapticFeedback() {
        this.vibrate(10); 
    },
    
    // Feedback mais forte para confirmações (ex: Capturar Foto)
    successFeedback() {
        this.vibrate([50, 30, 50]);
    }
};

/* EXPORTAÇÃO PADRÃO PARA CORRIGIR ERRO DE MODULE */
export default Features;
