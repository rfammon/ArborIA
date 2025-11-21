// js/tooltip.ui.js (NOVO v24.0)
// Gerencia toda a lógica de criação, posicionamento e interação de tooltips.

// === 1. IMPORTAÇÕES ===
import * as state from './state.js';
import { glossaryTerms, equipmentData, podaPurposeData } from './content.js';

// === 2. ESTADO DO MÓDULO ===

// Helper de template (privado para este módulo)
const imgTag = (src, alt) => `<img src="img/${src}" alt="${alt}" class="manual-img">`;

// Detecção de toque (privado para este módulo)
const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
const termClickEvent = isTouchDevice ? 'touchend' : 'click';
const popupCloseEvent = isTouchDevice ? 'touchend' : 'click';

// Timer de tooltip
let tooltipHideTimer = null;

// === 3. LÓGICA DE TOOLTIP (Privada e Pública) ===

/**
 * Cria ou obtém o elemento de tooltip global.
 * @returns {HTMLElement} O elemento do tooltip.
 */
function createTooltip() {
  let tooltip = document.getElementById('glossary-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = 'glossary-tooltip';
    document.body.appendChild(tooltip);
  }

  // Garante que o listener de fechar (em touch) seja anexado apenas uma vez
  if (!tooltip.dataset.clickToCloseAdded) {
    tooltip.addEventListener(popupCloseEvent, (e) => {
      e.stopPropagation();
      hideTooltip();
    });
    tooltip.dataset.clickToCloseAdded = 'true';
  }
  
  state.setCurrentTooltip(tooltip);
  return tooltip;
}

/**
 * (PÚBLICO) Esconde o tooltip ativo e reseta o estado.
 */
export function hideTooltip() {
  if (state.currentTooltip) {
    const img = state.currentTooltip.querySelector('img');
    // Limpa blobs de URL para evitar vazamentos de memória
    if (img && img.src.startsWith('blob:')) {
      URL.revokeObjectURL(img.src);
    }
    state.currentTooltip.style.opacity = '0';
    state.currentTooltip.style.visibility = 'hidden';
    state.currentTooltip.style.width = ''; // Reseta a largura
    delete state.currentTooltip.dataset.currentElement;
    state.setCurrentTooltip(null);
  }
}

/**
 * Agenda o fechamento do tooltip (para mouseleave).
 */
function scheduleHideTooltip() {
  clearTimeout(tooltipHideTimer);
  tooltipHideTimer = setTimeout(hideTooltip, 200);
}

/**
 * Cancela o fechamento do tooltip (para mouseenter).
 */
function cancelHideTooltip() {
  clearTimeout(tooltipHideTimer);
}

/**
 * Posiciona o tooltip em relação a um elemento.
 * @param {HTMLElement} termElement O elemento (span) que ativou o tooltip.
 */
function positionTooltip(termElement) {
  if (!state.currentTooltip) return;

  const rect = termElement.getBoundingClientRect();
  const scrollY = window.scrollY;
  const scrollX = window.scrollX;

  // Usa requestAnimationFrame para garantir que o DOM foi atualizado
  requestAnimationFrame(() => {
    if (!state.currentTooltip) return;

    const tooltipWidth = state.currentTooltip.offsetWidth;
    const tooltipHeight = state.currentTooltip.offsetHeight;

    // Tenta posicionar acima, se não houver espaço, posiciona abaixo
    let topPos = (rect.top > tooltipHeight + 10) 
      ? (rect.top + scrollY - tooltipHeight - 10) 
      : (rect.bottom + scrollY + 10);

    // Centraliza horizontalmente
    let leftPos = rect.left + scrollX + (rect.width / 2) - (tooltipWidth / 2);

    // Evita transbordar a tela
    if (leftPos < scrollX + 10) leftPos = scrollX + 10;
    if (leftPos + tooltipWidth > window.innerWidth + scrollX - 10) {
      leftPos = window.innerWidth + scrollX - tooltipWidth - 10;
    }

    state.currentTooltip.style.top = `${topPos}px`;
    state.currentTooltip.style.left = `${leftPos}px`;
  });
}

// === 4. INTERAÇÕES DO GLOSSÁRIO (Privado) ===

function showGlossaryTooltip(event) {
  cancelHideTooltip();
  const termElement = event.currentTarget;
  const termKey = termElement.getAttribute('data-term-key');
  const definition = glossaryTerms[termKey];
  if (!definition) return;

  const tooltip = createTooltip();
  tooltip.style.width = '350px'; // Largura padrão para texto
  tooltip.innerHTML = `<strong>${termElement.textContent}</strong>: ${definition}`;
  
  positionTooltip(termElement);
  tooltip.style.opacity = '1';
  tooltip.style.visibility = 'visible';
  tooltip.dataset.currentElement = termElement.textContent;
}

