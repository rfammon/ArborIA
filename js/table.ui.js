/**
 * ARBORIA 2.0 - TABLE UI (V25.1 - Mobile Fix & Gradient)
 * Responsável pela renderização e interatividade da tabela de resumo.
 * Correção: Integração do botão "Toggle Columns" para visualização mobile.
 */

import * as State from './state.js';
import * as Features from './features.js';
import { showConfirmModal, openPhotoViewer } from './modal.ui.js';
import { getImageFromDB } from './database.js';

export const TableUI = {
    
    container: null,
    badgeElement: null,
    isCompactMode: false, // Estado do toggle de colunas (padrão: expandido/todos)

    /**
     * Renderiza a tabela completa.
     */
    render() {
        this.container = document.getElementById('summary-table-container');
        this.badgeElement = document.getElementById('summary-badge');

        if (!this.container) return;

        const trees = State.registeredTrees || [];
        this.updateBadge(trees.length);

        // Injeta controles superiores (Filtro + Toggle Colunas)
        this.renderControls();

        // Estado Vazio
        if (trees.length === 0) {
            this.container.innerHTML = `
                <div class="text-center" style="padding: 40px; color: #999;">
                    <p style="font-size: 3rem; margin-bottom: 10px;">🌳</p>
                    <p>Nenhuma árvore cadastrada.</p>
                    <p style="font-size: 0.9rem;">Use a aba "Registrar" ou importe um arquivo.</p>
                </div>
            `;
            this.toggleExportButtons(false);
            return;
        }

        this.toggleExportButtons(true);

        // Ordenação (Decrescente por ID padrão)
        const sortedTrees = [...trees].sort((a, b) => b.id - a.id);

        // Monta a tabela com classe 'summary-table' e 'compact-view' se ativo
        let html = `
            <div class="table-responsive">
            <table class="summary-table ${this.isCompactMode ? 'compact-view' : ''}">
                <thead>
                    <tr>
                        <th style="width: 50px;">ID</th>
                        <th>Espécie/Data</th>
                        <th class="col-hide-mobile">Coord. UTM</th>
                        <th class="col-hide-mobile">DAP/Alt</th>
                        <th>Local</th>
                        <th class="col-hide-mobile">Avaliador</th>
                        <th>Risco</th>
                        <th style="text-align: center;">Ações</th>
                    </tr>
                </thead>
                <tbody>
        `;

        sortedTrees.forEach(tree => {
            // Badges de Risco
            let badgeClass = 'badge-low'; 
            if (tree.riscoClass === 'risk-high' || tree.risco === 'Alto Risco') badgeClass = 'badge-high';
            else if (tree.riscoClass === 'risk-medium' || tree.risco === 'Médio Risco') badgeClass = 'badge-medium';

            const photoIcon = tree.hasPhoto ? '📷' : '';
            // Formata data simples
            const dateSimple = tree.data ? tree.data.split('-').reverse().join('/') : '--/--';

            html += `
                <tr id="row-${tree.id}">
                    <td class="col-id">#${tree.id}</td>
                    <td>
                        <div style="font-weight:700; color:#333;">${tree.especie}</div>
                        <div style="font-size:0.75rem; color:#777;">${dateSimple} ${photoIcon}</div>
                    </td>
                    <td class="col-hide-mobile">
                        <div style="font-size:0.8rem;">E: ${tree.coordX}</div>
                        <div style="font-size:0.8rem;">N: ${tree.coordY}</div>
                    </td>
                    <td class="col-hide-mobile">
                        <div style="font-size:0.8rem;">DAP: ${tree.dap}</div>
                        <div style="font-size:0.8rem;">Alt: ${tree.altura}</div>
                    </td>
                    <td style="font-size:0.85rem;">${tree.local}</td>
                    <td class="col-hide-mobile" style="font-size:0.8rem;">${tree.avaliador}</td>
                    <td><span class="badge ${badgeClass}" style="font-size:0.7rem;">${tree.risco}</span></td>
                    <td style="text-align: center;">
                        <div style="display: flex; gap: 6px; justify-content: center;">
                            
                            <button class="action-btn-icon btn-map" data-id="${tree.id}" title="Ver no Mapa" 
                                style="background:#e3f2fd; color:#0277BD; border-radius:50%; width:32px; height:32px; padding:0; display:flex; align-items:center; justify-content:center;">
                                📍
                            </button>
                            
                            ${tree.hasPhoto ? `
                            <button class="action-btn-icon btn-photo" data-id="${tree.id}" title="Ver Foto" 
                                style="background:#e8f5e9; color:#2e7d32; border-radius:50%; width:32px; height:32px; padding:0; display:flex; align-items:center; justify-content:center;">
                                📷
                            </button>` : ''}

                            <button class="action-btn-icon btn-edit" data-id="${tree.id}" title="Editar" 
                                style="background:#fff3e0; color:#f57c00; border-radius:50%; width:32px; height:32px; padding:0; display:flex; align-items:center; justify-content:center;">
                                ✏️
                            </button>
                            
                            <button class="action-btn-icon btn-delete" data-id="${tree.id}" title="Excluir" 
                                style="background:#ffebee; color:#d32f2f; border-radius:50%; width:32px; height:32px; padding:0; display:flex; align-items:center; justify-content:center;">
                                🗑️
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

        html += `</tbody></table></div>`;
        this.container.innerHTML = html;

        this.bindEvents();
    },

    /**
     * Renderiza o input de filtro e botão de toggle se não existirem.
     * (Mantém os listeners originais do input ao mover no DOM).
     */
    renderControls() {
        const wrapper = document.querySelector('.table-filter-container');
        if (!wrapper) return;

        // Se já tem o botão, não faz nada
        if (document.getElementById('toggle-cols-btn')) return;

        // Transforma o container em Flexbox para acomodar o botão
        wrapper.className = 'table-controls-wrapper'; // Classe CSS nova
        
        // Guarda referência ao input existente (para não perder o listener do features.js)
        const input = document.getElementById('table-filter-input');
        
        // Cria o botão de toggle
        const btnToggle = document.createElement('button');
        btnToggle.id = 'toggle-cols-btn';
        btnToggle.type = 'button';
        btnToggle.innerHTML = this.isCompactMode ? '➕ Detalhes' : '👁️ Colunas';
        // No mobile, queremos esconder por padrão? Se sim, inverta a lógica aqui.
        // Assumindo padrão: Mostra tudo, botão esconde.
        
        btnToggle.onclick = () => this.toggleCompactMode(btnToggle);

        // Limpa o wrapper e reconstrói
        wrapper.innerHTML = ''; 
        
        // Wrapper do input (para manter estilo de largura total flex)
        const divInput = document.createElement('div');
        divInput.className = 'table-filter-container';
        divInput.appendChild(input); // Move o elemento DOM existente

        wrapper.appendChild(divInput);
        wrapper.appendChild(btnToggle);
    },

    /**
     * Alterna a visualização compacta/expandida.
     */
    toggleCompactMode(btn) {
        this.isCompactMode = !this.isCompactMode;
        btn.innerHTML = this.isCompactMode ? '➕ Detalhes' : '👁️ Colunas';
        
        // Atualiza classe na tabela sem re-renderizar tudo (Performance)
        const table = this.container.querySelector('table');
        if (table) {
            if (this.isCompactMode) table.classList.add('compact-view');
            else table.classList.remove('compact-view');
        }
    },

    updateBadge(count) {
        if (this.badgeElement) {
            this.badgeElement.textContent = count;
            if (count > 0) this.badgeElement.classList.add('badge-medium');
            else this.badgeElement.classList.remove('badge-medium');
        }
    },

    toggleExportButtons(show) {
        const ctrls = document.getElementById('import-export-controls');
        if (!ctrls) return;
        const exportBtns = ctrls.querySelectorAll('#export-data-btn, #generate-pdf-btn, #send-email-btn, #clear-all-btn');
        exportBtns.forEach(btn => {
            btn.style.display = show ? 'inline-flex' : 'none';
        });
    },

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
