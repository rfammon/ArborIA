/**
 * ARBORIA 2.0 - TABLE UI (Refatorado)
 * Renderiza a tabela de resumo e gerencia ações de linha.
 */

import * as State from './state.js';
import * as Features from './features.js';
import { showConfirmModal, openPhotoViewer } from './modal.ui.js';
import { getImageFromDB } from './database.js';

export const TableUI = {
    container: null,
    badgeElement: null,

    /**
     * Renderiza a tabela completa com base no estado atual.
     */
    render() {
        this.container = document.getElementById('summary-table-container');
        this.badgeElement = document.getElementById('summary-badge');

        if (!this.container) return;

        const trees = State.registeredTrees || [];
        this.updateBadge(trees.length);

        // Estado Vazio
        if (trees.length === 0) {
            this.container.innerHTML = `
                <div class="text-center" style="padding: 40px; color: #999;">
                    <p style="font-size: 3rem; margin-bottom: 10px;">🌳</p>
                    <p>Nenhuma árvore cadastrada.</p>
                    <p style="font-size: 0.9rem;">Use a aba "Registrar" ou importe um arquivo.</p>
                </div>
            `;
            
            // Esconde botões de exportação se vazio
            this.toggleExportButtons(false);
            return;
        }

        // Mostra botões de exportação
        this.toggleExportButtons(true);

        // Ordenação (Decrescente por ID padrão)
        const sortedTrees = [...trees].sort((a, b) => b.id - a.id);

        let html = `
            <table class="risk-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Espécie</th>
                        <th>Local</th>
                        <th>Risco</th>
                        <th style="text-align: center;">Ações</th>
                    </tr>
                </thead>
                <tbody>
        `;

        sortedTrees.forEach(tree => {
            // Badges de Risco
            let badgeClass = 'badge-low'; 
            // Mapeamento de classes CSS novas
            if (tree.riscoClass === 'risk-high' || tree.risco === 'Alto Risco') badgeClass = 'badge-high';
            else if (tree.riscoClass === 'risk-medium' || tree.risco === 'Médio Risco') badgeClass = 'badge-medium';

            const photoIcon = tree.hasPhoto ? '📷' : '';

            html += `
                <tr id="row-${tree.id}">
                    <td><strong>${tree.id}</strong></td>
                    <td>
                        <div style="font-weight:600; color:#333;">${tree.especie}</div>
                        <div style="font-size:0.8rem; color:#777;">${tree.data} ${photoIcon}</div>
                    </td>
                    <td style="font-size:0.9rem;">${tree.local}</td>
                    <td><span class="badge ${badgeClass}">${tree.risco}</span></td>
                    <td style="text-align: center;">
                        <div style="display: flex; gap: 8px; justify-content: center;">
                            
                            <button class="action-btn-icon btn-map" data-id="${tree.id}" title="Ver no Mapa" 
                                style="background:#e3f2fd; color:#0277BD; width:32px; height:32px; padding:0; display:flex; align-items:center; justify-content:center; border-radius:50%;">
                                📍
                            </button>
                            
                            ${tree.hasPhoto ? `
                            <button class="action-btn-icon btn-photo" data-id="${tree.id}" title="Ver Foto" 
                                style="background:#e8f5e9; color:#2e7d32; width:32px; height:32px; padding:0; display:flex; align-items:center; justify-content:center; border-radius:50%;">
                                📷
                            </button>` : ''}

                            <button class="action-btn-icon btn-edit" data-id="${tree.id}" title="Editar" 
                                style="background:#fff3e0; color:#f57c00; width:32px; height:32px; padding:0; display:flex; align-items:center; justify-content:center; border-radius:50%;">
                                ✏️
                            </button>
                            
                            <button class="action-btn-icon btn-delete" data-id="${tree.id}" title="Excluir" 
                                style="background:#ffebee; color:#d32f2f; width:32px; height:32px; padding:0; display:flex; align-items:center; justify-content:center; border-radius:50%;">
                                🗑️
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

        html += `</tbody></table>`;
        this.container.innerHTML = html;

        this.bindEvents();
    },

    /**
     * Atualiza o badge de contagem na aba.
     */
    updateBadge(count) {
        if (this.badgeElement) {
            this.badgeElement.textContent = count;
            if (count > 0) this.badgeElement.classList.add('badge-medium');
            else this.badgeElement.classList.remove('badge-medium');
        }
    },

    /**
     * Controla visibilidade dos botões de exportação
     */
    toggleExportButtons(show) {
        const ctrls = document.getElementById('import-export-controls');
        if (!ctrls) return;
        
        // Mantemos Importar visível, escondemos Exportar/Limpar se vazio
        const exportBtns = ctrls.querySelectorAll('#export-data-btn, #generate-pdf-btn, #send-email-btn, #clear-all-btn');
        exportBtns.forEach(btn => {
            btn.style.display = show ? 'inline-flex' : 'none';
        });
    },

    /**
     * Anexa listeners aos botões gerados dinamicamente.
     */
    bindEvents() {
        // Ver Mapa
        this.container.querySelectorAll('.btn-map').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(btn.dataset.id);
                Features.handleZoomToPoint(id);
            });
        });

        // Editar
        this.container.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(btn.dataset.id);
                Features.handleEditTree(id);
            });
        });

        // Excluir
        this.container.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(btn.dataset.id);
                showConfirmModal(
                    "Excluir Registro?", 
                    `Deseja apagar a árvore ID ${id}?`, 
                    () => Features.handleDeleteTree(id)
                );
            });
        });

        // Ver Foto
        this.container.querySelectorAll('.btn-photo').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(btn.dataset.id);
                getImageFromDB(id, (blob) => {
                    if (blob) {
                        const url = URL.createObjectURL(blob);
                        openPhotoViewer(url);
                    }
                });
            });
        });
    }
};
