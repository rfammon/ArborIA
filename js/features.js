/**
 * ARBORIA 2.0 - FEATURES (v82.0 - Lógica TRAQ/ISA)
 * Contém: Lógica de GPS, CRUD (com risco TRAQ), Importação/Exportação (com risco TRAQ).
 */

import * as state from './state.js';
import * as utils from './utils.js';
import * as db from './database.js';
import { TableUI } from './table.ui.js';

// ============================================================ 
// NOVA LÓGICA DE RISCO (METODOLOGIA TRAQ/ISA)
// ============================================================ 

// Armazena os dados da avaliação atual enquanto o checklist está aberto
let currentRiskAssessment = {
    targetCategory: null,
    mitigationAction: 'nenhuma'
};

const riskProfile = {
    'Baixo':    { class: 'risk-low' },
    'Moderado': { class: 'risk-medium' },
    'Alto':     { class: 'risk-high' },
    'Extremo':  { class: 'risk-extreme' }
};

/**
 * Converte a pontuação total (soma dos pesos) em uma probabilidade de falha. (Tabela 2 TRAQ)
 * @param {number} score - A pontuação total do checklist.
 * @returns {string} 'Improvável', 'Possível', 'Provável', ou 'Iminente'.
 */
function getFailureProb(score) {
    if (score >= 30) return 'Iminente';
    if (score >= 20) return 'Provável';
    if (score >= 10) return 'Possível';
    return 'Improvável';
}

/**
 * Mapeia a categoria do alvo para a probabilidade de impacto. (Tabela 4 TRAQ)
 * @param {string|number} targetVal - O valor da categoria do alvo (1-4).
 * @returns {string} 'Muito Baixo', 'Baixo', 'Médio', 'Alto'.
 */
function getImpactProb(targetVal) {
    const value = parseInt(targetVal, 10);
    if (value === 1) return 'Muito Baixo';
    if (value === 2) return 'Baixo';
    if (value === 3) return 'Médio';
    if (value === 4) return 'Alto';
    return 'Muito Baixo'; // Padrão de segurança
}

/**
 * Executa as matrizes de risco TRAQ para determinar o nível de risco final.
 * @param {string} failureProb - A probabilidade de falha ('Improvável', 'Possível', 'Provável', 'Iminente').
 * @param {string} impactProb - A probabilidade de impacto no alvo ('Muito Baixo', 'Baixo', 'Médio', 'Alto').
 * @param {number|string} targetCategory - O valor da categoria do alvo (1-4) para determinar a consequência.
 * @returns {string} O nível de risco final: 'Baixo', 'Moderado', 'Alto', ou 'Extremo'.
 */
function runTraqMatrices(failureProb, impactProb, targetCategory) {
    const impactProbMap = { 'Muito Baixo': 0, 'Baixo': 1, 'Médio': 2, 'Alto': 3 };
    const impactIndex = impactProbMap[impactProb];
    const eventLikelihoodMatrix = {
        'Improvável':   ['Muito Improvável', 'Muito Improvável', 'Improvável',     'Improvável'    ],
        'Possível':     ['Muito Improvável', 'Improvável',     'Provável',       'Provável'      ],
        'Provável':     ['Improvável',     'Provável',       'Muito Provável', 'Muito Provável'],
        'Iminente':     ['Improvável',     'Muito Provável', 'Muito Provável', 'Muito Provável']
    };
    const eventLikelihood = (eventLikelihoodMatrix[failureProb] && impactIndex !== undefined) ? eventLikelihoodMatrix[failureProb][impactIndex] : 'Muito Improvável';

    const consequence = (parseInt(targetCategory, 10) === 4) ? 'Severa' : 'Significante';
    const consequenceMap = { 'Mínima': 0, 'Menor': 1, 'Significante': 2, 'Severa': 3 };
    const consequenceIndex = consequenceMap[consequence];
    const riskRatingMatrix = {
        'Muito Provável':   ['Moderado', 'Alto',          'Extremo',      'Extremo' ],
        'Provável':         ['Baixo',    'Moderado',      'Alto',         'Extremo' ],
        'Improvável':       ['Baixo',    'Baixo',         'Moderado',     'Alto'    ],
        'Muito Improvável': ['Baixo',    'Baixo',         'Baixo',        'Moderado']
    };
    const finalRisk = (riskRatingMatrix[eventLikelihood] && consequenceIndex !== undefined) ? riskRatingMatrix[eventLikelihood][consequenceIndex] : 'Baixo';
    return finalRisk;
}

