// js/ui.js (v62.0 - Completo com Altura, Clinômetro e PDF)

import * as state from './state.js';
import { glossaryTerms, equipmentData, podaPurposeData, checklistData } from './content.js';
import { showToast, debounce } from './utils.js'; 
import { getImageFromDB } from './database.js';
import * as features from './features.js';
import * as mapUI from './map.ui.js'; 
import * as modalUI from './modal.ui.js';
import { generatePDF } from './pdf.generator.js';

const imgTag = (src, alt) => `<img src="img/${src}" alt="${alt}" class="manual-img">`;
const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
const termClickEvent = isTouchDevice ? 'touchend' : 'click';
const popupCloseEvent = isTouchDevice ? 'touchend' : 'click';

let tooltipHideTimer = null;
let columnVisibilityState = {};

// === 1. RENDERIZAÇÃO DE CONTEÚDO ===

export function loadContent(detailView, content) {
  if (!detailView) return;
  if (content) {
    detailView.innerHTML = `<h3>${content.titulo}</h3>${content.html}`;
    setupGlossaryInteractions(detailView);
    setupEquipmentInteractions(detailView);
    setupPurposeInteractions(detailView);
    setupChecklistInteractions(detailView);
  } else {
    detailView.innerHTML = `<h3 class="placeholder-titulo">Tópico Não Encontrado</h3>`;
  }
}

// === 2. TOOLTIPS ===

export function createTooltip() {
  let t = document.getElementById('glossary-tooltip');
  if (!t) {
    t = document.createElement('div');
    t.id = 'glossary-tooltip';
    document.body.appendChild(t);
  }
  if (!t.dataset.clickToCloseAdded) {
    t.addEventListener(popupCloseEvent, (e) => { e.stopPropagation(); hideTooltip(); });
    t.dataset.clickToCloseAdded = 'true';
  }
  state.setCurrentTooltip(t);
  return t;
}

export function hideTooltip() {
  if (state.currentTooltip) {
    state.currentTooltip.style.opacity = '0';
    state.currentTooltip.style.visibility = 'hidden';
    state.currentTooltip.style.width = '';
    state.setCurrentTooltip(null);
  }
}

function scheduleHideTooltip() { clearTimeout(tooltipHideTimer); tooltipHideTimer = setTimeout(hideTooltip, 200); }
function cancelHideTooltip() { clearTimeout(tooltipHideTimer); }

function positionTooltip(el) {
  if (!state.currentTooltip) return;
  const rect = el.getBoundingClientRect();
  requestAnimationFrame(() => {
    if (!state.currentTooltip) return;
    let leftPos = rect.left + window.scrollX;
    if (leftPos + 350 > window.innerWidth) leftPos = window.innerWidth - 360;
    state.currentTooltip.style.top = `${rect.bottom + window.scrollY + 5}px`;
    state.currentTooltip.style.left = `${leftPos}px`;
  });
}

function attachTooltipListeners(elements, showFunc) {
    elements.forEach(el => {
        if(!isTouchDevice) { 
            el.addEventListener('mouseenter', showFunc); 
            el.addEventListener('mouseleave', scheduleHideTooltip); 
        }
        el.addEventListener(termClickEvent, (e) => { e.preventDefault(); e.stopPropagation(); showFunc(e); });
    });
}

function setupGlossaryInteractions(d) { attachTooltipListeners(d.querySelectorAll('.glossary-term'), showGlossaryTooltip); }
function setupEquipmentInteractions(d) { attachTooltipListeners(d.querySelectorAll('.equipment-term'), showEquipmentTooltip); }
function setupPurposeInteractions(d) { attachTooltipListeners(d.querySelectorAll('.purpose-term'), showPurposeTooltip); }
function setupChecklistInteractions(d) { attachTooltipListeners(d.querySelectorAll('.checklist-term'), showChecklistTooltip); }

