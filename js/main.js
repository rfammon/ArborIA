// js/main.js (v72.0 - Integração Completa DAP e Clinômetro)

import * as state from './state.js';
import * as ui from './ui.js';
import * as features from './features.js';
import { initImageDB } from './database.js'; 
import * as modalUI from './modal.ui.js'; 
import { manualContent } from './content.js'; 
import { showToast } from './utils.js';
import * as clinometer from './clinometer.js'; 
import * as dapEstimator from './dap.estimator.js'; // [NOVO] Importação

// === 1. SELETORES GLOBAIS ===
const manualView = document.getElementById('manual-view');
const calculatorView = document.getElementById('calculadora-view');
const clinometroView = document.getElementById('clinometro-view'); 
const dapEstimatorView = document.getElementById('dap-estimator-view'); // [NOVO]
const detailView = document.getElementById('detalhe-view');
const topNavContainer = document.querySelector('.topicos-container');

// === 2. LÓGICA DE NAVEGAÇÃO ===
function handleMainNavigation(event) {
  const targetButton = event.target.closest('.topico-btn');
  if (!targetButton) return;

  // Atualiza menu
  if (topNavContainer) {
      topNavContainer.querySelectorAll('.topico-btn').forEach(btn => {
        btn.classList.remove('active');
      });
  }
  targetButton.classList.add('active');
  
  const targetId = targetButton.dataset.target;
  state.saveActiveTab(targetId);

  // 1. Desliga recursos pesados (Câmeras) ao sair
  // Importante: Só desliga se não for a própria aba alvo
  if (targetId !== 'clinometro-view') clinometer.stopClinometer();
  if (targetId !== 'dap-estimator-view') dapEstimator.stopDAPEstimator();

  // 2. Esconde TODAS as views
  if (manualView) manualView.style.display = 'none';
  if (calculatorView) calculatorView.style.display = 'none';
  if (clinometroView) clinometroView.style.display = 'none'; 
  if (dapEstimatorView) dapEstimatorView.style.display = 'none'; 

  // 3. Roteamento Lógico e Exibição
  if (targetId === 'calculadora-risco') {
    // --- CALCULADORA ---
    if (calculatorView) calculatorView.style.display = 'block';
    const activeSubTab = document.querySelector('.sub-nav-btn.active')?.dataset.target;
    if (activeSubTab === 'tab-content-mapa') {
      ui.showSubTab('tab-content-mapa');
    }
    scrollToElement('page-top');

  } else if (targetId === 'clinometro-view') {
    // --- CLINÔMETRO (ALTURA) ---
    if (clinometroView) {
        clinometroView.style.display = 'block';
        clinometer.startClinometer(); 
        // Rola para a ferramenta (UX Imersiva)
        setTimeout(() => {
            clinometroView.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }

  } else if (targetId === 'dap-estimator-view') {
    // --- ESTIMADOR DE DAP (NOVO) ---
    if (dapEstimatorView) {
        dapEstimatorView.style.display = 'block';
        dapEstimator.startDAPEstimator(); 
        // Rola para a ferramenta (UX Imersiva)
        setTimeout(() => {
            dapEstimatorView.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }

  } else {
    // --- MANUAL TÉCNICO ---
    if (manualView) manualView.style.display = 'block';
    if (manualContent && manualContent[targetId]) {
        ui.loadContent(detailView, manualContent[targetId]);
    }
    scrollToElement('page-top');
  }
}

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

  if (chatSendBtn) {
    chatSendBtn.addEventListener('click', features.handleChatSend);
    if (chatInput) chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); features.handleChatSend(); } });
  }
  if (contactForm) contactForm.addEventListener('submit', features.handleContactForm);
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
    console.log("Inicializando aplicação v72.0...");

    // 1. Dados
    state.loadDataFromStorage();
    if (typeof initImageDB === 'function') initImageDB();

    // 2. Navegação Principal
    if (topNavContainer) topNavContainer.addEventListener('click', handleMainNavigation);

    // 3. UI e Módulos
    ui.setupRiskCalculator();
    if (modalUI && typeof modalUI.initPhotoViewer === 'function') modalUI.initPhotoViewer();
    
    // 4. Inicializa Listeners das Ferramentas de Campo
    clinometer.initClinometerListeners();
    dapEstimator.initDAPEstimatorListeners(); // [NOVO]
    
    // 5. Conecta os botões pequenos do formulário às ferramentas
    const btnHeight = document.getElementById('btn-measure-height-form');
    const btnDap = document.getElementById('btn-measure-dap-form');
    
    if (btnHeight) {
        btnHeight.addEventListener('click', () => {
            // Clica no botão do menu principal para navegar corretamente
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

    // 6. Recupera Aba Inicial
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
    
    console.log("App inicializada com sucesso.");

  } catch (error) {
    console.error("Falha crítica ao inicializar:", error);
    try { showToast("Erro ao carregar aplicação.", "error"); } catch(e){}
  }
}

// === 5. PWA SERVICE WORKER ===
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then((reg) => console.log('SW registrado:', reg.scope))
      .catch((err) => console.log('Falha no SW:', err));
  });
}

initApp();