/**
 * Reduz a probabilidade de falha em um nível para cálculo de risco residual.
 * @param {string} failureProb - A probabilidade de falha inicial.
 * @returns {string} A probabilidade de falha reduzida.
 */
function getReducedFailureProb(failureProb) {
    const reductionMap = {
        'Iminente': 'Provável',
        'Provável': 'Possível',
        'Possível': 'Improvável',
        'Improvável': 'Improvável'
    };
    return reductionMap[failureProb] || 'Improvável';
}


// ============================================================ 
// 1. LÓGICA DO CHECKLIST (MODO FLASH CARD / TELA CHEIA) - v2 (TRAQ)
// ============================================================ 

let currentCardIndex = 0;
let flashCardListenersAttached = false;
let flashcardStep = 'checklist'; // 'checklist', 'target', 'residual'

const getFlashCardElements = () => {
    const container = document.getElementById('checklist-flashcard-view');
    if (!container) return null;

    return {
        container: container,
        closeBtn: document.getElementById('close-checklist-btn'),
        questionCard: document.getElementById('question-card'),
        targetCard: document.getElementById('target-card'),
        residualRiskCard: document.getElementById('residual-risk-card'),
        counter: document.getElementById('flashcard-counter'),
        questionBox: document.getElementById('flashcard-question-text'), 
        toggleInput: document.getElementById('flashcard-toggle-input'), 
        btnPrev: document.getElementById('flashcard-prev'),
        btnNext: document.getElementById('flashcard-next'),
        dataRows: document.querySelectorAll('#checklist-data-table tbody tr')
    };
};

function showCard(cardToShow) {
    const els = getFlashCardElements();
    if (!els) return;
    ['questionCard', 'targetCard', 'residualRiskCard'].forEach(cardKey => {
        if (els[cardKey]) {
            els[cardKey].style.display = (cardKey === cardToShow) ? 'flex' : 'none';
        }
    });
}

function updateFlashcardUI() {
    const els = getFlashCardElements();
    if (!els) return;

    if (flashcardStep === 'checklist') {
        showCard('questionCard');
        const row = els.dataRows[currentCardIndex];
        const sourceCheckbox = row.querySelector('input[type="checkbox"]');
        const questionCell = row.cells[1].cloneNode(true);
        if (questionCell.querySelector('.checklist-term')) {
            questionCell.querySelector('.checklist-term').classList.add('tooltip-trigger');
        }
        els.counter.textContent = `Fator de Risco ${currentCardIndex + 1} / ${els.dataRows.length}`;
        els.questionBox.innerHTML = questionCell.innerHTML; 
        els.toggleInput.checked = sourceCheckbox.checked;
        updateCardVisuals(els.questionCard, sourceCheckbox.checked);
        els.btnPrev.disabled = (currentCardIndex === 0);
        els.btnNext.textContent = (currentCardIndex === els.dataRows.length - 1) ? 'Avançar para Alvo ❯' : 'Próxima ❯';
    } else if (flashcardStep === 'target') {
        showCard('targetCard');
        els.counter.textContent = 'Etapa 2 de 3: Alvo';
        els.btnPrev.disabled = false;
        els.btnNext.textContent = 'Avançar para Mitigação ❯';
    } else if (flashcardStep === 'residual') {
        showCard('residualRiskCard');
        els.counter.textContent = 'Etapa 3 de 3: Risco Residual';
        els.btnPrev.disabled = false;
        els.btnNext.textContent = 'Concluir e Salvar';
    }
}

function handleFlashcardToggle() {
    const els = getFlashCardElements();
    if (!els) return;
    const sourceCheckbox = els.dataRows[currentCardIndex].querySelector('input[type="checkbox"]');
    sourceCheckbox.checked = els.toggleInput.checked;
    updateCardVisuals(els.questionCard, sourceCheckbox.checked);

    if (sourceCheckbox.checked && currentCardIndex < els.dataRows.length - 1) {
        setTimeout(() => els.btnNext.click(), 600);
    }
}

function updateCardVisuals(cardElement, isChecked) {
    if (isChecked) cardElement.classList.add('answered-yes');
    else cardElement.classList.remove('answered-yes');
}

