// js/main.js (v2.9 - Patch Applied for CRUD + CSS Injection Fix)

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

let pdfGenerator = null;

// === 1. SELETORES GLOBAIS ===
const detailView = document.getElementById("detalhe-view");
const topNavContainer = document.querySelector(".topicos-container");

// === [FIX] INJEÇÃO DINÂMICA DE CSS ===
// Resolve o problema de empilhamento vertical dos cards do checklist mobile
// injetando o CSS que estava faltando no index.html
function injectMobileChecklistCSS() {
    const linkId = 'mobile-checklist-css';
    if (!document.getElementById(linkId)) {
        const link = document.createElement('link');
        link.id = linkId;
        link.rel = 'stylesheet';
        link.href = 'css/modules/02_feature.checklist_mobile.css?v=2.2';
        document.head.appendChild(link);
        console.log('CSS do Checklist Mobile injetado dinamicamente.');
    }
}

// === 2. LÓGICA DE NAVEGAÇÃO (CORE) ===
function handleMainNavigation(event, treeId = null) {
  const targetButton = event.target.closest(".topico-btn");
  if (!targetButton) return;

  const targetId = targetButton.dataset.target;
  state.saveActiveTab(targetId);

  // 1. CICLO DE VIDA DE SENSORES E MÓDULOS
  if (targetId !== "clinometro-view") clinometer.stopClinometer();
  if (targetId !== "dap-estimator-view") dapEstimator.stopDAPEstimator();
  if (targetId === "plano-intervencao-view") {
    openPlanningModule(treeId);
  } else {
    PlanningModule.unmount();
  }

  // 2. DELEGAÇÃO VISUAL (SPA)
  UI.navigateTo(targetId);

  // 3. LÓGICA ESPECÍFICA POR ABA
  if (targetId === "calculadora-view") {
    window.scrollTo({ top: 0, behavior: "smooth" });
    TableUI.render();

    // [MAP FIX] Se a última sub-aba ativa era o mapa, força resize
    const mapTab = document.getElementById("tab-content-mapa");
    if (mapTab && mapTab.style.display === "block") {
      setTimeout(() => {
        // Força múltiplos ciclos de resize
        window.dispatchEvent(new Event('resize'));
        setTimeout(() => window.dispatchEvent(new Event('resize')), 300);
        setTimeout(() => window.dispatchEvent(new Event('resize')), 800);
      }, 100);
    }
  } else if (targetId === "clinometro-view") {
    clinometer.startClinometer();
  } else if (targetId === "dap-estimator-view") {
    dapEstimator.startDAPEstimator();
  } else {
    // --- MANUAL TÉCNICO ---
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
        return { ...tree, image: tree.photoUrl }; // Use the URL directly
      }
      return tree;
    }),
  );

  const container = document.getElementById("planning-module-root");
  if (!container) {
    utils.showToast(
      "Erro interno: Elemento de visualização não encontrado.",
      "error",
    );
    return;
  }

  PlanningModule.mount(
    "planning-module-root",
    {
      trees: treesWithImages,
      currentUser:
        document.getElementById("risk-avaliador")?.value || "Usuário",
      onSavePlan: (plan) => {
        utils.showToast("Plano Salvo!", "success");
        document
          .querySelector('.topico-btn[data-target="calculadora-view"]')
          ?.click();
      },
      onCancel: () => {
        document
          .querySelector('.topico-btn[data-target="calculadora-view"]')
          ?.click();
      },
      onNavigateToPlanningForm: (tId) => {
        handleMainNavigation(
          {
            target: {
              closest: () => ({
                dataset: { target: "plano-intervencao-view" },
              }),
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
    const content =
      typeof manualContent[topicId] === "object"
        ? manualContent[topicId].html
        : manualContent[topicId];
    const title =
      typeof manualContent[topicId] === "object"
        ? `<h3>${manualContent[topicId].titulo}</h3>`
        : "";
    const finalHTML =
      content.includes("<h3>") || !title ? content : title + content;

    detailView.innerHTML = finalHTML;
    detailView.style.opacity = 1;
  }, 150);
}

// === 3. CONEXÃO DOS BOTÕES DE AÇÃO ===
function setupActionButtons() {
  // --- NAVEGAÇÃO INTERNA ---
  const backToSummaryBtn = document.getElementById("back-to-summary-btn");
  if (backToSummaryBtn) {
    backToSummaryBtn.addEventListener("click", () => {
      const summaryNavBtn = document.querySelector(
        '.topico-btn[data-target="calculadora-view"]',
      );
      if (summaryNavBtn) summaryNavBtn.click();
    });
  }

  // --- FORMULÁRIO DE RISCO ---
  const riskForm = document.getElementById("risk-calculator-form");
  if (riskForm) {
    riskForm.addEventListener("submit", async (e) => {
      // [PATCH] Usa a função corrigida
      const result = await handleAddTreeSubmit(e);
      if (result && result.success) {
        TableUI.render();
        mapUI.updateMapData(true);
        const summaryTab = document.querySelector(
          '.sub-nav-btn[data-target="tab-content-summary"]',
        );
        if (summaryTab) summaryTab.click();
      }
    });

    const resetBtn = document.getElementById("reset-risk-form-btn");
    if (resetBtn)
      resetBtn.addEventListener("click", () => {
        riskForm.reset();
        clearPhotoPreview();
        
        // Garante que o mapa permaneça oculto após limpar formulário
        const mapTab = document.getElementById("tab-content-mapa");
        if (mapTab && !mapTab.classList.contains('active')) {
          mapTab.style.display = 'none';
          mapTab.style.visibility = 'hidden';
          mapTab.style.opacity = '0';
          mapTab.style.position = 'absolute';
          mapTab.style.zIndex = '-1';
        }
      });
  }

  // --- CHECKLIST FLASH CARD ---
  const openFlashcardBtn = document.getElementById("open-flashcard-btn");
  if (openFlashcardBtn) {
    openFlashcardBtn.addEventListener("click", () => {
      console.log("Main: Botão de flashcard clicado");
      
      // Debug antes de tentar abrir
      ChecklistMobileService.debug();
      
      // Inicializa o serviço antes de abrir
      ChecklistMobileService.init();
      ChecklistMobileService.open();
      
      // Debug depois de tentar abrir
      setTimeout(() => {
        ChecklistMobileService.debug();
      }, 100);
      
      // Força a exibição completa após 200ms
      setTimeout(() => {
        console.log("Forçando exibição completa do modal...");
        ChecklistMobileService.forceShow();
      }, 200);
    });
  }

  const closeChecklistBtn = document.getElementById("close-checklist-btn");
  if (closeChecklistBtn) {
    closeChecklistBtn.addEventListener("click", () => {
      ChecklistMobileService.close();
    });
  }

  // --- GPS ---
  const gpsBtn = document.getElementById("get-gps-btn");
  if (gpsBtn) gpsBtn.addEventListener("click", handleGetGPS);

  // --- IMPORTAÇÃO / EXPORTAÇÃO ---
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

  // --- GERAR PDF ---
  const btnPdf = document.getElementById("generate-pdf-btn");
  if (btnPdf) {
    btnPdf.addEventListener("click", () => {
      if (
        pdfGenerator &&
        typeof pdfGenerator.generateGeneralReport === "function"
      ) {
        pdfGenerator.generateGeneralReport(state.registeredTrees);
      } else {
        utils.showToast(
          "Módulo de relatório não carregado. Recarregue a página.",
          "error",
        );
      }
    });
  }

  const btnEmail = document.getElementById("send-email-btn");
  if (btnEmail) btnEmail.addEventListener("click", sendEmailReport);

  // --- LIMPAR BANCO ---
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

  // --- FILTRO E FOTO ---
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

        const previewContainer = document.getElementById(
          "photo-preview-container",
        );
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

  // Anexa o listener ao botão de sync. Chamado aqui para o caso de o botão já existir no DOM.
  attachSyncModalListener();
}

/**
 * Anexa o event listener para o botão que abre o modal de sincronização.
 * Precisa ser chamado sempre que a UI de autenticação é atualizada.
 */
function attachSyncModalListener() {
  const btnOpenSync = document.getElementById("btn-open-sync-modal");
  if (btnOpenSync) {
    // Remove listener antigo para evitar duplicatas, caso esta função seja chamada várias vezes
    const newBtn = btnOpenSync.cloneNode(true);
    btnOpenSync.parentNode.replaceChild(newBtn, btnOpenSync);

    newBtn.addEventListener("click", () => {
      SyncUI.showModal();
    });
  }
}

// Escuta o evento disparado pelo AuthUI quando o usuário loga/desloga
document.addEventListener("auth-ui-updated", (e) => {
  // Anexa o listener novamente pois o botão de sync pode ter sido recriado no DOM.
  attachSyncModalListener();
});

// === 5. ATALHOS ===
function setupToolShortcuts() {
  const btnHeight = document.getElementById("btn-measure-height-form");
  const btnDap = document.getElementById("btn-measure-dap-form");

  if (btnHeight) {
    btnHeight.addEventListener("click", () => {
      const navBtn = document.querySelector(
        '.topico-btn[data-target="clinometro-view"]',
      );
      if (navBtn) navBtn.click();
    });
  }
  if (btnDap) {
    btnDap.addEventListener("click", () => {
      const navBtn = document.querySelector(
        '.topico-btn[data-target="dap-estimator-view"]',
      );
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

  console.log("Applying guest restrictions...");

  const importBtn = document.getElementById("import-data-btn");
  const emailBtn = document.getElementById("send-email-btn");

  if (importBtn) {
    importBtn.style.display = "none";
    console.log("Import button hidden for guest.");
  }
  if (emailBtn) {
    emailBtn.style.display = "none";
    console.log("Email button hidden for guest.");
  }
}

// === 6. INICIALIZAÇÃO PRINCIPAL ===
async function initApp() {
  console.log("🚀 Initializing ArborIA 2.0...");
  
  // [FIX] Injeta CSS faltante
  injectMobileChecklistCSS();
  
  // [FIX] Listener para redimensionamento
  window.addEventListener('resize', () => {
    setTimeout(() => {
      forceMobileLayout();
      debugMobileFormVisibility();
      ensureSingleTabVisible();
    }, 100);
  });
  
  // [FIX] Força visibilidade do formulário após carregar
  setTimeout(() => {
    forceFormVisibility();
    forceMapVisibility();
    // debugFilterColors();
    // debugMitigationDropdown();
    forceMitigationVisibility();
    // debugMobileFormVisibility();
    forceMobileLayout();
    // debugMapVisibility();
    // testTabNavigation();
    forceTabNavigation();
    ensureSingleTabVisible();
  }, 2500);
  
  // [DEBUG] Adiciona função global para teste do modal
  window.testChecklistModal = () => {
    const container = document.getElementById("checklist-flashcard-view");
    if (container) {
      container.style.cssText = `
        display: flex !important;
        visibility: visible !important;
        opacity: 1 !important;
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        z-index: 999999 !important;
        background-color: rgba(255, 0, 0, 0.5) !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: center !important;
      `;
      console.log("Modal de teste visível (fundo vermelho)");
    } else {
      console.error("Container não encontrado");
    }
  };
  
  window.testSimpleModal = () => {
    const container = document.getElementById("checklist-flashcard-view");
    if (container) {
      container.innerHTML = `
        <div style="
          background: white;
          padding: 20px;
          border-radius: 10px;
          color: black;
          text-align: center;
        ">
          <h2>TESTE SIMPLES</h2>
          <p>Se você consegue ver isso, o modal funciona!</p>
          <button onclick="this.parentElement.parentElement.style.display='none'">Fechar</button>
        </div>
      `;
      container.style.cssText = `
        display: flex !important;
        visibility: visible !important;
        opacity: 1 !important;
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        z-index: 999999 !important;
        background-color: rgba(0, 0, 0, 0.8) !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: center !important;
      `;
      console.log("Modal simples visível");
    } else {
      console.error("Container não encontrado");
    }
  };
  
  window.debugFormElements = () => {
    const form = document.getElementById("risk-calculator-form");
    if (form) {
      console.log("=== DEBUG FORMULÁRIO ===");
      console.log("Formulário encontrado:", form);
      console.log("Formulário visível:", form.offsetParent !== null);
      console.log("Formulário opacity:", window.getComputedStyle(form).opacity);
      
      // Verifica inputs
      const inputs = form.querySelectorAll("input");
      console.log("Inputs encontrados:", inputs.length);
      inputs.forEach((input, index) => {
        console.log(`Input ${index + 1}:`, {
          id: input.id,
          type: input.type,
          visible: input.offsetParent !== null,
          opacity: window.getComputedStyle(input).opacity,
          display: window.getComputedStyle(input).display,
          visibility: window.getComputedStyle(input).visibility
        });
      });
      
      // Verifica botões
      const buttons = form.querySelectorAll("button");
      console.log("Botões encontrados:", buttons.length);
      buttons.forEach((button, index) => {
        console.log(`Botão ${index + 1}:`, {
          id: button.id,
          className: button.className,
          visible: button.offsetParent !== null,
          opacity: window.getComputedStyle(button).opacity,
          display: window.getComputedStyle(button).display,
          visibility: window.getComputedStyle(button).visibility
        });
      });
      
      // Verifica ícones
      const icons = form.querySelectorAll("i, img.button-icon");
      console.log("Ícones encontrados:", icons.length);
      icons.forEach((icon, index) => {
        console.log(`Ícone ${index + 1}:`, {
          tagName: icon.tagName,
          className: icon.className,
          src: icon.src || "N/A",
          visible: icon.offsetParent !== null,
          opacity: window.getComputedStyle(icon).opacity,
          display: window.getComputedStyle(icon).display,
          visibility: window.getComputedStyle(icon).visibility
        });
      });
      
      console.log("========================");
    } else {
      console.error("Formulário não encontrado");
    }
  };
  
  window.forceFormVisibility = () => {
    const form = document.getElementById("risk-calculator-form");
    if (form) {
      console.log("Forçando visibilidade do formulário...");
      
      // Força visibilidade do formulário
      form.style.cssText = `
        opacity: 1 !important;
        visibility: visible !important;
        display: block !important;
      `;
      
      // Força visibilidade de todos os elementos
      const allElements = form.querySelectorAll("*");
      allElements.forEach(element => {
        element.style.cssText = `
          opacity: 1 !important;
          visibility: visible !important;
        `;
      });
      
      // Força estilos específicos para inputs
      const inputs = form.querySelectorAll("input");
      inputs.forEach(input => {
        input.style.cssText = `
          opacity: 1 !important;
          visibility: visible !important;
          background-color: #ffffff !important;
          color: #1a202c !important;
          border: 1px solid #e2e8f0 !important;
        `;
      });
      
      // Força estilos específicos para botões
      const buttons = form.querySelectorAll("button");
      buttons.forEach(button => {
        button.style.cssText = `
          opacity: 1 !important;
          visibility: visible !important;
        `;
      });
      
      // Força estilos específicos para ícones
      const icons = form.querySelectorAll("i, img");
      icons.forEach(icon => {
        icon.style.cssText = `
          opacity: 1 !important;
          visibility: visible !important;
        `;
      });
      
      console.log("Visibilidade do formulário forçada");
      debugFormElements();
    } else {
      console.error("Formulário não encontrado");
    }
  };
  
  window.debugMapElements = () => {
    const mapTab = document.getElementById("tab-content-mapa");
    if (mapTab) {
      console.log("=== DEBUG MAPA ===");
      console.log("Aba do mapa encontrada:", mapTab);
      console.log("Aba do mapa visível:", mapTab.offsetParent !== null);
      console.log("Aba do mapa opacity:", window.getComputedStyle(mapTab).opacity);
      
      // Verifica inputs
      const inputs = mapTab.querySelectorAll("input");
      console.log("Inputs encontrados:", inputs.length);
      inputs.forEach((input, index) => {
        console.log(`Input ${index + 1}:`, {
          id: input.id,
          type: input.type,
          visible: input.offsetParent !== null,
          opacity: window.getComputedStyle(input).opacity,
          display: window.getComputedStyle(input).display,
          visibility: window.getComputedStyle(input).visibility
        });
      });
      
      // Verifica botões
      const buttons = mapTab.querySelectorAll("button");
      console.log("Botões encontrados:", buttons.length);
      buttons.forEach((button, index) => {
        console.log(`Botão ${index + 1}:`, {
          id: button.id,
          className: button.className,
          visible: button.offsetParent !== null,
          opacity: window.getComputedStyle(button).opacity,
          display: window.getComputedStyle(button).display,
          visibility: window.getComputedStyle(button).visibility
        });
      });
      
      // Verifica ícones
      const icons = mapTab.querySelectorAll("i, span.legend-dot");
      console.log("Ícones encontrados:", icons.length);
      icons.forEach((icon, index) => {
        console.log(`Ícone ${index + 1}:`, {
          tagName: icon.tagName,
          className: icon.className,
          visible: icon.offsetParent !== null,
          opacity: window.getComputedStyle(icon).opacity,
          display: window.getComputedStyle(icon).display,
          visibility: window.getComputedStyle(icon).visibility
        });
      });
      
      console.log("====================");
    } else {
      console.error("Aba do mapa não encontrada");
    }
  };
  
  window.forceMapVisibility = () => {
    const mapTab = document.getElementById("tab-content-mapa");
    if (mapTab) {
      console.log("Forçando visibilidade dos elementos do mapa...");
      
      // NÃO força display: block - respeita navegação de abas
      // Apenas garante que os elementos dentro do mapa sejam visíveis quando a aba estiver ativa
      
      // Força visibilidade de todos os elementos internos
      const allElements = mapTab.querySelectorAll("*");
      allElements.forEach(element => {
        element.style.cssText = `
          opacity: 1 !important;
          visibility: visible !important;
        `;
      });
      
      // Força estilos específicos para inputs
      const inputs = mapTab.querySelectorAll("input");
      inputs.forEach(input => {
        input.style.cssText = `
          opacity: 1 !important;
          visibility: visible !important;
        `;
      });
      
      // Força estilos específicos para botões
      const buttons = mapTab.querySelectorAll("button");
      buttons.forEach(button => {
        button.style.cssText = `
          opacity: 1 !important;
          visibility: visible !important;
        `;
      });
      
      // Força estilos específicos para ícones
      const icons = mapTab.querySelectorAll("i, span");
      icons.forEach(icon => {
        icon.style.cssText = `
          opacity: 1 !important;
          visibility: visible !important;
        `;
      });
      
      console.log("Visibilidade dos elementos do mapa forçada");
      debugMapElements();
    } else {
      console.error("Aba do mapa não encontrada");
    }
  };
  
// Função de debug de cores simplificada
window.debugFilterColors = () => {
  const mapTab = document.getElementById("tab-content-mapa");
  if (mapTab) {
    console.log("=== DEBUG CORES DOS FILTROS ===");
    
    const filters = [
      { id: 'filter-todos', name: 'Todos', expectedColor: '#2d3748' },
      { id: 'filter-alto', name: 'Alto', expectedColor: '#d32f2f' },
      { id: 'filter-medio', name: 'Médio', expectedColor: '#f57c00' },
      { id: 'filter-baixo', name: 'Baixo', expectedColor: '#2e7d32' }
    ];
    
    filters.forEach(filter => {
      const input = document.getElementById(filter.id);
      const label = input ? input.nextElementSibling : null;
      const dot = label ? label.querySelector('.legend-dot') : null;
      
      if (input && label && dot) {
        const labelColor = window.getComputedStyle(label).color;
        const dotBgColor = window.getComputedStyle(dot).backgroundColor;
        
        console.log(filter.name + ':', {
          labelColor: labelColor,
          expectedLabelColor: filter.expectedColor,
          dotBgColor: dotBgColor,
          expectedDotColor: filter.expectedColor
        });
      } else {
        console.error(filter.name + ': Elementos não encontrados');
      }
    });
    
    console.log("===============================");
  } else {
    console.error("Aba do mapa não encontrada");
  }
};
  
  window.debugMitigationDropdown = () => {
    const mitigationSelect = document.getElementById("mitigation-action");
    if (mitigationSelect) {
      console.log("=== DEBUG MITIGATION DROPDOWN ===");
      console.log("Select encontrado:", mitigationSelect);
      console.log("Select visível:", mitigationSelect.offsetParent !== null);
      console.log("Select cor do texto:", window.getComputedStyle(mitigationSelect).color);
      console.log("Select background:", window.getComputedStyle(mitigationSelect).backgroundColor);
      console.log("Select opacity:", window.getComputedStyle(mitigationSelect).opacity);
      
      // Verifica as options
      const options = mitigationSelect.querySelectorAll("option");
      console.log("Options encontradas:", options.length);
      options.forEach((option, index) => {
        console.log(`Option ${index + 1}:`, {
          text: option.text,
          value: option.value,
          color: window.getComputedStyle(option).color,
          background: window.getComputedStyle(option).backgroundColor,
          opacity: window.getComputedStyle(option).opacity,
          visible: option.offsetParent !== null
        });
      });
      
      console.log("=====================================");
    } else {
      console.error("Dropdown mitigation-action não encontrado");
    }
  };
  
  window.forceMitigationVisibility = () => {
    const mitigationSelect = document.getElementById("mitigation-action");
    if (mitigationSelect) {
      console.log("Forçando visibilidade do dropdown mitigation-action...");
      
      // Força estilos do select principal
      mitigationSelect.style.cssText = `
        background-color: rgba(255, 255, 255, 0.1) !important;
        color: #ffffff !important;
        border: 1px solid rgba(255, 255, 255, 0.3) !important;
        padding: 10px !important;
        border-radius: 8px !important;
        font-size: 1rem !important;
        opacity: 1 !important;
        visibility: visible !important;
      `;
      
      // Força estilos das options
      const options = mitigationSelect.querySelectorAll("option");
      options.forEach(option => {
        option.style.cssText = `
          background-color: #1a202c !important;
          color: #ffffff !important;
          opacity: 1 !important;
          visibility: visible !important;
          padding: 8px !important;
        `;
      });
      
      console.log("Visibilidade do dropdown forçada");
      debugMitigationDropdown();
    } else {
      console.error("Dropdown mitigation-action não encontrado");
    }
  };

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
    pdfGenerator = await import("./pdf.generator.js");
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
    if (typeof initImageDB === "function") await initImageDB();
    if (modalUI && typeof modalUI.initPhotoViewer === "function")
      modalUI.initPhotoViewer();
  } catch (e) {
    console.error("DB Init Error:", e);
  }

  // 5. Configura Listeners e Estado
  try {
    state.loadDataFromStorage();

    if (topNavContainer)
      topNavContainer.addEventListener("click", handleMainNavigation);

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
        handleMainNavigation(
          {
            target: {
              closest: () => ({
                dataset: { target: "plano-intervencao-view" },
              }),
            },
          },
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

    // 7. Navegação Inicial
    const calcViewButton = document.querySelector(
      '.topico-btn[data-target="calculadora-view"]',
    );
    if (window.innerWidth > 768 && calcViewButton) {
      UI.navigateTo("calculadora-view");
    }
  } catch (error) {
    console.error("Main Logic Error:", error);
    UI.showToast("Erro parcial na inicialização.", "error");
  }
}

// === 7. SERVICE WORKER ===
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch((err) => {});
  });
}

window.debugMobileFormVisibility = () => {
  console.log("=== DEBUG FORMULÁRIOS MOBILE ===");
  console.log("Viewport width:", window.innerWidth);
  console.log("Is mobile:", window.innerWidth <= 768);
  
  const forms = [
    { 
      id: 'target-selection-desktop', 
      name: '2. Taxa de Ocupação do Alvo',
      hasClass: true 
    },
    { 
      id: 'mitigation-selection-desktop', 
      name: '3. Mitigação de Risco',
      hasClass: true 
    },
    { 
      id: 'checklist-data-table-fieldset', 
      name: '4. Fatores de Risco',
      hasClass: true
    }
  ];
  
  forms.forEach(form => {
    const element = document.getElementById(form.id);
    if (element) {
      const isVisible = element.offsetParent !== null;
      const display = window.getComputedStyle(element).display;
      const hasHideClass = element.classList.contains('hide-on-mobile');
      
      console.log(form.name + ':', {
        id: form.id,
        visible: isVisible,
        display: display,
        hasHideClass: hasHideClass,
        shouldBeHidden: window.innerWidth <= 768 && hasHideClass
      });
    } else {
      console.error(form.name + ': Elemento não encontrado (ID: ' + form.id + ')');
    }
  });
  
  console.log("==============================");
};

window.forceTabNavigation = () => {
  console.log("Forçando navegação de abas em mobile...");
  
  // Encontra todos os botões de sub-navegação
  const subNavButtons = document.querySelectorAll('.sub-nav-btn');
  
  subNavButtons.forEach(btn => {
    // Remove listeners antigos para evitar duplicação
    btn.replaceWith(btn.cloneNode(true));
  });
  
  // Re-adiciona os listeners
  const newButtons = document.querySelectorAll('.sub-nav-btn');
  
  newButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const targetTabId = btn.getAttribute('data-target');
      const parentSection = btn.closest('.content-section');
      
      console.log(`Clicado: ${btn.textContent.trim()} -> ${targetTabId}`);
      
      if (!parentSection) return;
      
      // 1. Atualiza botões
      const siblings = parentSection.querySelectorAll('.sub-nav-btn');
      siblings.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // 2. Atualiza Conteúdo
      const tabContents = parentSection.querySelectorAll('.sub-tab-content');
      tabContents.forEach(content => {
        content.style.display = 'none';
        content.classList.remove('active');
      });
      
      const targetContent = document.getElementById(targetTabId);
      if (targetContent) {
        targetContent.style.display = 'block';
        targetContent.classList.add('active');
        console.log(`Ativada aba: ${targetTabId}`);
        
        // 3. Trigger resize se for mapa
        if (targetTabId && targetTabId.includes('mapa')) {
           setTimeout(() => {
             if (window.mapUI && window.mapUI.triggerMapResize) {
               window.mapUI.triggerMapResize();
             }
           }, 100);
        }
      }
    });
  });
  
  console.log("Navegação de abas forçada");
};