function toggleGlossaryTooltip(event) {
  event.preventDefault(); event.stopPropagation();
  const tooltip = document.getElementById('glossary-tooltip');
  const isCurrent = tooltip && tooltip.dataset.currentElement === event.currentTarget.textContent;

  if (tooltip && tooltip.style.visibility === 'visible' && isCurrent) {
    hideTooltip();
  } else {
    showGlossaryTooltip(event);
  }
}

// === 5. INTERAÇÕES DE EQUIPAMENTOS (Privado) ===

function showEquipmentTooltip(event) {
  cancelHideTooltip();
  const termElement = event.currentTarget;
  const termKey = termElement.getAttribute('data-term-key');
  const data = equipmentData[termKey];
  if (!data) return;

  const tooltip = createTooltip();
  tooltip.style.width = '350px';
  tooltip.innerHTML = `<strong>${termElement.textContent}</strong><p>${data.desc}</p>${imgTag(data.img, termElement.textContent)}`;
  
  positionTooltip(termElement);
  tooltip.style.opacity = '1';
  tooltip.style.visibility = 'visible';
  tooltip.dataset.currentElement = termElement.textContent;
}

function toggleEquipmentTooltip(event) {
  event.preventDefault(); event.stopPropagation();
  const tooltip = document.getElementById('glossary-tooltip');
  const isCurrent = tooltip && tooltip.dataset.currentElement === event.currentTarget.textContent;

  if (tooltip && tooltip.style.visibility === 'visible' && isCurrent) {
    hideTooltip();
  } else {
    showEquipmentTooltip(event);
  }
}

// === 6. INTERAÇÕES DE PROPÓSITO (Privado) ===

function showPurposeTooltip(event) {
  cancelHideTooltip();
  const termElement = event.currentTarget;
  const termKey = termElement.getAttribute('data-term-key');
  const data = podaPurposeData[termKey];
  if (!data) return;

  const tooltip = createTooltip();
  tooltip.style.width = '350px';
  tooltip.innerHTML = `<strong>${termElement.textContent}</strong><p>${data.desc}</p>${imgTag(data.img, termElement.textContent)}`;
  
  positionTooltip(termElement);
  tooltip.style.opacity = '1';
  tooltip.style.visibility = 'visible';
  tooltip.dataset.currentElement = termElement.textContent;
}

function togglePurposeTooltip(event) {
  event.preventDefault(); event.stopPropagation();
  const tooltip = document.getElementById('glossary-tooltip');
  const isCurrent = tooltip && tooltip.dataset.currentElement === event.currentTarget.textContent;

  if (tooltip && tooltip.style.visibility === 'visible' && isCurrent) {
    hideTooltip();
  } else {
    showPurposeTooltip(event);
  }
}

// === 7. FUNÇÕES DE SETUP (Público) ===

/**
 * Anexa listeners de tooltip aos termos do glossário.
 * @param {HTMLElement} detailView O elemento pai (view) onde o conteúdo foi carregado.
 */
export function setupGlossaryInteractions(detailView) {
  const glossaryTermsElements = detailView.querySelectorAll('.glossary-term');
  glossaryTermsElements.forEach((termElement) => {
    if (!isTouchDevice) {
      termElement.addEventListener('mouseenter', showGlossaryTooltip);
      termElement.addEventListener('mouseleave', scheduleHideTooltip);
    }
    termElement.addEventListener(termClickEvent, toggleGlossaryTooltip);
  });
}

/**
 * Anexa listeners de tooltip aos termos de equipamento.
 * @param {HTMLElement} detailView O elemento pai (view).
 */
export function setupEquipmentInteractions(detailView) {
  const equipmentTermsElements = detailView.querySelectorAll('.equipment-term');
  equipmentTermsElements.forEach((termElement) => {
    if (!isTouchDevice) {
      termElement.addEventListener('mouseenter', showEquipmentTooltip);
      termElement.addEventListener('mouseleave', scheduleHideTooltip);
    }
    termElement.addEventListener(termClickEvent, toggleEquipmentTooltip);
  });
}

/**
 * Anexa listeners de tooltip aos termos de propósito de poda.
 * @param {HTMLElement} detailView O elemento pai (view).
 */
export function setupPurposeInteractions(detailView) {
  const purposeTermsElements = detailView.querySelectorAll('.purpose-term');
  purposeTermsElements.forEach((termElement) => {
    if (!isTouchDevice) {
      termElement.addEventListener('mouseenter', showPurposeTooltip);
      termElement.addEventListener('mouseleave', scheduleHideTooltip);
    }
    termElement.addEventListener(termClickEvent, togglePurposeTooltip);
  });
}