function setupFlashCardListeners() {
    if (flashCardListenersAttached) return;
    const els = getFlashCardElements();
    if (!els) return;

    els.closeBtn.addEventListener('click', closeChecklistFlashCard);
    if(els.toggleInput._handler) els.toggleInput.removeEventListener('change', els.toggleInput._handler);
    els.toggleInput.addEventListener('change', handleFlashcardToggle);
    els.toggleInput._handler = handleFlashcardToggle;

    els.btnPrev.addEventListener('click', (e) => {
        e.preventDefault();
        if (flashcardStep === 'residual') {
            flashcardStep = 'target';
        } else if (flashcardStep === 'target') {
            flashcardStep = 'checklist';
        } else if (flashcardStep === 'checklist' && currentCardIndex > 0) {
            currentCardIndex--;
        }
        updateFlashcardUI();
    });

    els.btnNext.addEventListener('click', (e) => {
        e.preventDefault();
        if (flashcardStep === 'checklist') {
            if (currentCardIndex < els.dataRows.length - 1) {
                currentCardIndex++;
            } else {
                flashcardStep = 'target';
            }
        } else if (flashcardStep === 'target') {
            const targetInput = document.querySelector('input[name="target_category"]:checked');
            if (!targetInput) {
                utils.showToast("Por favor, selecione a taxa de ocupação.", "error");
                return;
            }
            currentRiskAssessment.targetCategory = targetInput.value;
            flashcardStep = 'residual';
        } else if (flashcardStep === 'residual') {
            const mitigationInput = document.getElementById('mitigation-action');
            currentRiskAssessment.mitigationAction = mitigationInput.value;
            closeChecklistFlashCard();
            utils.showToast("Checklist preenchido!", "success");
            // Dispara o submit do formulário principal para salvar os dados
            document.getElementById('add-tree-btn').click();
        }
        updateFlashcardUI();
    });
    flashCardListenersAttached = true;
}

export function initChecklistFlashCard(retry = 0) {
    const els = getFlashCardElements();
    if (!els || !els.dataRows || els.dataRows.length === 0) {
        if (retry < 5) setTimeout(() => initChecklistFlashCard(retry + 1), 150);
        else utils.showToast("Erro: Tabela de critérios não carregou.", "error");
        return;
    }
    setupFlashCardListeners();
    currentCardIndex = 0;
    flashcardStep = 'checklist';
    // Limpa a avaliação anterior
    currentRiskAssessment = { targetCategory: null, mitigationAction: 'nenhuma' };
    // Limpa o estado dos radio buttons (mobile e desktop) e select
    document.querySelectorAll('input[name="target_category"], input[name="target_category_desktop"]').forEach(radio => radio.checked = false);
    document.getElementById('mitigation-action').value = 'nenhuma';
    
    updateFlashcardUI();
}

function closeChecklistFlashCard() {
    const els = getFlashCardElements();
    if (els && els.container) els.container.classList.remove('active');
}

// ============================================================ 
// 2. LÓGICA DE GPS (Mantida Original)
// ============================================================ 

export async function handleGetGPS() {
  const gpsStatus = document.getElementById('gps-status');
  const coordXField = document.getElementById('risk-coord-x');
  const coordYField = document.getElementById('risk-coord-y');
  const getGpsBtn = document.getElementById('get-gps-btn');

  if (!navigator.geolocation) {
    if(gpsStatus) { 
        gpsStatus.textContent = "Sem GPS disponível."; 
        gpsStatus.className = 'instruction-text text-center error'; 
    }
    return;
  }
  
  const CAPTURE_TIME_MS = 10000;
  const options = { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 };
  let readings = [];
  let watchId = null;
  let timerInterval = null;
  let startTime = Date.now();
  
  if(getGpsBtn) getGpsBtn.disabled = true;

  const cleanup = () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (timerInterval !== null) clearInterval(timerInterval);
      const btn = document.getElementById('get-gps-btn'); 
      if (btn) { btn.disabled = false; btn.innerHTML = 'Capturar GPS Preciso'; }
  };

  const updateUI = () => {
      const btn = document.getElementById('get-gps-btn');
      if (!btn) { cleanup(); return; } 

      const elapsed = Date.now() - startTime;
      const remaining = Math.ceil((CAPTURE_TIME_MS - elapsed) / 1000);
      
      btn.innerHTML = `Calibrando... ${remaining}s`;
      
      if (elapsed >= CAPTURE_TIME_MS) finishCapture();
  };

  const finishCapture = () => {
      cleanup();
      if (readings.length === 0) {
          utils.showToast("Sem sinal de satélite.", "error");
          return;
      }

      let sumLat = 0, sumLon = 0, sumAcc = 0;
      readings.forEach(r => { sumLat += r.latitude; sumLon += r.longitude; sumAcc += r.accuracy; });
      
      const avgLat = sumLat / readings.length;
      const avgLon = sumLon / readings.length;
      const avgAcc = sumAcc / readings.length;

      const utmCoords = utils.convertLatLonToUtm(avgLat, avgLon); 

      if (utmCoords) {
          if(coordXField) coordXField.value = utmCoords.easting.toFixed(0);
          if(coordYField) coordYField.value = utmCoords.northing.toFixed(0);
          
          if(state.setLastUtmZone) state.setLastUtmZone(utmCoords.zoneNum, utmCoords.zoneLetter);
          
          const dz = document.getElementById('default-utm-zone');
          if (dz) dz.value = `${utmCoords.zoneNum}${utmCoords.zoneLetter}`;
          
          const gs = document.getElementById('gps-status');
          if(gs) {
              const color = avgAcc <= 5 ? 'var(--color-forest)' : '#E65100';
              gs.innerHTML = `Precisão: <span style="color:${color}">±${avgAcc.toFixed(1)}m</span>`;
          }
          utils.showToast("Coordenadas capturadas!", "success");
      } else {
          utils.showToast("Erro na conversão UTM.", "error");
      }
  };

  watchId = navigator.geolocation.watchPosition(
      (pos) => { if (pos.coords.accuracy < 150) readings.push(pos.coords); },
      (err) => {}, // Error callback
      options
  );
  timerInterval = setInterval(updateUI, 1000);
  updateUI();
}

