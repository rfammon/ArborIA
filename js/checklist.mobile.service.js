/**
 * ARBORIA 2.0 - CHECKLIST MOBILE SERVICE (v1.0)
 * Serviço dedicado para gerenciar o fluxo do checklist de avaliação de risco no modo mobile.
 *
 * Fluxo:
 * 1. Perguntas do Checklist (16 perguntas)
 * 2. Seleção do Alvo
 * 3. Cálculo de Risco e Mitigação
 * 4. Confirmação e Salvamento
 */

// ============================================================
// ESTADO DO SERVIÇO
// ============================================================

const checklistState = {
  currentStep: 1, // 1: checklist, 2: target, 3: risk, 4: confirm
  totalSteps: 4,
  currentQuestionIndex: 0,
  totalQuestions: 16,
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
  if (elements) return elements;

  const container = document.getElementById("checklist-flashcard-view");
  if (!container) return null;

  elements = {
    container,
    stepper: document.getElementById("risk-stepper"),
    stepItems: document.querySelectorAll(".step-item"),

    // Cards das diferentes etapas
    questionCard: document.getElementById("question-card"),
    targetCard: document.getElementById("target-card"),
    riskCard: document.getElementById("risk-card"),
    confirmCard: document.getElementById("confirm-card"),

    // Elementos da etapa de perguntas
    questionCounter: document.getElementById("flashcard-counter"),
    questionText: document.getElementById("flashcard-question-text"),
    questionWeight: document.getElementById("flashcard-question-weight"),
    toggleInput: document.getElementById("flashcard-toggle-input"),

    // Navegação
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
    btnConfirmSave: document.getElementById("confirm-save-btn"),

    // Tabela de perguntas (hidden, mas fonte de dados)
    dataRows: document.querySelectorAll(
      "#risk-calculator-form .risk-table tbody tr",
    ),
  };

  return elements;
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

/**
 * Converte pontuação em probabilidade de falha (Tabela 2 TRAQ)
 */
const getFailureProb = (score) => {
  if (score >= 30) return "Iminente";
  if (score >= 20) return "Provável";
  if (score >= 10) return "Possível";
  return "Improvável";
};

/**
 * Mapeia categoria do alvo para probabilidade de impacto (Tabela 4 TRAQ)
 */
const getImpactProb = (targetVal) => {
  const value = parseInt(targetVal, 10);
  if (value === 1) return "Muito Baixo";
  if (value === 2) return "Baixo";
  if (value === 3) return "Médio";
  if (value === 4) return "Alto";
  return "Muito Baixo";
};

/**
 * Executa matrizes TRAQ para determinar nível de risco
 */
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

/**
 * Reduz probabilidade de falha para cálculo de risco residual
 */
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

/**
 * Atualiza o stepper visual
 */
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
  });
};

/**
 * Renderiza a pergunta atual do checklist
 */