window.ensureSingleTabVisible = () => {
  console.log("Garantindo que apenas uma aba esteja visível...");
  
  const allTabs = document.querySelectorAll('.sub-tab-content');
  const activeButtons = document.querySelectorAll('.sub-nav-btn.active');
  
  // Encontra a aba que deve estar visível
  let targetTabId = null;
  activeButtons.forEach(btn => {
    if (btn.classList.contains('active')) {
      targetTabId = btn.getAttribute('data-target');
    }
  });
  
  // Oculta todas as abas
  allTabs.forEach(tab => {
    tab.style.display = 'none';
    tab.classList.remove('active');
  });
  
  // Mostra apenas a aba correta
  if (targetTabId) {
    const targetTab = document.getElementById(targetTabId);
    if (targetTab) {
      targetTab.style.display = 'block';
      targetTab.classList.add('active');
      console.log(`Aba visível: ${targetTabId}`);
    }
  }
  
  console.log("Verificação de abas concluída");
};

window.debugMapVisibility = () => {
  const mapTab = document.getElementById("tab-content-mapa");
  const registerTab = document.getElementById("tab-content-register");
  
  console.log("=== DEBUG MAPA VISIBILITY ===");
  console.log("Viewport width:", window.innerWidth);
  console.log("Is mobile:", window.innerWidth <= 768);
  
  if (mapTab) {
    console.log("Mapa tab:", {
      id: mapTab.id,
      visible: mapTab.offsetParent !== null,
      display: window.getComputedStyle(mapTab).display,
      classes: mapTab.className,
      active: mapTab.classList.contains('active')
    });
  }
  
  if (registerTab) {
    console.log("Register tab:", {
      id: registerTab.id,
      visible: registerTab.offsetParent !== null,
      display: window.getComputedStyle(registerTab).display,
      classes: registerTab.className
    });
  }
  
  // Verifica se o mapa está vazando para outras abas
  const allTabs = document.querySelectorAll('.sub-tab-content');
  console.log("Todas as abas:");
  allTabs.forEach((tab, index) => {
    console.log(`Tab ${index + 1}:`, {
      id: tab.id,
      display: window.getComputedStyle(tab).display,
      visible: tab.offsetParent !== null
    });
  });
  
  console.log("=============================");
};

