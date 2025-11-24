// js/calculator.form.ui.js (NOVO v24.0)
// Gerencia o formulário de registro (desktop e mobile) e os controles de foto.

// === 1. IMPORTAÇÕES ===
import * as state from './state.js';
import * as features from './features.js';
import { getImageFromDB } from './database.js';
import { showToast, optimizeImage, showInputError, clearInputError } from './utils.js?v=26.3';
// [NOVO] Importa funções da tabela para atualizar a UI no submit
import { appendTreeRow, renderSummaryTable } from './table.ui.js';

// === 2. ESTADO DO MÓDULO (CHECKLIST MOBILE) ===

const mobileChecklist = {
  currentIndex: 0,
  totalQuestions: 0,
  questions: null,
  wrapper: null,
  card: null,
  navPrev: null,
  navNext: null,
  counter: null,
};

// === 3. LÓGICA DO FORMULÁRIO (Privado) ===

/**
 * Valida um único campo do formulário e exibe/limpa mensagens de erro.
 * @param {HTMLInputElement|HTMLTextAreaElement} input O elemento de input a ser validado.
 * @returns {boolean} True se o campo é válido, False caso contrário.
 */
function _validateField(input) {
  clearInputError(input);
  let isValid = true;
  let errorMessage = '';

  // Validação de campos obrigatórios
  if (input.required && input.value.trim() === '') {
    isValid = false;
    errorMessage = 'Este campo é obrigatório.';
  }

  // Validação para campos numéricos
  if (input.type === 'number') {
    const value = parseFloat(input.value);
    if (isNaN(value) && input.value.trim() !== '') { // Permite campo vazio se não for required
      isValid = false;
      errorMessage = 'Por favor, insira um número válido.';
    } else if (value < parseFloat(input.min)) {
      isValid = false;
      errorMessage = `O valor mínimo é ${input.min}.`;
    } else if (input.max && value > parseFloat(input.max)) {
      isValid = false;
      errorMessage = `O valor máximo é ${input.max}.`;
    }
  }

  // Validação específica para coordenadas (garante que são números, mesmo sendo type="text")
  if (input.id === 'risk-coord-x' || input.id === 'risk-coord-y') {
    if (input.value.trim() !== '' && isNaN(parseFloat(input.value))) {
      isValid = false;
      errorMessage = 'Coordenada inválida. Insira um valor numérico.';
    }
  }

  // Validação de data (não pode ser no futuro)
  if (input.id === 'risk-data' && input.value) {
    const selectedDate = new Date(input.value);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Zera horas para comparar apenas a data
    if (selectedDate > today) {
      isValid = false;
      errorMessage = 'A data não pode ser no futuro.';
    }
  }

  if (!isValid) {
    showInputError(input, errorMessage);
  }
  return isValid;
}

/**
 * Alterna o modo do formulário entre Adicionar e Editar.
 * @param {'add' | 'edit'} mode O modo para o qual o formulário deve ir.
 */
export function setFormMode(mode) {
  const btn = document.getElementById('add-tree-btn');
  if (!btn) return;

  // Limpa quaisquer erros de validação ao mudar o modo do formulário
  const form = document.getElementById('risk-calculator-form');
  if (form) _clearAllValidationErrors(form);

  if (mode === 'edit') {
    btn.textContent = '💾 Salvar Alterações';
    btn.style.backgroundColor = 'var(--color-accent)';
    btn.style.color = 'var(--color-dark)';
  } else {
    btn.textContent = '➕ Adicionar Árvore';
    btn.style.backgroundColor = 'var(--color-primary-medium)';
    btn.style.color = 'white';
    state.setEditingTreeId(null); // Limpa o ID de edição
  }
}

/**
 * Preenche o formulário com dados da árvore para edição.
 * @param {object} tree O objeto da árvore vindo do 'state.registeredTrees'.
 */
