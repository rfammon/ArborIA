/**
 * ARBORIA 2.0 - TABLE UI (V27.0 - Toggle Logic Fixed)
 * Responsável pela renderização e interatividade da tabela de resumo.
 */

import * as State from './state.js';
import * as Features from './features.js';
import { showConfirmModal, openPhotoViewer } from './modal.ui.js';
import { getImageFromDB } from './database.js';

export const TableUI = {
    
    container: null,
    badgeElement: null,
    // DEFAULT STATE: false = Compact (Mobile columns hidden). true = Expanded (Show all).
    isExpanded: false, 

    render() {
        this.container = document.getElementById('summary-table-container');
        this.badgeElement = document.getElementById('summary-badge');

        if (!this.container) return;

        const trees = State.registeredTrees || [];
        this.updateBadge(trees.length);

        // Render controls BEFORE checking empty state (so import button is visible)
        this.renderControls();

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

        const sortedTrees = [...trees].sort((a, b) => b.id - a.id);

        // Apply 'show-columns' class if expanded is true
        let tableClass = 'summary-table';
        if (this.isExpanded) tableClass += ' show-columns';

        let html = `
            <div class="table-responsive">
            <table class="${tableClass}">
                <thead>
                    <tr>
                        <th style="width: 40px;">ID</th>
                        <th>Espécie</th>
                        <th class="col-hide-mobile">Data</th>
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
            let badgeClass = 'badge-low'; 
            if (tree.riscoClass === 'risk-high' || tree.risco === 'Alto Risco') badgeClass = 'badge-high';
            else if (tree.riscoClass === 'risk-medium' || tree.risco === 'Médio Risco') badgeClass = 'badge-medium';

            const photoIcon = tree.hasPhoto ? '📷' : '';
            const dateSimple = tree.data ? tree.data.split('-').reverse().join('/') : '--/--';

            html += `
                <tr id="row-${tree.id}">
                    <td class="col-id"><strong>${tree.id}</strong></td>
                    <td>
                        <div style="font-weight:700; color:#333;">${tree.especie}</div>
                        <div class="col-show-mobile-only" style="font-size:0.7rem; color:#777;">${dateSimple}</div> 
                    </td>
                    
                    <td class="col-hide-mobile">${dateSimple}</td>
                    
                    <td class="col-hide-mobile">
                        <div style="font-size:0.75rem;">E:${tree.coordX}<br>N:${tree.coordY}</div>
                    </td>
                    
                    <td class="col-hide-mobile">
                        <div style="font-size:0.75rem;">D:${tree.dap} cm<br>H:${tree.altura} m</div>
                    </td>
                    
                    <td style="font-size:0.85rem;">${tree.local}</td>
                    
                    <td class="col-hide-mobile" style="font-size:0.8rem;">${tree.avaliador}</td>
                    
                    <td><span class="badge ${badgeClass}" style="font-size:0.7rem;">${tree.risco}</span> ${photoIcon}</td>
                    
                    <td style="text-align: center;">
                        <div style="display: flex; gap: 5px; justify-content: center;">
                            <button class="action-btn-icon btn-map" data-id="${tree.id}" title="Mapa" 
                                style="background:#e3f2fd; color:#0277BD; border-radius:50%; width:30px; height:30px; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center;">📍</button>
                            
                            ${tree.hasPhoto ? `
                            <button class="action-btn-icon btn-photo" data-id="${tree.id}" title="Foto" 
                                style="background:#e8f5e9; color:#2e7d32; border-radius:50%; width:30px; height:30px; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center;">📷</button>` : ''}

                            <button class="action-btn-icon btn-edit" data-id="${tree.id}" title="Editar" 
                                style="background:#fff3e0; color:#f57c00; border-radius:50%; width:30px; height:30px; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center;">✏️</button>
                            
                            <button class="action-btn-icon btn-delete" data-id="${tree.id}" title="Excluir" 
                                style="background:#ffebee; color:#d32f2f; border-radius:50%; width:30px; height:30px; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center;">🗑️</button>
                        </div>
                    </td>
                </tr>
            `;
        });

        html += `</tbody></table></div>`;
        this.container.innerHTML = html;
        this.bindEvents();
    },

    renderControls() {
        const wrapper = document.querySelector('.table-filter-container');
        if (!wrapper) return;

        // If button exists, update text and return
        if (document.getElementById('toggle-cols-btn')) {
            const btn = document.getElementById('toggle-cols-btn');
            btn.innerHTML = this.isExpanded ? '➖ Compactar' : '👁️ + Colunas';
            return;
        }

        wrapper.className = 'table-controls-wrapper';
        const input = document.getElementById('table-filter-input');
        
        // Create Toggle Button
        const btnToggle = document.createElement('button');
        btnToggle.id = 'toggle-cols-btn';
        btnToggle.type = 'button';
        // Initial state text
        btnToggle.innerHTML = this.isExpanded ? '➖ Compactar' : '👁️ + Colunas';
        
        btnToggle.onclick = () => {
            this.isExpanded = !this.isExpanded;
            btnToggle.innerHTML = this.isExpanded ? '➖ Compactar' : '👁️ + Colunas';
            
            // Toggle class on existing table
            const table = this.container.querySelector('table');
            if (table) {
                if (this.isExpanded) table.classList.add('show-columns');
                else table.classList.remove('show-columns');
            }
        };

        wrapper.innerHTML = ''; 
        
        const divInput = document.createElement('div');
        divInput.className = 'table-filter-container';
        divInput.appendChild(input); 

        wrapper.appendChild(divInput);
        wrapper.appendChild(btnToggle);
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
        // Map
        this.container.querySelectorAll('.btn-map').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(btn.dataset.id);
                Features.handleZoomToPoint(id);
            });
        });

        // Edit
        this.container.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(btn.dataset.id);
                Features.handleEditTree(id);
            });
        });

        // Delete
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

        // Photo
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
