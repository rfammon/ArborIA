// js/main.js (v78.0 - Maestro do ArborIA)

import * as state from './state.js';
import * as ui from './ui.js';
import * as features from './features.js';
import { initImageDB } from './database.js'; 
import * as modalUI from './modal.ui.js'; 
import { manualContent } from './content.js'; 
import { showToast } from './utils.js';
import * as clinometer from './clinometer.js'; 
import * as dapEstimator from './dap.estimator.js';

// === 1. SELETORES GLOBAIS ===
const manualView = document.getElementById('manual-view');
const calculatorView = document.getElementById('calculadora-view');
const clinometroView = document.getElementById('clinometro-view'); 
const dapEstimatorView = document.getElementById('dap-estimator-view'); 
const detailView = document.getElementById('detalhe-view');
const topNavContainer = document.querySelector('.topicos-container');

// === 2. LÓGICA DE NAVEGAÇÃO ===
function handleMainNavigation(event) {
  const targetButton = event.target.closest('.topico-btn');
  if (!targetButton) return;

  // Atualiza classe ativa no menu
  if (topNavContainer) {
      topNavContainer.querySelectorAll('.topico-btn').forEach(btn => {
        btn.classList.remove('active');
      });
  }
  targetButton.classList.add('active');
  
  const targetId = targetButton.dataset.target;
  state.saveActiveTab(targetId);

  // 1. Desliga recursos pesados (Câmeras/Sensores) ao sair das abas específicas
  if (targetId !== 'clinometro-view') clinometer.stopClinometer();
  if (targetId !== 'dap-estimator-view') dapEstimator.stopDAPEstimator();

  // 2. Esconde todas as views de aplicativo
  if (manualView) manualView.style.display = 'none';
  if (calculatorView) calculatorView.style.display = 'none';
  if (clinometroView) clinometroView.style.display = 'none'; 
  if (dapEstimatorView) dapEstimatorView.style.display = 'none'; 

  // 3. Roteamento Lógico e Exibição
  if (targetId === 'calculadora-risco') {
    // --- ABA: CALCULADORA ---
    if (calculatorView) calculatorView.style.display = 'block';
    
    // Restaura a sub-aba ativa (Registro, Resumo ou Mapa)
    const activeSubTab = document.querySelector('.sub-nav-btn.active')?.dataset.target;
    if (activeSubTab === 'tab-content-mapa') {
      ui.showSubTab('tab-content-mapa');
    }
    scrollToElement('page-top');

  } else if (targetId === 'clinometro-view') {
    // --- ABA: CLINÔMETRO (ALTURA) ---
    if (clinometroView) {
        clinometroView.style.display = 'block';
        clinometer.startClinometer(); // Liga Câmera
        // Rola suavemente para a ferramenta (UX Imersiva)
        setTimeout(() => {
            clinometroView.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }

  } else if (targetId === 'dap-estimator-view') {
    // --- ABA: MEDIDOR DE DAP ---
    if (dapEstimatorView) {
        dapEstimatorView.style.display = 'block';
        dapEstimator.startDAPEstimator(); // Liga Câmera
        setTimeout(() => {
            dapEstimatorView.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }

  } else {
    // --- ABA: MANUAL TÉCNICO ---
    if (manualView) manualView.style.display = 'block';
    
    // Carrega o conteúdo dinâmico do manual
    if (manualContent && manualContent[targetId]) {
        ui.loadContent(detailView, manualContent[targetId]);
    }
    scrollToElement('page-top');
  }
}

// Helper para rolar a tela
function scrollToElement(elementId) {
    const el = document.getElementById(elementId);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
}

// === 3. HELPERS DE INICIALIZAÇÃO ===
function setupBackToTop() {
  const backToTopBtn = document.getElementById('back-to-top-btn');
  if (!backToTopBtn) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 300) backToTopBtn.classList.add('show');
    else backToTopBtn.classList.remove('show');
  }, { passive: true });
}

function setupForms() {
  const chatSendBtn = document.getElementById('chat-send-btn');
  const chatInput = document.getElementById('chat-input');
  const contactForm = document.getElementById('contact-form');

  // Chat IA (Stub)
  if (chatSendBtn) {
    chatSendBtn.addEventListener('click', features.handleChatSend);
    if (chatInput) {
        chatInput.addEventListener('keydown', (e) => { 
            if (e.key === 'Enter') { 
                e.preventDefault(); 
                features.handleChatSend(); 
            } 
        });
    }
  }
  
  // Formulário de Contato
  if (contactForm) {
      contactForm.addEventListener('submit', features.handleContactForm);
  }
}

function initFormDefaults() {
    try {
      const dateInput = document.getElementById('risk-data');
      if (dateInput && !dateInput.value) dateInput.value = new Date().toISOString().split('T')[0];
      
      const avaliadorInput = document.getElementById('risk-avaliador');
      if (avaliadorInput && state.lastEvaluatorName) avaliadorInput.value = state.lastEvaluatorName;
    } catch(e) { console.warn(e); }
}

// === 4. INICIALIZAÇÃO PRINCIPAL ===
function initApp() {
  try {
    console.log("Inicializando ArborIA v78.0...");

    // 1. Carrega Dados e Banco de Imagens
    state.loadDataFromStorage();
    if (typeof initImageDB === 'function') initImageDB();

    // 2. Configura Navegação Principal
    if (topNavContainer) topNavContainer.addEventListener('click', handleMainNavigation);

    // 3. Inicializa UI e Módulos
    ui.setupRiskCalculator();
    
    if (modalUI && typeof modalUI.initPhotoViewer === 'function') {
        modalUI.initPhotoViewer();
    }
    
    // 4. Inicializa Listeners das Ferramentas de Campo
    clinometer.initClinometerListeners();
    dapEstimator.initDAPEstimatorListeners();
    
    // 5. Conecta os botões de atalho do formulário (ícones de régua) às ferramentas
    const btnHeight = document.getElementById('btn-measure-height-form');
    const btnDap = document.getElementById('btn-measure-dap-form');
    
    if (btnHeight) {
        btnHeight.addEventListener('click', () => {
            // Simula clique na navegação principal para ativar a lógica correta
            const navBtn = document.querySelector('.topico-btn[data-target="clinometro-view"]');
            if (navBtn) navBtn.click();
        });
    }
    if (btnDap) {
        btnDap.addEventListener('click', () => {
            const navBtn = document.querySelector('.topico-btn[data-target="dap-estimator-view"]');
            if (navBtn) navBtn.click();
        });
    }

    initFormDefaults();
    setupForms();
    setupBackToTop();

    // 6. Recupera a última aba acessada ou vai para o início
    const lastTab = state.getActiveTab() || 'conceitos-basicos';
    let initialButton = null;
    
    if (topNavContainer) {
        initialButton = topNavContainer.querySelector(`[data-target="${lastTab}"]`) || topNavContainer.querySelector('.topico-btn');
    }
    
    if (initialButton) {
      initialButton.click();
    } else if (detailView && manualContent['conceitos-basicos']) {
        ui.loadContent(detailView, manualContent['conceitos-basicos']);
    }
    
    console.log("ArborIA inicializado com sucesso.");

  } catch (error) {
    console.error("Falha crítica ao inicializar:", error);
    try { showToast("Erro ao carregar aplicação.", "error"); } catch(e){}
  }
}

// === 5. REGISTRO DO SERVICE WORKER (PWA) ===
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then((reg) => console.log('Service Worker registrado:', reg.scope))
      .catch((err) => console.log('Falha no Service Worker:', err));
  });
}

// Executa a aplicação
initApp();
