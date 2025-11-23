/**
 * ARBORIA 2.0 - FEATURES (v81.0 - Flash Card Checklist)
 * Contém: Lógica de GPS, CRUD, Importação e NOVO CHECKLIST (Flash Card Fullscreen).
 */

import * as state from './state.js';
import * as utils from './utils.js';
import * as db from './database.js';
import { TableUI } from './table.ui.js'; 

// ============================================================
// 1. LÓGICA DO CHECKLIST (MODO FLASH CARD / TELA CHEIA)
// ============================================================

let currentCardIndex = 0;
let flashCardListenersAttached = false;

// Seletores específicos da nova UI Fullscreen
const getFlashCardElements = () => {
    const container = document.getElementById('checklist-flashcard-view');
    if (!container) return null;

    return {
        container: container,
        closeBtn: document.getElementById('close-checklist-btn'),
        card: document.querySelector('.mobile-checklist-card'),
        
        // Elementos de Conteúdo
        counter: document.getElementById('flashcard-counter'),
        questionBox: document.getElementById('flashcard-question-text'), 
        
        // Controle (Toggle)
        toggleInput: document.getElementById('flashcard-toggle-input'), 
        
        // Navegação
        btnPrev: document.getElementById('flashcard-prev'),
        btnNext: document.getElementById('flashcard-next'),
        
        // Fonte de Dados (Tabela Oculta)
        dataRows: document.querySelectorAll('#checklist-data-table tbody tr')
    };
};

/**
 * Renderiza o cartão atual baseado no índice.
 */
function updateFlashCard(index) {
    const els = getFlashCardElements();
    if (!els || !els.dataRows || index < 0 || index >= els.dataRows.length) return;

    const row = els.dataRows[index];
    // [IMPORTANTE] Obtém o checkbox da tabela que é a fonte de dados real
    const sourceCheckbox = row.querySelector('input[type="checkbox"]');

    // Extração de Conteúdo (Célula 1) - Clona para não perder eventos de tooltip
    const questionCell = row.cells[1].cloneNode(true); 
    const tooltipSpan = questionCell.querySelector('.checklist-term');
    if (tooltipSpan) {
        tooltipSpan.classList.add('tooltip-trigger'); 
    }

    // 1. Atualiza UI
    els.counter.textContent = `Fator de Risco ${index + 1} / ${els.dataRows.length}`;
    els.questionBox.innerHTML = questionCell.innerHTML; 
    
    // 2. Sincroniza Toggle Visual com o Checkbox Real
    els.toggleInput.checked = sourceCheckbox.checked;
    updateCardVisuals(els.card, els.toggleInput.checked);

    // 3. Atualiza Botões
    els.btnPrev.disabled = (index === 0);
    // Muda texto do botão no último item
    els.btnNext.textContent = (index === els.dataRows.length - 1) ? 'Concluir' : 'Próxima ❯';

    // 4. Lógica do Toggle (Remove listener antigo antes de adicionar novo)
    if (els.toggleInput._handler) {
        els.toggleInput.removeEventListener('change', els.toggleInput._handler);
    }

    const onToggleChange = () => {
        const isChecked = els.toggleInput.checked;
        
        // A. Atualiza o "Banco de Dados" (Checkbox da Tabela Oculta)
        sourceCheckbox.checked = isChecked;
        
        // B. Feedback Visual Imediato (Troca Cor)
        updateCardVisuals(els.card, isChecked);

        // C. Auto-Avanço (apenas se marcou SIM e não é o último)
        if (isChecked && index < els.dataRows.length - 1) {
            // [MELHORIA] Aumenta o tempo de espera para 600ms
            setTimeout(() => {
                // Dispara a navegação para o próximo, que agora tem animação
                els.btnNext.click();
            }, 600);
        }
    };

    els.toggleInput.addEventListener('change', onToggleChange);
    els.toggleInput._handler = onToggleChange; // Salva referência para remoção
}

/**
 * Helper para mudar a cor do cartão (CSS class)
 */
function updateCardVisuals(cardElement, isChecked) {
    if (isChecked) cardElement.classList.add('answered-yes');
    else cardElement.classList.remove('answered-yes');
}

/**
 * Anexa os listeners de navegação global (apenas uma vez).
 */