// ============================================================ 
// 3. CRUD & AÇÕES DIVERSAS (Integradas com Lógica TRAQ)
// ============================================================ 

export function clearPhotoPreview() {
  const pc = document.getElementById('photo-preview-container');
  const rb = document.getElementById('remove-photo-btn');
  const op = document.querySelector('#photo-preview-container img');
  
  if (op && pc) { try { URL.revokeObjectURL(op.src); } catch(e){} op.remove(); }
  if (rb) rb.style.display = 'none';
  
  if(state.setCurrentTreePhoto) state.setCurrentTreePhoto(null);
  
  const pi = document.getElementById('tree-photo-input');
  if (pi) pi.value = null;

  document.querySelectorAll('.risk-checkbox').forEach(cb => cb.checked = false);
  document.querySelectorAll('input[name="target_category_desktop"]').forEach(radio => radio.checked = false);
  
  currentRiskAssessment = { targetCategory: null, mitigationAction: 'nenhuma' };
  
  TableUI.render();
}

export function handleAddTreeSubmit(event) {
  event.preventDefault();
  const form = event.target;
  
  let totalScore = 0;
  form.querySelectorAll('.risk-checkbox:checked').forEach(cb => totalScore += parseInt(cb.dataset.weight, 10));
  const checkedRiskFactors = Array.from(form.querySelectorAll('.risk-checkbox')).map(cb => cb.checked ? 1 : 0);
  
  // Sincroniza o target do desktop, se disponível
  const desktopTargetInput = document.querySelector('input[name="target_category_desktop"]:checked');
  if (desktopTargetInput) {
      currentRiskAssessment.targetCategory = desktopTargetInput.value;
  }

  if (currentRiskAssessment.targetCategory === null) {
      utils.showToast("Selecione a 'Taxa de Ocupação do Alvo' antes de registrar.", "error");
      return { success: false };
  }

  // --- INÍCIO DA LÓGICA DE CÁLCULO DE RISCO TRAQ ---
  const failureProb = getFailureProb(totalScore);
  const impactProb = getImpactProb(currentRiskAssessment.targetCategory);
  
  // 1. Cálculo do Risco Inicial
  const initialRisk = runTraqMatrices(failureProb, impactProb, currentRiskAssessment.targetCategory);

  // Unifica a captura da mitigação (desktop ou mobile)
  let mitigationVal = document.getElementById('mitigation-action-desktop')?.value || 'nenhuma';
  if (mitigationVal === 'nenhuma' && currentRiskAssessment.mitigationAction) {
      mitigationVal = currentRiskAssessment.mitigationAction;
  }
  currentRiskAssessment.mitigationAction = mitigationVal; // Garante consistência

  // 2. Cálculo do Risco Residual
  let residualRisk = initialRisk;
  if (currentRiskAssessment.mitigationAction !== 'nenhuma') {
      const reducedFailureProb = getReducedFailureProb(failureProb);
      residualRisk = runTraqMatrices(reducedFailureProb, impactProb, currentRiskAssessment.targetCategory);
  }

  const classificationClass = riskProfile[initialRisk] ? riskProfile[initialRisk].class : 'risk-low';
  // --- FIM DA LÓGICA DE CÁLCULO DE RISCO TRAQ ---

  const especie = document.getElementById('risk-especie').value.trim();
  if (!especie) { utils.showToast("Nome da espécie é obrigatório.", 'error'); return { success: false }; }

  const treeData = {
    data: document.getElementById('risk-data').value || new Date().toISOString().split('T')[0],
    especie: especie,
    local: document.getElementById('risk-local').value || 'N/A',
    coordX: document.getElementById('risk-coord-x').value || 'N/A',
    coordY: document.getElementById('risk-coord-y').value || 'N/A',
    utmZoneNum: (state.lastUtmZone && state.lastUtmZone.num) ? state.lastUtmZone.num : 0,
    utmZoneLetter: (state.lastUtmZone && state.lastUtmZone.letter) ? state.lastUtmZone.letter : 'Z',
    dap: document.getElementById('risk-dap').value || 'N/A',
    altura: document.getElementById('risk-altura').value || '0.0', 
    avaliador: document.getElementById('risk-avaliador').value || 'N/A',
    observacoes: document.getElementById('risk-obs').value || 'N/A',
    pontuacao: totalScore,
    riskFactors: checkedRiskFactors,
    hasPhoto: (state.currentTreePhoto !== null),
    // Novos campos TRAQ
    riskLevel: initialRisk,
    residualRisk: residualRisk,
    mitigation: currentRiskAssessment.mitigationAction,
    // Campo legado para compatibilidade de cores
    risco: initialRisk, // 'risco' agora reflete o risco inicial
    riscoClass: classificationClass,
  };

  if(state.setLastEvaluatorName) state.setLastEvaluatorName(treeData.avaliador);
  
  let resultTree;

  if (state.editingTreeId === null) {
    const newTreeId = state.registeredTrees.length > 0 ? Math.max(...state.registeredTrees.map(t => t.id)) + 1 : 1;
    resultTree = { ...treeData, id: newTreeId };
    if (resultTree.hasPhoto) db.saveImageToDB(resultTree.id, state.currentTreePhoto);
    state.registeredTrees.push(resultTree);
    utils.showToast(`Árvore ID ${resultTree.id} salva!`, 'success');
  } else {
    const idx = state.registeredTrees.findIndex(t => t.id === state.editingTreeId);
    if (idx === -1) return { success: false };
    
    resultTree = { ...treeData, id: state.editingTreeId };
    const original = state.registeredTrees[idx];
    
    if (original.hasPhoto && state.currentTreePhoto === null) {
        resultTree.hasPhoto = true; 
    } else if (state.currentTreePhoto !== null) {
        db.saveImageToDB(resultTree.id, state.currentTreePhoto);
    } else if (!resultTree.hasPhoto && original.hasPhoto) {
        db.deleteImageFromDB(resultTree.id);
    }
    
    state.registeredTrees[idx] = resultTree;
    utils.showToast(`ID ${resultTree.id} atualizado!`, 'success');
  }

  state.saveDataToStorage();
  state.setEditingTreeId(null);
  form.reset();
  clearPhotoPreview(); 
  document.getElementById('add-tree-btn').innerHTML = 'Registrar Árvore';
  if(document.activeElement) document.activeElement.blur();

  TableUI.render();
  return { success: true, tree: resultTree };
}

