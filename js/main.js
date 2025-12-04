// js/main.js (v3.0 - Map Fix & Tab Navigation)

import * as state from "./state.js";
import { UI } from "./ui.js";
import { TooltipUI } from "./tooltip.ui.js";
import { TableUI } from "./table.ui.js";
import { AuthUI } from "./auth.ui.js";
import { SyncUI } from "./sync.ui.js";
import { ApiService } from "./supabase-client.js";
import { SyncService } from "./sync.service.js";

import {
  handleAddTreeSubmit,
  clearPhotoPreview,
  handleGetGPS,
  handleImportZip,
  exportActionZip,
  sendEmailReport,
  handleClearAll,
  handleTableFilter,
} from "./features_patch_v2.js";
import { ChecklistMobileService } from "./checklist.mobile.service.js";

import { initImageDB, getImageFromDB } from "./database.js";
import * as modalUI from "./modal.ui.js";
import * as mapUI from "./map.ui.js";

import { manualContent } from "./content.js";
import * as utils from "./utils.js";
import * as clinometer from "./clinometer.js";
import * as dapEstimator from "./dap.estimator.js";
import { PlanningModule } from "./arboria-module.js";

// Expose mapUI globally for tab navigation handlers
window.mapUI = mapUI;

let pdfGenerator = null;

// === 1. SELETORES GLOBAIS ===
const detailView = document.getElementById("detalhe-view");
const topNavContainer = document.querySelector(".topicos-container");

// === [FIX] INJEÇÃO DINÂMICA DE CSS ===
function injectMobileChecklistCSS() {
    const linkId = 'mobile-checklist-css';
    if (!document.getElementById(linkId)) {
        const link = document.createElement('link');
        link.id = linkId;
        link.rel = 'stylesheet';
        link.href = 'css/modules/02_feature.checklist_mobile.css?v=2.2';
        document.head.appendChild(link);
    }
}

