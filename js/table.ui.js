/**
 * ARBORIA 2.0 - TABLE UI (V28.0 - Fixed Overflow & Toggle Logic)
 * Renderiza a tabela de resumo e gerencia ações de linha.
 */ 

import * as State from './state.js';
import * as features from './features.js'; // Importação correta
import { showConfirmModal, openPhotoViewer, showDetailsModal } from './modal.ui.js'; // Adiciona showDetailsModal
import { getImageFromDB } from './database.js';

export const TableUI = {
    
    container: null,
    badgeElement: null,
    
    // [MUDANÇA] isCompactMode agora é apenas para desktop. Mobile terá sua própria renderização.
    isCompactMode: window.innerWidth <= 768,

    render() {
        this.container = document.getElementById('summary-table-container');
        this.badgeElement = document.getElementById('summary-badge');

        if (!this.container || !this.badgeElement) return;

        const trees = State.registeredTrees || [];
        this.updateBadge(trees.length);

        // [MUDANÇA] Controles de expandir/compactar só aparecem no desktop.
        if (window.innerWidth > 768) {
            this.renderControls();
        }

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

        // [MUDANÇA] Lógica de renderização condicional
        if (window.innerWidth <= 768) {
            this.renderMobileList(trees);
        } else {
            this.renderDesktopTable(trees);
        }
    },

    /**
     * [NOVO] Renderiza a tabela completa para desktop.
     */
    renderDesktopTable(trees) {
        const sortedTrees = [...trees].sort((a, b) => b.id - a.id);

        // Aplica classe de modo compacto
        let tableClass = 'summary-table';
        if (this.isCompactMode) tableClass += ' compact-mode';

        // Colunas com 'col-secondary' são ocultadas no modo compacto
        let html = `
            <div class="table-responsive">
            <table class="${tableClass}">
                <thead>
                    <tr>
                        <th style="width: 40px;">ID</th>
                        <th>Espécie</th>
                        <th class="col-secondary">Data</th>
                        <th class="col-secondary">Coord. UTM</th>
                        <th class="col-secondary">DAP/Alt</th>
                        <th>Local</th>
                        <th class="col-secondary">Avaliador</th>
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
                        <div style="font-weight: 700; color: #333;">${tree.especie}</div>
                        <div class="col-mobile-summary">${dateSimple} &nbsp; | &nbsp; ${tree.local} ${photoIcon}</div>
                    </td>
                    
                    <td class="col-secondary">${dateSimple}</td>
                    
                    <td class="col-secondary">
                        <div style="font-size:0.75rem;">E:${tree.coordX}<br>N:${tree.coordY}</div>
                    </td>
                    
                    <td class="col-secondary">
                        <div style="font-size:0.75rem;">D:${tree.dap} cm<br>H:${tree.altura} m</div>
                    </td>
                    
                    <td style="font-size:0.85rem;">${tree.local}</td>
                    
                    <td class="col-secondary" style="font-size:0.8rem;">${tree.avaliador}</td>
                    
                    <td><span class="badge ${badgeClass}" style="font-size:0.7rem;">${tree.risco}</span></td>
                    
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

    /**
     * [NOVO] Renderiza a lista de cards para mobile.
     */
    renderMobileList(trees) {
        const sortedTrees = [...trees].sort((a, b) => b.id - a.id);
        let html = `<div class="summary-list-mobile">`;

        sortedTrees.forEach(tree => {
            let badgeClass = 'badge-low';
            if (tree.risco === 'Alto Risco') badgeClass = 'badge-high';
            else if (tree.risco === 'Médio Risco') badgeClass = 'badge-medium';

            const photoIcon = tree.hasPhoto ? '📷' : '';

            html += `
                <div class="summary-list-item" data-tree-id="${tree.id}">
                    <div class="item-main-info">
                        <span class="item-id">ID: ${tree.id}</span>
                        <strong class="item-species">${tree.especie}</strong>
                        <p class="item-location">${tree.local || 'N/A'} ${photoIcon}</p>
                    </div>
                    <div class="item-risk-info">
                        <span class="badge ${badgeClass}">${tree.risco}</span>
                    </div>
                </div>
            `;
        });

        html += `</div>`;
        this.container.innerHTML = html;
        this.bindMobileListEvents();
    },

    /**
     * [NOVO] Anexa eventos de clique para a lista mobile.
     */
    bindMobileListEvents() {
        this.container.querySelectorAll('.summary-list-item').forEach(item => {
            item.addEventListener('click', () => {
                const treeId = parseInt(item.dataset.treeId, 10);
                this.showTreeDetailsModal(treeId);
            });
        });
    },

    /**
     * [NOVO] Exibe o modal com os detalhes da árvore.
     */
    showTreeDetailsModal(treeId) {
        const tree = State.registeredTrees.find(t => t.id === treeId);
        if (!tree) return;

        const dateSimple = tree.data ? tree.data.split('-').reverse().join('/') : '--/--';
        
        // [MELHORIA] Usa as descrições dos fatores de risco
        const riskLabels = [
            "Galhos Mortos > 5cm", "Rachaduras/Fendas", "Sinais de Apodrecimento", "Casca Inclusa", 
            "Galhos Cruzados", "Copa Assimétrica", "Inclinação Anormal", "Próxima a Vias Públicas", 
            "Risco sobre Alvos", "Interferência em Redes", "Espécie com Falhas", "Brotação Epicórmica", 
            "Calçadas Rachadas", "Perda de Raízes", "Compactação do Solo", "Apodrecimento em Raízes"
        ];
        const riskFactors = (tree.riskFactors || []).map((val, idx) => val === 1 ? `<li>${riskLabels[idx]}</li>` : null).filter(v => v).join('');

        const content = `
            <div class="details-modal-grid">
                <p><strong>Data:</strong> ${dateSimple}</p>
                <p><strong>Local:</strong> ${tree.local}</p>
                <p><strong>Avaliador:</strong> ${tree.avaliador}</p>
                <p><strong>DAP:</strong> ${tree.dap} cm</p>
                <p><strong>Altura:</strong> ${tree.altura} m</p>
                <p><strong>Coordenadas:</strong> ${tree.coordX} / ${tree.coordY} (Zona ${tree.utmZoneNum}${tree.utmZoneLetter})</p>
                <p><strong>Observações:</strong> ${tree.observacoes || 'Nenhuma.'}</p>
            </div>
            ${riskFactors ? `<h4>Fatores de Risco Ativos:</h4><ul class="details-risk-list">${riskFactors}</ul>` : ''}
        `;

        const actions = [
            { text: '✏️ Editar', className: 'action-btn', onClick: () => features.handleEditTree(tree.id) },
            { text: '🗑️ Excluir', className: 'btn-danger-filled', closesModal: false, onClick: () => {
                showConfirmModal("Excluir Registro?", `Deseja apagar a árvore ID ${tree.id}?`, () => features.handleDeleteTree(tree.id));
            }}
        ];

        if (tree.hasPhoto) {
            actions.unshift({ text: '📷 Ver Foto', className: 'action-btn', onClick: () => getImageFromDB(tree.id, blob => blob && openPhotoViewer(URL.createObjectURL(blob))) });
        }

        // [MELHORIA] Passa a classe de risco para o modal
        const riskClass = tree.risco === 'Alto Risco' ? 'risk-high' : tree.risco === 'Médio Risco' ? 'risk-medium' : 'risk-low';

        showDetailsModal(`Detalhes: ${tree.especie} (ID: ${tree.id})`, content, actions, riskClass);
    },

    renderControls() {
        const wrapper = document.querySelector('.table-filter-container');
        if (!wrapper) return; // Sai se o container não existir

        // Se o botão já existe, apenas atualiza o texto
        const existingBtn = document.getElementById('toggle-cols-btn');
        if (existingBtn) {
            existingBtn.innerHTML = this.isCompactMode ? '👁️ + Colunas' : '➖ Compactar';
            return;
        }

        // Cria o layout de controles pela primeira vez
        wrapper.className = 'table-controls-wrapper';
        const input = document.getElementById('table-filter-input');
        
        const btnToggle = document.createElement('button');
        btnToggle.id = 'toggle-cols-btn';
        btnToggle.type = 'button';
        btnToggle.innerHTML = this.isCompactMode ? '👁️ + Colunas' : '➖ Compactar';
        
        btnToggle.onclick = () => {
            this.isCompactMode = !this.isCompactMode;
            btnToggle.innerHTML = this.isCompactMode ? '👁️ + Colunas' : '➖ Compactar';
            
            // Alterna a classe na tabela para o CSS reagir
            const table = this.container.querySelector('table');
            if (table) {
                if (this.isCompactMode) table.classList.add('compact-mode');
                else table.classList.remove('compact-mode');
            }
        };

        wrapper.innerHTML = ''; // Limpa o container
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
        // Ver Mapa
        this.container.querySelectorAll('.btn-map').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(btn.dataset.id);
                features.handleZoomToPoint(id);
            });
        });

        // Editar
        this.container.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(btn.dataset.id);
                features.handleEditTree(id);
            });
        });

        // Excluir
        this.container.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(btn.dataset.id);
                showConfirmModal(
                    "Excluir Registro?", 
                    `Deseja apagar a árvore ID ${id}?`, 
                    () => features.handleDeleteTree(id)
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