export function handleDeleteTree(id) {
  const t = state.registeredTrees.find(tree => tree.id === id);
  if (t && t.hasPhoto) db.deleteImageFromDB(id);
  
  const n = state.registeredTrees.filter(tree => tree.id !== id);
  state.setRegisteredTrees(n); 
  state.saveDataToStorage();
  TableUI.render();
  
  utils.showToast(`Árvore removida.`, 'info'); 
  return true;
}

export function handleEditTree(id) {
  const t = state.registeredTrees.find(tree => tree.id === id);
  if (!t) { utils.showToast(`Erro ID ${id}.`, "error"); return null; }
  
  state.setEditingTreeId(id);
  if(state.setLastUtmZone) state.setLastUtmZone(t.utmZoneNum || 0, t.utmZoneLetter || 'Z');
  
  const setVal = (elemId, val) => {
      const el = document.getElementById(elemId);
      if(el) el.value = (val !== undefined && val !== null) ? val : '';
  };

  setVal('risk-data', t.data);
  setVal('risk-especie', t.especie);
  setVal('risk-local', t.local);
  setVal('risk-coord-x', t.coordX);
  setVal('risk-coord-y', t.coordY);
  setVal('risk-dap', t.dap);
  setVal('risk-altura', t.altura);
  setVal('risk-avaliador', t.avaliador);
  setVal('risk-obs', t.observacoes);
  
  const checkboxes = document.querySelectorAll('.risk-checkbox');
  checkboxes.forEach(cb => cb.checked = false); 
  if (t.riskFactors && Array.isArray(t.riskFactors)) {
      t.riskFactors.forEach((val, index) => {
          if (val === 1 && checkboxes[index]) checkboxes[index].checked = true;
      });
  }

  document.getElementById('add-tree-btn').innerHTML = `Salvar Alterações (ID: ${id})`;
  document.querySelector('.sub-nav-btn[data-target="tab-content-register"]').click();
  utils.showToast(`Editando ID ${id}...`, "info");
  
  // Força o usuário a reavaliar o risco no checklist.
  currentRiskAssessment = { targetCategory: null, mitigationAction: 'nenhuma' }; 
  document.querySelectorAll('input[name="target_category_desktop"]').forEach(radio => radio.checked = false);
  utils.showToast("Risco resetado. Reavalie no checklist ou no formulário.", "info");

  return t;
}

