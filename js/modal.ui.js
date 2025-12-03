/**
 * ARBORIA 2.0 - MODAL UI
 * Gerencia visualizadores de fotos e diálogos de confirmação
 */

import { getImageByUrl, saveImageByUrl } from './database.js'; // Import new DB functions

// Module-level variable to store the previously active modal
let _previousActiveModal = null; // New variable

// Função helper não exportada para fechar o visualizador de fotos.
function closePhotoViewer() {
    const dialog = document.getElementById('photo-viewer-dialog');
    if (!dialog) return;

    dialog.classList.remove('active'); // Inicia animação de saída

    // Aguarda a transição CSS (300ms) antes de esconder e limpar.
    setTimeout(() => {
        dialog.style.display = 'none';
        const content = document.getElementById('photo-viewer-content');
        if (content) {
            const img = content.querySelector('img');
            if (img && img.src.startsWith('blob:')) {
                URL.revokeObjectURL(img.src); // Libera o URL do Blob para economizar memória
            }
            content.innerHTML = ''; // Limpa a imagem para economizar memória
        }

        // Check if there was a previously active modal and re-activate it
        if (_previousActiveModal) { // New logic
            _previousActiveModal.style.display = 'flex';
            _previousActiveModal.classList.add('active');
            _previousActiveModal = null; // Clear the reference
        }

    }, 300);
}

/**
 * Inicializa os listeners do visualizador de fotos (botão fechar e clique no fundo).
 * Chamado uma única vez no initApp do main.js.
 */
export function initPhotoViewer() {
    const dialog = document.getElementById('photo-viewer-dialog');
    const closeBtn = document.getElementById('photo-viewer-close');

    if (!dialog) return; // Add this check first

    // Ensure it's hidden on initialization
    dialog.style.display = 'none';

    if (!closeBtn) return;

    // Evento: Botão X
    closeBtn.addEventListener('click', closePhotoViewer);

    // Event: Click anywhere inside the dialog (including image or content area)
    dialog.addEventListener('click', (e) => {
        const closeBtn = document.getElementById('photo-viewer-close');
        // Fecha se o clique não foi no botão de fechar (X)
        // Isso cobre cliques na imagem, no conteúdo ou no próprio dialog (backdrop)
        if (e.target !== closeBtn) {
            closePhotoViewer();
        }
    });
}

/**
 * Abre uma imagem no visualizador de tela cheia com estratégia cache-first.
 * @param {string} imageSrc - URL da imagem.
 */
export async function openPhotoViewer(imageSrc) {
    const dialog = document.getElementById('photo-viewer-dialog');
    const content = document.getElementById('photo-viewer-content');
    const actionModal = document.getElementById('action-modal');

    if (!dialog || !content || !imageSrc) {
        console.warn("openPhotoViewer: Elementos não encontrados ou imageSrc inválido.");
        return;
    }

    if (actionModal && actionModal.classList.contains('active')) {
        _previousActiveModal = actionModal;
    }

    content.innerHTML = `<p style="text-align:center; padding:20px;">Carregando imagem...</p>`; // Placeholder
    dialog.style.display = 'flex';
    setTimeout(() => { dialog.classList.add('active'); }, 10);

    try {
        let imageBlob = await getImageByUrl(imageSrc);

        if (imageBlob) {
            console.log("openPhotoViewer: Imagem encontrada no cache.");
            // Found in cache, display it
            content.innerHTML = `<img src="${URL.createObjectURL(imageBlob)}" alt="Foto da Árvore">`;
        } else {
            console.log("openPhotoViewer: Imagem não encontrada no cache, buscando da rede.");
            // Not in cache, fetch from network
            const response = await fetch(imageSrc);
            if (!response.ok) throw new Error('Falha ao carregar imagem da rede.');
            imageBlob = await response.blob();
            
            // Display and save to cache
            content.innerHTML = `<img src="${URL.createObjectURL(imageBlob)}" alt="Foto da Árvore">`;
            await saveImageByUrl(imageSrc, imageBlob);
            console.log("openPhotoViewer: Imagem carregada da rede e salva no cache.");
        }

        // Adiciona listener para fechar ao clicar na própria imagem
        const img = content.querySelector('img');
        if (img) {
            img.addEventListener('click', closePhotoViewer);
        }

    } catch (error) {
        console.error("Erro ao carregar imagem no visualizador:", error);
        content.innerHTML = `<p style="text-align:center; color:red; padding:20px;">Erro ao carregar imagem.</p>`;
    }
}