export function populateFormForEdit(tree) {
  if (!tree) return;
  const form = document.getElementById('risk-calculator-form');
  if (!form) return;

  form.reset();
  features.clearPhotoPreview();
  _clearAllValidationErrors(form); // Limpa erros ao preencher o formulário para edição

  // Preenche os campos de texto
  document.getElementById('risk-data').value = tree.data;
  document.getElementById('risk-especie').value = tree.especie;
  document.getElementById('risk-local').value = tree.local;
  document.getElementById('risk-coord-x').value = tree.coordX;
  document.getElementById('risk-coord-y').value = tree.coordY;
  document.getElementById('risk-dap').value = tree.dap;
  document.getElementById('risk-avaliador').value = tree.avaliador;
  document.getElementById('risk-obs').value = tree.observacoes;

  // Carrega a foto (se houver)
  if (tree.hasPhoto) {
    getImageFromDB(tree.id, (imageBlob) => {
      if (imageBlob) {
        const previewContainer = document.getElementById('photo-preview-container');
        const removePhotoBtn = document.getElementById('remove-photo-btn');
        const preview = document.createElement('img');
        preview.id = 'photo-preview';
        preview.src = URL.createObjectURL(imageBlob);
        previewContainer.prepend(preview);
        removePhotoBtn.style.display = 'block';
        state.setCurrentTreePhoto(imageBlob);
      } else {
        showToast(`Foto da Árvore ID ${tree.id} não encontrada no DB.`, 'error');
      }
    });
  }

  // Marca os checkboxes
  const allCheckboxes = form.querySelectorAll('.risk-checkbox');
  allCheckboxes.forEach((cb, index) => {
    cb.checked = (tree.riskFactors && tree.riskFactors[index] === 1) || false;
  });

  // Atualiza o status do GPS (para mostrar a zona da árvore)
  const gpsStatus = document.getElementById('gps-status');
  if (gpsStatus) {
    gpsStatus.textContent = `Zona (da árvore): ${tree.utmZoneNum || '?'}${tree.utmZoneLetter || '?'}`;
  }
}

/**
 * Limpa todos os erros de validação do formulário.
 * @param {HTMLFormElement} form O formulário a ser limpo.
 */
function _clearAllValidationErrors(form) {
  const allInputs = form.querySelectorAll('input, textarea');
  allInputs.forEach(input => clearInputError(input));
}

/**
 * Anexa listeners ao formulário principal (submit, reset, gps).
 * @param {HTMLFormElement} form O elemento do formulário.
 * @param {boolean} isTouchDevice Indica se é um dispositivo de toque.
 */