export function handleClearAll() {
  state.registeredTrees.forEach(t => { if (t.hasPhoto) db.deleteImageFromDB(t.id); });
  state.setRegisteredTrees([]); 
  state.saveDataToStorage();
  TableUI.render();
  utils.showToast('Banco limpo.', 'success'); 
  return true;
}

// === HELPERS ===
export function handleTableFilter() {
  const fi = document.getElementById('table-filter-input'); 
  if (!fi) return;
  const ft = fi.value.toLowerCase();
  document.querySelectorAll("#summary-table-container tbody tr").forEach(r => {
    r.style.display = r.textContent.toLowerCase().includes(ft) ? "" : "none";
  });
}

export function handleSort(sortKey) {
  if (state.sortState.key === sortKey) state.setSortState(sortKey, state.sortState.direction === 'asc' ? 'desc' : 'asc');
  else state.setSortState(sortKey, 'asc');
}

export function getSortValue(tree, key) {
  const numKeys = ['id', 'dap', 'altura', 'pontuacao', 'coordX', 'coordY', 'utmZoneNum'];
  if (numKeys.includes(key)) return parseFloat(tree[key]) || 0;
  return (tree[key] || '').toLowerCase();
}

// === MAPA ===
export function convertToLatLon(tree) { 
  if(tree.coordX === 'N/A' || tree.coordY === 'N/A') return null;
  if (typeof window.proj4 === 'undefined') return null;
  
  const e = parseFloat(tree.coordX); const n = parseFloat(tree.coordY);
  const zn = tree.utmZoneNum || 23; 
  const hemi = '+south';
  const def = `+proj=utm +zone=${zn} ${hemi} +datum=WGS84 +units=m +no_defs`;
  
  try { 
      const ll = window.proj4(def, "EPSG:4326", [e, n]); 
      return [ll[1], ll[0]]; 
  } catch(e) { return null; }
}

export function handleZoomToPoint(id) {
  const t = state.registeredTrees.find(tr => tr.id === id); 
  if (!t) return;
  
  const latLonCoords = convertToLatLon(t);
  if (!latLonCoords) {
      utils.showToast("Coordenadas inválidas para esta árvore.", "error");
      return;
  }

  state.setZoomTargetCoords(latLonCoords);
  state.setHighlightTargetId(id);
  state.setOpenInfoBoxId(id);
  
  document.querySelector('.sub-nav-btn[data-target="tab-content-mapa"]').click();
}

export function handleMapMarkerClick(id) {
  state.setHighlightTargetId(id);
  document.querySelector('.sub-nav-btn[data-target="tab-content-summary"]').click();
  setTimeout(() => {
      const row = document.getElementById(`row-${id}`);
      if(row) {
          row.scrollIntoView({behavior: 'smooth', block: 'center'});
          row.classList.add('glow-effect');
          setTimeout(() => row.classList.remove('glow-effect'), 1500);
      }
  }, 300);
}