function showGlossaryTooltip(e) {
    cancelHideTooltip();
    const d = glossaryTerms[e.currentTarget.getAttribute('data-term-key')];
    if(!d) return;
    const t = createTooltip(); t.style.width = '300px';
    t.innerHTML = `<strong>${e.currentTarget.textContent}</strong>: ${d}`;
    positionTooltip(e.currentTarget); t.style.opacity = '1'; t.style.visibility = 'visible';
}
function showEquipmentTooltip(e) {
    cancelHideTooltip();
    const d = equipmentData[e.currentTarget.getAttribute('data-term-key')];
    if(!d) return;
    const t = createTooltip(); t.style.width = '320px';
    t.innerHTML = `<strong>${e.currentTarget.textContent}</strong><p>${d.desc}</p>${imgTag(d.img, e.currentTarget.textContent)}`;
    positionTooltip(e.currentTarget); t.style.opacity = '1'; t.style.visibility = 'visible';
}
function showPurposeTooltip(e) {
    cancelHideTooltip();
    const d = podaPurposeData[e.currentTarget.getAttribute('data-term-key')];
    if(!d) return;
    const t = createTooltip(); t.style.width = '320px';
    t.innerHTML = `<strong>${e.currentTarget.textContent}</strong><p>${d.desc}</p>${imgTag(d.img, e.currentTarget.textContent)}`;
    positionTooltip(e.currentTarget); t.style.opacity = '1'; t.style.visibility = 'visible';
}
function showChecklistTooltip(e) {
    cancelHideTooltip();
    const key = e.currentTarget.getAttribute('data-term-key');
    const d = checklistData[key];
    if(!d) return;
    const t = createTooltip(); t.style.width = '320px';
    t.innerHTML = `<div style="border-bottom:1px solid #555; margin-bottom:5px; color:#d32f2f; font-weight:bold;">REFERÊNCIA</div><strong>${e.currentTarget.textContent}</strong><p style="font-size:0.9em;">${d.desc}</p>${imgTag(d.img, e.currentTarget.textContent)}`;
    positionTooltip(e.currentTarget); t.style.opacity = '1'; t.style.visibility = 'visible';
}

// === 3. CHECKLIST MOBILE ===

let mobileChecklist = { currentIndex: 0, totalQuestions: 0, questions: null, wrapper: null, card: null, navPrev: null, navNext: null, counter: null };

export function showMobileQuestion(index) {
  const { questions, card, navPrev, navNext, counter, totalQuestions } = mobileChecklist;
  const questionRow = questions[index];
  if (!questionRow || !questionRow.cells || questionRow.cells.length < 4) return;

  const num = questionRow.cells[0].textContent;
  const pergunta = questionRow.cells[1].innerHTML; 
  const peso = questionRow.cells[2].textContent;
  const realCheckbox = questionRow.cells[3].querySelector('.risk-checkbox');
  
  if (!realCheckbox) return;
  
  card.innerHTML = `
    <span class="checklist-card-question"><strong>${num}.</strong> ${pergunta}</span>
    <span class="checklist-card-peso">(Peso: ${peso})</span>
    <label class="checklist-card-toggle">
      <input type="checkbox" class="mobile-checkbox-proxy" data-target-index="${index}" ${realCheckbox.checked ? 'checked' : ''}>
      <span class="toggle-label">Não</span><span class="toggle-switch"></span><span class="toggle-label">Sim</span>
    </label>
  `;
  setupChecklistInteractions(card);
  counter.textContent = `${index + 1} / ${totalQuestions}`;
  navPrev.disabled = (index === 0);
  navNext.disabled = (index === totalQuestions - 1);
  mobileChecklist.currentIndex = index;
}

export function setupMobileChecklist() {
  mobileChecklist.wrapper = document.querySelector('.mobile-checklist-wrapper');
  if (!mobileChecklist.wrapper) return;
  mobileChecklist.card = mobileChecklist.wrapper.querySelector('.mobile-checklist-card');
  mobileChecklist.navPrev = mobileChecklist.wrapper.querySelector('#checklist-prev');
  mobileChecklist.navNext = mobileChecklist.wrapper.querySelector('#checklist-next');
  mobileChecklist.counter = mobileChecklist.wrapper.querySelector('.checklist-counter');
  mobileChecklist.questions = document.querySelectorAll('#risk-calculator-form .risk-table tbody tr');
  if (mobileChecklist.questions.length === 0 || !mobileChecklist.card) return;

  mobileChecklist.currentIndex = 0;
  mobileChecklist.totalQuestions = mobileChecklist.questions.length;

  const cloneAndReplace = (el) => { const n = el.cloneNode(true); el.parentNode.replaceChild(n, el); return n; };
  mobileChecklist.card = cloneAndReplace(mobileChecklist.card);
  mobileChecklist.navPrev = cloneAndReplace(mobileChecklist.navPrev);
  mobileChecklist.navNext = cloneAndReplace(mobileChecklist.navNext);

  mobileChecklist.card.addEventListener('change', (e) => {
    const cb = e.target.closest('.mobile-checkbox-proxy');
    if(cb) mobileChecklist.questions[parseInt(cb.dataset.targetIndex, 10)].cells[3].querySelector('.risk-checkbox').checked = cb.checked;
  });
  mobileChecklist.navPrev.addEventListener('click', () => { if (mobileChecklist.currentIndex > 0) showMobileQuestion(mobileChecklist.currentIndex - 1); });
  mobileChecklist.navNext.addEventListener('click', () => { if (mobileChecklist.currentIndex < mobileChecklist.totalQuestions - 1) showMobileQuestion(mobileChecklist.currentIndex + 1); });
  showMobileQuestion(0);
}