function _setupFormListeners(form, isTouchDevice) {
  if (!form) return;

  const getGpsBtn = document.getElementById('get-gps-btn');
  const resetBtn = document.getElementById('reset-risk-form-btn');
  const gpsStatus = document.getElementById('gps-status');

  // Adiciona listeners para validação em tempo real
  const inputsToValidate = form.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]), textarea');
  inputsToValidate.forEach(input => {
    input.addEventListener('blur', () => _validateField(input));
    input.addEventListener('input', () => {
      // Limpa o erro ao digitar, mas revalida no blur
      if (input.classList.contains('input-error')) {
        clearInputError(input);
      }
    });
  });

  // Esconde o botão de GPS em desktop
  if (getGpsBtn && !isTouchDevice) {
    getGpsBtn.closest('.gps-button-container')?.setAttribute('style', 'display:none');
  }
  if (getGpsBtn) {
    getGpsBtn.addEventListener('click', features.handleGetGPS);
  }

  // Listener de SUBMIT
  form.addEventListener('submit', (event) => {
    event.preventDefault(); // Previne o submit padrão para fazer validação manual
    
    let isFormValid = true;
    let firstInvalidInput = null;

    // Valida todos os campos ao submeter
    inputsToValidate.forEach(input => {
      if (!_validateField(input)) {
        isFormValid = false;
        if (!firstInvalidInput) {
          firstInvalidInput = input;
        }
      }
    });

    if (!isFormValid) {
      showToast('Por favor, corrija os erros no formulário.', 'error');
      firstInvalidInput?.focus(); // Foca no primeiro campo inválido
      firstInvalidInput?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return; // Impede o submit se o formulário não for válido
    }

    // Se o formulário é válido, prossegue com o submit
    const result = features.handleAddTreeSubmit(event);
    if (!result || !result.success) return;

    // Ação de UI baseada no resultado
    if (result.mode === 'add') {
      appendTreeRow(result.tree); // O(1) performance
    } else if (result.mode === 'update') {
      renderSummaryTable(); // O(N) - necessário para reordenar/atualizar
    }

    if (isTouchDevice) setupMobileChecklist();
    if (gpsStatus) { gpsStatus.textContent = ''; gpsStatus.className = ''; }
    setFormMode('add'); // Reseta o formulário para o modo 'add'
    _clearAllValidationErrors(form); // Limpa erros após submit bem-sucedido
  });

  // Listener de RESET
  if (resetBtn) {
    resetBtn.addEventListener('click', (e) => {
      e.preventDefault();
      // Salva o nome do avaliador antes de resetar
      state.setLastEvaluatorName(document.getElementById('risk-avaliador').value || '');
      
      form.reset();
      features.clearPhotoPreview();
      _clearAllValidationErrors(form); // Limpa erros ao resetar o formulário

      // Preenche data e avaliador
      try {
        document.getElementById('risk-data').value = new Date().toISOString().split('T')[0];
        document.getElementById('risk-avaliador').value = state.lastEvaluatorName;
      } catch (err) { /* ignora */ }

      if (isTouchDevice) setupMobileChecklist();
      if (gpsStatus) { gpsStatus.textContent = ''; gpsStatus.className = ''; }
      setFormMode('add'); // Garante que o modo 'add' esteja ativo
    });
  }
}

/**
 * Anexa listeners aos controles de foto.
 */
function _setupPhotoListeners() {
  const photoInput = document.getElementById('tree-photo-input');
  const removePhotoBtn = document.getElementById('remove-photo-btn');

  if (photoInput) {
    photoInput.addEventListener('change', async (event) => {
      const file = event.target.files[0];
      if (!file) return;

      features.clearPhotoPreview();
      try {
        showToast('Otimizando foto...', 'success');
        // Utiliza a função movida para 'utils.js'
        const optimizedBlob = await optimizeImage(file, 800, 0.7);
        state.setCurrentTreePhoto(optimizedBlob);

        const previewContainer = document.getElementById('photo-preview-container');
        const removeBtn = document.getElementById('remove-photo-btn');
        const preview = document.createElement('img');
        
        preview.id = 'photo-preview';
        preview.src = URL.createObjectURL(optimizedBlob);
        previewContainer.prepend(preview);
        removeBtn.style.display = 'block';

      } catch (error) {
        console.error('Erro ao otimizar imagem:', error);
        showToast('Erro ao processar a foto. Tente outra imagem.', 'error');
        state.setCurrentTreePhoto(null);
        features.clearPhotoPreview();
      }
    });
  }

  if (removePhotoBtn) {
    removePhotoBtn.addEventListener('click', features.clearPhotoPreview);
  }
}

// === 4. LÓGICA DO CARROSSEL (Público) ===

/**
 * Mostra a pergunta do carrossel mobile no índice especificado.
 * @param {number} index - O índice da pergunta.
 */
export function showMobileQuestion(index) {
  const { questions, card, navPrev, navNext, counter, totalQuestions } = mobileChecklist;
  const questionRow = questions[index];
  if (!questionRow) return;

  // Validação defensiva
  if (!questionRow.cells || questionRow.cells.length < 4) {
    console.error('showMobileQuestion: A linha da tabela (tr) está malformada.', questionRow);
    return;
  }

  const num = questionRow.cells[0].textContent;
  const pergunta = questionRow.cells[1].textContent;
  const peso = questionRow.cells[2].textContent;
  const realCheckbox = questionRow.cells[3].querySelector('.risk-checkbox');

  if (!realCheckbox) {
    console.error('showMobileQuestion: Checkbox não encontrado na linha.', questionRow);
    return;
  }

  // .innerHTML seguro (template controlado, dados de .textContent)
  card.innerHTML = `
    <span class="checklist-card-question"><strong>${num}.</strong> ${pergunta}</span>
    <span class="checklist-card-peso">(Peso: ${peso})</span>
    <label class="checklist-card-toggle">
      <input type="checkbox" class="mobile-checkbox-proxy" data-target-index="${index}" ${realCheckbox.checked ? 'checked' : ''}>
      <span class="toggle-label">Não</span>
      <span class="toggle-switch"></span>
      <span class="toggle-label">Sim</span>
    </label>
  `;
  counter.textContent = `${index + 1} / ${totalQuestions}`;
  navPrev.disabled = (index === 0);
  navNext.disabled = (index === totalQuestions - 1);
  mobileChecklist.currentIndex = index;
}