window.testTabNavigation = () => {
  console.log("=== TESTE NAVEGAÇÃO ABAS ===");
  
  // Encontra os botões de sub-navegação
  const subNavButtons = document.querySelectorAll('.sub-nav-btn');
  console.log("Botões de sub-navegação encontrados:", subNavButtons.length);
  
  subNavButtons.forEach((btn, index) => {
    const target = btn.getAttribute('data-target');
    console.log(`Botão ${index + 1}:`, {
      text: btn.textContent.trim(),
      target: target,
      active: btn.classList.contains('active')
    });
  });
  
  // Testa ativação da aba do mapa
  const mapButton = document.querySelector('[data-target="tab-content-mapa"]');
  const mapTab = document.getElementById('tab-content-mapa');
  
  if (mapButton && mapTab) {
    console.log("Testando ativação do mapa...");
    
    // Simula clique no botão do mapa
    mapButton.click();
    
    setTimeout(() => {
      console.log("Após clique no mapa:", {
        buttonActive: mapButton.classList.contains('active'),
        tabDisplay: window.getComputedStyle(mapTab).display,
        tabVisible: mapTab.offsetParent !== null
      });
    }, 100);
  } else {
    console.error("Botão ou aba do mapa não encontrados", { mapButton, mapTab });
  }
  
  console.log("==============================");
};