function setupFlashCardListeners() {
    if (flashCardListenersAttached) return;
    
    const els = getFlashCardElements();
    if (!els || !els.btnPrev || !els.btnNext) return;

    // Botão Fechar (X)
    els.closeBtn.addEventListener('click', closeChecklistFlashCard);

    // Botão Anterior
    els.btnPrev.addEventListener('click', (e) => {
        e.preventDefault();
        if (currentCardIndex <= 0 || els.card.classList.contains('is-animating')) return;

        els.card.classList.add('is-animating', 'swipe-out-to-right');
        setTimeout(() => {
            currentCardIndex--;
            updateFlashCard(currentCardIndex);
            els.card.classList.remove('swipe-out-to-right');
            els.card.classList.add('swipe-in-from-left');
            setTimeout(() => els.card.classList.remove('is-animating', 'swipe-in-from-left'), 400);
        }, 300);
    });

    // Botão Próximo / Concluir
    els.btnNext.addEventListener('click', (e) => {
        e.preventDefault();
        if (els.card.classList.contains('is-animating')) return;

        if (currentCardIndex < els.dataRows.length - 1) {
            els.card.classList.add('is-animating', 'swipe-out-to-left');
            setTimeout(() => {
                currentCardIndex++;
                updateFlashCard(currentCardIndex);
                els.card.classList.remove('swipe-out-to-left');
                els.card.classList.add('swipe-in-from-right');
                setTimeout(() => els.card.classList.remove('is-animating', 'swipe-in-from-right'), 400);
            }, 300);
        } else {
            // Fim do fluxo: Fecha o modal e notifica
            closeChecklistFlashCard();
            utils.showToast("Checklist preenchido!", "success");
        }
    });
    
    flashCardListenersAttached = true;
}

/**
 * [PÚBLICO] Inicia o Checklist em Tela Cheia.
 * Chamado pelo botão "#open-checklist-btn" no formulário.
 */
export function initChecklistFlashCard(retry = 0) {
    const els = getFlashCardElements();
    
    // 1. Verificação Crítica: Garante que as linhas da tabela oculta existem
    if (!els || els.dataRows.length === 0) {
        if (retry < 5) {
            // Tenta novamente a cada 150ms para esperar o DOM renderizar a tabela
            setTimeout(() => initChecklistFlashCard(retry + 1), 150);
        } else {
            utils.showToast("Erro: Tabela de critérios não carregou. Recarregue a página.", "error");
        }
        return;
    }

    // 2. Anexa Listeners (se ainda não anexou)
    setupFlashCardListeners();
    
    // 3. Reset e Inicia no primeiro card (a UI já está visível)
    currentCardIndex = 0;
    updateFlashCard(currentCardIndex);
}

/**
 * [PRIVADO] Fecha a UI do Checklist.
 */
function closeChecklistFlashCard() {
    const els = getFlashCardElements();
    // A lógica de fechar foi movida para main.js para centralizar o controle do DOM.
    if (els && els.container) els.container.style.display = 'none';
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
      if (btn) { btn.disabled = false; btn.innerHTML = '🛰️ Capturar GPS Preciso'; }
  };

  const updateUI = () => {
      const btn = document.getElementById('get-gps-btn');
      if (!btn) { cleanup(); return; } 

      const elapsed = Date.now() - startTime;
      const remaining = Math.ceil((CAPTURE_TIME_MS - elapsed) / 1000);
      
      let batteryIcon = '📡'; 
      btn.innerHTML = `${batteryIcon} Calibrando... ${remaining}s`;
      
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
      (err) => console.warn("GPS:", err),
      options
  );
  timerInterval = setInterval(updateUI, 1000);
  updateUI();
}

// ============================================================
// 3. CRUD & AÇÕES DIVERSAS (Integradas)
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

  const submitBtn = document.getElementById('add-tree-btn');
  if (submitBtn) {
      submitBtn.innerHTML = '➕ Registrar Árvore';
  }
  state.setEditingTreeId(null);
  
  // Limpa Checkboxes da Tabela Oculta
  const form = document.getElementById('risk-calculator-form');
  if(form) form.reset();
  
  document.querySelectorAll('.risk-checkbox').forEach(cb => cb.checked = false);
  
  TableUI.render();
}

