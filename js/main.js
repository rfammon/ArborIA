// js/main.js (v2.5 - Maestro do ArborIA 2.0 - Flash Card Integration)

import * as state from './state.js';
import { UI } from './ui.js'; 
import { TooltipUI } from './tooltip.ui.js';
import { TableUI } from './table.ui.js';

import * as features from './features.js';
import { initImageDB } from './database.js'; 
import * as modalUI from './modal.ui.js'; 
import * as mapUI from './map.ui.js'; 

import { manualContent } from './content.js'; 
import { showToast } from './utils.js';
import * as clinometer from './clinometer.js'; 
import * as dapEstimator from './dap.estimator.js';

// Tenta importar o gerador de PDF dinamicamente
let pdfGenerator = null;
try {
    // pdfGenerator = await import('./pdf.generator.js');
} catch (e) {
    console.warn("Módulo de PDF não encontrado.", e);
}

// === 1. SELETORES GLOBAIS ===
const detailView = document.getElementById('detalhe-view');
const topNavContainer = document.querySelector('.topicos-container');

// === 2. LÓGICA DE NAVEGAÇÃO (CORE) ===
function handleMainNavigation(event) {
  const targetButton = event.target.closest('.topico-btn');
  if (!targetButton) return;

  const targetId = targetButton.dataset.target;
  state.saveActiveTab(targetId);

  // 1. CICLO DE VIDA DE SENSORES
  if (targetId !== 'clinometro-view') clinometer.stopClinometer();
  if (targetId !== 'dap-estimator-view') dapEstimator.stopDAPEstimator();

  // 2. DELEGAÇÃO VISUAL (SPA)
  UI.navigateTo(targetId);

  // 3. LÓGICA ESPECÍFICA POR ABA
  if (targetId === 'calculadora-view') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    TableUI.render();
    
    // [MAP FIX] Se a última sub-aba ativa era o mapa, força resize
    const mapTab = document.getElementById('tab-content-mapa');
    if (mapTab && mapTab.style.display === 'block') {
        setTimeout(() => mapUI.prepareMapForScreenshot(), 100);
    }

  } else if (targetId === 'clinometro-view') {
    clinometer.startClinometer();

  } else if (targetId === 'dap-estimator-view') {
    dapEstimator.startDAPEstimator();

  } else {
    // --- MANUAL TÉCNICO ---
    if (manualContent && manualContent[targetId]) {
        loadManualContent(targetId);
    } else {
        if(detailView) detailView.innerHTML = `<h3>Conteúdo em Breve</h3><p>O tópico <strong>${targetId}</strong> está em desenvolvimento.</p>`;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function loadManualContent(topicId) {
    if (!detailView) return;
    detailView.style.opacity = 0;
    setTimeout(() => {
        const content = typeof manualContent[topicId] === 'object' ? manualContent[topicId].html : manualContent[topicId];
        const title = typeof manualContent[topicId] === 'object' ? `<h3>${manualContent[topicId].titulo}</h3>` : '';
        const finalHTML = (content.includes('<h3>') || !title) ? content : title + content;
        
        detailView.innerHTML = finalHTML;
        detailView.style.opacity = 1;
    }, 150);
}

// === 3. CONEXÃO DOS BOTÕES DE AÇÃO ===
function setupActionButtons() {
    console.log("🔌 Conectando botões de ação...");

    // --- FORMULÁRIO DE RISCO ---
    const riskForm = document.getElementById('risk-calculator-form');
    if (riskForm) {
        riskForm.addEventListener('submit', (e) => {
            const result = features.handleAddTreeSubmit(e); 
            if (result && result.success) {
                TableUI.render(); 
                mapUI.initializeMap(); 
                
                const summaryTab = document.querySelector('.sub-nav-btn[data-target="tab-content-summary"]');
                if (summaryTab) summaryTab.click();
            }
        });
        
        const resetBtn = document.getElementById('reset-risk-form-btn');
        if(resetBtn) resetBtn.addEventListener('click', () => {
            riskForm.reset();
            features.clearPhotoPreview();
        });
    }

    // --- [NOVO] CHECKLIST FLASH CARD ---
    const openChecklistBtn = document.getElementById('open-checklist-btn');
    if (openChecklistBtn) {
        openChecklistBtn.addEventListener('click', () => {
            // Chama a nova função do features.js (v80.0)
            if (typeof features.initChecklistFlashCard === 'function') {
                features.initChecklistFlashCard();
            } else {
                console.error("Função initChecklistFlashCard não encontrada no features.js");
            }
        });
    }

    // --- GPS ---
    const gpsBtn = document.getElementById('get-gps-btn');
    if (gpsBtn) gpsBtn.addEventListener('click', features.handleGetGPS);

    // --- IMPORTAÇÃO / EXPORTAÇÃO ---
    const btnImport = document.getElementById('import-data-btn');
    const inputZip = document.getElementById('zip-importer');
    
    if (btnImport && inputZip) {
        btnImport.addEventListener('click', () => inputZip.click()); 
        inputZip.addEventListener('change', async (e) => {
            await features.handleImportZip(e);
            TableUI.render(); 
            mapUI.initializeMap(); 
        });
    }

    const btnExport = document.getElementById('export-data-btn');
    if (btnExport) {
        btnExport.addEventListener('click', features.exportActionZip); 
    }

    // --- GERAR PDF ---
    const btnPdf = document.getElementById('generate-pdf-btn');
    if (btnPdf) {
        btnPdf.addEventListener('click', () => {
            if (pdfGenerator && typeof pdfGenerator.generatePDF === 'function') {
                pdfGenerator.generatePDF(state.registeredTrees);
            } else {
                features.sendEmailReport(); 
            }
        });
    }

    // --- LIMPAR BANCO ---
    const btnClear = document.getElementById('clear-all-btn');
    if (btnClear) {
        btnClear.addEventListener('click', () => {
            modalUI.showConfirmModal(
                "Excluir Tudo?", 
                "Esta ação apagará todas as árvores e fotos. Confirma?", 
                () => {
                    features.handleClearAll();
                    TableUI.render();
                    mapUI.initializeMap(); 
                }
            );
        });
    }

    // --- FILTRO DA TABELA ---
    const filterInput = document.getElementById('table-filter-input');
    if(filterInput) filterInput.addEventListener('keyup', features.handleTableFilter);

    // --- CHAT & CONTATO ---
    const chatSendBtn = document.getElementById('chat-send-btn');
    const chatInput = document.getElementById('chat-input');
    if (chatSendBtn) chatSendBtn.addEventListener('click', features.handleChatSend);
    if (chatInput) chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') features.handleChatSend(); });
}

// === 4. ATALHOS DE FERRAMENTAS ===
function setupToolShortcuts() {
    const btnHeight = document.getElementById('btn-measure-height-form');
    const btnDap = document.getElementById('btn-measure-dap-form');
    
    if (btnHeight) {
        btnHeight.addEventListener('click', () => {
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
}

function setupBackToTop() {
  const backToTopBtn = document.getElementById('back-to-top-btn');
  if (!backToTopBtn) return;
  window.addEventListener('scroll', () => {
    if (window.scrollY > 300) backToTopBtn.style.display = 'block';
    else backToTopBtn.style.display = 'none';
  }, { passive: true });
}

function initFormDefaults() {
    try {
      const dateInput = document.getElementById('risk-data');
      if (dateInput && !dateInput.value) dateInput.value = new Date().toISOString().split('T')[0];
      
      const avaliadorInput = document.getElementById('risk-avaliador');
      if (avaliadorInput && state.lastEvaluatorName) avaliadorInput.value = state.lastEvaluatorName;
    } catch(e) { console.warn(e); }
}

// === 5. INICIALIZAÇÃO PRINCIPAL ===
async function initApp() {
  try {
    console.log("🚀 Inicializando ArborIA 2.0...");

    // 1. Inicializa UI Base
    UI.init();
    TooltipUI.init();
    if (modalUI && typeof modalUI.initPhotoViewer === 'function') modalUI.initPhotoViewer();

    // 2. Carrega Dados
    state.loadDataFromStorage();
    if (typeof initImageDB === 'function') await initImageDB(); 

    // 3. Configura Listeners
    if (topNavContainer) topNavContainer.addEventListener('click', handleMainNavigation);
    setupActionButtons(); 
    setupToolShortcuts();
    setupBackToTop();
    initFormDefaults();
    
    // 4. Inicializa Componentes Complexos
    mapUI.initializeMap();
    mapUI.setupMapListeners();
    
    clinometer.initClinometerListeners();
    dapEstimator.initDAPEstimatorListeners();

    // [NOTA] Não iniciamos mais o checklist automaticamente aqui.
    // Ele é iniciado apenas pelo clique do botão #open-checklist-btn

    // 5. Renderiza Tabela Inicial
    TableUI.render();

    // 6. Listener Global de Resize (Mapa)
    window.addEventListener('resize', () => {
        const mapContainer = document.getElementById('map-container');
        if (mapContainer && mapContainer.offsetParent !== null) {
            mapUI.initializeMap(); 
            if (state.mapInstance) state.mapInstance.invalidateSize();
        }
    });

    // 7. Restaura Estado
    const lastTab = state.getActiveTab() || 'conceitos-basicos';
    let initialButton = null;
    if (topNavContainer) {
        initialButton = topNavContainer.querySelector(`.topico-btn[data-target="${lastTab}"]`);
    }
    
    if (initialButton) {
      initialButton.click();
    } else {
      UI.navigateTo('calculadora-view');
    }
    
    console.log("✅ ArborIA 2.0 Pronto.");

  } catch (error) {
    console.error("❌ Falha crítica ao inicializar:", error);
    try { UI.showToast("Erro ao carregar aplicação.", "error"); } catch(e){}
  }
}

// === 6. SERVICE WORKER (PWA) ===
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .catch((err) => console.log('SW Falhou:', err));
  });
}

// Executa a aplicação
document.addEventListener('DOMContentLoaded', initApp);