/**
 * Exibe um Modal de Confirmação Genérico.
 * Útil para ações destrutivas (Excluir, Limpar).
 * * @param {string} title - Título do modal.
 * @param {string} message - Mensagem explicativa.
 * @param {Function} onConfirm - Callback executado ao clicar em Confirmar.
 */
export function showConfirmModal(title, message, onConfirm) {
    const modal = document.getElementById('action-modal');

    // Fallback de segurança se o modal HTML não existir
    if (!modal) {
        if (confirm(`${title}\n\n${message}`)) {
            onConfirm();
        }
        return;
    }

    // Popula textos
    const titleEl = document.getElementById('modal-title');
    const descEl = document.getElementById('modal-description');
    if(titleEl) titleEl.textContent = title;
    if(descEl) descEl.textContent = message;

    // Configura Botões
    const actionsContainer = modal.querySelector('.modal-actions');
    if (actionsContainer) {
        actionsContainer.innerHTML = ''; // Limpa botões antigos para não duplicar listeners

        // Botão Cancelar (Estilo Export/Outline)
        const btnCancel = document.createElement('button');
        btnCancel.style.cssText = 'background-color: #9E9E9E; color: white; padding: 10px 15px; border-radius: 8px; font-size: 0.9em; border: none; cursor: pointer;';
        btnCancel.innerHTML = '<span style="font-size: 1.1em; vertical-align: middle; margin-right: 5px;">✕</span> Cancelar';
        btnCancel.onclick = () => {
            modal.classList.remove('active');
            setTimeout(() => modal.style.display = 'none', 300);
        };

        // Botão Confirmar (Estilo HUD/Primary)
        const btnConfirm = document.createElement('button');
        btnConfirm.style.cssText = 'background-color: #00796B; color: white; padding: 10px 15px; border-radius: 8px; font-size: 0.9em; border: none; cursor: pointer;';
        btnConfirm.innerHTML = '<span style="font-size: 1.1em; vertical-align: middle; margin-right: 5px;">✓</span> Confirmar';
        btnConfirm.onclick = () => {
            onConfirm();
            modal.classList.remove('active');
            setTimeout(() => modal.style.display = 'none', 300);
        };

        // Ordem: Cancelar primeiro, Confirmar depois (Padrão UX)
        actionsContainer.appendChild(btnCancel);
        actionsContainer.appendChild(btnConfirm);
    }

    // Exibe o modal
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
}

/**
 * [NOVO] Exibe um Modal com conteúdo HTML e botões de ação customizáveis.
 * @param {string} title - Título do modal.
 * @param {string} contentHTML - O HTML a ser injetado no corpo do modal.
 * @param {Array<object>} actions - Array de objetos de ação, ex: [{text, className, onClick}, ...].
 * @param {string} dialogClass - Classe CSS adicional para o .modal-dialog.
 */
export function showDetailsModal(title, contentHTML, actions = [], dialogClass = '') {
    const modal = document.getElementById('action-modal');
    if (!modal) return;

    const titleEl = document.getElementById('modal-title');
    const descEl = document.getElementById('modal-description');
    const actionsContainer = modal.querySelector('.modal-actions');
    const dialogEl = modal.querySelector('.modal-dialog');

    if (dialogEl) dialogEl.className = `modal-dialog ${dialogClass}`;

    if (titleEl) titleEl.textContent = title;
    if (descEl) descEl.innerHTML = contentHTML; // Usa innerHTML para renderizar o conteúdo

    if (actionsContainer) {
        actionsContainer.innerHTML = '';

        // Botão Cancelar/Fechar padrão
        const btnCancel = document.createElement('button');
        btnCancel.className = 'export-btn'; // Use className instead of inline style
        btnCancel.innerHTML = '<i class="icon-close"></i> Fechar'; // Replace emoji with icon tag
        btnCancel.onclick = () => {
            modal.classList.remove('active');
            setTimeout(() => modal.style.display = 'none', 300);
        };
        actionsContainer.appendChild(btnCancel);

        // Adiciona botões de ação customizados
                    actions.forEach(action => {
                        const btn = document.createElement('button');
                        btn.innerHTML = action.text; // Use innerHTML to render icons
                        if (action.style) btn.style.cssText = action.style; // Apply inline styles
                        btn.className = action.className || ''; // Clear default class, inline style takes precedence
                        btn.onclick = () => {
                            action.onClick();
                            if (action.closesModal !== false) {
                                btnCancel.click();
                            }
                        };
                        actionsContainer.appendChild(btn);
                    });    }

    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
}