// === 4. TABELA E COLUNAS (Atualizado com Altura) ===

const TABLE_COLUMNS = [
    { key: 'id', text: 'ID', cssClass: 'col-id' },
    { key: 'data', text: 'Data', cssClass: 'col-data' },
    { key: 'especie', text: 'Espécie', cssClass: 'col-especie cell-truncate' },
    { key: 'photo', text: 'Foto', cssClass: 'col-foto' },
    { key: 'altura', text: 'Alt(m)', cssClass: 'col-altura' }, // [NOVO] Coluna Altura
    { key: 'coordX', text: 'X', cssClass: 'col-coord-x' },
    { key: 'coordY', text: 'Y', cssClass: 'col-coord-y' },
    { key: 'utmZoneNum', text: 'Zona', cssClass: 'col-utm-zone' },
    { key: 'dap', text: 'DAP', cssClass: 'col-dap' },
    { key: 'local', text: 'Local', cssClass: 'col-local cell-truncate' },
    { key: 'avaliador', text: 'Aval.', cssClass: 'col-avaliador' },
    { key: 'pontuacao', text: 'Pts', cssClass: 'col-pontuacao' },
    { key: 'risco', text: 'Risco', cssClass: 'col-risco' },
    { key: 'observacoes', text: 'Obs', cssClass: 'col-observacoes cell-truncate' },
    { key: 'zoom', text: '🔍', cssClass: 'col-zoom' },
    { key: 'edit', text: '✎', cssClass: 'col-edit' },
    { key: 'delete', text: '✖', cssClass: 'col-delete' }
];

function createSafeCell(text, className) {
  const c = document.createElement('td'); c.textContent = text; if(className) c.className = className; return c;
}
function createActionCell({ className, icon, treeId, cellClassName }) {
  const c = document.createElement('td'); const b = document.createElement('button'); if (cellClassName) c.className = cellClassName;
  b.type = 'button'; b.className = className; b.dataset.id = treeId; b.innerHTML = icon; c.appendChild(b); return c;
}