const renderQuestion = () => {
  const els = getElements();
  if (!els) return;

  const idx = checklistState.currentQuestionIndex;
  const question = questions[idx];

  if (!question) return;

  // Atualiza contador
  els.questionCounter.textContent = `Pergunta ${idx + 1} de ${checklistState.totalQuestions}`;

  // Atualiza texto da pergunta
  els.questionText.textContent = question.text;

  // Atualiza peso (se elemento existe)
  if (els.questionWeight) {
    els.questionWeight.textContent = `Peso: ${question.weight}`;
  }

  // Define estado do toggle baseado na resposta anterior
  els.toggleInput.checked = checklistState.answers[idx] || false;

  // Atualiza classe do card baseado na resposta
  if (checklistState.answers[idx]) {
    els.questionCard.classList.add("answered-yes");
  } else {
    els.questionCard.classList.remove("answered-yes");
  }

  // Atualiza botões de navegação
  els.btnPrev.disabled = idx === 0;

  // Texto do botão "Próxima" muda na última pergunta
  if (idx === checklistState.totalQuestions - 1) {
    els.btnNext.textContent = "Concluir ✓";
  } else {
    els.btnNext.textContent = "Próxima ❯";
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

/**
 * Renderiza a etapa de seleção de alvo
 */
const renderTargetSelection = () => {
  const els = getElements();
  if (!els) return;

  const summary = renderSummary();

  // Cria HTML do resumo
  let summaryHTML = `
    <div class="checklist-summary">
      <h3>📊 Resumo da Avaliação</h3>
      <div class="summary-stats">
        <div class="stat-item">
          <span class="stat-label">Fatores de Risco:</span>
          <span class="stat-value">${summary.count}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Pontuação Total:</span>
          <span class="stat-value">${summary.score}</span>
        </div>
      </div>
  `;

  if (summary.factors.length > 0) {
    summaryHTML += '<ul class="risk-factors-list">';
    summary.factors.forEach((factor) => {
      summaryHTML += `<li><strong>P${factor.num}:</strong> ${factor.text} (${factor.weight})</li>`;
    });
    summaryHTML += "</ul>";
  } else {
    summaryHTML +=
      '<p class="no-risks">✓ Nenhum fator de risco identificado</p>';
  }

  summaryHTML += "</div>";

  // Injeta resumo no card de alvo (se houver container específico)
  const summaryContainer = els.targetCard.querySelector(".summary-container");
  if (summaryContainer) {
    summaryContainer.innerHTML = summaryHTML;
  }

  // Restaura seleção anterior se existir
  if (checklistState.targetCategory) {
    els.targetOptions.forEach((radio) => {
      if (radio.value === String(checklistState.targetCategory)) {
        radio.checked = true;
      }
    });
  }
};

/**
 * Renderiza a etapa de cálculo de risco
 */
const renderRiskCalculation = () => {
  const els = getElements();
  if (!els || !checklistState.targetCategory) return;

  // Calcula probabilidades e risco
  checklistState.failureProb = getFailureProb(checklistState.totalScore);
  checklistState.impactProb = getImpactProb(checklistState.targetCategory);
  checklistState.riskLevel = runTraqMatrices(
    checklistState.failureProb,
    checklistState.impactProb,
    checklistState.targetCategory,
  );

  // Calcula risco residual (após mitigação)
  const reducedFailure = getReducedFailureProb(checklistState.failureProb);
  checklistState.residualRisk = runTraqMatrices(
    reducedFailure,
    checklistState.impactProb,
    checklistState.targetCategory,
  );

  // Gera HTML do resumo de risco
  const riskHTML = `
    <div class="risk-calculation-summary">
      <h3>⚠️ Avaliação de Risco TRAQ</h3>

      <div class="risk-metrics">
        <div class="metric-card">
          <span class="metric-label">Probabilidade de Falha:</span>
          <span class="metric-value">${checklistState.failureProb}</span>
        </div>
        <div class="metric-card">
          <span class="metric-label">Probabilidade de Impacto:</span>
          <span class="metric-value">${checklistState.impactProb}</span>
        </div>
        <div class="metric-card primary">
          <span class="metric-label">Nível de Risco Inicial:</span>
          <span class="metric-value risk-${checklistState.riskLevel.toLowerCase()}">${checklistState.riskLevel}</span>
        </div>
      </div>

      <div class="mitigation-section">
        <h4>🛠️ Ação de Mitigação</h4>
        <p class="helper-text">Selecione a ação recomendada para reduzir o risco:</p>
      </div>

      <div class="residual-risk-section">
        <h4>📉 Risco Residual (Após Mitigação)</h4>
        <div class="residual-value risk-${checklistState.residualRisk.toLowerCase()}">
          ${checklistState.residualRisk}
        </div>
        <p class="helper-text">Este é o risco estimado após a implementação da mitigação.</p>
      </div>
    </div>
  `;

  if (els.riskSummary) {
    els.riskSummary.innerHTML = riskHTML;
  }

  // Restaura seleção de mitigação se existir
  if (els.mitigationSelect && checklistState.mitigationAction) {
    els.mitigationSelect.value = checklistState.mitigationAction;
  }
};

/**
 * Renderiza a etapa de confirmação final
 */
const renderConfirmation = () => {
  const els = getElements();
  if (!els) return;

  const confirmHTML = `
    <div class="confirmation-summary">
      <h3>✅ Confirmar Dados</h3>

      <div class="confirm-section">
        <h4>Fatores de Risco Identificados:</h4>
        <p><strong>${checklistState.riskFactors.length}</strong> fatores (Pontuação: ${checklistState.totalScore})</p>
      </div>

      <div class="confirm-section">
        <h4>Categoria do Alvo:</h4>
        <p>${getTargetCategoryLabel(checklistState.targetCategory)}</p>
      </div>

      <div class="confirm-section">
        <h4>Nível de Risco:</h4>
        <p class="risk-badge risk-${checklistState.riskLevel.toLowerCase()}">${checklistState.riskLevel}</p>
      </div>

      <div class="confirm-section">
        <h4>Ação de Mitigação:</h4>
        <p>${getMitigationLabel(checklistState.mitigationAction)}</p>
      </div>

      <div class="confirm-section">
        <h4>Risco Residual:</h4>
        <p class="risk-badge risk-${checklistState.residualRisk.toLowerCase()}">${checklistState.residualRisk}</p>
      </div>

      <div class="confirm-actions">
        <p class="helper-text">Os dados serão salvos no formulário principal. Clique em "Salvar Árvore" para finalizar.</p>
      </div>
    </div>
  `;

  if (els.confirmSummary) {
    els.confirmSummary.innerHTML = confirmHTML;
  }
};

/**
 * Helper: Retorna label da categoria do alvo
 */
const getTargetCategoryLabel = (value) => {
  const labels = {
    1: "Categoria 1 - Área raramente ocupada",
    2: "Categoria 2 - Ocupação ocasional",
    3: "Categoria 3 - Ocupação frequente",
    4: "Categoria 4 - Ocupação constante",
  };
  return labels[String(value)] || "Não definido";
};

/**
 * Helper: Retorna label da ação de mitigação
 */
const getMitigationLabel = (value) => {
  const labels = {
    nenhuma: "Nenhuma ação necessária",
    monitoramento: "Monitoramento regular",
    poda: "Poda corretiva",
    reducao: "Redução de copa",
    remocao: "Remoção da árvore",
  };
  return labels[value] || "Não definido";
};

// ============================================================
// NAVEGAÇÃO ENTRE ETAPAS
// ============================================================

/**
 * Mostra o card correspondente à etapa atual
 */
const showCurrentStepCard = () => {
  const els = getElements();
  if (!els) return;

  // Oculta todos os cards
  [els.questionCard, els.targetCard, els.riskCard, els.confirmCard].forEach(
    (card) => {
      if (card) card.style.display = "none";
    },
  );

  // Mostra card da etapa atual
  switch (checklistState.currentStep) {
    case 1:
      if (els.questionCard) {
        els.questionCard.style.display = "flex";
        renderQuestion();
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
      }
      break;
  }

  updateStepper();
};

/**
 * Avança para próxima etapa
 */
const goToNextStep = () => {
  // Validações específicas de cada etapa
  if (checklistState.currentStep === 1) {
    // Checklist: deve ter completado todas as perguntas
    if (
      checklistState.currentQuestionIndex <
      checklistState.totalQuestions - 1
    ) {
      return false; // Ainda há perguntas
    }
  } else if (checklistState.currentStep === 2) {
    // Alvo: deve ter selecionado categoria
    if (!checklistState.targetCategory) {
      alert("Por favor, selecione uma categoria de alvo.");
      return false;
    }
  } else if (checklistState.currentStep === 3) {
    // Risco: deve ter selecionado mitigação
    if (!checklistState.mitigationAction) {
      checklistState.mitigationAction = "nenhuma";
    }
  }

  if (checklistState.currentStep < checklistState.totalSteps) {
    checklistState.currentStep++;
    checklistState.hasUnsavedChanges = true;
    showCurrentStepCard();
    return true;
  }

  return false;
};

/**
 * Volta para etapa anterior
 */
const goToPreviousStep = () => {
  if (checklistState.currentStep > 1) {
    checklistState.currentStep--;
    showCurrentStepCard();
    return true;
  }
  return false;
};

/**
 * Navega para pergunta específica (dentro da etapa 1)
 */
const goToQuestion = (index) => {
  if (index >= 0 && index < checklistState.totalQuestions) {
    checklistState.currentQuestionIndex = index;
    renderQuestion();
    return true;
  }
  return false;
};

/**
 * Próxima pergunta do checklist
 */
const nextQuestion = () => {
  if (checklistState.currentQuestionIndex < checklistState.totalQuestions - 1) {
    checklistState.currentQuestionIndex++;
    renderQuestion();
    return true;
  } else {
    // Última pergunta: avança para próxima etapa
    return goToNextStep();
  }
};

/**
 * Pergunta anterior do checklist
 */
const previousQuestion = () => {
  if (checklistState.currentQuestionIndex > 0) {
    checklistState.currentQuestionIndex--;
    renderQuestion();
    return true;
  }
  return false;
};

// ============================================================
// HANDLERS DE EVENTOS
// ============================================================

/**
 * Handler para resposta da pergunta (toggle)
 */
const handleAnswerChange = (e) => {
  const isChecked = e.target.checked;
  checklistState.answers[checklistState.currentQuestionIndex] = isChecked;
  checklistState.hasUnsavedChanges = true;

  // Atualiza visual do card
  const els = getElements();
  if (els && els.questionCard) {
    if (isChecked) {
      els.questionCard.classList.add("answered-yes");
    } else {
      els.questionCard.classList.remove("answered-yes");
    }
  }

  // Sincroniza com checkbox real do formulário (se existir)
  syncAnswerToForm(checklistState.currentQuestionIndex, isChecked);
};

/**
 * Sincroniza resposta com formulário hidden
 */
const syncAnswerToForm = (index, value) => {
  const els = getElements();
  if (!els || !els.dataRows[index]) return;

  const checkbox = els.dataRows[index].querySelector(".risk-checkbox");
  if (checkbox) {
    checkbox.checked = value;
  }
};

/**
 * Handler para seleção de categoria de alvo
 */
const handleTargetSelection = (e) => {
  checklistState.targetCategory = e.target.value;
  checklistState.hasUnsavedChanges = true;
};

/**
 * Handler para seleção de mitigação
 */
const handleMitigationSelection = (e) => {
  checklistState.mitigationAction = e.target.value;
  checklistState.hasUnsavedChanges = true;

  // Recalcula risco residual
  const reducedFailure = getReducedFailureProb(checklistState.failureProb);
  checklistState.residualRisk = runTraqMatrices(
    reducedFailure,
    checklistState.impactProb,
    checklistState.targetCategory,
  );

  // Atualiza visualização
  renderRiskCalculation();
};

/**
 * Handler para navegação (próximo)
 */
const handleNext = () => {
  if (checklistState.currentStep === 1) {
    nextQuestion();
  } else {
    goToNextStep();
  }
};

/**
 * Handler para navegação (anterior)
 */
const handlePrevious = () => {
  if (checklistState.currentStep === 1) {
    previousQuestion();
  } else {
    goToPreviousStep();
  }
};

/**
 * Handler para fechar modal
 */
const handleClose = () => {
  if (checklistState.hasUnsavedChanges) {
    const confirm = window.confirm(
      "Você tem dados não salvos. Deseja realmente fechar?",
    );
    if (!confirm) return;
  }

  closeChecklist();
};

/**
 * Handler para confirmar e salvar
 */
const handleConfirmSave = () => {
  // Transfere dados para o formulário principal
  transferDataToForm();

  // Fecha o modal
  closeChecklist();

  // Pode disparar evento customizado para indicar conclusão
  const event = new CustomEvent("checklist:completed", {
    detail: {
      riskFactors: checklistState.riskFactors,
      score: checklistState.totalScore,
      targetCategory: checklistState.targetCategory,
      riskLevel: checklistState.riskLevel,
      mitigation: checklistState.mitigationAction,
      residualRisk: checklistState.residualRisk,
    },
  });
  document.dispatchEvent(event);
};

/**
 * Transfere dados do checklist para o formulário principal
 */
const transferDataToForm = () => {
  const form = document.getElementById("risk-calculator-form");
  if (!form) return;

  // Atualiza campo hidden de categoria do alvo (se existir)
  const targetInput = form.querySelector('input[name="target-category"]');
  if (targetInput) {
    targetInput.value = checklistState.targetCategory;
  }

  // Atualiza campo de mitigação
  const mitigationInput = form.querySelector(
    '#mitigation-action, select[name="mitigation"]',
  );
  if (mitigationInput) {
    mitigationInput.value = checklistState.mitigationAction;
  }

  // Atualiza campos de risco (podem ser inputs hidden)
  const riskLevelInput = form.querySelector('input[name="risk-level"]');
  if (riskLevelInput) {
    riskLevelInput.value = checklistState.riskLevel;
  }

  const residualRiskInput = form.querySelector('input[name="residual-risk"]');
  if (residualRiskInput) {
    residualRiskInput.value = checklistState.residualRisk;
  }

  // Atualiza campo de fatores de risco (JSON)
  const riskFactorsInput = form.querySelector('input[name="risk-factors"]');
  if (riskFactorsInput) {
    riskFactorsInput.value = JSON.stringify(checklistState.riskFactors);
  }
};

// ============================================================
// INICIALIZAÇÃO E CONTROLE
// ============================================================

/**
 * Inicializa o serviço e abre o checklist
 */
const openChecklist = () => {
  const els = getElements();
  if (!els) {
    console.error("Checklist Mobile Service: Elementos não encontrados");
    return false;
  }

  // Reseta estado
  resetState();

  // Configura event listeners
  setupEventListeners();

  // Mostra modal
  els.container.classList.add("active");
  checklistState.isActive = true;

  // Mostra primeira pergunta
  showCurrentStepCard();

  return true;
};

/**
 * Fecha o checklist
 */
const closeChecklist = () => {
  const els = getElements();
  if (!els) return;

  els.container.classList.remove("active");
  checklistState.isActive = false;
  checklistState.hasUnsavedChanges = false;

  // Remove event listeners para evitar duplicação
  removeEventListeners();
};

/**
 * Reseta o estado do checklist
 */
const resetState = () => {
  checklistState.currentStep = 1;
  checklistState.currentQuestionIndex = 0;
  checklistState.answers = [];
  checklistState.riskFactors = [];
  checklistState.totalScore = 0;
  checklistState.targetCategory = null;
  checklistState.mitigationAction = "nenhuma";
  checklistState.failureProb = null;
  checklistState.impactProb = null;
  checklistState.riskLevel = null;
  checklistState.residualRisk = null;
  checklistState.hasUnsavedChanges = false;
};

/**
 * Configura event listeners
 */
let listenersAttached = false;

const setupEventListeners = () => {
  if (listenersAttached) return;

  const els = getElements();
  if (!els) return;

  // Toggle de resposta
  if (els.toggleInput) {
    els.toggleInput.addEventListener("change", handleAnswerChange);
  }

  // Navegação
  if (els.btnNext) {
    els.btnNext.addEventListener("click", handleNext);
  }

  if (els.btnPrev) {
    els.btnPrev.addEventListener("click", handlePrevious);
  }

  if (els.btnClose) {
    els.btnClose.addEventListener("click", handleClose);
  }

  // Seleção de alvo
  if (els.targetOptions) {
    els.targetOptions.forEach((radio) => {
      radio.addEventListener("change", handleTargetSelection);
    });
  }

  // Seleção de mitigação
  if (els.mitigationSelect) {
    els.mitigationSelect.addEventListener("change", handleMitigationSelection);
  }

  // Botão de confirmar/salvar
  if (els.btnConfirmSave) {
    els.btnConfirmSave.addEventListener("click", handleConfirmSave);
  }

  listenersAttached = true;
};

/**
 * Remove event listeners
 */
const removeEventListeners = () => {
  if (!listenersAttached) return;

  const els = getElements();
  if (!els) return;

  // Toggle de resposta
  if (els.toggleInput) {
    els.toggleInput.removeEventListener("change", handleAnswerChange);
  }

  // Navegação
  if (els.btnNext) {
    els.btnNext.removeEventListener("click", handleNext);
  }

  if (els.btnPrev) {
    els.btnPrev.removeEventListener("click", handlePrevious);
  }

  if (els.btnClose) {
    els.btnClose.removeEventListener("click", handleClose);
  }

  // Seleção de alvo
  if (els.targetOptions) {
    els.targetOptions.forEach((radio) => {
      radio.removeEventListener("change", handleTargetSelection);
    });
  }

  // Seleção de mitigação
  if (els.mitigationSelect) {
    els.mitigationSelect.removeEventListener(
      "change",
      handleMitigationSelection,
    );
  }

  // Botão de confirmar/salvar
  if (els.btnConfirmSave) {
    els.btnConfirmSave.removeEventListener("click", handleConfirmSave);
  }

  listenersAttached = false;
};

// ============================================================
// API PÚBLICA
// ============================================================

/**
 * Inicializa o checklist com dados de uma árvore em edição (opcional)
 */
const initWithData = (treeData) => {
  if (!treeData) return openChecklist();

  // Carrega dados existentes
  if (treeData.riskFactors && Array.isArray(treeData.riskFactors)) {
    checklistState.riskFactors = treeData.riskFactors;
  }

  if (treeData.targetCategory) {
    checklistState.targetCategory = treeData.targetCategory;
  }

  if (treeData.mitigationAction) {
    checklistState.mitigationAction = treeData.mitigationAction;
  }

  if (treeData.riskLevel) {
    checklistState.riskLevel = treeData.riskLevel;
  }

  if (treeData.residualRisk) {
    checklistState.residualRisk = treeData.residualRisk;
  }

  return openChecklist();
};

/**
 * Retorna estado atual do checklist
 */
const getState = () => {
  return { ...checklistState };
};

/**
 * Exporta API pública do serviço
 */
export const ChecklistMobileService = {
  open: openChecklist,
  close: closeChecklist,
  initWithData,
  getState,
  isActive: () => checklistState.isActive,
  hasUnsavedChanges: () => checklistState.hasUnsavedChanges,
};