export function handleAddTreeSubmit(event) {
  event.preventDefault();
  const form = event.target;
  
  let totalScore = 0;
  form.querySelectorAll('.risk-checkbox:checked').forEach(cb => totalScore += parseInt(cb.dataset.weight, 10));
  const checkedRiskFactors = Array.from(form.querySelectorAll('.risk-checkbox')).map(cb => cb.checked ? 1 : 0);
  
  let classificationText = 'Baixo Risco', classificationClass = 'risk-low';
  if (totalScore >= 20) { classificationText = 'Alto Risco'; classificationClass = 'risk-high'; }
  else if (totalScore >= 10) { classificationText = 'Médio Risco'; classificationClass = 'risk-medium'; }
  
  const especie = document.getElementById('risk-especie').value.trim();
  if (!especie) { utils.showToast("Nome da espécie é obrigatório.", 'error'); return { success: false }; }

  const alturaVal = document.getElementById('risk-altura').value || '0.0';

  const treeData = {
    data: document.getElementById('risk-data').value || new Date().toISOString().split('T')[0],
    especie: especie,
    local: document.getElementById('risk-local').value || 'N/A',
    coordX: document.getElementById('risk-coord-x').value || 'N/A',
    coordY: document.getElementById('risk-coord-y').value || 'N/A',
    utmZoneNum: (state.lastUtmZone && state.lastUtmZone.num) ? state.lastUtmZone.num : 0,
    utmZoneLetter: (state.lastUtmZone && state.lastUtmZone.letter) ? state.lastUtmZone.letter : 'Z',
    dap: document.getElementById('risk-dap').value || 'N/A',
    altura: alturaVal, 
    avaliador: document.getElementById('risk-avaliador').value || 'N/A',
    observacoes: document.getElementById('risk-obs').value || 'N/A',
    pontuacao: totalScore,
    risco: classificationText,
    riscoClass: classificationClass, 
    riskFactors: checkedRiskFactors,
    hasPhoto: (state.currentTreePhoto !== null)
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
  
  // Marca Checkboxes na Tabela Oculta
  const checkboxes = document.querySelectorAll('.risk-checkbox');
  checkboxes.forEach(cb => cb.checked = false); 
  
  if (t.riskFactors && Array.isArray(t.riskFactors)) {
      t.riskFactors.forEach((val, index) => {
          if (val === 1 && checkboxes[index]) checkboxes[index].checked = true;
      });
  }

  const submitBtn = document.getElementById('add-tree-btn');
  if (submitBtn) {
      submitBtn.innerHTML = `💾 Salvar Alterações (ID: ${id})`;
  }

  const tabBtn = document.querySelector('.sub-nav-btn[data-target="tab-content-register"]');
  if(tabBtn) tabBtn.click();
  
  utils.showToast(`Editando ID ${id}...`, "info");
  
  // [FIX] Não abre automaticamente o checklist, o usuário clica se quiser editar
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
  
  const coords = utils.convertLatLonToUtm(0,0); 
  state.setHighlightTargetId(id);
  state.setOpenInfoBoxId(id);
  
  const b = document.querySelector('.sub-nav-btn[data-target="tab-content-mapa"]'); 
  if (b) b.click();
}

export function handleMapMarkerClick(id) {
  state.setHighlightTargetId(id);
  const b = document.querySelector('.sub-nav-btn[data-target="tab-content-summary"]'); 
  if (b) b.click();
  setTimeout(() => {
      const row = document.getElementById(`row-${id}`);
      if(row) {
          row.scrollIntoView({behavior: 'smooth', block: 'center'});
          row.style.backgroundColor = '#fff9c4';
          setTimeout(() => row.style.backgroundColor = '', 1500);
      }
  }, 300);
}

export function handleZoomToExtent() {}

// === IMPORTAÇÃO / EXPORTAÇÃO ===
function getCSVData() {
  if (state.registeredTrees.length === 0) return null;
  const headers = ["ID", "Data", "Especie", "CoordX", "CoordY", "ZonaN", "ZonaL", "DAP", "Altura", "Distancia", "Local", "Avaliador", "Pontos", "Risco", "Obs", "Fatores", "Foto"];
  let csv = "\uFEFF" + headers.join(";") + "\n";
  state.registeredTrees.forEach(t => {
    const c = (s) => (s || '').toString().replace(/[\n;]/g, ' ');
    const rf = (t.riskFactors || []).join(',');
    const r = [
      t.id, t.data, c(t.especie), t.coordX, t.coordY, t.utmZoneNum, t.utmZoneLetter, 
      t.dap, t.altura, t.distancia, c(t.local), c(t.avaliador), t.pontuacao, t.risco, c(t.observacoes), rf, t.hasPhoto?'Sim':'Nao'
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

    const subject = "Laudo de Avaliação Arbórea - ArborIA";
    const body = `Olá,\n\nSegue o laudo gerado pelo aplicativo ArborIA.\n\n---\n${csvData}\n---\n\nAtenciosamente,\nEquipe ArborIA`;

    const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    // Create a temporary link to trigger the mail client
    const link = document.createElement('a');
    link.href = mailtoLink;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    utils.showToast("Cliente de e-mail aberto.", "success");
}

export function exportActionZip() {
  if (typeof JSZip === 'undefined') { utils.showToast("Erro: JSZip.", 'error'); return; }
  if (state.registeredTrees.length === 0) { utils.showToast("Sem dados.", 'error'); return; }
  
  const zipStatus = document.getElementById('zip-status'); 
  if(zipStatus) zipStatus.style.display = 'flex';
  
  try {
    const zip = new JSZip();
    const csv = getCSVData();
    if (csv) zip.file("manifesto_dados.csv", csv);
    
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
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `Backup_ArborIA_${new Date().toISOString().slice(0,10)}.zip`;
            document.body.appendChild(link); link.click(); document.body.removeChild(link);
            utils.showToast('ZIP criado!', 'success');
            if(zipStatus) zipStatus.style.display = 'none';
        });
    });
  } catch (e) { 
      console.error(e); 
      if(zipStatus) zipStatus.style.display = 'none'; 
  }
}

