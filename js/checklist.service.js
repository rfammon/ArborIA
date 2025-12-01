/**
 * ARBORIA 2.0 - CHECKLIST SERVICE (v81.0 - Flash Card Checklist)
 * Contém: Lógica do CHECKLIST (Flash Card Fullscreen).
 */

import * as state from './state.js';
import * as utils from './utils.js';
import * as db from './database.js';
import { TableUI } from './table.ui.js'; 

// ============================================================
// 1. LÓGICA DO CHECKLIST (MODO FLASH CARD / TELA CHEIA)
// ============================================================

let currentStep = 0; // 0: Questions, 1: Target, 2: Residual Risk
let currentQuestionIndex = 0;
let flashCardListenersAttached = false;

// Seletores específicos da nova UI Fullscreen
const getFlashCardElements = () => {
    const container = document.getElementById('checklist-flashcard-view');
    if (!container) return null;

    return {
        container: container,
        closeBtn: document.getElementById('close-checklist-btn'),
        
        // As 3 etapas principais do fluxo FlashCard
        questionCard: document.getElementById('question-card'),
        targetCard: document.getElementById('target-card'),
        residualRiskCard: document.getElementById('residual-risk-card'),
        
        // Elementos de Conteúdo Específicos do questionCard
        counter: document.getElementById('flashcard-counter'),
        questionBox: document.getElementById('flashcard-question-text'), 
        toggleInput: document.getElementById('flashcard-toggle-input'), 
        
        // Navegação
        btnPrev: document.getElementById('flashcard-prev'),
        btnNext: document.getElementById('flashcard-next'),
        
        // Fonte de Dados (Tabela Oculta para perguntas do checklist)
        dataRows: document.querySelectorAll('#checklist-data-table tbody tr')
    };
};

/**
 * Renderiza o CARTÃO DE PERGUNTA atual baseado no índice.
 */
function updateQuestionFlashCard(index) {
    const els = getFlashCardElements();
    if (!els || !els.dataRows || index < 0 || index >= els.dataRows.length) return;

    const row = els.dataRows[index];
    const sourceCheckbox = row.querySelector('input[type="checkbox"]');

    const questionCell = row.cells[1].cloneNode(true); 
    const tooltipSpan = questionCell.querySelector('.checklist-term');
    if (tooltipSpan) {
        tooltipSpan.classList.add('tooltip-trigger'); 
    }

    // 1. Atualiza UI da Pergunta
    els.counter.textContent = `Fator de Risco ${index + 1} / ${els.dataRows.length}`;
    els.questionBox.innerHTML = questionCell.innerHTML; 
    
    // 2. Sincroniza Toggle Visual com o Checkbox Real
    els.toggleInput.checked = sourceCheckbox.checked;
    updateCardVisuals(els.questionCard, els.toggleInput.checked);

    // 3. Atualiza Botões (para a etapa de perguntas)
    els.btnPrev.disabled = (index === 0 && currentStep === 0);
    // Texto do botão 'Próxima' se estiver na última pergunta da fase 0
    if (index === els.dataRows.length - 1 && currentStep === 0) {
        els.btnNext.textContent = 'Avançar para Alvo ❯';
    } else {
        els.btnNext.textContent = 'Próxima ❯';
    }

    // 4. Lógica do Toggle (Remove listener antigo antes de adicionar novo)
    if (els.toggleInput._handler) {
        els.toggleInput.removeEventListener('change', els.toggleInput._handler);
    }

    const onToggleChange = () => {
        const isChecked = els.toggleInput.checked;
        
        // A. Atualiza o "Banco de Dados" (Checkbox da Tabela Oculta)
        sourceCheckbox.checked = isChecked;
        
        // B. Feedback Visual Imediato (Troca Cor)
        updateCardVisuals(els.questionCard, isChecked);

        // C. Auto-Avanço (apenas se marcou SIM e não é o último)
        if (isChecked && index < els.dataRows.length - 1) {
            setTimeout(() => {
                els.btnNext.click(); // Simula clique no próximo
            }, 600);
        }
    };

    els.toggleInput.addEventListener('change', onToggleChange);
    els.toggleInput._handler = onToggleChange; // Salva referência para remoção
}

/**
 * Controla qual das 3 etapas principais (questionCard, targetCard, residualRiskCard) está visível.
 */
function renderStep(step) {
    const els = getFlashCardElements();
    if (!els) return;

    // Esconde todos os cards de etapa
    els.questionCard.style.display = 'none';
    els.targetCard.style.display = 'none';
    els.residualRiskCard.style.display = 'none';

    // Exibe o card da etapa atual
    if (step === 0) {
        els.questionCard.style.display = 'flex'; // Ou 'block', dependendo do layout interno
        updateQuestionFlashCard(currentQuestionIndex); // Atualiza o conteúdo da pergunta
    } else if (step === 1) {
        els.targetCard.style.display = 'flex';
        els.btnNext.textContent = 'Próxima ❯'; // Reseta texto do botão
        els.btnPrev.disabled = false;
    } else if (step === 2) {
        els.residualRiskCard.style.display = 'flex';
        els.btnNext.textContent = 'Concluir'; // Altera texto para 'Concluir' na última etapa
        els.btnPrev.disabled = false;
    }

    currentStep = step;
    updateNavigationButtons(); // Atualiza o estado dos botões de navegação
}

