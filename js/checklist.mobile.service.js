/**
 * ARBORIA 2.0 - CHECKLIST MOBILE SERVICE (v2.2 - Single Flashcard Navigation)
 * Serviço dedicado para gerenciar o fluxo do checklist de avaliação de risco no modo mobile.
 *
 * Updates:
 * - Navegação unitária (Flashcard por Flashcard) na etapa 1.
 * - Layout otimizado para foco em uma pergunta por vez.
 */

// ============================================================
// ESTADO DO SERVIÇO
// ============================================================

const checklistState = {
    currentStep: 1, // 1: checklist, 2: target, 3: risk, 4: confirm
    currentFlashcardIndex: 0, // Índice da pergunta atual (0-15)
    totalSteps: 4,
    answers: [], // Array de booleanos (true = Sim, false/undefined = Não)
    riskFactors: [], // Fatores de risco detectados
    totalScore: 0,
    targetCategory: null,
    mitigationAction: "nenhuma",
    failureProb: null,
    impactProb: null,
    riskLevel: null,
    residualRisk: null,
    isActive: false,
    hasUnsavedChanges: false,
  };
  
  // ============================================================
  // ELEMENTOS DO DOM
  // ============================================================
  
  let elements = null;
  
  const getElements = () => {
    // Sempre busca atualizado pois o DOM pode mudar
    const container = document.getElementById("checklist-flashcard-view");
    if (!container) return null;
  
    return {
      container,
      stepper: document.getElementById("risk-stepper"),
      stepItems: document.querySelectorAll(".step-item"),
  
      // Cards das diferentes etapas
      questionCard: document.getElementById("question-card"), // Agora contém o flashcard único
      targetCard: document.getElementById("target-card"),
      riskCard: document.getElementById("risk-card"),
      confirmCard: document.getElementById("confirm-card"),
  
      // Navegação Global (Rodapé)
      navContainer: document.querySelector(".mobile-checklist-nav"),
      btnPrev: document.getElementById("flashcard-prev"),
      btnNext: document.getElementById("flashcard-next"),
      btnClose: document.getElementById("close-checklist-btn"),
  
      // Elementos da etapa de alvo
      targetOptions: document.querySelectorAll('input[name="target-category"]'),
  
      // Elementos da etapa de risco
      riskSummary: document.getElementById("risk-summary"),
      mitigationSelect: document.getElementById("mitigation-action"),
  
      // Elementos de confirmação
      confirmSummary: document.getElementById("confirm-summary"),
  
      // Tabela de perguntas (hidden, mas fonte de dados)
      dataRows: document.querySelectorAll(
        "#risk-calculator-form .risk-table tbody tr",
      ),
    };
  };
  
  // ============================================================
  // CONFIGURAÇÃO DAS PERGUNTAS
  // ============================================================
  
  const questions = [
    { num: 1, text: "Há galhos mortos com diâmetro superior a 5 cm?", weight: 3 },
    {
      num: 2,
      text: "Existem rachaduras ou fendas no tronco ou galhos principais?",
      weight: 5,
    },
    {
      num: 3,
      text: "Há sinais de apodrecimento (madeira esponjosa, fungos, cavidades)?",
      weight: 5,
    },
    {
      num: 4,
      text: 'A árvore possui uniões em "V" com casca inclusa?',
      weight: 4,
    },
    { num: 5, text: "Há galhos cruzados ou friccionando entre si?", weight: 2 },
    {
      num: 6,
      text: "A árvore apresenta copa assimétrica (>30% de desequilíbrio)?",
      weight: 2,
    },
    { num: 7, text: "Há sinais de inclinação anormal ou recente?", weight: 5 },
    {
      num: 8,
      text: "A árvore está próxima a vias públicas ou áreas de circulação?",
      weight: 5,
    },
    {
      num: 9,
      text: "Há risco de queda sobre edificações, veículos ou pessoas?",
      weight: 5,
    },
    {
      num: 10,
      text: "A árvore interfere em redes elétricas ou estruturas urbanas?",
      weight: 4,
    },
    {
      num: 11,
      text: "A espécie é conhecida por apresentar alta taxa de falhas?",
      weight: 3,
    },
    {
      num: 12,
      text: "A árvore já sofreu podas drásticas ou brotação epicórmica intensa?",
      weight: 3,
    },
    {
      num: 13,
      text: "Há calçadas rachadas ou tubulações expostas próximas à base?",
      weight: 3,
    },
    {
      num: 14,
      text: "Há perda visível de raízes de sustentação (>40%)?",
      weight: 5,
    },
    {
      num: 15,
      text: "Há sinais de compactação ou asfixia radicular?",
      weight: 3,
    },
    { num: 16, text: "Há apodrecimento em raízes primárias (>3 cm)?", weight: 5 },
  ];
  
  // ============================================================
  // LÓGICA DE RISCO TRAQ/ISA
  // ============================================================
  
  const getFailureProb = (score) => {
    if (score >= 30) return "Iminente";
    if (score >= 20) return "Provável";
    if (score >= 10) return "Possível";
    return "Improvável";
  };
  
  const getImpactProb = (targetVal) => {
    const value = parseInt(targetVal, 10);
    if (value === 1) return "Muito Baixo";
    if (value === 2) return "Baixo";
    if (value === 3) return "Médio";
    if (value === 4) return "Alto";
    return "Muito Baixo";
  };
  
  const runTraqMatrices = (failureProb, impactProb, targetCategory) => {
    const impactProbMap = { "Muito Baixo": 0, Baixo: 1, Médio: 2, Alto: 3 };
    const impactIndex = impactProbMap[impactProb];
  
    const eventLikelihoodMatrix = {
      Improvável: [
        "Muito Improvável",
        "Muito Improvável",
        "Improvável",
        "Improvável",
      ],
      Possível: ["Muito Improvável", "Improvável", "Provável", "Provável"],
      Provável: ["Improvável", "Provável", "Muito Provável", "Muito Provável"],
      Iminente: [
        "Improvável",
        "Muito Provável",
        "Muito Provável",
        "Muito Provável",
      ],
    };
  
    const eventLikelihood =
      eventLikelihoodMatrix[failureProb]?.[impactIndex] || "Muito Improvável";
  
    const consequence =
      parseInt(targetCategory, 10) === 4 ? "Severa" : "Significante";
    const consequenceMap = { Mínima: 0, Menor: 1, Significante: 2, Severa: 3 };
    const consequenceIndex = consequenceMap[consequence];
  
    const riskRatingMatrix = {
      "Muito Provável": ["Moderado", "Alto", "Extremo", "Extremo"],
      Provável: ["Baixo", "Moderado", "Alto", "Extremo"],
      Improvável: ["Baixo", "Baixo", "Moderado", "Alto"],
      "Muito Improvável": ["Baixo", "Baixo", "Baixo", "Moderado"],
    };
  
    return riskRatingMatrix[eventLikelihood]?.[consequenceIndex] || "Baixo";
  };
  
  const getReducedFailureProb = (failureProb) => {
    const reductionMap = {
      Iminente: "Provável",
      Provável: "Possível",
      Possível: "Improvável",
      Improvável: "Improvável",
    };
    return reductionMap[failureProb] || "Improvável";
  };
  
  // ============================================================
  // FUNÇÕES DE RENDERIZAÇÃO
  // ============================================================
  
  const updateStepper = () => {
    const els = getElements();
    if (!els || !els.stepItems) return;
  
    els.stepItems.forEach((item, index) => {
      const stepNum = index + 1;
      item.classList.remove("active", "completed");
  
      if (stepNum < checklistState.currentStep) {
        item.classList.add("completed");
      } else if (stepNum === checklistState.currentStep) {
        item.classList.add("active");
      }
      
      // Navegação direta pelo stepper
      item.onclick = () => {
          // Se clicar no passo 1, volta para o primeiro flashcard ou mantém onde estava?
          // Melhor manter onde estava se já estiver no passo 1, senão reseta.
          if (stepNum === 1 && checklistState.currentStep !== 1) {
             checklistState.currentFlashcardIndex = 0;
          }
          checklistState.currentStep = stepNum;
          showCurrentStepCard();
      }
    });
  };
  
  /**
   * Renderiza UM ÚNICO Flashcard (Pergunta) por vez
   */
  const renderCurrentFlashcard = () => {
    const els = getElements();
    if (!els || !els.questionCard) return;
  
    const idx = checklistState.currentFlashcardIndex;
    const q = questions[idx];
    const isChecked = checklistState.answers[idx] || false;
    const totalQ = questions.length;
    
    // Calcula progresso
    const progressPercent = ((idx + 1) / totalQ) * 100;

    const html = `
        <div class="single-flashcard-container">
            <div class="flashcard-header">
                <span class="flashcard-counter">Fator ${idx + 1} de ${totalQ}</span>
                <div class="flashcard-progress-bar">
                    <div class="flashcard-progress-fill" style="width: ${progressPercent}%"></div>
                </div>
            </div>

            <div class="flashcard-body">
                <div class="flashcard-weight-badge">Peso: ${q.weight}</div>
                <h2 class="flashcard-question-text">${q.text}</h2>
                
                <div class="flashcard-interaction-area">
                    <p class="interaction-label">${isChecked ? 'Risco Identificado' : 'Não Identificado'}</p>
                    <label class="big-toggle-switch">
                        <input type="checkbox" class="single-q-checkbox" data-index="${idx}" ${isChecked ? 'checked' : ''}>
                        <span class="big-slider">
                            <span class="slider-icon-no"><i class="fas fa-times"></i></span>
                            <span class="slider-icon-yes"><i class="fas fa-check"></i></span>
                        </span>
                    </label>
                </div>
            </div>
        </div>
    `;
  
    els.questionCard.innerHTML = html;
  
    // Listener para o checkbox
    const checkbox = els.questionCard.querySelector('.single-q-checkbox');
    if (checkbox) {
        checkbox.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            checklistState.answers[idx] = isChecked;
            checklistState.hasUnsavedChanges = true;
            
            // Atualiza texto visualmente
            const label = els.questionCard.querySelector('.interaction-label');
            if (label) label.textContent = isChecked ? 'Risco Identificado' : 'Não Identificado';

            syncAnswerToForm(idx, isChecked);
            
            // Opcional: Auto-avanço após delay curto se marcar SIM? 
            // Melhor não, deixa o usuário controlar.
        });
    }
  };
  
  /**
   * Renderiza resumo das respostas "Sim"
   */
  const renderSummary = () => {
    checklistState.riskFactors = [];
    checklistState.totalScore = 0;
  
    checklistState.answers.forEach((answer, idx) => {
      if (answer) {
        const question = questions[idx];
        checklistState.riskFactors.push({
          num: question.num,
          text: question.text,
          weight: question.weight,
        });
        checklistState.totalScore += question.weight;
      }
    });
  
    return {
      factors: checklistState.riskFactors,
      score: checklistState.totalScore,
      count: checklistState.riskFactors.length,
    };
  };
  
  const renderTargetSelection = () => {
    const els = getElements();
    if (!els) return;
  
    const summary = renderSummary();
  
    let summaryHTML = `
      <div class="checklist-summary" style="background:rgba(255,255,255,0.05); padding:15px; border-radius:8px; margin-bottom:20px;">
        <h3 style="margin-bottom:10px;">📊 Resumo Parcial</h3>
        <div class="summary-stats" style="display:flex; justify-content:space-between;">
          <div class="stat-item">
            <span class="stat-label">Fatores:</span>
            <strong>${summary.count}</strong>
          </div>
          <div class="stat-item">
            <span class="stat-label">Pontuação:</span>
            <strong>${summary.score}</strong>
          </div>
        </div>
      </div>
    `;
  
    const summaryContainer = els.targetCard.querySelector(".summary-container");
    if (summaryContainer) {
      summaryContainer.innerHTML = summaryHTML;
    }
  
    if (checklistState.targetCategory) {
      els.targetOptions.forEach((radio) => {
        if (radio.value === String(checklistState.targetCategory)) {
          radio.checked = true;
        }
      });
    }
  };
  
  const renderRiskCalculation = () => {
    const els = getElements();
    if (!els) return;

    const targetCat = checklistState.targetCategory || "1";
    
    checklistState.failureProb = getFailureProb(checklistState.totalScore);
    checklistState.impactProb = getImpactProb(targetCat);
    checklistState.riskLevel = runTraqMatrices(
      checklistState.failureProb,
      checklistState.impactProb,
      targetCat,
    );
  
    const reducedFailure = getReducedFailureProb(checklistState.failureProb);
    checklistState.residualRisk = runTraqMatrices(
      reducedFailure,
      checklistState.impactProb,
      targetCat,
    );
  
    const riskHTML = `
      <div class="risk-calculation-summary" style="padding-bottom:20px;">
        <h3>⚠️ Avaliação de Risco TRAQ</h3>
  
        <div class="risk-metrics">
          <div class="metric-card">
            <span class="metric-label">Probabilidade de Falha</span>
            <span class="metric-value">${checklistState.failureProb}</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Probabilidade de Impacto</span>
            <span class="metric-value">${checklistState.impactProb}</span>
          </div>
          <div class="metric-card primary">
            <span class="metric-label">Nível de Risco Inicial</span>
            <span class="metric-value risk-${checklistState.riskLevel.toLowerCase()}">${checklistState.riskLevel}</span>
          </div>
        </div>
      </div>
    `;
  
    if (els.riskSummary) {
      els.riskSummary.innerHTML = riskHTML;
    }
  
    if (els.mitigationSelect && checklistState.mitigationAction) {
      els.mitigationSelect.value = checklistState.mitigationAction;
    }
  };
  
  const renderConfirmation = () => {
    const els = getElements();
    if (!els) return;
  
    const confirmHTML = `
      <div class="confirmation-summary" style="padding-bottom:40px;">
        <h3>✅ Resumo Final</h3>
  
        <div class="confirm-section">
          <p><strong>${checklistState.riskFactors.length}</strong> Fatores (Score: ${checklistState.totalScore})</p>
          <p>Alvo: ${getTargetCategoryLabel(checklistState.targetCategory || 1)}</p>
          <p>Mitigação: ${getMitigationLabel(checklistState.mitigationAction)}</p>
          <hr style="border:0; border-top:1px solid rgba(255,255,255,0.1); margin:10px 0;">
          <p style="font-size:1.2rem;">Risco Final: <span class="risk-badge risk-${checklistState.residualRisk?.toLowerCase() || 'baixo'}">${checklistState.residualRisk || 'Baixo'}</span></p>
        </div>

        <button type="button" id="btn-finish-assessment-action" class="btn-finish-action">
            <i class="fas fa-check-circle"></i> Concluir Avaliação
        </button>
      </div>
    `;
  
    if (els.confirmSummary) {
      els.confirmSummary.innerHTML = confirmHTML;
    }
  };
  
  const getTargetCategoryLabel = (value) => {
    const labels = {
      1: "Raro (1)",
      2: "Ocasional (2)",
      3: "Frequente (3)",
      4: "Constante (4)",
    };
    return labels[String(value)] || "Não definido";
  };
  
  const getMitigationLabel = (value) => {
    const labels = {
      nenhuma: "Nenhuma",
      monitoramento: "Monitoramento",
      poda: "Poda",
      reducao: "Redução",
      remocao: "Remoção",
    };
    return labels[value] || "Não definido";
  };
  
  // ============================================================
  // NAVEGAÇÃO
  // ============================================================
  
  const showCurrentStepCard = () => {
    const els = getElements();
    if (!els) return;
  
    // Oculta todos
    [els.questionCard, els.targetCard, els.riskCard, els.confirmCard].forEach(
      (card) => {
        if (card) card.style.display = "none";
      },
    );
  
    // Mostra atual
    switch (checklistState.currentStep) {
      case 1:
        if (els.questionCard) {
          els.questionCard.style.display = "flex"; // Flex para centralizar
          renderCurrentFlashcard(); 
        }
        break;
      case 2:
        if (els.targetCard) {
          els.targetCard.style.display = "flex";
          renderTargetSelection();
        }
        break;
      case 3:
        if (els.riskCard) {
          els.riskCard.style.display = "flex";
          renderRiskCalculation();
        }
        break;
      case 4:
        if (els.confirmCard) {
          els.confirmCard.style.display = "flex";
          renderConfirmation();
          
          setTimeout(() => {
              const finishBtn = document.getElementById('btn-finish-assessment-action');
              if (finishBtn) {
                  finishBtn.onclick = handleConfirmSave;
              }
          }, 100);
        }
        break;
    }
    
    updateNavigationButtons();
    updateStepper();
    
    // Scroll para o topo ao mudar de aba
    if (els.container) els.container.scrollTop = 0;
  };

  const updateNavigationButtons = () => {
      const els = getElements();
      if (!els) return;

      // Lógica do botão Voltar
      if (checklistState.currentStep === 1 && checklistState.currentFlashcardIndex === 0) {
          els.btnPrev.disabled = true;
          els.btnPrev.style.opacity = '0.5';
      } else {
          els.btnPrev.disabled = false;
          els.btnPrev.style.opacity = '1';
      }

      // Lógica do botão Próximo
      if (checklistState.currentStep === 4) {
          els.btnNext.style.display = 'none';
      } else {
          els.btnNext.style.display = 'block';
          els.btnNext.textContent = 'Próximo ❯';
      }
  };
  
  const goToNextStep = () => {
    // Se estiver na etapa 1 (Flashcards), navega entre os cards primeiro
    if (checklistState.currentStep === 1) {
        if (checklistState.currentFlashcardIndex < questions.length - 1) {
            checklistState.currentFlashcardIndex++;
            renderCurrentFlashcard();
            updateNavigationButtons();
            return; // Não muda de step global ainda
        }
    }

    // Se não for etapa 1 ou se acabou os flashcards, avança o step global
    if (checklistState.currentStep < checklistState.totalSteps) {
      checklistState.currentStep++;
      showCurrentStepCard();
    }
  };
  
  const goToPreviousStep = () => {
    // Se estiver na etapa 1 e não for o primeiro card, volta o card
    if (checklistState.currentStep === 1) {
        if (checklistState.currentFlashcardIndex > 0) {
            checklistState.currentFlashcardIndex--;
            renderCurrentFlashcard();
            updateNavigationButtons();
            return;
        }
    }

    // Volta step global
    if (checklistState.currentStep > 1) {
      checklistState.currentStep--;
      showCurrentStepCard();
    }
  };
  
  // ============================================================
  // HANDLERS
  // ============================================================
  
  const syncAnswerToForm = (index, value) => {
    const els = getElements();
    if (!els || !els.dataRows[index]) return;
  
    const checkbox = els.dataRows[index].querySelector(".risk-checkbox");
    if (checkbox) {
      checkbox.checked = value;
    }
  };
  
  const handleTargetSelection = (e) => {
    checklistState.targetCategory = e.target.value;
    checklistState.hasUnsavedChanges = true;
  };
  
  const handleMitigationSelection = (e) => {
    checklistState.mitigationAction = e.target.value;
    checklistState.hasUnsavedChanges = true;
    renderRiskCalculation();
  };
  
  const handleClose = () => {
    closeChecklist();
  };
  
  const handleConfirmSave = () => {
    transferDataToForm();
    closeChecklist();
    
    const event = new CustomEvent("checklist:completed", {
      detail: { ...checklistState },
    });
    document.dispatchEvent(event);
  };
  
  const transferDataToForm = () => {
    const form = document.getElementById("risk-calculator-form");
    if (!form) return;
  
    const targetInput = form.querySelector('input[name="target-category"]');
    if (checklistState.targetCategory) {
        const desktopRadios = form.querySelectorAll('input[name="target_category_desktop"]');
        desktopRadios.forEach(r => {
            if (r.value == checklistState.targetCategory) r.checked = true;
        });
    }
  
    const mitigationInput = form.querySelector('#mitigation-action-desktop');
    if (mitigationInput) {
      mitigationInput.value = checklistState.mitigationAction;
    }
  };
  
  // ============================================================
  // INICIALIZAÇÃO
  // ============================================================
  
  const openChecklist = () => {
    const els = getElements();
    if (!els) return false;
  
    setupEventListeners();
  
    els.container.classList.add("active");
    checklistState.isActive = true;
    
    document.body.style.overflow = 'hidden';
  
    showCurrentStepCard();
    return true;
  };
  
  const closeChecklist = () => {
    const els = getElements();
    if (!els) return;
    els.container.classList.remove("active");
    checklistState.isActive = false;
    
    document.body.style.overflow = '';
  };
  
  let listenersAttached = false;
  const setupEventListeners = () => {
    if (listenersAttached) return;
    const els = getElements();
    if (!els) return;
  
    if (els.btnNext) els.btnNext.addEventListener("click", goToNextStep);
    if (els.btnPrev) els.btnPrev.addEventListener("click", goToPreviousStep);
    if (els.btnClose) els.btnClose.addEventListener("click", handleClose);
  
    if (els.targetOptions) {
      els.targetOptions.forEach((radio) => {
        radio.addEventListener("change", handleTargetSelection);
      });
    }
  
    if (els.mitigationSelect) {
      els.mitigationSelect.addEventListener("change", handleMitigationSelection);
    }
  
    listenersAttached = true;
  };
  
  const initWithData = (treeData) => {
    checklistState.answers = new Array(16).fill(false);
    checklistState.currentFlashcardIndex = 0; // Reset index
    checklistState.currentStep = 1; // Reset step
    
    const els = getElements();
    if (els && els.dataRows) {
        els.dataRows.forEach((row, idx) => {
            const checkbox = row.querySelector('.risk-checkbox');
            if (checkbox) checklistState.answers[idx] = checkbox.checked;
        });
    }

    const desktopTarget = document.querySelector('input[name="target_category_desktop"]:checked');
    if (desktopTarget) checklistState.targetCategory = desktopTarget.value;

    const desktopMitigation = document.getElementById('mitigation-action-desktop');
    if (desktopMitigation) checklistState.mitigationAction = desktopMitigation.value;
    
    return openChecklist();
  };
  
  export const ChecklistMobileService = {
    open: openChecklist,
    close: closeChecklist,
    initWithData,
    getState: () => ({ ...checklistState }),
  };
