// js/main.js (v2.0 - Maestro do ArborIA 2.0)

import * as state from './state.js';
// AQUI: Mudamos para import desestruturado pois o novo ui.js exporta 'UI' const
import { UI } from './ui.js'; 
import { TooltipUI } from './tooltip.ui.js'; // NOVO: Glossário

import * as features from './features.js';
import { initImageDB } from './database.js'; 
import * as modalUI from './modal.ui.js'; 
import { manualContent } from './content.js'; 
import { showToast } from './utils.js';
import * as clinometer from './clinometer.js'; 
import * as dapEstimator from './dap.estimator.js';
// Se existir lógica de formulário específica, garanta que features trate isso

// === 1. SELETORES GLOBAIS ===
// Mantidos para compatibilidade com lógica legado, embora UI.js gerencie a maioria
const manualView = document.getElementById('manual-view');
const detailView = document.getElementById('detalhe-view');
const topNavContainer = document.querySelector('.topicos-container'); // Agora é Grid/Flex

// === 2. LÓGICA DE NAVEGAÇÃO (CORE) ===
/**
 * Gerencia a troca de abas, ciclo de vida dos sensores e carregamento de conteúdo.
 * A parte visual (esconder/mostrar) agora é delegada ao UI.navigateTo.
 */
function handleMainNavigation(event) {
  // Detecta clique no botão ou dentro dele (ícone/texto)
  const targetButton = event.target.closest('.topico-btn');
  if (!targetButton) return;

  const targetId = targetButton.dataset.target;
  
  // Salva estado
  state.saveActiveTab(targetId);

  // 1. CICLO DE VIDA DE SENSORES (Crítico: Desliga câmeras ao sair)
  if (targetId !== 'clinometro-view') clinometer.stopClinometer();
  if (targetId !== 'dap-estimator-view') dapEstimator.stopDAPEstimator();

  // 2. DELEGAÇÃO VISUAL (O novo UI Controller faz a mágica do SPA)
  UI.navigateTo(targetId);

  // 3. LÓGICA ESPECÍFICA POR ABA
  if (targetId === 'calculadora-view') { // Nota: ID ajustado para bater com o HTML novo
    // Se tiver lógica de restaurar sub-aba, o UI.js já trata no initSubTabs
    // Apenas garantimos scroll top
    window.scrollTo({ top: 0, behavior: 'smooth' });

  } else if (targetId === 'clinometro-view') {
    // Inicia Hardware
    clinometer.startClinometer();
    // O CSS fullscreen-app já cuida do layout, não precisa de scrollIntoView complexo

  } else if (targetId === 'dap-estimator-view') {
    // Inicia Hardware
    dapEstimator.startDAPEstimator();

  } else {
    // --- ABA: MANUAL TÉCNICO ---
    // Carrega o conteúdo dinâmico do texto
    if (manualContent && manualContent[targetId]) {
        loadManualContent(targetId);
    } else {
        // Fallback se não achar conteúdo
        if(detailView) detailView.innerHTML = `<h3>${targetButton.innerText}</h3><p>Conteúdo em desenvolvimento.</p>`;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

/**
 * Carrega conteúdo HTML dentro da view de detalhes
 * (Substitui o antigo ui.loadContent)
 */
function loadManualContent(topicId) {
    if (!detailView) return;
    
    // Efeito simples de fade
    detailView.style.opacity = 0;
    setTimeout(() => {
        detailView.innerHTML = manualContent[topicId];
        detailView.style.opacity = 1;
        // Reinicializa tooltips dentro do novo conteúdo carregado, se necessário
    }, 150);
}


// === 3. HELPERS DE FORMULÁRIO E UI ===
// (Trazido do antigo ui.js ou adaptado para manter funcionamento)

function setupBackToTop() {
  const backToTopBtn = document.getElementById('back-to-top-btn');
  if (!backToTopBtn) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 300) backToTopBtn.style.display = 'block';
    else backToTopBtn.style.display = 'none';
  }, { passive: true });
}

function setupForms() {
  const chatSendBtn = document.getElementById('chat-send-btn');
  const chatInput = document.getElementById('chat-input');
  const contactForm = document.getElementById('contact-form');
  const riskForm = document.getElementById('risk-calculator-form');

  // Chat IA
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

  // Formulário de Risco (Conexão com Features)
  if (riskForm) {
      riskForm.addEventListener('submit', (e) => {
          e.preventDefault();
          if (features.handleAddTree) features.handleAddTree(e);
      });
      
      const resetBtn = document.getElementById('reset-risk-form-btn');
      if(resetBtn) resetBtn.addEventListener('click', () => riskForm.reset());
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
    console.log("🚀 Inicializando ArborIA 2.0...");

    // 1. Inicializa UI Controllers (Novo Sistema)
    UI.init();        // Navegação e Layout
    TooltipUI.init(); // Glossário Inteligente

    // 2. Carrega Dados
    state.loadDataFromStorage();
    if (typeof initImageDB === 'function') initImageDB();

    // 3. Configura Navegação Principal (Listener no Container)
    if (topNavContainer) topNavContainer.addEventListener('click', handleMainNavigation);

    // 4. Inicializa Componentes Visuais Legado
    if (modalUI && typeof modalUI.initPhotoViewer === 'function') {
        modalUI.initPhotoViewer();
    }
    
    // 5. Inicializa Listeners das Ferramentas de Campo (Sensores)
    clinometer.initClinometerListeners();
    dapEstimator.initDAPEstimatorListeners();
    
    // 6. Atalhos do Formulário (Botões de Régua -> Abrem Ferramenta)
    const btnHeight = document.getElementById('btn-measure-height-form');
    const btnDap = document.getElementById('btn-measure-dap-form');
    
    if (btnHeight) {
        btnHeight.addEventListener('click', () => {
            // Usa UI.navigateTo diretamente para consistência
            // Mas precisamos simular o comportamento de menu para ativar abas
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

    // 7. Configurações Finais
    initFormDefaults();
    setupForms();
    setupBackToTop();

    // 8. Restaura Estado (Última aba visitada)
    const lastTab = state.getActiveTab() || 'conceitos-basicos'; // Padrão
    
    // Simula clique para navegar corretamente com animações
    let initialButton = null;
    if (topNavContainer) {
        initialButton = topNavContainer.querySelector(`.topico-btn[data-target="${lastTab}"]`);
    }
    
    if (initialButton) {
      initialButton.click();
    } else {
      // Fallback
      UI.navigateTo('calculadora-view'); // Ou outra view padrão
    }
    
    console.log("✅ ArborIA 2.0 Pronto.");

  } catch (error) {
    console.error("❌ Falha crítica ao inicializar:", error);
    try { UI.showToast("Erro ao carregar aplicação.", "error"); } catch(e){}
  }
}

// === 5. REGISTRO DO SERVICE WORKER (PWA) ===
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then((reg) => console.log('SW registrado:', reg.scope))
      .catch((err) => console.log('Falha no SW:', err));
  });
}

// Executa a aplicação
document.addEventListener('DOMContentLoaded', initApp);