// === IMPORTAÇÃO / EXPORTAÇÃO (ATUALIZADO PARA TRAQ) ===
function getCSVData() {
  if (state.registeredTrees.length === 0) return null;
  const headers = ["ID", "Data", "Especie", "CoordX", "CoordY", "ZonaN", "ZonaL", "DAP", "Altura", "Local", "Avaliador", "Pontos", "Risco_Inicial", "Risco_Residual", "Acao_Mitigadora", "Obs", "Fatores", "Foto"];
  let csv = "﻿" + headers.join(";") + "\n";
  state.registeredTrees.forEach(t => {
    const c = (s) => (s || '').toString().replace(/[\n;]/g, ' ');
    const rf = (t.riskFactors || []).join(',');
    const r = [
      t.id, t.data, c(t.especie), t.coordX, t.coordY, t.utmZoneNum, t.utmZoneLetter, 
      t.dap, t.altura, c(t.local), c(t.avaliador), t.pontuacao, 
      t.riskLevel, t.residualRisk, t.mitigation, // Novos campos TRAQ
      c(t.observacoes), rf, t.hasPhoto?'Sim':'Nao'
    ];
    csv += r.join(";") + "\n";
  });
  return csv;
}

export function sendEmailReport() {
    const csvData = getCSVData();
    if (!csvData) {
        utils.showToast("Nenhum dado para enviar.", "error");
        return;
    }
    const subject = "Laudo de Avaliação Arbórea - ArborIA (TRAQ)";
    const body = `Segue o laudo gerado pelo aplicativo ArborIA.\n\n${csvData}`;
    const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const link = document.createElement('a');
    link.href = mailtoLink;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

export function exportActionZip() {
  if (typeof JSZip === 'undefined' || state.registeredTrees.length === 0) return;
  
  const zipStatus = document.getElementById('zip-status'); 
  if(zipStatus) zipStatus.style.display = 'flex';
  
  try {
    const zip = new JSZip();
    const csv = getCSVData();
    if (csv) zip.file("manifesto_dados_traq.csv", csv);
    
    db.getAllImagesFromDB().then(images => {
        if (images.length > 0) {
          const imgFolder = zip.folder("images");
          images.forEach(img => {
             const t = state.registeredTrees.find(x => x.id === img.id);
             if(t && t.hasPhoto) {
                 let ext = img.imageBlob.type.includes('png') ? 'png' : 'jpg';
                 imgFolder.file(`tree_id_${img.id}.${ext}`, img.imageBlob);
             }
          });
        }
        zip.generateAsync({ type: "blob" }).then(blob => {
            utils.downloadBlob(blob, `Backup_ArborIA_TRAQ_${new Date().toISOString().slice(0,10)}.zip`);
            if(zipStatus) zipStatus.style.display = 'none';
        });
    });
  } catch (e) { 
      if(zipStatus) zipStatus.style.display = 'none'; 
  }
}

export async function handleImportZip(event) {
  if (typeof JSZip === 'undefined') return;
  const file = event.target.files[0]; 
  if (!file) return;
  
  const zipStatus = document.getElementById('zip-status');
  if (zipStatus) zipStatus.style.display = 'flex';

  try {
    const zip = await JSZip.loadAsync(file);
    
    // 1. Tenta encontrar o arquivo CSV (Novo ou Antigo)
    let csvFile = zip.file("manifesto_dados_traq.csv"); // Novo padrão TRAQ
    let isTraqFormat = true;

    if (!csvFile) {
        // Tenta o padrão antigo (fallback)
        csvFile = zip.file("manifesto_dados.csv");
        isTraqFormat = false;
    }

    if (!csvFile) {
        // Última tentativa: Procura qualquer arquivo que termine em .csv
        const csvFiles = zip.file(/.*\.csv$/);
        if (csvFiles.length > 0) {
            csvFile = csvFiles[0];
            // Assume formato novo se tiver 'traq' no nome
            isTraqFormat = csvFile.name.toLowerCase().includes('traq');
        } else {
            throw new Error("Arquivo CSV não encontrado no ZIP.");
        }
    }
    
    const csvContent = await csvFile.async("string");
    const lines = csvContent.split('\n').filter(l => l.trim() !== '');
    
    // Remove o BOM (\uFEFF) se existir e pega os cabeçalhos
    const headers = lines[0].replace(/^\uFEFF/, '').split(';').map(h => h.trim());
    
    // Validação extra de formato baseada nos cabeçalhos
    if (!isTraqFormat && headers.includes('Risco_Inicial')) {
        isTraqFormat = true;
    }

    let newTrees = [...state.registeredTrees];
    let maxId = newTrees.length > 0 ? Math.max(...newTrees.map(t => t.id)) : 0;
    
    // Definição do Perfil de Risco (para mapear cores)
    const riskProfile = {
        'Baixo':    { class: 'risk-low' },
        'Moderado': { class: 'risk-medium' },
        'Alto':     { class: 'risk-high' },
        'Extremo':  { class: 'risk-extreme' }
    };

    for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(';');
        if (row.length < 5) continue; // Pula linhas vazias ou quebradas

        const newId = ++maxId;
        let tree;

        if (isTraqFormat) {
            // Mapeamento Dinâmico (TRAQ)
            const dataMap = headers.reduce((obj, header, index) => {
                obj[header] = row[index];
                return obj;
            }, {});

            tree = {
                id: newId,
                data: dataMap['Data'], 
                especie: dataMap['Especie'], 
                local: dataMap['Local'],
                coordX: dataMap['CoordX'], 
                coordY: dataMap['CoordY'], 
                utmZoneNum: parseInt(dataMap['ZonaN']) || 0,
                utmZoneLetter: dataMap['ZonaL'], 
                dap: dataMap['DAP'], 
                altura: dataMap['Altura'],
                avaliador: dataMap['Avaliador'], 
                observacoes: dataMap['Obs'],
                pontuacao: parseInt(dataMap['Pontos_Checklist'] || dataMap['Pontos']) || 0,
                riskFactors: (dataMap['Fatores_IDs'] || dataMap['Fatores'] || '').split(',').map(Number),
                hasPhoto: (dataMap['Tem_Foto'] || dataMap['Foto'] || '').trim().toLowerCase() === 'sim',
                
                // Campos TRAQ
                targetType: dataMap['Alvo_Tipo'] || 'Não Informado',
                failureProb: dataMap['Prob_Falha'] || 'Não Avaliado',
                riskLevel: dataMap['Risco_Inicial'] || 'Baixo',
                residualRisk: dataMap['Risco_Residual'] || 'Baixo',
                mitigation: dataMap['Mitigacao'] || 'nenhuma',
                
                // Compatibilidade UI
                risco: dataMap['Risco_Inicial'] || 'Baixo',
                riscoClass: (riskProfile[dataMap['Risco_Inicial']] || {class: 'risk-low'}).class,
            };
        } else {
            // Mapeamento Legado (Antigo)
            // Layout antigo: ID;Data;Especie;CoordX;CoordY;ZonaN;ZonaL;DAP;Altura;Local;Avaliador;Pontos;Risco;Obs;Fatores;Foto
            const pontuacao = parseInt(row[11]) || 0;
            // Recálculo básico para TRAQ
            let riskLevel = 'Baixo';
            let riskClass = 'risk-low';
            if(pontuacao >= 20) { riskLevel = 'Alto'; riskClass = 'risk-high'; }
            else if(pontuacao >= 10) { riskLevel = 'Moderado'; riskClass = 'risk-medium'; }

            tree = {
                id: newId,
                data: row[1], especie: row[2], local: row[9],
                coordX: row[3], coordY: row[4], 
                utmZoneNum: parseInt(row[5]) || 0, utmZoneLetter: row[6], 
                dap: row[7], altura: row[8],
                avaliador: row[10], observacoes: row[13],
                pontuacao: pontuacao,
                riskFactors: (row[14] || '').split(',').map(Number),
                hasPhoto: (row[15] || '').trim().toLowerCase() === 'sim',
                
                // Preenche TRAQ com defaults
                targetType: 'Legado',
                failureProb: 'Não Avaliado',
                riskLevel: riskLevel,
                residualRisk: riskLevel,
                mitigation: 'nenhuma',
                risco: riskLevel,
                riscoClass: riskClass
            };
        }

        // Importação de Imagem
        if (tree.hasPhoto) {
            const oldId = isTraqFormat ? (headers.includes('ID') ? row[headers.indexOf('ID')] : row[0]) : row[0];
            // Procura por JPG ou PNG
            let imgFile = zip.file(`images/tree_id_${oldId}.jpg`);
            if (!imgFile) imgFile = zip.file(`images/tree_id_${oldId}.png`);
            
            if (imgFile) {
                const blob = await imgFile.async("blob");
                await db.saveImageToDB(newId, blob);
            }
        }
        newTrees.push(tree);
    }
    
    state.setRegisteredTrees(newTrees);
    state.saveDataToStorage();
    TableUI.render();
    
    // Importa utils dinamicamente para usar o showToast
    const u = await import('./utils.js');
    u.showToast("Importação TRAQ concluída!", "success");
    
  } catch (e) {
      console.error(e);
      const u = await import('./utils.js');
      u.showToast("Erro crítico na importação.", "error");
  } finally {
      if (zipStatus) zipStatus.style.display = 'none';
      event.target.value = null;
  }
}
