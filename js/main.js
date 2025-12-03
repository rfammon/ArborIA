// js/main.js (v2.9 - Patch Applied for CRUD)

import * as state from './state.js';
import { UI } from './ui.js'; 
import { TooltipUI } from './tooltip.ui.js';
import { TableUI } from './table.ui.js';
import { AuthUI } from './auth.ui.js'; 
import { SyncUI } from './sync.ui.js';
import { ApiService } from './supabase-client.js';
import { SyncService } from './sync.service.js'; 

import { 
    handleAddTreeSubmit, 
    clearPhotoPreview, 
    handleGetGPS, 
    handleImportZip, 
    exportActionZip, 
    sendEmailReport, 
    handleClearAll, 
    handleTableFilter,
    initChecklistFlashCard
} from './features_patch_v2.js';

import { initImageDB, getImageFromDB } from './database.js'; 
import * as modalUI from './modal.ui.js'; 
import * as mapUI from './map.ui.js'; 

import { manualContent } from './content.js'; 
import * as utils from './utils.js';
import * as clinometer from './clinometer.js'; 
import * as dapEstimator from './dap.estimator.js';
import { PlanningModule } from './arboria-module.js';

let pdfGenerator = null;

// === 1. SELETORES GLOBAIS ===
const detailView = document.getElementById('detalhe-view');
const topNavContainer = document.querySelector('.topicos-container');