/**
 * Inicializa o carrossel mobile.
 */
export function setupMobileChecklist() {
  mobileChecklist.wrapper = document.querySelector('.mobile-checklist-wrapper');
  if (!mobileChecklist.wrapper) return;

  // Busca de elementos
  mobileChecklist.card = mobileChecklist.wrapper.querySelector('.mobile-checklist-card');
  mobileChecklist.navPrev = mobileChecklist.wrapper.querySelector('#checklist-prev');
  mobileChecklist.navNext = mobileChecklist.wrapper.querySelector('#checklist-next');
  mobileChecklist.counter = mobileChecklist.wrapper.querySelector('.checklist-counter');
  mobileChecklist.questions = document.querySelectorAll('#risk-calculator-form .risk-table tbody tr');

  // Validação
  if (mobileChecklist.questions.length === 0 || !mobileChecklist.card || !mobileChecklist.navPrev) {
    console.warn('setupMobileChecklist: Elementos do carrossel não encontrados.');
    return;
  }

  mobileChecklist.currentIndex = 0;
  mobileChecklist.totalQuestions = mobileChecklist.questions.length;

  // --- Clonagem para limpeza de listeners ---
  const newCard = mobileChecklist.card.cloneNode(true);
  mobileChecklist.card.parentNode.replaceChild(newCard, mobileChecklist.card);
  mobileChecklist.card = newCard;

  const newNavPrev = mobileChecklist.navPrev.cloneNode(true);
  mobileChecklist.navPrev.parentNode.replaceChild(newNavPrev, mobileChecklist.navPrev);
  mobileChecklist.navPrev = newNavPrev;

  const newNavNext = mobileChecklist.navNext.cloneNode(true);
  mobileChecklist.navNext.parentNode.replaceChild(newNavNext, mobileChecklist.navNext);
  mobileChecklist.navNext = newNavNext;

  // Listeners (Delegação no card)
  mobileChecklist.card.addEventListener('change', (e) => {
    const proxyCheckbox = e.target.closest('.mobile-checkbox-proxy');
    if (proxyCheckbox) {
      const targetIndex = parseInt(proxyCheckbox.dataset.targetIndex, 10);
      const realCheckbox = mobileChecklist.questions[targetIndex].cells[3].querySelector('.risk-checkbox');
      realCheckbox.checked = proxyCheckbox.checked;
    }
  });

  mobileChecklist.navPrev.addEventListener('click', () => {
    if (mobileChecklist.currentIndex > 0) showMobileQuestion(mobileChecklist.currentIndex - 1);
  });
  mobileChecklist.navNext.addEventListener('click', () => {
    if (mobileChecklist.currentIndex < mobileChecklist.totalQuestions - 1) showMobileQuestion(mobileChecklist.currentIndex + 1);
  });

  showMobileQuestion(0);
}


// === 5. FUNÇÃO DE INICIALIZAÇÃO (Pública) ===

/**
 * Inicializa os listeners do formulário da calculadora.
 * @param {boolean} isTouchDevice Indica se é um dispositivo de toque.
 */
export function initCalculatorForm(isTouchDevice) {
  const form = document.getElementById('risk-calculator-form');
  _setupFormListeners(form, isTouchDevice);
  _setupPhotoListeners();

}
