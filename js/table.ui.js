/**
 * ARBORIA 2.0 - TABLE UI (V28.0 - Fixed Overflow & Toggle Logic)
 * Renderiza a tabela de resumo e gerencia ações de linha.
 */ 

import * as State from './state.js';
import * as features from './features.js'; // Importação correta
import { showConfirmModal, openPhotoViewer, showDetailsModal } from './modal.ui.js'; // Adiciona showDetailsModal
import { getImageFromDB } from './database.js';
import { debounce } from './utils.js'; // Importa a função debounce
import { generateIndividualReport } from './pdf.generator.js';

export const TableUI = {
    
    container: null,
    badgeElement: null,
    filterInput: null, // Adiciona referência ao input de filtro
    _containerClickHandler: null, // Armazena o handler de clique para remoção
    _currentFilterHandler: null, // Armazena o handler do filtro para remoção
    _lastRenderedTrees: [], // [MODIFICATION-SEQ-ID] Cache for display IDs
    
    // Callbacks from main.js
    onNavigateToPlanningForm: null,

    // [MUDANÇA] isCompactMode agora é apenas para desktop. Mobile terá sua própria renderização.
    isCompactMode: window.innerWidth <= 768,

    sortState: {
        column: 'id',
        direction: 'desc'
    },

    render(callbacks = {}) {
        this.container = document.getElementById('summary-table-container');
        this.badgeElement = document.getElementById('summary-badge');
        this.filterInput = document.getElementById('table-filter-input'); // Obtém o input de filtro
        if (callbacks.onNavigateToPlanningForm) {
            this.onNavigateToPlanningForm = callbacks.onNavigateToPlanningForm;
        } // Store the callback

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

    sortData(trees) {
        const { column, direction } = this.sortState;
        if (!column) return trees;

        return trees.sort((a, b) => {
            let valA = a[column];
            let valB = b[column];

            // Define a mapping for risk levels to allow sorting
            const riskOrder = { 'Baixo': 1, 'Moderado': 2, 'Alto': 3, 'Extremo': 4 };

            if (column === 'risco') {
                valA = riskOrder[valA] || 0;
                valB = riskOrder[valB] || 0;
            } else if (typeof valA === 'string' && (column === 'dap' || column === 'altura' || column === 'id')) {
                valA = parseFloat(valA) || 0;
                valB = parseFloat(valB) || 0;
            } else if (typeof valA === 'string') {
                valA = valA.toLowerCase();
                valB = b[column] ? b[column].toString().toLowerCase() : '';
                return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }

            // Handle numbers and other types
             if (typeof valA === 'number' || !isNaN(valA)) {
                valA = parseFloat(valA) || 0;
                valB = parseFloat(valB) || 0;
            }

            if (valA < valB) {
                return direction === 'asc' ? -1 : 1;
            }
            if (valA > valB) {
                return direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
    },


    /**
     * [NOVO] Renderiza a tabela completa para desktop.
     */
    renderDesktopTable(trees) {
        const sortedTrees = this.sortData([...trees]);

        // [MODIFICATION-SEQ-ID] Add a sequential display ID after sorting
        const treesWithDisplayId = sortedTrees.map((tree, index) => ({
            ...tree,
            displayId: index + 1
        }));
        this._lastRenderedTrees = treesWithDisplayId; // Cache for modal

        // Aplica classe de modo compacto
        let tableClass = 'summary-table';
        if (this.isCompactMode) tableClass += ' compact-mode';

        const renderHeader = () => {
            const headers = [
                { key: 'id', label: 'ID', style: 'width: 40px;' },
                { key: 'especie', label: 'Espécie' },
                { key: 'data', label: 'Data', class: 'col-secondary' },
                { key: 'coordX', label: 'Coord. UTM', class: 'col-secondary' },
                { key: 'dap', label: 'DAP/Alt', class: 'col-secondary' },
                { key: 'local', label: 'Local' },
                { key: 'avaliador', label: 'Avaliador', class: 'col-secondary' },
                { key: 'risco', label: 'Risco' },
                { key: null, label: 'Ações', class: 'no-sort', style: 'text-align: center;' }
            ];

            return headers.map(h => {
                if (!h.key) {
                    return `<th class="${h.class || ''}" style="${h.style || ''}">${h.label}</th>`;
                }
                const isActive = this.sortState.column === h.key;
                const sortIcon = isActive ? (this.sortState.direction === 'asc' ? '▲' : '▼') : '';
                return `
                    <th 
                        class="${h.class || ''} ${isActive ? 'sort-active' : ''}"
                        style="${h.style || ''}" 
                        data-sort-key="${h.key}"
                    >
                        ${h.label} <span class="sort-icon">${sortIcon}</span>
                    </th>
                `;
            }).join('');
        };

        // Colunas com 'col-secondary' são ocultadas no modo compacto
        let html = `
            <div class="table-responsive">
            <table class="${tableClass}">
                <thead>
                    <tr>
                        ${renderHeader()}
                    </tr>
                </thead>
                <tbody>
        `;

        // Utiliza um array para construir o HTML e junta no final para melhor performance
        const rowsHtml = treesWithDisplayId.map(tree => {
            const riskClass = tree.riscoClass || 'risk-low';
            const photoIcon = tree.hasPhoto ? '📷' : '';
            const dateSimple = tree.data ? tree.data.split('-').reverse().join('/') : '--/--';

            return `
                <tr id="row-${tree.id}" class="${riskClass}">
                    <td class="col-id"><strong>${tree.displayId}</strong></td>
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
                    
                    <td style="font-size:0.8rem;">${tree.avaliador}</td>
                    
                    <td><span class="risk-badge ${riskClass}">${tree.risco}</span></td>
                    
                    <td class="col-actions">
                        <div class="action-btn-group">
                            <button class="action-btn btn-map" data-id="${tree.id}" title="Ver no Mapa">📍</button>
                            <button class="action-btn btn-details" data-id="${tree.id}" title="Ver Ficha Técnica">📋</button>
                            <button class="action-btn btn-pdf" data-id="${tree.id}" title="Gerar Laudo Individual">📄</button>
                            ${tree.hasPhoto ? `<button class="action-btn btn-photo" data-id="${tree.id}" title="Foto">📷</button>` : ''}
                            <button class="action-btn btn-edit" data-id="${tree.id}" title="Editar">✏️</button>
                            <button class="action-btn btn-delete" data-id="${tree.id}" title="Excluir">🗑️</button>
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

        // [MODIFICATION-SEQ-ID] Add a sequential display ID after sorting
        const treesWithDisplayId = sortedTrees.map((tree, index) => ({
            ...tree,
            displayId: index + 1
        }));
        this._lastRenderedTrees = treesWithDisplayId; // Cache for modal

        const listItemsHtml = treesWithDisplayId.map(tree => {
            const riskClass = tree.riscoClass || 'risk-low';
            const photoIcon = tree.hasPhoto ? '📷' : '';

            return `
                <div class="tree-card ${riskClass}" data-id="${tree.id}">
                    <div style="position:absolute; top:15px; right:15px;"><span class="risk-badge ${riskClass}">${tree.risco}</span></div>
                    <div class="item-main-info">
                        <span class="item-id">ID: ${tree.displayId}</span>
                        <strong class="item-species">${tree.especie}</strong>
                        <p class="item-location">${tree.local || 'N/A'} ${photoIcon}</p>
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
            ? this.container.querySelectorAll('.tree-card')
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

            // Handle sorting clicks
            const header = target.closest('th[data-sort-key]');
            if (header) {
                const key = header.dataset.sortKey;
                if (this.sortState.column === key) {
                    this.sortState.direction = this.sortState.direction === 'asc' ? 'desc' : 'asc';
                } else {
                    this.sortState.column = key;
                    this.sortState.direction = 'asc';
                }
                this.render(); // Re-render the whole UI
                return;
            }
            
            // Ações da tabela de desktop
            const actionBtn = target.closest('.action-btn-group .action-btn');
            if (actionBtn) {
                const id = actionBtn.dataset.id; // ID pode ser número (local) ou UUID (string, supabase)
                if (!id) return;

                // Encontra a árvore no estado usando comparação solta para lidar com tipos mistos
                const tree = State.registeredTrees.find(t => t.id == id);
                if (!tree) return;
                
                const treeId = tree.id; // Usa o ID real da árvore encontrada, preservando o tipo

                if (actionBtn.classList.contains('btn-map')) {
                    features.handleZoomToPoint(treeId);
                } else if (actionBtn.classList.contains('btn-details')) {
                    this.showTreeDetailsModal(treeId);
                } else if (actionBtn.classList.contains('btn-pdf')) {
                    generateIndividualReport(tree); // Passa a árvore inteira
                } else if (actionBtn.classList.contains('btn-edit')) {
                    features.handleEditTree(treeId);
                } else if (actionBtn.classList.contains('btn-delete')) {
                    showConfirmModal("Excluir Registro?", `Deseja apagar a árvore ID ${treeId}?`, () => features.handleDeleteTree(treeId));
                } else if (actionBtn.classList.contains('btn-photo')) {
                    getImageFromDB(treeId, blob => {
                        if (blob) openPhotoViewer(URL.createObjectURL(blob));
                    });
                }
                return;
            }

            // Clique na lista de mobile
            const listItem = target.closest('.tree-card');
            if (listItem) {
                const id = listItem.dataset.id;
                if (!id) return;

                const tree = State.registeredTrees.find(t => t.id == id);
                if (tree) {
                    this.showTreeDetailsModal(tree.id);
                }
            }
        };

        this.container.addEventListener('click', this._containerClickHandler);
    },

    /**
     * [NOVO] Exibe o modal com os detalhes da árvore.
     */
    showTreeDetailsModal(treeId) {
        const treeFromState = State.registeredTrees.find(t => t.id === treeId);
        if (!treeFromState) return;

        // [MODIFICATION-SEQ-ID] Find the rendered tree to get the displayId
        const renderedTree = this._lastRenderedTrees.find(t => t.id === treeId);
        const displayId = renderedTree ? renderedTree.displayId : treeId; // Fallback to original ID

        const tree = treeFromState; // Use the full object from state
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
                    console.log('Tentando navegar para plano, ID:', tree.id, 'Callback:', this.onNavigateToPlanningForm);
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
                onClick: () => generateIndividualReport(tree)
            }
        ];

        if (tree.hasPhoto) {
            actions.unshift({
                text: '📷 Foto',
                className: 'export-btn',
                onClick: () => getImageFromDB(tree.id, blob => blob && openPhotoViewer(URL.createObjectURL(blob)))
            });
        }
        
        // Determina a classe de risco para o diálogo
        let dialogRiskClass = 'dialog-risk-low'; // Padrão
        if (tree.riscoClass) {
            if (tree.riscoClass.includes('medium')) dialogRiskClass = 'dialog-risk-medium';
            else if (tree.riscoClass.includes('high')) dialogRiskClass = 'dialog-risk-high';
            else if (tree.riscoClass.includes('extreme')) dialogRiskClass = 'dialog-risk-extreme';
        }

        // Passa a classe para o modal
        showDetailsModal(`${tree.especie} (ID: ${displayId})`, content, actions, dialogRiskClass);
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