function _createTreeRow(tree) {
  const r = document.createElement('tr'); r.dataset.treeId = tree.id;
  const [y, m, d] = (tree.data || '---').split('-'); const displayDate = (y === '---' || !y) ? 'N/A' : `${d}/${m}/${y}`; const utmZone = `${tree.utmZoneNum || ''}${tree.utmZoneLetter || ''}`;
  const getClasses = (col) => { let cls = col.cssClass; if (columnVisibilityState[col.key] === false) cls += ' col-hidden'; return cls; };

  r.appendChild(createSafeCell(tree.id, getClasses(TABLE_COLUMNS[0])));
  r.appendChild(createSafeCell(displayDate, getClasses(TABLE_COLUMNS[1])));
  r.appendChild(createSafeCell(tree.especie, getClasses(TABLE_COLUMNS[2])));
  
  // Foto
  const pc = document.createElement('td'); pc.className = getClasses(TABLE_COLUMNS[3]); pc.style.textAlign = 'center';
  if (tree.hasPhoto) { const b = document.createElement('button'); b.type = 'button'; b.className = 'photo-preview-btn'; b.dataset.id = tree.id; b.innerHTML = '📷'; pc.appendChild(b); } else { pc.textContent = '—'; }
  r.appendChild(pc);

  // [NOVO] Altura
  r.appendChild(createSafeCell(tree.altura || '-', getClasses(TABLE_COLUMNS[4])));

  r.appendChild(createSafeCell(tree.coordX, getClasses(TABLE_COLUMNS[5])));
  r.appendChild(createSafeCell(tree.coordY, getClasses(TABLE_COLUMNS[6])));
  r.appendChild(createSafeCell(utmZone, getClasses(TABLE_COLUMNS[7])));
  r.appendChild(createSafeCell(tree.dap, getClasses(TABLE_COLUMNS[8])));
  r.appendChild(createSafeCell(tree.local, getClasses(TABLE_COLUMNS[9])));
  r.appendChild(createSafeCell(tree.avaliador, getClasses(TABLE_COLUMNS[10])));
  r.appendChild(createSafeCell(tree.pontuacao, getClasses(TABLE_COLUMNS[11])));
  
  const rc = createSafeCell(tree.risco, getClasses(TABLE_COLUMNS[12])); rc.classList.add(tree.riscoClass); r.appendChild(rc);
  r.appendChild(createSafeCell(tree.observacoes, getClasses(TABLE_COLUMNS[13])));
  
  // Ações
  r.appendChild(createActionCell({ className: 'zoom-tree-btn', icon: '🔍', treeId: tree.id, cellClassName: getClasses(TABLE_COLUMNS[14]) }));
  r.appendChild(createActionCell({ className: 'edit-tree-btn', icon: '✎', treeId: tree.id, cellClassName: getClasses(TABLE_COLUMNS[15]) }));
  r.appendChild(createActionCell({ className: 'delete-tree-btn', icon: '✖', treeId: tree.id, cellClassName: getClasses(TABLE_COLUMNS[16]) }));
  return r;
}

export function appendTreeRow(tree) {
  const c = document.getElementById('summary-table-container'); if (!c) return;
  const p = document.getElementById('summary-placeholder'); 
  if (p) { p.remove(); renderSummaryTable(); return; }
  c.querySelector('.summary-table tbody').appendChild(_createTreeRow(tree)); updateBadge();
}

export function removeTreeRow(id) {
  const c = document.getElementById('summary-table-container'); if (!c) return;
  const r = c.querySelector(`.summary-table tr[data-tree-id="${id}"]`); if (r) r.remove();
  if (c.querySelector('.summary-table tbody').children.length === 0) renderSummaryTable(); else updateBadge();
}

function updateBadge() {
    const sb = document.getElementById('summary-badge');
    if(sb) { const c = state.registeredTrees.length; sb.textContent = c > 0 ? `(${c})` : ''; sb.style.display = c > 0 ? 'inline' : 'none'; }
}

function toggleColumnVisibility(key, isVisible) {
    columnVisibilityState[key] = isVisible;
    const cssClass = TABLE_COLUMNS.find(c => c.key === key)?.cssClass.split(' ')[0];
    if(cssClass) {
        const elements = document.querySelectorAll(`.${cssClass}`);
        elements.forEach(el => {
            if(isVisible) { el.classList.remove('col-hidden'); el.style.display = 'table-cell'; } 
            else { el.classList.add('col-hidden'); el.style.display = ''; }
        });
    }
}

function buildColumnMenu() {
    const om = document.querySelector('.columns-dropdown-menu'); if(om) om.remove();
    const m = document.createElement('div'); m.className = 'columns-dropdown-menu';
    TABLE_COLUMNS.forEach(col => {
        if (['zoom','edit','delete'].includes(col.key)) return;
        const l = document.createElement('label'); l.className = 'column-option';
        const cb = document.createElement('input'); cb.type = 'checkbox'; cb.dataset.key = col.key; cb.checked = columnVisibilityState[col.key] !== false;
        cb.addEventListener('change', (e) => toggleColumnVisibility(col.key, e.target.checked));
        l.appendChild(cb); l.appendChild(document.createTextNode(` ${col.text}`)); m.appendChild(l);
    });
    return m;
}

