// js/main.js (v87.0 - Fix Import modalUI)

import * as ui from './ui.js';
import * as db from './database.js';
import * as state from './state.js';
import * as modalUI from './modal.ui.js'; // [CORREÇÃO] Importação adicionada
import { manualContent } from './content.js';
import { showToast } from './utils.js';
import * as chat from './chat.js';
import * as features from './features.js';
import * as clinometer from './clinometer.js';
import * as dapEstimator from './dap.estimator.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // 1. Inicialização do Banco de Dados
        await db.initDB();
        await state.loadStateFromDB();

        console.log("ArborIA inicializado v87.0");

        // Referências DOM
        const detailView = document.getElementById('detalhe-view');
        const navButtons = document.querySelectorAll('.topico-btn');
        const backToTopBtn = document.getElementById('back-to-top-btn');
        const calculatorView = document.getElementById('calculadora-view');
        const clinometerView = document.getElementById('clinometro-view');
        const dapEstimatorView = document.getElementById('dap-estimator-view');
        const chatSendBtn = document.getElementById('chat-send-btn');
        const chatInput = document.getElementById('chat-input');
        const contactForm = document.getElementById('contact-form');

        // Estado da Aplicação
        let currentManualTopic = 'conceitos-basicos';
        
        // === Funções de Navegação ===
        function showView(viewId) {
            // Esconde todas as views
            document.querySelectorAll('.app-view, .conteudo-detalhe').forEach(view => {
                // Garante que escondemos as views principais
                if(view.id === 'manual-view' || view.id === 'calculadora-view' || view.id === 'clinometro-view' || view.id === 'dap-estimator-view') {
                    view.style.display = 'none';
                }
            });

            // Mostra a view específica
            const viewToShow = document.getElementById(viewId);
            if (viewToShow) {
                viewToShow.style.display = 'block';

                // Lógica específica para cada view (Ligar/Desligar Câmeras)
                if (viewId === 'clinometro-view') {
                    clinometer.startClinometer();
                } else {
                    clinometer.stopClinometer(); 
                }

                if (viewId === 'dap-estimator-view') {
                    dapEstimator.startDAPEstimator();
                } else {
                    dapEstimator.stopDAPEstimator(); 
                }
            }
        }

        function loadManualTopic(topicKey) {
            if (!detailView) return;
            if (manualContent[topicKey]) {
                ui.loadContent(detailView, manualContent[topicKey]);
                currentManualTopic = topicKey;
            }
            
            // Ativa o botão de navegação correspondente
            navButtons.forEach(btn => {
                if (btn.dataset.target === topicKey) btn.classList.add('active');
                else btn.classList.remove('active');
            });
            
            showView('manual-view');
        }

        // === Event Listeners ===

        // Navegação Principal
        navButtons.forEach(button => {
            button.addEventListener('click', () => {
                const target = button.dataset.target;
                
                if (target === 'calculadora-risco') {
                    showView('calculadora-view');
                    navButtons.forEach(b => b.classList.remove('active'));
                    button.classList.add('active');
                } else if (target === 'clinometro-view') {
                    showView('clinometro-view');
                    navButtons.forEach(b => b.classList.remove('active'));
                    button.classList.add('active');
                } else if (target === 'dap-estimator-view') {
                    showView('dap-estimator-view');
                    navButtons.forEach(b => b.classList.remove('active'));
                    button.classList.add('active');
                } else {
                    loadManualTopic(target);
                }
                
                ui.hideTooltip();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        });

        // Botões de Fechar Ferramentas
        document.getElementById('close-clinometer')?.addEventListener('click', () => {
            clinometer.stopClinometer();
            loadManualTopic(currentManualTopic); 
        });
        document.getElementById('close-dap-estimator')?.addEventListener('click', () => {
            dapEstimator.stopDAPEstimator();
            loadManualTopic(currentManualTopic); 
        });

        // Botão Voltar ao Topo
        if (backToTopBtn) {
            window.addEventListener('scroll', () => {
                if (window.scrollY > 300) backToTopBtn.classList.add('show');
                else backToTopBtn.classList.remove('show');
            });
            backToTopBtn.addEventListener('click', (e) => {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }

        // Chatbot
        if (chatSendBtn && chatInput) {
            chatSendBtn.addEventListener('click', chat.handleChatInput);
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') chat.handleChatInput();
            });
        }

        // Contact Form
        if (contactForm) {
            contactForm.addEventListener('submit', features.handleContactForm);
        }

        // Inicialização da UI
        ui.setupRiskCalculator();
        
        clinometer.initClinometerListeners();
        dapEstimator.initDAPEstimatorListeners();
        
        // Inicializa Photo Viewer se existir
        if (modalUI && typeof modalUI.initPhotoViewer === 'function') {
            modalUI.initPhotoViewer();
        }

        // Carrega conteúdo inicial
        loadManualTopic(currentManualTopic);

    } catch (error) {
        console.error("Erro fatal no main.js:", error);
        showToast("Erro ao inicializar app.", "error");
    }
});

// PWA Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then(reg => console.log('SW OK:', reg.scope))
            .catch(err => console.log('SW Falha:', err));
    });
}
