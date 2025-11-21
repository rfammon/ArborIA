// js/table.ui.js (V24.3 - FINALMENTE CORRIGIDO: Imports Circulares Removidas)
// Gerencia a renderização, atualização e interação com a tabela de resumo.

// === 1. IMPORTAÇÕES (Apenas o que é estritamente necessário) ===
import * as state from './state.js';
import * as features from './features.js';
import * as modalUI from './modal.ui.js';
import { debounce } from './utils.js';

// **ATENÇÃO: As imports circulares de 'ui.js' e 'calculator.form.ui.js' foram removidas.
// As funcionalidades agora são injetadas através do objeto 'callbacks' em initSummaryTable.**

// === 2. HELPERS DE RENDERIZAÇÃO (Privado) ===

/**
 * Cria uma célula de tabela (<td>) com texto seguro (usando .textContent).
 * @param {string} text O conteúdo de texto.
 * @param {string} [className] Classe CSS opcional.
 * @returns {HTMLTableCellElement}
 */
function createSafeCell(text, className) {
  const cell = document.createElement('td');
  cell.textContent = text || '---';
  if (className) cell.className = className;
  return cell;
}

/**
 * Cria uma célula de tabela (<td>) com um botão de ação.
 * @param {object} options
 * @param {string} options.className Classe CSS para o botão.
 * @param {string} options.icon O ícone (HTML seguro, ex: '🔍').
 * @param {number} options.treeId O ID da árvore.
 * @param {string} [options.cellClassName] Classe CSS opcional para a <td>.
 * @returns {HTMLTableCellElement}
 */
function createActionCell({ className, icon, treeId, cellClassName }) {
  const cell = document.createElement('td');
  const button = document.createElement('button');
  if (cellClassName) cell.className = cellClassName;
  
  button.type = 'button';
  button.className = className;
  button.dataset.id = treeId;
  button.innerHTML = icon;
  
  cell.appendChild(button);
  return cell;
}

/**
 * Helper privado que constrói um <tr> para uma árvore.
 * @param {object} tree O objeto da árvore.
 * @returns {HTMLTableRowElement}
 */
function _createTreeRow(tree) {
  const row = document.createElement('tr');
  row.dataset.treeId = tree.id;

  const [y, m, d] = (tree.data || '---').split('-');
  const displayDate = (y === '---' || !y) ? 'N/A' : `${d}/${m}/${y}`;
  const utmZone = `${tree.utmZoneNum || 'N/A'}${tree.utmZoneLetter || ''}`;

  const photoCell = document.createElement('td');
  photoCell.style.textAlign = 'center';
  if (tree.hasPhoto) {
    const photoButton = document.createElement('button');
    photoButton.type = 'button';
    photoButton.className = 'photo-preview-btn';
    photoButton.dataset.id = tree.id;
    photoButton.innerHTML = '📷';
    photoCell.appendChild(photoButton);
  } else {
    photoCell.textContent = '—';
  }

  row.appendChild(createSafeCell(tree.id));
  row.appendChild(createSafeCell(displayDate));
  row.appendChild(createSafeCell(tree.especie));
  row.appendChild(photoCell);
  row.appendChild(createSafeCell(tree.coordX));
  row.appendChild(createSafeCell(tree.coordY));
  row.appendChild(createSafeCell(utmZone));
  row.appendChild(createSafeCell(tree.dap));
  row.appendChild(createSafeCell(tree.local));
  row.appendChild(createSafeCell(tree.avaliador));
  row.appendChild(createSafeCell(tree.pontuacao));
  row.appendChild(createSafeCell(tree.risco, tree.riscoClass));
  row.appendChild(createSafeCell(tree.observacoes));
  
  row.appendChild(createActionCell({ className: 'zoom-tree-btn', icon: '🔍', treeId: tree.id, cellClassName: 'col-zoom' }));
  row.appendChild(createActionCell({ className: 'edit-tree-btn', icon: '✎', treeId: tree.id, cellClassName: 'col-edit' }));
  row.appendChild(createActionCell({ className: 'delete-tree-btn', icon: '✖', treeId: tree.id, cellClassName: 'col-delete' }));
  
  return row;
}

// === 3. FUNÇÕES DE RENDERIZAÇÃO (Público) ===

/**
 * Adiciona uma ÚNICA linha à tabela (Performance O(1)).
 * @param {object} tree O objeto da nova árvore.
 */
export function appendTreeRow(tree) {
  const container = document.getElementById('summary-table-container');
  if (!container) return;

  const placeholder = document.getElementById('summary-placeholder');
  if (placeholder) {
    renderSummaryTable();
    return;
  }

  const tbody = container.querySelector('.summary-table tbody');
  if (tbody) {
    const row = _createTreeRow(tree);
    tbody.appendChild(row);
  } else {
    renderSummaryTable();
  }
  
  const summaryBadge = document.getElementById('summary-badge');
  if (summaryBadge) {
    const count = state.registeredTrees.length;
    summaryBadge.textContent = `(${count})`;
    summaryBadge.style.display = 'inline';
  }
}