// === 2. LÓGICA DE NAVEGAÇÃO (CORE) ===
function handleMainNavigation(event, treeId = null) {
  const targetButton = event.target.closest('.topico-btn');
  if (!targetButton) return;

  const targetId = targetButton.dataset.target;
  state.saveActiveTab(targetId);

  // 1. CICLO DE VIDA DE SENSORES E MÓDULOS
  if (targetId !== 'clinometro-view') clinometer.stopClinometer();
  if (targetId !== 'dap-estimator-view') dapEstimator.stopDAPEstimator();
  if (targetId === 'plano-intervencao-view') {
    openPlanningModule(treeId);
  } else {
    PlanningModule.unmount();
  }

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

async function openPlanningModule(treeId = null) {
    let treesToProcess = state.registeredTrees;

    if (treeId) {
        treesToProcess = state.registeredTrees.filter(tree => tree.id === treeId);
        if (treesToProcess.length === 0) {
            utils.showToast(`Árvore ID ${treeId} não encontrada.`, "error");
            return;
        }
    }

    const trees = treesToProcess.map(tree => ({
        ...tree,
        species: tree.especie,
        location: tree.local,
        riskLevel: tree.riskLevel || 'Não Avaliado',
        residualRisk: tree.residualRisk || tree.riskLevel,
        failureProb: tree.failureProb || '-',
        targetType: tree.targetType || '-',
        mitigation: tree.mitigation || 'nenhuma',
        riskFactorsCode: tree.riskFactors ? tree.riskFactors.join(',') : '',
        defects: tree.observacoes ? [tree.observacoes] : [],
        riskScore: tree.pontuacao,
        date: tree.data,
        dap: tree.dap,
        height: tree.altura,
        suggestedIntervention: tree.mitigation 
    }));

    const treesWithImages = await Promise.all(trees.map(async (tree) => {
        if (tree.hasPhoto && tree.photoUrl) {
            return { ...tree, image: tree.photoUrl }; // Use the URL directly
        }
        return tree;
    }));

    const container = document.getElementById('planning-module-root');
    if (!container) {
        utils.showToast("Erro interno: Elemento de visualização não encontrado.", "error");
        return;
    }

    PlanningModule.mount('planning-module-root', {
        trees: treesWithImages,
        currentUser: document.getElementById('risk-avaliador')?.value || 'Usuário',
        onSavePlan: (plan) => {
            utils.showToast("Plano Salvo!", "success");
            document.querySelector('.topico-btn[data-target="calculadora-view"]')?.click();
        },
        onCancel: () => {
            document.querySelector('.topico-btn[data-target="calculadora-view"]')?.click();
        },
        onNavigateToPlanningForm: (tId) => {
            handleMainNavigation({ target: { closest: () => ({ dataset: { target: 'plano-intervencao-view' } }) } }, tId);
        }
    }, treeId);
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

    // --- NAVEGAÇÃO INTERNA ---
    const backToSummaryBtn = document.getElementById('back-to-summary-btn');
    if (backToSummaryBtn) {
        backToSummaryBtn.addEventListener('click', () => {
            const summaryNavBtn = document.querySelector('.topico-btn[data-target="calculadora-view"]');
            if (summaryNavBtn) summaryNavBtn.click();
        });
    }

    // --- FORMULÁRIO DE RISCO ---
    const riskForm = document.getElementById('risk-calculator-form');
    if (riskForm) {
        riskForm.addEventListener('submit', async (e) => {
            // [PATCH] Usa a função corrigida
            const result = await handleAddTreeSubmit(e); 
            if (result && result.success) {
                TableUI.render(); 
                mapUI.updateMapData(true); 
                const summaryTab = document.querySelector('.sub-nav-btn[data-target="tab-content-summary"]');
                if (summaryTab) summaryTab.click();
            }
        });
        
        const resetBtn = document.getElementById('reset-risk-form-btn');
        if(resetBtn) resetBtn.addEventListener('click', () => {
            riskForm.reset();
            clearPhotoPreview();
        });
    }

    // --- CHECKLIST FLASH CARD ---
    const openFlashcardBtn = document.getElementById('open-flashcard-btn');
    if (openFlashcardBtn) {
      openFlashcardBtn.addEventListener('click', () => {
        const checklistView = document.getElementById('checklist-flashcard-view');
        if (checklistView) {
          checklistView.classList.add('active'); 
          if (typeof initChecklistFlashCard === 'function') {
            initChecklistFlashCard();
          }
        }
      });
    }

    const closeChecklistBtn = document.getElementById('close-checklist-btn');
    if (closeChecklistBtn) {
      closeChecklistBtn.addEventListener('click', () => {
        const checklistView = document.getElementById('checklist-flashcard-view');
        if (checklistView) checklistView.classList.remove('active');
      });
    }

    // --- GPS ---
    const gpsBtn = document.getElementById('get-gps-btn');
    if (gpsBtn) gpsBtn.addEventListener('click', handleGetGPS);

    // --- IMPORTAÇÃO / EXPORTAÇÃO ---
    const btnImport = document.getElementById('import-data-btn');
    const inputZip = document.getElementById('zip-importer');
    if (btnImport && inputZip) {
        btnImport.addEventListener('click', () => inputZip.click()); 
        inputZip.addEventListener('change', async (e) => {
            await handleImportZip(e);
            TableUI.render(); 
            mapUI.updateMapData(true); 
        });
    }

    const btnExport = document.getElementById('export-data-btn');
    if (btnExport) btnExport.addEventListener('click', exportActionZip); 

    // --- GERAR PDF ---
    const btnPdf = document.getElementById('generate-pdf-btn');
    if (btnPdf) {
        btnPdf.addEventListener('click', () => {
            if (pdfGenerator && typeof pdfGenerator.generateGeneralReport === 'function') {
                pdfGenerator.generateGeneralReport(state.registeredTrees);
            } else {
                utils.showToast("Módulo de relatório não carregado. Recarregue a página.", "error");
            }
        });
    }

    const btnEmail = document.getElementById('send-email-btn');
    if (btnEmail) btnEmail.addEventListener('click', sendEmailReport);

    // --- LIMPAR BANCO ---
    const btnClear = document.getElementById('clear-all-btn');
    if (btnClear) {
        btnClear.addEventListener('click', () => {
            modalUI.showConfirmModal(
                "Excluir Tudo?", 
                "Esta ação apagará todas as árvores e fotos localmente.", 
                () => {
                    handleClearAll();
                    TableUI.render();
                    mapUI.updateMapData(true); 
                }
            );
        });
    }

    // --- FILTRO E FOTO ---
    const filterInput = document.getElementById('table-filter-input');
    if(filterInput) filterInput.addEventListener('keyup', handleTableFilter);

    const photoInput = document.getElementById('tree-photo-input');
    const removePhotoBtn = document.getElementById('remove-photo-btn');

    if (photoInput) {
        photoInput.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (!file) return;

            clearPhotoPreview(); 
            try {
                utils.showToast('Otimizando foto...', 'success');
                const optimizedBlob = await utils.optimizeImage(file, 800, 0.7);
                state.setCurrentTreePhoto(optimizedBlob);

                const previewContainer = document.getElementById('photo-preview-container');
                const preview = document.createElement('img');
                preview.id = 'photo-preview';
                preview.src = URL.createObjectURL(optimizedBlob);
                previewContainer.prepend(preview); 
                if(removePhotoBtn) removePhotoBtn.style.display = 'block';

            } catch (error) {
                utils.showToast('Erro ao processar a foto.', 'error');
            }
        });
    }

    if (removePhotoBtn) {
        removePhotoBtn.addEventListener('click', clearPhotoPreview);
    }
    
    // Anexa o listener ao botão de sync. Chamado aqui para o caso de o botão já existir no DOM.
    attachSyncModalListener();
}

/**
 * Anexa o event listener para o botão que abre o modal de sincronização.
 * Precisa ser chamado sempre que a UI de autenticação é atualizada.
 */
function attachSyncModalListener() {
    const btnOpenSync = document.getElementById('btn-open-sync-modal');
    if (btnOpenSync) {
        // Remove listener antigo para evitar duplicatas, caso esta função seja chamada várias vezes
        const newBtn = btnOpenSync.cloneNode(true);
        btnOpenSync.parentNode.replaceChild(newBtn, btnOpenSync);
        
        newBtn.addEventListener('click', () => {
            SyncUI.showModal();
        });
    }
}


