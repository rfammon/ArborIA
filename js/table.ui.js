/**
 * ARBORIA 2.0 - TABLE UI (V28.0 - Fixed Overflow & Toggle Logic)
 * Renderiza a tabela de resumo e gerencia ações de linha.
 */ 

import * as State from './state.js';
import * as features from './features.js'; // Importação correta
import { showConfirmModal, openPhotoViewer, showDetailsModal } from './modal.ui.js'; // Adiciona showDetailsModal
import { getImageFromDB } from './database.js';
import { debounce } from './utils.js'; // Importa a função debounce
import { generateSingleTreePDF } from './pdf.generator.js';

export const TableUI = {
    
    container: null,
    badgeElement: null,
    filterInput: null, // Adiciona referência ao input de filtro
    _containerClickHandler: null, // Armazena o handler de clique para remoção
    _currentFilterHandler: null, // Armazena o handler do filtro para remoção
    
    // Callbacks from main.js
    onNavigateToPlanningForm: null,

    // [MUDANÇA] isCompactMode agora é apenas para desktop. Mobile terá sua própria renderização.
    isCompactMode: window.innerWidth <= 768,

    render(callbacks = {}) {
        this.container = document.getElementById('summary-table-container');
        this.badgeElement = document.getElementById('summary-badge');
        this.filterInput = document.getElementById('table-filter-input'); // Obtém o input de filtro
        this.onNavigateToPlanningForm = callbacks.onNavigateToPlanningForm; // Store the callback

        if (!this.container || !this.badgeElement || !this.filterInput) return;

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
        
        this.setupFilterListener(); // Configura o listener do filtro após a renderização
        this.bindContainerEvents(); // Otimizado com delegação de eventos
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

        // Utiliza um array para construir o HTML e junta no final para melhor performance
        const rowsHtml = sortedTrees.map(tree => {
            let badgeClass = 'badge-low'; 
            if (tree.riscoClass === 'risk-high' || tree.risco === 'Alto Risco') badgeClass = 'badge-high';
            else if (tree.riscoClass === 'risk-medium' || tree.risco === 'Médio Risco') badgeClass = 'badge-medium';

            const photoIcon = tree.hasPhoto ? '📷' : '';
            const dateSimple = tree.data ? tree.data.split('-').reverse().join('/') : '--/--';

            return `
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
                            
                            <button class="action-btn-icon btn-plan-intervencion" data-id="${tree.id}" title="Plano de Intervenção" 
                                style="background:#d7f3e0; color:#4CAF50; border-radius:50%; width:30px; height:30px; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center;">📋</button>
                            
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

        html += rowsHtml.join('') + `</tbody></table></div>`;
        this.container.innerHTML = html;
    },

    /**
     * [NOVO] Renderiza a lista de cards para mobile.
     */
    renderMobileList(trees) {
        const sortedTrees = [...trees].sort((a, b) => b.id - a.id);
        
        const listItemsHtml = sortedTrees.map(tree => {
            let badgeClass = 'badge-low';
            if (tree.risco === 'Alto Risco') badgeClass = 'badge-high';
            else if (tree.risco === 'Médio Risco') badgeClass = 'badge-medium';

            const photoIcon = tree.hasPhoto ? '📷' : '';

            return `
                <div class="summary-list-item ${badgeClass}" data-tree-id="${tree.id}">
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

        this.container.innerHTML = `<div class="summary-list-mobile">${listItemsHtml.join('')}</div>`;

        // A delegação de eventos em bindContainerEvents cuida dos cliques na lista mobile
    },

    /**
     * Configura o listener para o campo de filtro da tabela.
     */
    setupFilterListener() {
        if (!this.filterInput) return;

        // Debounce a função de filtro para otimizar performance
        const debouncedFilter = debounce((event) => {
            const filterText = event.target.value.toLowerCase();
            this.filterTable(filterText);
        }, 300); // 300ms de atraso

        this.filterInput.removeEventListener('input', this._currentFilterHandler); // Remove handler antigo
        this._currentFilterHandler = debouncedFilter; // Armazena o handler atual
        this.filterInput.addEventListener('input', this._currentFilterHandler);
        
        // Aplica o filtro imediatamente se já houver texto (ex: ao voltar para a aba)
        this.filterTable(this.filterInput.value.toLowerCase());
    },

    /**
     * Filtra as linhas da tabela ou itens da lista com base no texto.
     * @param {string} filterText O texto a ser usado como filtro.
     */
    filterTable(filterText) {
        const isMobile = window.innerWidth <= 768;
        const items = isMobile 
            ? this.container.querySelectorAll('.summary-list-item')
            : this.container.querySelectorAll('tbody tr');

        items.forEach(item => {
            const itemText = item.textContent.toLowerCase();
            const shouldShow = itemText.includes(filterText);
            
            if (isMobile) {
                item.style.display = shouldShow ? 'flex' : 'none';
            } else {
                item.style.display = shouldShow ? 'table-row' : 'none';
            }
        });
    },

    /**
     * [OTIMIZADO] Anexa um único listener de eventos ao container para lidar com todas as ações.
     */
    bindContainerEvents() {
        if (!this.container) return;

        // Remove listener antigo para evitar duplicação
        if (this._containerClickHandler) {
            this.container.removeEventListener('click', this._containerClickHandler);
        }

        this._containerClickHandler = (event) => {
            const target = event.target;
            
            // Ações da tabela de desktop
            const actionBtn = target.closest('.action-btn-icon');
            if (actionBtn) {
                const id = parseInt(actionBtn.dataset.id, 10);
                if (isNaN(id)) return;

                            if (actionBtn.classList.contains('btn-map')) {
                                features.handleZoomToPoint(id);
                            } else if (actionBtn.classList.contains('btn-edit')) {
                                features.handleEditTree(id);
                            } else if (actionBtn.classList.contains('btn-delete')) {
                                showConfirmModal("Excluir Registro?", `Deseja apagar a árvore ID ${id}?`, () => features.handleDeleteTree(id));
                            } else if (actionBtn.classList.contains('btn-photo')) {
                                getImageFromDB(id, blob => {
                                    if (blob) openPhotoViewer(URL.createObjectURL(blob));
                                });
                            } else if (actionBtn.classList.contains('btn-plan-intervencion')) {
                                if (this.onNavigateToPlanningForm) {
                                    this.onNavigateToPlanningForm(id);
                                }
                            }                return;
            }

            // Clique na lista de mobile
            const listItem = target.closest('.summary-list-item');
            if (listItem) {
                const treeId = parseInt(listItem.dataset.treeId, 10);
                if (!isNaN(treeId)) {
                    this.showTreeDetailsModal(treeId);
                }
            }
        };

        this.container.addEventListener('click', this._containerClickHandler);
    },

    /**
     * [NOVO] Exibe o modal com os detalhes da árvore.
     */
    showTreeDetailsModal(treeId) {
        const tree = State.registeredTrees.find(t => t.id === treeId);
        if (!tree) return;

        const dateSimple = tree.data ? tree.data.split('-').reverse().join('/') : 'N/A';
        
        // Mapeia os fatores de risco para uma lista legível
        const riskFactorsMeta = [
            { key: 'galhos-mortos', label: 'Galhos Mortos > 5cm' },
            { key: 'rachaduras', label: 'Rachaduras/Fendas' },
            { key: 'apodrecimento', label: 'Sinais de Apodrecimento' },
            { key: 'casca-inclusa', label: 'Casca Inclusa' },
            { key: 'galhos-cruzados', label: 'Galhos Cruzados' },
            { key: 'copa-assimetrica', label: 'Copa Assimétrica' },
            { key: 'inclinacao', label: 'Inclinação Anormal' },
            { key: null, label: 'Próxima a Vias Públicas' },
            { key: null, label: 'Risco sobre Alvos' },
            { key: null, label: 'Interferência em Redes' },
            { key: null, label: 'Espécie com Falhas' },
            { key: 'brotacao-intensa', label: 'Brotação Epicórmica' },
            { key: null, label: 'Calçadas Rachadas' },
            { key: 'perda-raizes', label: 'Perda de Raízes' },
            { key: 'compactacao', label: 'Compactação do Solo' },
            { key: 'apodrecimento', label: 'Apodrecimento em Raízes' }
        ];

        const riskFactorsList = (tree.riskFactors || [])
            .map((val, idx) => (val === 1 && riskFactorsMeta[idx]) ? `<li>${riskFactorsMeta[idx].label}</li>` : null)
            .filter(Boolean)
            .join('');

        const content = `
            <div class="details-modal-grid">
                <p><strong>Data:</strong> ${dateSimple}</p>
                <p><strong>Local:</strong> ${tree.local || 'N/A'}</p>
                <p><strong>DAP:</strong> ${tree.dap || 'N/A'} cm</p>
                <p><strong>Altura:</strong> ${tree.altura || 'N/A'} m</p>
            </div>

            <div class="details-section">
                <h4>Observações de Campo</h4>
                <p>${tree.observacoes || 'Nenhuma observação registrada.'}</p>
            </div>

            ${riskFactorsList ? `
            <div class="details-section">
                <h4>Fatores de Risco Ativos</h4>
                <ul class="details-risk-list">${riskFactorsList}</ul>
            </div>` : ''}
        `;

        const actions = [
            {
                text: '📍 Mapa',
                className: 'export-btn',
                onClick: () => features.handleZoomToPoint(tree.id)
            },
            {
                text: '📄 Plano',
                className: 'action-btn',
                onClick: () => {
                    if (this.onNavigateToPlanningForm) {
                        this.onNavigateToPlanningForm(tree.id);
                    }
                }
            },
            {
                text: '✏️ Editar',
                className: 'export-btn',
                onClick: () => features.handleEditTree(tree.id)
            },
            {
                text: '📄 Laudo',
                className: 'action-btn',
                onClick: () => generateSingleTreePDF(tree)
            }
        ];

        if (tree.hasPhoto) {
            actions.unshift({
                text: '📷 Foto',
                className: 'export-btn',
                onClick: () => getImageFromDB(tree.id, blob => blob && openPhotoViewer(URL.createObjectURL(blob)))
            });
        }
        
        const riskClass = tree.risco === 'Alto Risco' ? 'risk-high' : tree.risco === 'Médio Risco' ? 'risk-medium' : 'risk-low';

        showDetailsModal(`${tree.especie} (ID: ${tree.id})`, content, actions, riskClass);
    },

    renderControls() {
        const wrapper = document.querySelector('.table-controls-wrapper');
        if (!wrapper) return;

        // Se o botão já existe, apenas atualiza o texto
        const existingBtnToggle = document.getElementById('toggle-cols-btn');
        if (existingBtnToggle) {
            existingBtnToggle.innerHTML = this.isCompactMode ? '👁️ + Colunas' : '➖ Compactar';
        }

        // Encontra ou cria o container do input
        let inputOuterContainer = wrapper.querySelector('.table-filter-container');
        if (!inputOuterContainer) {
            inputOuterContainer = document.createElement('div');
            inputOuterContainer.className = 'table-filter-container';
            wrapper.prepend(inputOuterContainer); // Adiciona antes do botão toggle se não existir
        }

        // Cria o novo wrapper para o input com ícone
        let filterInputWrapper = inputOuterContainer.querySelector('.filter-input-wrapper');
        if (!filterInputWrapper) {
            filterInputWrapper = document.createElement('div');
            filterInputWrapper.className = 'filter-input-wrapper';
            
            const searchIcon = document.createElement('span');
            searchIcon.className = 'filter-icon';
            searchIcon.textContent = '🔍'; // Ícone de lupa

            filterInputWrapper.appendChild(searchIcon);
            filterInputWrapper.appendChild(this.filterInput); // Adiciona o input existente
            
            inputOuterContainer.innerHTML = ''; // Limpa o container externo
            inputOuterContainer.appendChild(filterInputWrapper); // Adiciona o novo wrapper
        }
        
        // Cria ou atualiza o botão toggle
        let btnToggle = document.getElementById('toggle-cols-btn');
        if (!btnToggle) {
            btnToggle = document.createElement('button');
            btnToggle.id = 'toggle-cols-btn';
            btnToggle.type = 'button';
            btnToggle.className = 'export-btn';
            wrapper.appendChild(btnToggle);
        }
        btnToggle.innerHTML = this.isCompactMode ? '👁️ + Colunas' : '➖ Compactar';
        btnToggle.onclick = () => {
            this.isCompactMode = !this.isCompactMode;
            btnToggle.innerHTML = this.isCompactMode ? '👁️ + Colunas' : '➖ Compactar';
            const table = this.container.querySelector('table');
            if (table) {
                if (this.isCompactMode) table.classList.add('compact-mode');
                else table.classList.remove('compact-mode');
            }
        };
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
};