// === 2. LÓGICA DE NAVEGAÇÃO (CORE) ===
function handleMainNavigation(event, treeId = null) {
  const targetButton = event.target.closest(".topico-btn");
  if (!targetButton) return;

  const targetId = targetButton.dataset.target;
  state.saveActiveTab(targetId);

  if (targetId !== "clinometro-view") clinometer.stopClinometer();
  if (targetId !== "dap-estimator-view") dapEstimator.stopDAPEstimator();
  if (targetId === "plano-intervencao-view") {
    openPlanningModule(treeId);
  } else {
    PlanningModule.unmount();
  }

  UI.navigateTo(targetId);

  if (targetId === "calculadora-view") {
    window.scrollTo({ top: 0, behavior: "smooth" });
    TableUI.render();

    // [MAP FIX] Verifica se a aba do mapa está visível e atualiza
    const mapTab = document.getElementById("tab-content-mapa");
    if (mapTab && (mapTab.style.display === "block" || mapTab.classList.contains('active'))) {
      setTimeout(() => {
        if (mapUI && mapUI.onMapShow) mapUI.onMapShow();
      }, 100);
    }
  } else if (targetId === "clinometro-view") {
    clinometer.startClinometer();
  } else if (targetId === "dap-estimator-view") {
    dapEstimator.startDAPEstimator();
  } else {
    if (manualContent && manualContent[targetId]) {
      loadManualContent(targetId);
    } else {
      if (detailView)
        detailView.innerHTML = `<h3>Conteúdo em Breve</h3><p>O tópico <strong>${targetId}</strong> está em desenvolvimento.</p>`;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

async function openPlanningModule(treeId = null) {
  let treesToProcess = state.registeredTrees;

  if (treeId) {
    treesToProcess = state.registeredTrees.filter((tree) => tree.id === treeId);
    if (treesToProcess.length === 0) {
      utils.showToast(`Árvore ID ${treeId} não encontrada.`, "error");
      return;
    }
  }

  const trees = treesToProcess.map((tree) => ({
    ...tree,
    species: tree.especie,
    location: tree.local,
    riskLevel: tree.riskLevel || "Não Avaliado",
    residualRisk: tree.residualRisk || tree.riskLevel,
    failureProb: tree.failureProb || "-",
    targetType: tree.targetType || "-",
    mitigation: tree.mitigation || "nenhuma",
    riskFactorsCode: tree.riskFactors ? tree.riskFactors.join(",") : "",
    defects: tree.observacoes ? [tree.observacoes] : [],
    riskScore: tree.pontuacao,
    date: tree.data,
    dap: tree.dap,
    height: tree.altura,
    suggestedIntervention: tree.mitigation,
  }));

  const treesWithImages = await Promise.all(
    trees.map(async (tree) => {
      if (tree.hasPhoto && tree.photoUrl) {
        return { ...tree, image: tree.photoUrl }; 
      }
      return tree;
    }),
  );

  const container = document.getElementById("planning-module-root");
  if (!container) {
    utils.showToast("Erro interno: Elemento de visualização não encontrado.", "error");
    return;
  }

  PlanningModule.mount(
    "planning-module-root",
    {
      trees: treesWithImages,
      currentUser: document.getElementById("risk-avaliador")?.value || "Usuário",
      onSavePlan: (plan) => {
        utils.showToast("Plano Salvo!", "success");
        document.querySelector('.topico-btn[data-target="calculadora-view"]')?.click();
      },
      onCancel: () => {
        document.querySelector('.topico-btn[data-target="calculadora-view"]')?.click();
      },
      onNavigateToPlanningForm: (tId) => {
        handleMainNavigation(
          {
            target: {
              closest: () => ({ dataset: { target: "plano-intervencao-view" } }),
            },
          },
          tId,
        );
      },
    },
    treeId,
  );
}

function loadManualContent(topicId) {
  if (!detailView) return;
  detailView.style.opacity = 0;
  setTimeout(() => {
    const content = typeof manualContent[topicId] === "object" ? manualContent[topicId].html : manualContent[topicId];
    const title = typeof manualContent[topicId] === "object" ? `<h3>${manualContent[topicId].titulo}</h3>` : "";
    const finalHTML = content.includes("<h3>") || !title ? content : title + content;
    detailView.innerHTML = finalHTML;
    detailView.style.opacity = 1;
  }, 150);
}

// === 3. CONEXÃO DOS BOTÕES DE AÇÃO ===
function setupActionButtons() {
  const backToSummaryBtn = document.getElementById("back-to-summary-btn");
  if (backToSummaryBtn) {
    backToSummaryBtn.addEventListener("click", () => {
      const summaryNavBtn = document.querySelector('.topico-btn[data-target="calculadora-view"]');
      if (summaryNavBtn) summaryNavBtn.click();
    });
  }

  const riskForm = document.getElementById("risk-calculator-form");
  if (riskForm) {
    riskForm.addEventListener("submit", async (e) => {
      const result = await handleAddTreeSubmit(e);
      if (result && result.success) {
        TableUI.render();
        mapUI.updateMapData(true);
        const summaryTab = document.querySelector('.sub-nav-btn[data-target="tab-content-summary"]');
        if (summaryTab) summaryTab.click();
      }
    });

    const resetBtn = document.getElementById("reset-risk-form-btn");
    if (resetBtn)
      resetBtn.addEventListener("click", () => {
        riskForm.reset();
        clearPhotoPreview();
        const mapTab = document.getElementById("tab-content-mapa");
        if (mapTab && !mapTab.classList.contains('active')) {
          mapTab.style.display = 'none';
        }
      });
  }

  const openFlashcardBtn = document.getElementById("open-flashcard-btn");
  if (openFlashcardBtn) {
    openFlashcardBtn.addEventListener("click", () => {
      ChecklistMobileService.init();
      ChecklistMobileService.open();
      setTimeout(() => ChecklistMobileService.forceShow(), 200);
    });
  }

  const closeChecklistBtn = document.getElementById("close-checklist-btn");
  if (closeChecklistBtn) {
    closeChecklistBtn.addEventListener("click", () => {
      ChecklistMobileService.close();
    });
  }

  const gpsBtn = document.getElementById("get-gps-btn");
  if (gpsBtn) gpsBtn.addEventListener("click", handleGetGPS);

  const btnImport = document.getElementById("import-data-btn");
  const inputZip = document.getElementById("zip-importer");
  if (btnImport && inputZip) {
    btnImport.addEventListener("click", () => inputZip.click());
    inputZip.addEventListener("change", async (e) => {
      await handleImportZip(e);
      TableUI.render();
      mapUI.updateMapData(true);
    });
  }

  const btnExport = document.getElementById("export-data-btn");
  if (btnExport) btnExport.addEventListener("click", exportActionZip);

  const btnPdf = document.getElementById("generate-pdf-btn");
  if (btnPdf) {
    btnPdf.addEventListener("click", () => {
      if (pdfGenerator && typeof pdfGenerator.generateGeneralReport === "function") {
        pdfGenerator.generateGeneralReport(state.registeredTrees);
      } else {
        utils.showToast("Módulo de relatório não carregado. Recarregue a página.", "error");
      }
    });
  }

  const btnEmail = document.getElementById("send-email-btn");
  if (btnEmail) btnEmail.addEventListener("click", sendEmailReport);

  const btnClear = document.getElementById("clear-all-btn");
  if (btnClear) {
    btnClear.addEventListener("click", () => {
      modalUI.showConfirmModal(
        "Excluir Tudo?",
        "Esta ação apagará todas as árvores e fotos localmente.",
        () => {
          handleClearAll();
          TableUI.render();
          mapUI.updateMapData(true);
        },
      );
    });
  }

  const filterInput = document.getElementById("table-filter-input");
  if (filterInput) filterInput.addEventListener("keyup", handleTableFilter);

  const photoInput = document.getElementById("tree-photo-input");
  const removePhotoBtn = document.getElementById("remove-photo-btn");

  if (photoInput) {
    photoInput.addEventListener("change", async (event) => {
      const file = event.target.files[0];
      if (!file) return;

      clearPhotoPreview();
      try {
        utils.showToast("Otimizando foto...", "success");
        const optimizedBlob = await utils.optimizeImage(file, 800, 0.7);
        state.setCurrentTreePhoto(optimizedBlob);

        const previewContainer = document.getElementById("photo-preview-container");
        const preview = document.createElement("img");
        preview.id = "photo-preview";
        preview.src = URL.createObjectURL(optimizedBlob);
        previewContainer.prepend(preview);
        if (removePhotoBtn) removePhotoBtn.style.display = "block";
      } catch (error) {
        utils.showToast("Erro ao processar a foto.", "error");
      }
    });
  }

  if (removePhotoBtn) {
    removePhotoBtn.addEventListener("click", clearPhotoPreview);
  }

  attachSyncModalListener();
}

function attachSyncModalListener() {
  const btnOpenSync = document.getElementById("btn-open-sync-modal");
  if (btnOpenSync) {
    const newBtn = btnOpenSync.cloneNode(true);
    btnOpenSync.parentNode.replaceChild(newBtn, btnOpenSync);
    newBtn.addEventListener("click", () => {
      SyncUI.showModal();
    });
  }
}

document.addEventListener("auth-ui-updated", (e) => {
  attachSyncModalListener();
});

// === 5. ATALHOS ===
function setupToolShortcuts() {
  const btnHeight = document.getElementById("btn-measure-height-form");
  const btnDap = document.getElementById("btn-measure-dap-form");

  if (btnHeight) {
    btnHeight.addEventListener("click", () => {
      const navBtn = document.querySelector('.topico-btn[data-target="clinometro-view"]');
      if (navBtn) navBtn.click();
    });
  }
  if (btnDap) {
    btnDap.addEventListener("click", () => {
      const navBtn = document.querySelector('.topico-btn[data-target="dap-estimator-view"]');
      if (navBtn) navBtn.click();
    });
  }
}

function setupBackToTop() {
  const backToTopBtn = document.getElementById("back-to-top-btn");
  if (!backToTopBtn) return;
  window.addEventListener(
    "scroll",
    () => {
      if (window.scrollY > 300) backToTopBtn.style.display = "block";
      else backToTopBtn.style.display = "none";
    },
    { passive: true },
  );
}

function setupWelcomeScreen() {
  const welcomeScreen = document.getElementById("welcome-screen");
  const closeBtn = document.getElementById("close-welcome-btn");
  if (!welcomeScreen || !closeBtn) return;

  const closeWelcome = () => {
    welcomeScreen.classList.remove("active");
    setTimeout(() => {
      welcomeScreen.style.display = "none";
      localStorage.setItem("arboriaWelcomeShown", "true");
    }, 300);
  };

  closeBtn.addEventListener("click", closeWelcome);

  if (!localStorage.getItem("arboriaWelcomeShown")) {
    setTimeout(() => welcomeScreen.classList.add("active"), 500);
  }
}

function initFormDefaults() {
  try {
    const dateInput = document.getElementById("risk-data");
    if (dateInput && !dateInput.value)
      dateInput.value = new Date().toISOString().split("T")[0];

    const avaliadorInput = document.getElementById("risk-avaliador");
    if (avaliadorInput && state.lastEvaluatorName)
      avaliadorInput.value = state.lastEvaluatorName;
  } catch (e) {}
}

function applyGuestRestrictions() {
  const isGuest = sessionStorage.getItem("arboria_guest_mode") === "true";
  if (!isGuest) return;
  const importBtn = document.getElementById("import-data-btn");
  const emailBtn = document.getElementById("send-email-btn");
  if (importBtn) importBtn.style.display = "none";
  if (emailBtn) emailBtn.style.display = "none";
}

// === 6. INICIALIZAÇÃO PRINCIPAL ===
async function initApp() {
  console.log("🚀 Initializing ArborIA 2.0...");
  
  injectMobileChecklistCSS();
  
  window.addEventListener('resize', () => {
    setTimeout(() => {
      forceMobileLayout();
      ensureSingleTabVisible();
      // Se o mapa estiver visível, atualiza
      const mapTab = document.getElementById("tab-content-mapa");
      if (mapTab && mapTab.classList.contains('active')) {
          if (window.mapUI && window.mapUI.onMapShow) window.mapUI.onMapShow();
      }
    }, 100);
  });
  
  setTimeout(() => {
    forceFormVisibility();
    forceMapVisibility();
    forceMitigationVisibility();
    forceMobileLayout();
    forceTabNavigation();
    ensureSingleTabVisible();
  }, 2500);
  
  // Funções de debug e force (mantidas para compatibilidade e robustez)
  window.forceFormVisibility = () => {
    const form = document.getElementById("risk-calculator-form");
    if (form) {
      form.style.cssText = `opacity: 1 !important; visibility: visible !important; display: block !important;`;
      const allElements = form.querySelectorAll("*");
      allElements.forEach(element => { element.style.cssText = `opacity: 1 !important; visibility: visible !important;`; });
    }
  };
  
  window.forceMapVisibility = () => {
    const mapTab = document.getElementById("tab-content-mapa");
    if (mapTab) {
      const allElements = mapTab.querySelectorAll("*");
      allElements.forEach(element => { element.style.cssText = `opacity: 1 !important; visibility: visible !important;`; });
    }
  };
  
  window.forceMitigationVisibility = () => {
    const mitigationSelect = document.getElementById("mitigation-action");
    if (mitigationSelect) {
      mitigationSelect.style.cssText = `background-color: rgba(255, 255, 255, 0.1) !important; color: #ffffff !important; border: 1px solid rgba(255, 255, 255, 0.3) !important; padding: 10px !important; border-radius: 8px !important; font-size: 1rem !important; opacity: 1 !important; visibility: visible !important;`;
      const options = mitigationSelect.querySelectorAll("option");
      options.forEach(option => { option.style.cssText = `background-color: #1a202c !important; color: #ffffff !important; opacity: 1 !important; visibility: visible !important; padding: 8px !important;`; });
    }
  };

  try {
    UI.init();
    TooltipUI.init();
    SyncUI.init();
  } catch (e) { console.error("UI Init Error:", e); }

  try { pdfGenerator = await import("./pdf.generator.js"); } catch (e) {}

  try { AuthUI.init(); } catch (e) { console.error("Auth Init Error:", e); }

  try {
    if (typeof initImageDB === "function") await initImageDB();
    if (modalUI && typeof modalUI.initPhotoViewer === "function") modalUI.initPhotoViewer();
  } catch (e) { console.error("DB Init Error:", e); }

  try {
    state.loadDataFromStorage();

    if (topNavContainer) topNavContainer.addEventListener("click", handleMainNavigation);

    setupActionButtons();
    setupToolShortcuts();
    setupBackToTop();
    setupWelcomeScreen();
    initFormDefaults();
    applyGuestRestrictions();

    mapUI.setupMap();
    mapUI.setupMapListeners();

    clinometer.initClinometerListeners();
    dapEstimator.initDAPEstimatorListeners();

    TableUI.render({
      onNavigateToPlanningForm: (treeId) => {
        handleMainNavigation(
          { target: { closest: () => ({ dataset: { target: "plano-intervencao-view" } }) } },
          treeId,
        );
      },
    });

    window.addEventListener("resize", () => {
      const mapContainer = document.getElementById("map-container");
      if (mapContainer && mapContainer.offsetParent !== null) {
        mapUI.updateMapData(false);
        if (state.mapInstance) state.mapInstance.invalidateSize();
      }
    });

    const calcViewButton = document.querySelector('.topico-btn[data-target="calculadora-view"]');
    if (window.innerWidth > 768 && calcViewButton) {
      UI.navigateTo("calculadora-view");
    }
  } catch (error) {
    console.error("Main Logic Error:", error);
    UI.showToast("Erro parcial na inicialização.", "error");
  }
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch((err) => {});
  });
}

window.forceMobileLayout = () => {
  if (window.innerWidth <= 768) {
    const elementsToHide = ['target-selection-desktop', 'mitigation-selection-desktop', 'checklist-data-table-fieldset'];
    elementsToHide.forEach(id => {
      const element = document.getElementById(id);
      if (element) element.style.cssText = `display: none !important; visibility: hidden !important; opacity: 0 !important;`;
    });
    const classElements = document.querySelectorAll('.target-selection-desktop, .mitigation-selection-desktop, .hide-on-mobile');
    classElements.forEach(element => { element.style.cssText = `display: none !important; visibility: hidden !important; opacity: 0 !important;`; });
    
    const mapTab = document.getElementById('tab-content-mapa');
    if (mapTab) {
      mapTab.style.removeProperty('visibility');
      mapTab.style.removeProperty('opacity');
    }
  }
};

window.forceTabNavigation = () => {
  const subNavButtons = document.querySelectorAll('.sub-nav-btn');
  subNavButtons.forEach(btn => { btn.replaceWith(btn.cloneNode(true)); });
  
  const newButtons = document.querySelectorAll('.sub-nav-btn');
  newButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const targetTabId = btn.getAttribute('data-target');
      const parentSection = btn.closest('.content-section');
      
      if (!parentSection) return;
      
      const siblings = parentSection.querySelectorAll('.sub-nav-btn');
      siblings.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const tabContents = parentSection.querySelectorAll('.sub-tab-content');
      tabContents.forEach(content => {
        content.style.display = 'none';
        content.classList.remove('active');
      });
      
      const targetContent = document.getElementById(targetTabId);
      if (targetContent) {
        targetContent.style.display = 'block';
        targetContent.classList.add('active');
        
        // [MAP FIX] Chama onMapShow quando a aba do mapa é ativada
        if (targetTabId && targetTabId.includes('mapa')) {
           setTimeout(() => {
             if (window.mapUI && window.mapUI.onMapShow) {
               window.mapUI.onMapShow();
             }
           }, 50);
        }
      }
    });
  });
};

window.ensureSingleTabVisible = () => {
  const allTabs = document.querySelectorAll('.sub-tab-content');
  const activeButtons = document.querySelectorAll('.sub-nav-btn.active');
  let targetTabId = null;
  activeButtons.forEach(btn => { if (btn.classList.contains('active')) targetTabId = btn.getAttribute('data-target'); });
  
  allTabs.forEach(tab => { tab.style.display = 'none'; tab.classList.remove('active'); });
  
  if (targetTabId) {
    const targetTab = document.getElementById(targetTabId);
    if (targetTab) { targetTab.style.display = 'block'; targetTab.classList.add('active'); }
  }
};

document.addEventListener("DOMContentLoaded", initApp);