// Escuta o evento disparado pelo AuthUI quando o usuário loga/desloga
document.addEventListener('auth-ui-updated', (e) => {
    // Anexa o listener novamente pois o botão de sync pode ter sido recriado no DOM.
    attachSyncModalListener();
});

// === 5. ATALHOS ===
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

function setupWelcomeScreen() {
    const welcomeScreen = document.getElementById('welcome-screen');
    const closeBtn = document.getElementById('close-welcome-btn');
    if (!welcomeScreen || !closeBtn) return;

    const closeWelcome = () => {
        welcomeScreen.classList.remove('active');
        setTimeout(() => {
            welcomeScreen.style.display = 'none';
            localStorage.setItem('arboriaWelcomeShown', 'true');
        }, 300);
    };

    closeBtn.addEventListener('click', closeWelcome);

    if (!localStorage.getItem('arboriaWelcomeShown')) {
        setTimeout(() => welcomeScreen.classList.add('active'), 500);
    }
}

function initFormDefaults() {
    try {
      const dateInput = document.getElementById('risk-data');
      if (dateInput && !dateInput.value) dateInput.value = new Date().toISOString().split('T')[0];
      
      const avaliadorInput = document.getElementById('risk-avaliador');
      if (avaliadorInput && state.lastEvaluatorName) avaliadorInput.value = state.lastEvaluatorName;
    } catch(e) { }
}

function applyGuestRestrictions() {
    const isGuest = sessionStorage.getItem('arboria_guest_mode') === 'true';
    if (!isGuest) return;

    console.log("Applying guest restrictions...");

    const importBtn = document.getElementById('import-data-btn');
    const emailBtn = document.getElementById('send-email-btn');

    if (importBtn) {
        importBtn.style.display = 'none';
        console.log("Import button hidden for guest.");
    }
    if (emailBtn) {
        emailBtn.style.display = 'none';
        console.log("Email button hidden for guest.");
    }
}

// === 6. INICIALIZAÇÃO PRINCIPAL ===
async function initApp() {
    console.log("🚀 Initializing ArborIA 2.0...");

    // 1. Inicializa UI Base (Sync)
    try {
        UI.init();
        TooltipUI.init();
        SyncUI.init();
    } catch (e) {
        console.error("UI Init Error:", e);
    }

    // 2. Carrega PDF Module (Async)
    try {
        pdfGenerator = await import('./pdf.generator.js');
    } catch (e) {
        console.warn("PDF Module failed to load:", e);
    }

    // 3. Inicializa Autenticação (Async)
    // AuthUI.init() chama checkInitialSession que pode falhar se rede offline, 
    // mas já tratamos lá.
    try {
        AuthUI.init();
    } catch (e) {
        console.error("Auth Init Error:", e);
    }

    // 4. Inicializa Banco de Imagens (Async)
    try {
        if (typeof initImageDB === 'function') await initImageDB();
        if (modalUI && typeof modalUI.initPhotoViewer === 'function') modalUI.initPhotoViewer();
    } catch(e) {
        console.error("DB Init Error:", e);
    }

    // 5. Configura Listeners e Estado
    try {
        state.loadDataFromStorage();
        
        if (topNavContainer) topNavContainer.addEventListener('click', handleMainNavigation);
        
        setupActionButtons(); 
        setupToolShortcuts();
        setupBackToTop();
        setupWelcomeScreen();
        initFormDefaults();
        applyGuestRestrictions(); // Aplica restrições se for visitante
        
        mapUI.setupMap();
        mapUI.setupMapListeners();
        
        clinometer.initClinometerListeners();
        dapEstimator.initDAPEstimatorListeners();

        // 6. Renderiza Tabela
        TableUI.render({
            onNavigateToPlanningForm: (treeId) => {
                handleMainNavigation({ target: { closest: () => ({ dataset: { target: 'plano-intervencao-view' } }) } }, treeId);
            }
        });

        window.addEventListener('resize', () => {
            const mapContainer = document.getElementById('map-container');
            if (mapContainer && mapContainer.offsetParent !== null) {
                mapUI.updateMapData(false); 
                if (state.mapInstance) state.mapInstance.invalidateSize();
            }
        });

        // 7. Navegação Inicial
        const calcViewButton = document.querySelector('.topico-btn[data-target="calculadora-view"]');
        if (window.innerWidth > 768 && calcViewButton) {
            UI.navigateTo('calculadora-view');
        }

    } catch (error) {
        console.error("Main Logic Error:", error);
        UI.showToast("Erro parcial na inicialização.", "error");
    }
}

// === 7. SERVICE WORKER ===
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch((err) => {});
  });
}

document.addEventListener('DOMContentLoaded', initApp);