/**
 * Remove uma ÚNICA linha da tabela (Performance O(1)).
 * @param {number} id O ID da árvore a ser removida.
 */
export function removeTreeRow(id) {
  const container = document.getElementById('summary-table-container');
  if (!container) return;

  const row = container.querySelector(`.summary-table tr[data-tree-id="${id}"]`);
  if (row) row.remove();

  const tbody = container.querySelector('.summary-table tbody');
  const summaryBadge = document.getElementById('summary-badge');
  
  if (tbody && tbody.children.length === 0) {
    renderSummaryTable();
  } else if (summaryBadge) {
    const count = state.registeredTrees.length;
    summaryBadge.textContent = count > 0 ? `(${count})` : '';
    summaryBadge.style.display = count > 0 ? 'inline' : 'none';
  }
}

/**
 * Renderiza a tabela de resumo de árvores (O(N log N) devido à ordenação).
 */
export function renderSummaryTable() {
  const container = document.getElementById('summary-table-container');
  const importExportControls = document.getElementById('import-export-controls');
  const summaryBadge = document.getElementById('summary-badge');
  if (!container) return;

  const count = state.registeredTrees.length;

  if (summaryBadge) {
    summaryBadge.textContent = count > 0 ? `(${count})` : '';
    summaryBadge.style.display = count > 0 ? 'inline' : 'none';
  }

  if (count === 0) {
    container.innerHTML = '<p id="summary-placeholder">Nenhuma árvore cadastrada ainda.</p>';
    if (importExportControls) {
      document.getElementById('export-data-btn')?.setAttribute('style', 'display:none');
      document.getElementById('send-email-btn')?.setAttribute('style', 'display:none');
      document.getElementById('clear-all-btn')?.setAttribute('style', 'display:none');
    }
    return;
  }

  if (importExportControls) {
    document.getElementById('export-data-btn')?.setAttribute('style', 'display:inline-flex');
    document.getElementById('send-email-btn')?.setAttribute('style', 'display:inline-flex');
    document.getElementById('clear-all-btn')?.setAttribute('style', 'display:inline-flex');
  }

  container.innerHTML = '';
  const table = document.createElement('table');
  table.className = 'summary-table';

  // --- Cabeçalho (Thead) ---
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  const getThClass = (key) => {
    let classes = 'sortable';
    if (state.sortState.key === key) {
      classes += state.sortState.direction === 'asc' ? ' sort-asc' : ' sort-desc';
    }
    return classes;
  };
  const headers = [
    { key: 'id', text: 'ID' }, { key: 'data', text: 'Data' }, { key: 'especie', text: 'Espécie' },
    { key: null, text: 'Foto' }, { key: 'coordX', text: 'Coord. X' }, { key: 'coordY', text: 'Coord. Y' },
    { key: 'utmZoneNum', text: 'Zona UTM' }, { key: 'dap', text: 'DAP (cm)' }, { key: 'local', text: 'Local' },
    { key: 'avaliador', text: 'Avaliador' }, { key: 'pontuacao', text: 'Pontos' }, { key: 'risco', text: 'Risco' },
    { key: null, text: 'Observações' }, { key: null, text: 'Zoom', className: 'col-zoom' },
    { key: null, text: 'Editar', className: 'col-edit' }, { key: null, text: 'Excluir', className: 'col-delete' },
  ];

  headers.forEach((header) => {
    const th = document.createElement('th');
    th.textContent = header.text;
    if (header.key) {
      th.className = getThClass(header.key);
      th.dataset.sortKey = header.key;
    }
    if (header.className) th.classList.add(header.className);
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // --- Corpo (Tbody) ---
  const sortedData = [...state.registeredTrees].sort((a, b) => {
    const valA = features.getSortValue(a, state.sortState.key);
    const valB = features.getSortValue(b, state.sortState.key);
    if (valA < valB) return state.sortState.direction === 'asc' ? -1 : 1;
    if (valA > valB) return state.sortState.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const tbody = document.createElement('tbody');
  const fragment = document.createDocumentFragment();
  sortedData.forEach((tree) => {
    const row = _createTreeRow(tree);
    fragment.appendChild(row);
  });
  
  tbody.appendChild(fragment);
  table.appendChild(tbody);
  container.appendChild(table);
}

/**
 * Destaque da linha da tabela.
 * @param {number} id O ID da árvore a ser destacada.
 */
export function highlightTableRow(id) {
  setTimeout(() => {
    const row = document.querySelector(`.summary-table tr[data-tree-id="${id}"]`);
    if (row) {
      const oldHighlights = document.querySelectorAll('.summary-table tr.highlight');
      oldHighlights.forEach((r) => r.classList.remove('highlight'));
      
      row.classList.add('highlight');
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      setTimeout(() => { row.classList.remove('highlight'); }, 2500);
    } else {
      console.warn(`Linha da tabela [data-tree-id="${id}"] não encontrada.`);
    }
  }, 100);
}


// === 4. FUNÇÕES DE SETUP (Privado e Público) ===

/**
 * [PRIVADO] Anexa listeners aos controles acima da tabela (Filtro, Importar, etc.).
 * @param {object} callbacks Funções de callback para ações externas (modal, email).
 */
function _setupCalculatorControls(callbacks) {
  const importDataBtn = document.getElementById('import-data-btn');
  const exportDataBtn = document.getElementById('export-data-btn');
  const sendEmailBtn = document.getElementById('send-email-btn');
  const clearAllBtn = document.getElementById('clear-all-btn');
  const filterInput = document.getElementById('table-filter-input');

  if (importDataBtn) importDataBtn.addEventListener('click', callbacks.onImport);
  if (exportDataBtn) exportDataBtn.addEventListener('click', callbacks.onExport);
  if (filterInput) filterInput.addEventListener('keyup', callbacks.onFilter);
  if (sendEmailBtn) sendEmailBtn.addEventListener('click', callbacks.onEmail);
  
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', () => {
      modalUI.showGenericModal({
        title: '🗑️ Limpar Tabela',
        description: 'Tem certeza que deseja apagar TODOS os registros? Esta ação não pode ser desfeita.',
        buttons: [
          { text: 'Sim, Apagar Tudo', class: 'primary', action: callbacks.onClear },
          { text: 'Cancelar', class: 'cancel' },
        ],
      });
    });
  }
}

/**
 * [PRIVADO] Anexa o listener de delegação de eventos da tabela.
 * @param {HTMLElement} summaryContainer O contêiner da tabela.
 * @param {object} callbacks Funções de callback para ações na linha (edit, delete, zoom).
 */
function _setupTableDelegation(summaryContainer, callbacks) {
  if (!summaryContainer) return;

  summaryContainer.addEventListener('click', (e) => {
    const target = e.target;
    
    // Ação: Excluir
    const deleteButton = target.closest('.delete-tree-btn');
    if (deleteButton) {
      const treeId = parseInt(deleteButton.dataset.id, 10);
      modalUI.showGenericModal({
        title: 'Excluir Registro',
        description: `Tem certeza que deseja excluir a Árvore ID ${treeId}?`,
        buttons: [
          { text: 'Sim, Excluir', class: 'primary', action: () => callbacks.onDelete(treeId) },
          { text: 'Cancelar', class: 'cancel' },
        ],
      });
      return;
    }

    // Ação: Editar
    const editButton = target.closest('.edit-tree-btn');
    if (editButton) {
      callbacks.onEdit(parseInt(editButton.dataset.id, 10));
      return;
    }

    // Ação: Zoom
    const zoomButton = target.closest('.zoom-tree-btn');
    if (zoomButton) {
      callbacks.onZoom(parseInt(zoomButton.dataset.id, 10));
      return;
    }

    // Ação: Ordenar
    const sortButton = target.closest('th.sortable');
    if (sortButton) {
      callbacks.onSort(sortButton.dataset.sortKey);
      return;
    }

    // Ação: Ver Foto
    const photoButton = target.closest('.photo-preview-btn');
    if (photoButton) {
      e.preventDefault();
      callbacks.onPhoto(parseInt(photoButton.dataset.id, 10));
    }
  });
}

/**
 * (PÚBLICO) Função "maestro" que inicializa a Tabela.
 * @param {boolean} isTouchDevice Indica se é um dispositivo de toque (agora inútil, mas mantido).
 * @param {object} uiCallbacks Callbacks definidos pelo módulo maestro (ui.js).
 */
export function initSummaryTable(isTouchDevice, uiCallbacks) {
  const summaryContainer = document.getElementById('summary-table-container');
  if (!summaryContainer) {
    console.error("initSummaryTable: Contêiner 'summary-table-container' não encontrado.");
    return;
  }

  // 1. Renderiza a tabela inicial (O(N))
  renderSummaryTable();
  
  // 2. Anexa listeners aos controles, usando os callbacks passados
  _setupCalculatorControls(uiCallbacks.controls);
  
  // 3. Anexa o listener de delegação principal, usando os callbacks passados
  _setupTableDelegation(summaryContainer, uiCallbacks.actions);
}