export async function handleImportZip(event) {
  if (typeof JSZip === 'undefined') return;
  const file = event.target.files[0]; if (!file) return;
  
  try {
    const zip = await JSZip.loadAsync(file);
    const csvFile = zip.file("manifesto_dados.csv"); 
    if (!csvFile) throw new Error("CSV não encontrado.");
    
    const csvContent = await csvFile.async("string");
    const lines = csvContent.split('\n').filter(l => l.trim() !== '');
    
    let newTrees = [...state.registeredTrees];
    let maxId = newTrees.length > 0 ? Math.max(...newTrees.map(t => t.id)) : 0;
    
    for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(';'); 
        if(row.length < 5) continue;
        
        const newId = ++maxId;
        const tree = {
            id: newId, data: row[1], especie: row[2], coordX: row[3], coordY: row[4],
            utmZoneNum: parseInt(row[5]), utmZoneLetter: row[6],
            dap: row[7], altura: row[8], distancia: row[9],
            local: row[10], avaliador: row[11], pontuacao: parseInt(row[12]),
            risco: row[13], observacoes: row[14], 
            riskFactors: (row[15]||'').split(',').map(Number),
            hasPhoto: (row[16] && row[16].trim() === 'Sim')
        };
        
        if(tree.pontuacao >= 20) tree.riscoClass = 'risk-high'; 
        else if(tree.pontuacao >= 10) tree.riscoClass = 'risk-medium'; 
        else tree.riscoClass = 'risk-low';

        if(tree.hasPhoto) {
            const oldId = row[0];
            const imgFile = zip.file(`images/tree_id_${oldId}.jpg`) || zip.file(`images/tree_id_${oldId}.png`);
            if(imgFile) {
                const blob = await imgFile.async("blob");
                db.saveImageToDB(newId, blob);
            }
        }
        newTrees.push(tree);
    }
    
    state.setRegisteredTrees(newTrees);
    state.saveDataToStorage();
    TableUI.render();
    utils.showToast("Importação concluída!", "success");
    
  } catch (e) {
      console.error(e);
      utils.showToast("Erro na importação.", "error");
  } finally {
      event.target.value = null;
  }
}

export async function handleChatSend() {}
export function handleContactForm(e) { e.preventDefault(); }