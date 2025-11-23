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

let currentCardIndex = 0;
let flashCardListenersAttached = false;

// Seletores específicos da nova UI Fullscreen
const getFlashCardElements = () => {
    const container = document.getElementById('checklist-flashcard-view');
    if (!container) return null;

    return {
        container: container,
        closeBtn: document.getElementById('close-checklist-btn'),
        card: document.querySelector('.mobile-checklist-card'),
        
        // Elementos de Conteúdo
        counter: document.getElementById('flashcard-counter'),
        questionBox: document.getElementById('flashcard-question-text'), 
        
        // Controle (Toggle)
        toggleInput: document.getElementById('flashcard-toggle-input'), 
        
        // Navegação
        btnPrev: document.getElementById('flashcard-prev'),
        btnNext: document.getElementById('flashcard-next'),
        
        // Fonte de Dados (Tabela Oculta)
        dataRows: document.querySelectorAll('#checklist-data-table tbody tr')
    };
};

/**
 * Renderiza o cartão atual baseado no índice.
 */
function updateFlashCard(index) {
    const els = getFlashCardElements();
    if (!els || !els.dataRows || index < 0 || index >= els.dataRows.length) return;

    const row = els.dataRows[index];
    // [IMPORTANTE] Obtém o checkbox da tabela que é a fonte de dados real
    const sourceCheckbox = row.querySelector('input[type="checkbox"]');

    // Extração de Conteúdo (Célula 1) - Clona para não perder eventos de tooltip
    const questionCell = row.cells[1].cloneNode(true); 
    const tooltipSpan = questionCell.querySelector('.checklist-term');
    if (tooltipSpan) {
        tooltipSpan.classList.add('tooltip-trigger'); 
    }

    // 1. Atualiza UI
    els.counter.textContent = `Fator de Risco ${index + 1} / ${els.dataRows.length}`;
    els.questionBox.innerHTML = questionCell.innerHTML; 
    
    // 2. Sincroniza Toggle Visual com o Checkbox Real
    els.toggleInput.checked = sourceCheckbox.checked;
    updateCardVisuals(els.card, els.toggleInput.checked);

    // 3. Atualiza Botões
    els.btnPrev.disabled = (index === 0);
    // Muda texto do botão no último item
    els.btnNext.textContent = (index === els.dataRows.length - 1) ? 'Concluir' : 'Próxima ❯';

    // 4. Lógica do Toggle (Remove listener antigo antes de adicionar novo)
    if (els.toggleInput._handler) {
        els.toggleInput.removeEventListener('change', els.toggleInput._handler);
    }

    const onToggleChange = () => {
        const isChecked = els.toggleInput.checked;
        
        // A. Atualiza o "Banco de Dados" (Checkbox da Tabela Oculta)
        sourceCheckbox.checked = isChecked;
        
        // B. Feedback Visual Imediato (Troca Cor)
        updateCardVisuals(els.card, isChecked);

        // C. Auto-Avanço (apenas se marcou SIM e não é o último)
        if (isChecked && index < els.dataRows.length - 1) {
            // [MELHORIA] Aumenta o tempo de espera para 600ms
            setTimeout(() => {
                // Dispara a navegação para o próximo, que agora tem animação
                els.btnNext.click();
            }, 600);
        }
    };

    els.toggleInput.addEventListener('change', onToggleChange);
    els.toggleInput._handler = onToggleChange; // Salva referência para remoção
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
        if (currentCardIndex <= 0 || els.card.classList.contains('is-animating')) return;

        els.card.classList.add('is-animating', 'swipe-out-to-right');
        setTimeout(() => {
            currentCardIndex--;
            updateFlashCard(currentCardIndex);
            els.card.classList.remove('swipe-out-to-right');
            els.card.classList.add('swipe-in-from-left');
            setTimeout(() => els.card.classList.remove('is-animating', 'swipe-in-from-left'), 400);
        }, 300);
    });

    // Botão Próximo / Concluir
    els.btnNext.addEventListener('click', (e) => {
        e.preventDefault();
        if (els.card.classList.contains('is-animating')) return;

        if (currentCardIndex < els.dataRows.length - 1) {
            els.card.classList.add('is-animating', 'swipe-out-to-left');
            setTimeout(() => {
                currentCardIndex++;
                updateFlashCard(currentCardIndex);
                els.card.classList.remove('swipe-out-to-left');
                els.card.classList.add('swipe-in-from-right');
                setTimeout(() => els.card.classList.remove('is-animating', 'swipe-in-from-right'), 400);
            }, 300);
        } else {
            // Fim do fluxo: Fecha o modal e notifica
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
    currentCardIndex = 0;
    updateFlashCard(currentCardIndex);
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