window.forceMobileLayout = () => {
  console.log("Forçando layout mobile...");
  
  if (window.innerWidth <= 768) {
    // Força ocultação dos elementos que não devem aparecer em mobile
    const elementsToHide = [
      'target-selection-desktop',
      'mitigation-selection-desktop', 
      'checklist-data-table-fieldset'
    ];
    
    elementsToHide.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.style.cssText = `
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
        `;
        console.log(`Ocultado: ${id}`);
      }
    });
    
    // Força ocultação por classes também
    const classElements = document.querySelectorAll('.target-selection-desktop, .mitigation-selection-desktop, .hide-on-mobile');
    classElements.forEach(element => {
      element.style.cssText = `
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
      `;
    });
    
    // Garante que o mapa possa ser ativado quando clicado, mas não força display
    const mapTab = document.getElementById('tab-content-mapa');
    if (mapTab) {
      // Remove apenas estilos que impedem ativação, mas respeita display da navegação
      mapTab.style.removeProperty('visibility');
      mapTab.style.removeProperty('opacity');
      console.log("Mapa liberado para ativação (respeitando navegação)");
    }
    
    console.log("Layout mobile forçado");
  } else {
    console.log("Não é mobile, não foi necessário forçar layout");
  }
};

document.addEventListener("DOMContentLoaded", initApp);
