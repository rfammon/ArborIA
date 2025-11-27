// js/main.js (v2.5 - Maestro do ArborIA 2.0 - Flash Card Integration)

import * as state from './state.js';
import { UI } from './ui.js'; 
import { TooltipUI } from './tooltip.ui.js';
import { TableUI } from './table.ui.js';

import * as features from './features.js';
import { initImageDB, getImageFromDB } from './database.js'; 
import * as modalUI from './modal.ui.js'; 
import * as mapUI from './map.ui.js'; 

import { manualContent } from './content.js'; 
import * as utils from './utils.js';
import * as clinometer from './clinometer.js'; 
import * as dapEstimator from './dap.estimator.js';
import { PlanningModule } from './arboria-module.js';

// Tenta importar o gerador de PDF dinamicamente
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
    console.log("🦫 Beaver Log: Iniciando módulo de planejamento...");
    
    // 1. Verifica estado
    let treesToProcess = state.registeredTrees;
    console.log("🦫 Beaver Log: Árvores no State:", treesToProcess); 

    // 2. Filtra se houver ID
    if (treeId) {
        treesToProcess = state.registeredTrees.filter(tree => tree.id === treeId);
        if (treesToProcess.length === 0) {
            utils.showToast(`Árvore ID ${treeId} não encontrada.`, "error");
            return;
        }
    }

    // 3. Mapeia dados para o formato do módulo
    const trees = treesToProcess.map(tree => ({
        ...tree,
        species: tree.especie,
        location: tree.local,
        
        // --- DADOS TRAQ ---
        riskLevel: tree.riskLevel || 'Não Avaliado', // Ex: "Alto"
        residualRisk: tree.residualRisk || tree.riskLevel, // Ex: "Baixo"
        failureProb: tree.failureProb || '-',
        targetType: tree.targetType || '-',
        mitigation: tree.mitigation || 'nenhuma',
        // ------------------

        riskFactorsCode: tree.riskFactors ? tree.riskFactors.join(',') : '',
        defects: tree.observacoes ? [tree.observacoes] : [],
        riskScore: tree.pontuacao,
        date: tree.data,
        dap: tree.dap,
        height: tree.altura,
        suggestedIntervention: tree.mitigation // Mapeamento para automação
    }));

    // 4. Carrega imagens (Assíncrono)
    const treesWithImages = await Promise.all(trees.map(async (tree) => {
        if (tree.hasPhoto) {
            return new Promise((resolve) => {
                getImageFromDB(tree.id, (blob) => {
                    resolve({ ...tree, image: blob ? URL.createObjectURL(blob) : null });
                });
            });
        }
        return tree;
    }));

    console.log("🦫 Beaver Log: Dados finais enviados:", treesWithImages);

    // 5. Verificação Crítica do DOM
    const container = document.getElementById('planning-module-root');
    if (!container) {
        console.error("🦫 ERRO CRÍTICO: Container 'planning-module-root' não encontrado no DOM!");
        utils.showToast("Erro interno: Elemento de visualização não encontrado.", "error");
        return;
    }

    // 6. Montagem
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

    // --- FORMULÁRIO DE RISCO ---
    const riskForm = document.getElementById('risk-calculator-form');
    if (riskForm) {
        riskForm.addEventListener('submit', (e) => {
            const result = features.handleAddTreeSubmit(e); 
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
            features.clearPhotoPreview();
        });
    }

    // --- [NOVO] CHECKLIST FLASH CARD ---
    const openFlashcardBtn = document.getElementById('open-flashcard-btn');
    if (openFlashcardBtn) {
      openFlashcardBtn.addEventListener('click', () => {
        const checklistView = document.getElementById('checklist-flashcard-view');
        if (checklistView) {
          checklistView.classList.add('active'); // Use classList.add
          if (typeof features.initChecklistFlashCard === 'function') {
            features.initChecklistFlashCard();
          } else {
            
          }
        } else {
          
        }
      });
    }

    // Adiciona o listener para o botão de fechar o checklist
    const closeChecklistBtn = document.getElementById('close-checklist-btn');
    if (closeChecklistBtn) {
      closeChecklistBtn.addEventListener('click', () => {
        const checklistView = document.getElementById('checklist-flashcard-view');
        if (checklistView) checklistView.classList.remove('active'); // Use classList.remove
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
            mapUI.updateMapData(true); 
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

    const btnEmail = document.getElementById('send-email-btn');
    if (btnEmail) {
        btnEmail.addEventListener('click', features.sendEmailReport);
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
                    mapUI.updateMapData(true); 
                }
            );
        });
    }

    // --- FILTRO DA TABELA ---
    const filterInput = document.getElementById('table-filter-input');
    if(filterInput) filterInput.addEventListener('keyup', features.handleTableFilter);

    // --- LÓGICA DE UPLOAD E PREVIEW DE FOTO ---
    const photoInput = document.getElementById('tree-photo-input');
    const removePhotoBtn = document.getElementById('remove-photo-btn');

    if (photoInput) {
        photoInput.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (!file) return;

            features.clearPhotoPreview(); // Limpa qualquer preview anterior
            try {
                utils.showToast('Otimizando foto...', 'success');
                const optimizedBlob = await utils.optimizeImage(file, 800, 0.7);
                state.setCurrentTreePhoto(optimizedBlob);

                const previewContainer = document.getElementById('photo-preview-container');
                const preview = document.createElement('img');
                preview.id = 'photo-preview';
                preview.src = URL.createObjectURL(optimizedBlob);
                previewContainer.prepend(preview); // Adiciona a imagem antes do botão
                if(removePhotoBtn) removePhotoBtn.style.display = 'block';

            } catch (error) {
                
                utils.showToast('Erro ao processar a foto.', 'error');
            }
        });
    }

    if (removePhotoBtn) {
        removePhotoBtn.addEventListener('click', features.clearPhotoPreview);
    }
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