/**
 * Atualiza o estado dos botões de navegação (Anterior/Próxima).
 */
function updateNavigationButtons() {
    const els = getFlashCardElements();
    if (!els) return;

    // Botão Anterior
    if (currentStep === 0 && currentQuestionIndex === 0) {
        els.btnPrev.disabled = true;
    } else {
        els.btnPrev.disabled = false;
    }

    // Botão Próxima (o texto já é atualizado por renderStep e updateQuestionFlashCard)
}


/**
 * Helper para mudar a cor do cartão (CSS class)
 */
function updateCardVisuals(cardElement, isChecked) {
    if (isChecked) cardElement.classList.add('answered-yes');
    else cardElement.classList.remove('answered-yes');
}

/**
 * Anexa os listeners de navegação global (apenas uma vez).
 */
function setupFlashCardListeners() {
    if (flashCardListenersAttached) return;
    
    const els = getFlashCardElements();
    if (!els || !els.btnPrev || !els.btnNext) return;

    // Botão Fechar (X)
    els.closeBtn.addEventListener('click', closeChecklistFlashCard);

    // Botão Anterior
    els.btnPrev.addEventListener('click', (e) => {
        e.preventDefault();
        // Previne cliques múltiplos durante a animação
        if (els.questionCard.classList.contains('is-animating')) return; 

        if (currentStep === 0) { // Na fase de perguntas
            if (currentQuestionIndex > 0) {
                // Animação para o cartão de pergunta
                els.questionCard.classList.add('is-animating', 'swipe-out-to-right');
                setTimeout(() => {
                    currentQuestionIndex--;
                    updateQuestionFlashCard(currentQuestionIndex);
                    els.questionCard.classList.remove('swipe-out-to-right');
                    els.questionCard.classList.add('swipe-in-from-left');
                    setTimeout(() => els.questionCard.classList.remove('is-animating', 'swipe-in-from-left'), 400);
                }, 300);
            }
        } else if (currentStep > 0) { // Voltando do Alvo ou Risco Residual
            currentStep--;
            renderStep(currentStep);
        }
    });

    // Botão Próximo / Concluir
    els.btnNext.addEventListener('click', (e) => {
        e.preventDefault();
        // Previne cliques múltiplos durante a animação. Aplica-se ao cartão atualmente ativo.
        const activeCard = [els.questionCard, els.targetCard, els.residualRiskCard][currentStep];
        if (activeCard && activeCard.classList.contains('is-animating')) return;

        if (currentStep === 0) { // Na fase de perguntas
            if (currentQuestionIndex < els.dataRows.length - 1) {
                // Animação para o cartão de pergunta
                els.questionCard.classList.add('is-animating', 'swipe-out-to-left');
                setTimeout(() => {
                    currentQuestionIndex++;
                    updateQuestionFlashCard(currentQuestionIndex);
                    els.questionCard.classList.remove('swipe-out-to-left');
                    els.questionCard.classList.add('swipe-in-from-right');
                    setTimeout(() => els.questionCard.classList.remove('is-animating', 'swipe-in-from-right'), 400);
                }, 300);
            } else { // Última pergunta da Fase 0, avança para a Fase 1 (Alvo)
                currentStep++;
                renderStep(currentStep);
            }
        } else if (currentStep === 1) { // Na fase Alvo, avança para a Fase 2 (Risco Residual)
            currentStep++;
            renderStep(currentStep);
        } else if (currentStep === 2) { // Na fase Risco Residual, conclui
            closeChecklistFlashCard();
            utils.showToast("Checklist preenchido!", "success");
        }
    });
    
    flashCardListenersAttached = true;
}

/**
 * [PÚBLICO] Inicia o Checklist em Tela Cheia.
 * Chamado pelo botão "#open-checklist-btn" no formulário.
 */
export function initChecklistFlashCard(retry = 0) {
    const els = getFlashCardElements();
    
    // 1. Verificação Crítica: Garante que as linhas da tabela oculta existem
    if (!els || els.dataRows.length === 0) {
        if (retry < 5) {
            // Tenta novamente a cada 150ms para esperar o DOM renderizar a tabela
            setTimeout(() => initChecklistFlashCard(retry + 1), 150);
        } else {
            utils.showToast("Erro: Tabela de critérios não carregou. Recarregue a página.", "error");
        }
        return;
    }

    // 2. Anexa Listeners (se ainda não anexou)
    setupFlashCardListeners();
    
    // 3. Reset e Inicia no primeiro card (a UI já está visível)
    currentStep = 0; // Inicia na primeira etapa (perguntas)
    currentQuestionIndex = 0; // Inicia na primeira pergunta
    renderStep(currentStep); // Renderiza a etapa inicial
}

/**
 * [PRIVADO] Fecha a UI do Checklist.
 */
function closeChecklistFlashCard() {
    const els = getFlashCardElements();
    // A lógica de fechar foi movida para main.js para centralizar o controle do DOM.
    if (els && els.container) els.container.style.display = 'none';
}


export async function handleChatSend() {}
export function handleContactForm(e) { e.preventDefault(); }