export function renderSummaryTable() {
  const c = document.getElementById('summary-table-container'); const ie = document.getElementById('import-export-controls'); updateBadge();
  if (state.registeredTrees.length === 0) {
    c.innerHTML = '<p id="summary-placeholder">Nenhuma árvore cadastrada ainda.</p>';
    if(ie) { 
        ie.querySelectorAll('button, input').forEach(el => { if(el.id!=='import-data-btn'&&el.id!=='zip-importer'&&el.id!=='csv-importer') el.style.display = 'none'; }); 
        document.getElementById('import-data-btn').style.display = 'inline-flex'; 
    }
    return;
  }
  if(ie) ie.querySelectorAll('button').forEach(b => b.style.display = 'inline-flex');
  
  c.innerHTML = ''; const t = document.createElement('table'); t.className = 'summary-table';
  const th = document.createElement('thead'); const hr = document.createElement('tr');
  
  TABLE_COLUMNS.forEach(col => {
    const h = document.createElement('th'); h.textContent = col.text; let cls = col.cssClass; if(columnVisibilityState[col.key]===false) cls += ' col-hidden'; h.className = cls;
    if (['id','data','especie','coordX','coordY','utmZoneNum','dap','local','avaliador','pontuacao','risco','altura'].includes(col.key)) {
      h.classList.add('sortable');
      if(state.sortState.key===col.key) h.classList.add(state.sortState.direction==='asc'?'sort-asc':'sort-desc');
      h.dataset.sortKey = col.key;
    }
    hr.appendChild(h);
  });
  th.appendChild(hr); t.appendChild(th);
  
  const sd = [...state.registeredTrees].sort((a, b) => { const va = features.getSortValue(a, state.sortState.key); const vb = features.getSortValue(b, state.sortState.key); if (va < vb) return state.sortState.direction === 'asc' ? -1 : 1; if (va > vb) return state.sortState.direction === 'asc' ? 1 : -1; return 0; });
  const tb = document.createElement('tbody'); sd.forEach(tr => tb.appendChild(_createTreeRow(tr))); t.appendChild(tb); c.appendChild(t);
}

// === 5. SETUP DOS CONTROLES E FORMULÁRIOS ===

function _setupCalculatorControls() {
  const ib = document.getElementById('import-data-btn'); const eb = document.getElementById('export-data-btn'); const se = document.getElementById('send-email-btn'); const ca = document.getElementById('clear-all-btn'); const fi = document.getElementById('table-filter-input'); const pdf = document.getElementById('generate-pdf-btn');
  
  const fc = document.querySelector('.table-filter-container');
  if (fc && !document.getElementById('toggle-columns-btn')) {
      const w = document.createElement('div'); w.className = 'table-controls-wrapper'; fc.parentNode.insertBefore(w, fc); w.appendChild(fc);
      const tb = document.createElement('button'); tb.id = 'toggle-columns-btn'; tb.type = 'button'; tb.textContent = '👁️ Colunas'; w.appendChild(tb);
      const m = buildColumnMenu(); w.appendChild(m);
      tb.addEventListener('click', (e) => { e.stopPropagation(); m.classList.toggle('show'); });
      document.addEventListener('click', (e) => { if (!m.contains(e.target) && e.target !== tb) m.classList.remove('show'); });
  }

  if(ib) ib.addEventListener('click', modalUI.showImportModal);
  if(eb) eb.addEventListener('click', modalUI.showExportModal);
  if(pdf) pdf.addEventListener('click', generatePDF);
  if(fi) fi.addEventListener('keyup', debounce(features.handleTableFilter, 300));
  if(se) se.addEventListener('click', features.sendEmailReport);
  if(ca) ca.addEventListener('click', () => { modalUI.showGenericModal({ title: '🗑️ Limpar Tabela', description: 'Apagar tudo?', buttons: [{ text: 'Sim', class: 'primary', action: () => { if (features.handleClearAll()) renderSummaryTable(); }}, { text: 'Cancelar', class: 'cancel' }] }); });
}

function _setFormMode(mode) {
  const b = document.getElementById('add-tree-btn'); if(!b) return;
  if (mode === 'edit') { b.textContent = '💾 Salvar Alterações'; b.style.backgroundColor = 'var(--color-accent)'; b.style.color = 'var(--color-dark)'; } 
  else { b.textContent = '➕ Adicionar Árvore'; b.style.backgroundColor = 'var(--color-primary-medium)'; b.style.color = 'white'; }
}