// === 5. INICIALIZAÇÃO PRINCIPAL ===
async function initApp() {
  try {
    try {
        pdfGenerator = await import('./pdf.generator.js');
    } catch (e) {
        
    }

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
    setupWelcomeScreen();
    initFormDefaults();
    
    // 4. Inicializa Componentes Complexos
    mapUI.setupMap();
    mapUI.setupMapListeners();
    
    clinometer.initClinometerListeners();
    dapEstimator.initDAPEstimatorListeners();

    // [NOTA] Não iniciamos mais o checklist automaticamente aqui.
    // Ele é iniciado apenas pelo clique do botão #open-checklist-btn

    // 5. Renderiza Tabela Inicial
    TableUI.render({
        onNavigateToPlanningForm: (treeId) => {
            handleMainNavigation({ target: { closest: () => ({ dataset: { target: 'plano-intervencao-view' } }) } }, treeId);
        }
    });

    // 6. Listener Global de Resize (Mapa)
    window.addEventListener('resize', () => {
        const mapContainer = document.getElementById('map-container');
        if (mapContainer && mapContainer.offsetParent !== null) {
            mapUI.updateMapData(false); 
            if (state.mapInstance) state.mapInstance.invalidateSize();
        }
    });

    // 7. Restaura Estado
    // [MUDANÇA] Força o início na calculadora/painel, em vez de restaurar a última aba.
    // A UI já exibe o painel por padrão, então não precisamos clicar em nada.
    const calcViewButton = document.querySelector('.topico-btn[data-target="calculadora-view"]');
    if (window.innerWidth > 768 && calcViewButton) {
      UI.navigateTo('calculadora-view');
    }
    
  } catch (error) {
    
    try { UI.showToast("Erro ao carregar aplicação.", "error"); } catch(e){}
  }
}

// === 6. SERVICE WORKER (PWA) ===
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .catch((err) => {});
  });
}

// Executa a aplicação
document.addEventListener('DOMContentLoaded', initApp);