function _populateFormForEdit(tree) {
  if (!tree) return;
  document.getElementById('risk-calculator-form').reset(); features.clearPhotoPreview();
  
  // Preenche os campos (Incluindo Altura e Distância)
  document.getElementById('risk-data').value = tree.data; 
  document.getElementById('risk-especie').value = tree.especie; 
  document.getElementById('risk-local').value = tree.local; 
  document.getElementById('risk-coord-x').value = tree.coordX; 
  document.getElementById('risk-coord-y').value = tree.coordY; 
  document.getElementById('risk-dap').value = tree.dap; 
  document.getElementById('risk-altura').value = tree.altura || ''; // [NOVO]
  document.getElementById('risk-distancia-obs').value = tree.distancia || ''; // [NOVO]
  document.getElementById('risk-avaliador').value = tree.avaliador; 
  document.getElementById('risk-obs').value = tree.observacoes;
  
  if (tree.hasPhoto) { getImageFromDB(tree.id, (ib) => { if (ib) { const p = document.createElement('img'); p.id = 'photo-preview'; p.src = URL.createObjectURL(ib); document.getElementById('photo-preview-container').prepend(p); document.getElementById('remove-photo-btn').style.display = 'block'; state.setCurrentTreePhoto(ib); } }); }
  document.querySelectorAll('#risk-calculator-form .risk-checkbox').forEach((cb, i) => { cb.checked = (tree.riskFactors && tree.riskFactors[i] === 1) || false; });
  const gs = document.getElementById('gps-status'); if (gs) gs.textContent = `Zona: ${state.lastUtmZone.num}${state.lastUtmZone.letter}`;
}

function _setupSubNavigation() {
  const sn = document.querySelector('.sub-nav');
  if (sn) { sn.addEventListener('click', (e) => { const b = e.target.closest('.sub-nav-btn'); if (b) { e.preventDefault(); showSubTab(b.getAttribute('data-target')); } }); showSubTab('tab-content-register'); }
}

function _setupFileImporters() {
  const zi = document.getElementById('zip-importer'); const ci = document.getElementById('csv-importer');
  if (zi) zi.addEventListener('change', (e) => { e.replaceData = zi.dataset.replaceData === 'true'; features.handleImportZip(e).then(() => renderSummaryTable()); });
  if (ci) ci.addEventListener('change', (e) => { e.replaceData = ci.dataset.replaceData === 'true'; features.handleFileImport(e).then(() => renderSummaryTable()); });
}

function _setupFormListeners(form, isTouchDevice) {
  if (!form) return;
  const gb = document.getElementById('get-gps-btn'); const rb = document.getElementById('reset-risk-form-btn'); const gs = document.getElementById('gps-status');
  
  // [NOVO] Botão de Medição de Altura
  const measureBtn = document.getElementById('btn-measure-height');
  if (measureBtn) {
      measureBtn.addEventListener('click', () => {
          // Salva o estado atual do form (para não perder dados se usuário mudar de aba)
          // Mas como é SPA, os dados nos inputs persistem.
          
          // Muda para a aba do clinômetro
          const clinoBtn = document.querySelector('.topico-btn[data-target="clinometro-view"]');
          if (clinoBtn) clinoBtn.click();
      });
  }

  if (gb && !isTouchDevice) gb.closest('.gps-button-container')?.setAttribute('style', 'display:none');
  if (gb) gb.addEventListener('click', features.handleGetGPS);

  form.addEventListener('submit', (event) => {
    const res = features.handleAddTreeSubmit(event); 
    if (res && res.success) {
      if (res.mode === 'update') { renderSummaryTable(); showSubTab('tab-content-summary'); } 
      else { appendTreeRow(res.tree); }
      
      form.reset(); features.clearPhotoPreview();
      try { document.getElementById('risk-data').value = new Date().toISOString().split('T')[0]; if(state.lastEvaluatorName) document.getElementById('risk-avaliador').value = state.lastEvaluatorName; } catch(e){}
      
      if (isTouchDevice) setupMobileChecklist();
      if (gs) { gs.textContent = ''; gs.className = ''; }
      _setFormMode('add');
    }
  });

  if (rb) rb.addEventListener('click', (e) => {
    e.preventDefault(); form.reset(); features.clearPhotoPreview();
    try { document.getElementById('risk-data').value = new Date().toISOString().split('T')[0]; } catch(e){}
    if (isTouchDevice) setupMobileChecklist();
    if (gs) { gs.textContent = ''; gs.className = ''; }
    state.setEditingTreeId(null); _setFormMode('add');
  });
}

// Importação simples
import { optimizeImage } from './utils.js'; 

function _setupPhotoListeners() {
  const pi = document.getElementById('tree-photo-input'); const rb = document.getElementById('remove-photo-btn');
  if (pi) pi.addEventListener('change', async (event) => {
      const f = event.target.files[0]; if (!f) return; features.clearPhotoPreview();
      try { showToast("Otimizando...", "success"); const ob = await optimizeImage(f, 800, 0.7); state.setCurrentTreePhoto(ob); const p = document.createElement('img'); p.id = 'photo-preview'; p.src = URL.createObjectURL(ob); document.getElementById('photo-preview-container').prepend(p); document.getElementById('remove-photo-btn').style.display = 'block'; } catch (error) { console.error(error); showToast("Erro na foto.", "error"); }
  });
  if (rb) rb.addEventListener('click', features.clearPhotoPreview);
}

function _setupTableDelegation(container, isTouchDevice) {
  if (!container) return; renderSummaryTable();
  container.addEventListener('click', (e) => {
    const db = e.target.closest('.delete-tree-btn'); const eb = e.target.closest('.edit-tree-btn'); const zb = e.target.closest('.zoom-tree-btn'); const sb = e.target.closest('th.sortable'); const pb = e.target.closest('.photo-preview-btn');
    if (db) { const id = parseInt(db.dataset.id, 10); modalUI.showGenericModal({ title: 'Excluir', description: `Excluir ID ${id}?`, buttons: [{text:'Sim',class:'primary',action:()=>{if(features.handleDeleteTree(id))removeTreeRow(id)}},{text:'Cancelar',class:'cancel'}] }); }
    if (eb) { const d = features.handleEditTree(parseInt(eb.dataset.id, 10)); if (d) { _populateFormForEdit(d); _setFormMode('edit'); showSubTab('tab-content-register'); if (isTouchDevice) setupMobileChecklist(); document.getElementById('risk-calculator-form').scrollIntoView({ behavior: 'smooth' }); } }
    if (zb) features.handleZoomToPoint(parseInt(zb.dataset.id, 10));
    if (sb) { features.handleSort(sb.dataset.sortKey); renderSummaryTable(); }
    if (pb) { e.preventDefault(); modalUI.showPhotoViewer(parseInt(pb.dataset.id, 10)); }
  });
}

function highlightTableRow(id) {
  setTimeout(() => {
    const row = document.querySelector(`.summary-table tr[data-tree-id="${id}"]`);
    if (row) { 
        document.querySelectorAll('.summary-table tr.highlight').forEach(r => r.classList.remove('highlight')); 
        row.classList.add('highlight'); row.scrollIntoView({ behavior: 'smooth', block: 'center' }); 
        setTimeout(() => { row.classList.remove('highlight'); }, 2500); 
    }
  }, 200);
}

export function showSubTab(targetId) {
  const subTabPanes = document.querySelectorAll('.sub-tab-content'); subTabPanes.forEach(pane => pane.classList.toggle('active', pane.id === targetId));
  const subNavButtons = document.querySelectorAll('.sub-nav-btn'); subNavButtons.forEach(btn => btn.classList.toggle('active', btn.getAttribute('data-target') === targetId));
  if (targetId === 'tab-content-mapa') setTimeout(() => { if (mapUI && typeof mapUI.initializeMap === 'function') mapUI.initializeMap(); }, 300);
  if (targetId === 'tab-content-summary' && state.highlightTargetId) { highlightTableRow(state.highlightTargetId); state.setHighlightTargetId(null); }
}

export function setupRiskCalculator() {
  const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  _setupSubNavigation();
  _setupFileImporters();
  _setupFormListeners(document.getElementById('risk-calculator-form'), isTouchDevice);
  _setupPhotoListeners();
  _setupCalculatorControls();
  if (mapUI && typeof mapUI.setupMapListeners === 'function') mapUI.setupMapListeners();
  _setupTableDelegation(document.getElementById('summary-table-container'), isTouchDevice);
  
  const rt = document.querySelector('#risk-calculator-form .risk-table');
  if(rt) setupChecklistInteractions(rt);
  
  if (isTouchDevice) setupMobileChecklist();
}
