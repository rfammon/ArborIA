// js/features.js (v72.0 - Safe Save)

import * as state from './state.js';
import * as utils from './utils.js';
import * as db from './database.js';

// === 1. GPS ===
export async function handleGetGPS() {
  const gpsStatus = document.getElementById('gps-status');
  const coordXField = document.getElementById('risk-coord-x');
  const coordYField = document.getElementById('risk-coord-y');
  const getGpsBtn = document.getElementById('get-gps-btn');

  if (!navigator.geolocation) {
    if(gpsStatus) { gpsStatus.textContent = "Sem GPS."; gpsStatus.className = 'error'; }
    return;
  }
  
  const CAPTURE_TIME_MS = 15000; 
  const options = { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 };
  let readings = [];
  let watchId = null;
  let timerInterval = null;
  let startTime = Date.now();
  
  if(getGpsBtn) getGpsBtn.disabled = true;

  const cleanup = () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (timerInterval !== null) clearInterval(timerInterval);
      const btn = document.getElementById('get-gps-btn'); // Recaptura do DOM
      if (btn) { btn.disabled = false; btn.innerHTML = '🛰️ Capturar GPS'; }
  };

  const updateUI = () => {
      const btn = document.getElementById('get-gps-btn');
      if (!btn) { cleanup(); return; } // Proteção se mudar de aba

      const elapsed = Date.now() - startTime;
      const remaining = Math.ceil((CAPTURE_TIME_MS - elapsed) / 1000);
      const progress = Math.min(100, (elapsed / CAPTURE_TIME_MS) * 100);
      
      let batteryIcon = '🪫'; 
      if (progress > 25) batteryIcon = '🔋 ▂';
      if (progress > 50) batteryIcon = '🔋 ▃';
      if (progress > 75) batteryIcon = '🔋 ▆';
      if (progress > 90) batteryIcon = '🔋 █';

      btn.innerHTML = `${batteryIcon} Calibrando... ${remaining}s`;
      if (elapsed >= CAPTURE_TIME_MS) finishCapture();
  };

  const finishCapture = () => {
      cleanup();
      if (readings.length === 0) {
          utils.showToast("Sem sinal.", "error");
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
          state.setLastUtmZone(utmCoords.zoneNum, utmCoords.zoneLetter);
          const dz = document.getElementById('default-utm-zone');
          if (dz) dz.value = `${utmCoords.zoneNum}${utmCoords.zoneLetter}`;
          
          const gs = document.getElementById('gps-status');
          if(gs) {
              const color = avgAcc <= 5 ? 'var(--color-primary-dark)' : '#E65100';
              gs.innerHTML = `Média: <strong>${readings.length}</strong> pts. Prec: <span style="color:${color}">±${avgAcc.toFixed(1)}m</span>`;
          }
          utils.showToast("Coordenadas capturadas!", "success");
      }
  };

  watchId = navigator.geolocation.watchPosition(
      (pos) => { if (pos.coords.accuracy < 150) readings.push(pos.coords); },
      (err) => console.warn(err),
      options
  );
  timerInterval = setInterval(updateUI, 1000);
  updateUI();
}

// === 2. CRUD ===
export function clearPhotoPreview() {
  const pc = document.getElementById('photo-preview-container');
  const rb = document.getElementById('remove-photo-btn');
  const op = document.getElementById('photo-preview');
  if (op && pc) { URL.revokeObjectURL(op.src); pc.removeChild(op); }
  if (rb) rb.style.display = 'none';
  state.setCurrentTreePhoto(null);
  const pi = document.getElementById('tree-photo-input');
  if (pi) pi.value = null;
}

export function handleAddTreeSubmit(event) {
  event.preventDefault();
  const form = event.target;
  let totalScore = 0;
  form.querySelectorAll('.risk-checkbox:checked').forEach(cb => totalScore += parseInt(cb.dataset.weight, 10));
  const checkedRiskFactors = Array.from(form.querySelectorAll('.risk-checkbox')).map(cb => cb.checked ? 1 : 0);
  
  let classificationText = 'Baixo Risco', classificationClass = 'risk-col-low';
  if (totalScore >= 20) { classificationText = 'Alto Risco'; classificationClass = 'risk-col-high'; }
  else if (totalScore >= 10) { classificationText = 'Médio Risco'; classificationClass = 'risk-col-medium'; }
  
  const especie = document.getElementById('risk-especie').value.trim();
  if (!especie) { utils.showToast("Espécie obrigatória.", 'error'); return { success: false }; }

  // [CORREÇÃO] Leitura segura dos inputs numéricos
  const alturaInput = document.getElementById('risk-altura');
  const distInput = document.getElementById('risk-distancia-obs'); // Pode não existir
  
  const alturaVal = alturaInput ? alturaInput.value || '0.0' : '0.0';
  const distVal = distInput ? distInput.value || '0.0' : '0.0'; // Safe check

  const treeData = {
    data: document.getElementById('risk-data').value || new Date().toISOString().split('T')[0],
    especie: especie,
    local: document.getElementById('risk-local').value || 'N/A',
    coordX: document.getElementById('risk-coord-x').value || 'N/A',
    coordY: document.getElementById('risk-coord-y').value || 'N/A',
    utmZoneNum: state.lastUtmZone.num || 0,
    utmZoneLetter: state.lastUtmZone.letter || 'Z',
    dap: document.getElementById('risk-dap').value || 'N/A',
    altura: alturaVal, 
    distancia: distVal,
    avaliador: document.getElementById('risk-avaliador').value || 'N/A',
    observacoes: document.getElementById('risk-obs').value || 'N/A',
    pontuacao: totalScore,
    risco: classificationText,
    riscoClass: classificationClass,
    riskFactors: checkedRiskFactors,
    hasPhoto: (state.currentTreePhoto !== null)
  };

  state.setLastEvaluatorName(treeData.avaliador);
  let resultTree, mode;

  if (state.editingTreeId === null) {
    mode = 'add';
    const newTreeId = state.registeredTrees.length > 0 ? Math.max(...state.registeredTrees.map(t => t.id)) + 1 : 1;
    resultTree = { ...treeData, id: newTreeId };
    if (resultTree.hasPhoto) db.saveImageToDB(resultTree.id, state.currentTreePhoto);
    state.registeredTrees.push(resultTree);
    utils.showToast(`Árvore ID ${resultTree.id} salva!`, 'success');
  } else {
    mode = 'update';
    const idx = state.registeredTrees.findIndex(t => t.id === state.editingTreeId);
    if (idx === -1) return { success: false };
    resultTree = { ...treeData, id: state.editingTreeId };
    const original = state.registeredTrees[idx];
    if (resultTree.hasPhoto && !original.hasPhoto) db.saveImageToDB(resultTree.id, state.currentTreePhoto);
    else if (!resultTree.hasPhoto && original.hasPhoto) db.deleteImageFromDB(resultTree.id);
    else if (resultTree.hasPhoto && original.hasPhoto) db.saveImageToDB(resultTree.id, state.currentTreePhoto);
    state.registeredTrees[idx] = resultTree;
    utils.showToast(`Árvore ID ${resultTree.id} atualizada!`, 'success');
  }

  state.saveDataToStorage();
  state.setEditingTreeId(null);
  return { success: true, mode: mode, tree: resultTree };
}

export function handleDeleteTree(id) {
  const t = state.registeredTrees.find(tree => tree.id === id);
  if (t && t.hasPhoto) db.deleteImageFromDB(id);
  const n = state.registeredTrees.filter(tree => tree.id !== id);
  state.setRegisteredTrees(n); state.saveDataToStorage();
  utils.showToast(`Árvore ID ${id} excluída.`, 'error'); return true;
}
export function handleEditTree(id) {
  const t = state.registeredTrees.find(tree => tree.id === id);
  if (!t) { utils.showToast(`Erro ID ${id}.`, "error"); return null; }
  state.setEditingTreeId(id);
  state.setLastUtmZone(t.utmZoneNum || 0, t.utmZoneLetter || 'Z');
  return t;
}
export function handleClearAll() {
  state.registeredTrees.forEach(t => { if (t.hasPhoto) db.deleteImageFromDB(t.id); });
  state.setRegisteredTrees([]); state.saveDataToStorage();
  utils.showToast('Tabela limpa.', 'error'); return true;
}

// === HELPERS ===
export function handleTableFilter() {
  const fi = document.getElementById('table-filter-input'); if (!fi) return;
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

export function convertToLatLon(tree) {
  if(tree.coordX === 'N/A' || tree.coordY === 'N/A') return null;
  if (typeof window.proj4 === 'undefined') return null;
  const e = parseFloat(tree.coordX); const n = parseFloat(tree.coordY);
  const zn = tree.utmZoneNum || state.lastUtmZone.num;
  const zl = tree.utmZoneLetter || state.lastUtmZone.letter;
  if(!zn || !e || !n) return null;
  const hemi = (zl.toUpperCase() < 'N') ? '+south' : '';
  const def = `+proj=utm +zone=${zn} ${hemi} +datum=WGS84 +units=m +no_defs`;
  try { const ll = window.proj4(def, "EPSG:4326", [e, n]); return [ll[1], ll[0]]; } catch(e) { return null; }
}
export function handleZoomToPoint(id) {
  const t = state.registeredTrees.find(tr => tr.id === id); if (!t) return;
  const c = convertToLatLon(t);
  if (c) {
    state.setZoomTargetCoords(c); state.setHighlightTargetId(id); state.setOpenInfoBoxId(id);
    const b = document.querySelector('.sub-nav-btn[data-target="tab-content-mapa"]'); if (b) b.click();
  } else { utils.showToast("Coordenadas inválidas.", "error"); }
}
export function handleMapMarkerClick(id) {
  state.setHighlightTargetId(id);
  const b = document.querySelector('.sub-nav-btn[data-target="tab-content-summary"]'); if (b) b.click();
}
export function handleZoomToExtent() {}

// === EXPORTAÇÃO ===
function getCSVData() {
  if (state.registeredTrees.length === 0) return null;
  const headers = ["ID", "Data Coleta", "Especie", "Coord X", "Coord Y", "Zona Num", "Zona Letter", "DAP", "Altura", "Distancia Obs", "Local", "Avaliador", "Pontuacao", "Risco", "Obs", "RiskFactors", "HasPhoto"];
  let csv = "\uFEFF" + headers.join(";") + "\n";
  state.registeredTrees.forEach(t => {
    const c = (s) => (s || '').toString().replace(/[\n;]/g, ',');
    const rf = (t.riskFactors || []).join(',');
    const r = [
      t.id, t.data, c(t.especie), t.coordX, t.coordY, t.utmZoneNum, t.utmZoneLetter, 
      t.dap, t.altura, t.distancia, // Novos campos
      c(t.local), c(t.avaliador), t.pontuacao, t.risco, c(t.observacoes), rf, t.hasPhoto?'Sim':'Nao'
    ];
    csv += r.join(";") + "\n";
  });
  return csv;
}

export function exportActionCSV() {
  const csv = getCSVData(); if (!csv) { utils.showToast("Sem dados.", 'error'); return; }
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `risco_arboreo_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

export async function exportActionZip() {
  if (typeof JSZip === 'undefined') { utils.showToast("JSZip ausente.", 'error'); return; }
  if (state.registeredTrees.length === 0) { utils.showToast("Sem dados.", 'error'); return; }
  const zipStatus = document.getElementById('zip-status'); if(zipStatus) zipStatus.style.display = 'flex';
  try {
    const zip = new JSZip();
    const csvContent = getCSVData();
    if (csvContent) zip.file("manifesto_dados.csv", csvContent.replace(/^\uFEFF/, ''));
    const images = await db.getAllImagesFromDB();
    if (images.length > 0) {
      const imgFolder = zip.folder("images");
      images.forEach(imgData => {
        const treeExists = state.registeredTrees.some(t => t.id === imgData.id && t.hasPhoto);
        if (treeExists && imgData.imageBlob) {
            let ext = 'jpg'; if(imgData.imageBlob.type === 'image/png') ext = 'png';
            imgFolder.file(`tree_id_${imgData.id}.${ext}`, imgData.imageBlob);
        }
      });
    }
    const zipBlob = await zip.generateAsync({ type: "blob" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(zipBlob); link.download = `backup_completo_${new Date().toISOString().slice(0,10)}.zip`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    utils.showToast('Backup .zip criado!', 'success');
  } catch (error) { console.error(error); utils.showToast("Erro ao criar ZIP.", 'error'); } finally { if(zipStatus) zipStatus.style.display = 'none'; }
}

export async function handleImportZip(event) {
  if (typeof JSZip === 'undefined') return;
  const file = event.target.files[0]; if (!file) return;
  try {
    const zip = await JSZip.loadAsync(file);
    const csvFile = zip.file("manifesto_dados.csv"); if (!csvFile) throw new Error("CSV ausente.");
    const csvContent = await csvFile.async("string");
    const lines = csvContent.split('\n').filter(l => l.trim() !== '');
    const append = !event.replaceData;
    let newTrees = append ? [...state.registeredTrees] : [];
    let maxId = newTrees.length > 0 ? Math.max(...newTrees.map(t => t.id)) : 0;
    if (!append) await db.clearImageDB();
    for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(';'); if(row.length < 10) continue;
        const oldId = row[0]; const newId = ++maxId;
        const treeData = {
            id: newId, data: row[1], especie: row[2], coordX: row[3], coordY: row[4],
            utmZoneNum: parseInt(row[5])||0, utmZoneLetter: row[6],
            dap: row[7], altura: row[8]||'0', distancia: row[9]||'0',
            local: row[10], avaliador: row[11],
            pontuacao: parseInt(row[12])||0, risco: row[13], observacoes: row[14],
            riskFactors: (row[15]||'').split(',').map(Number),
            hasPhoto: (row[16] && row[16].trim().toLowerCase() === 'sim')
        };
        if (isNaN(parseFloat(treeData.altura))) { 
             treeData.altura = '0'; treeData.distancia = '0'; treeData.local = row[8]; treeData.avaliador = row[9]; treeData.pontuacao = parseInt(row[10]); treeData.risco = row[11]; treeData.observacoes = row[12]; treeData.riskFactors = (row[13]||'').split(',').map(Number); treeData.hasPhoto = (row[14] && row[14].trim().toLowerCase() === 'sim');
        }
        if(treeData.pontuacao >= 20) treeData.riscoClass = 'risk-col-high'; else if(treeData.pontuacao >= 10) treeData.riscoClass = 'risk-col-medium'; else treeData.riscoClass = 'risk-col-low';
        if(treeData.hasPhoto) {
            let imgFile = zip.file(`images/tree_id_${oldId}.jpg`) || zip.file(`images/tree_id_${oldId}.png`);
            if(imgFile) { const blob = await imgFile.async("blob"); db.saveImageToDB(newId, blob); } else { treeData.hasPhoto = false; }
        }
        newTrees.push(treeData);
    }
    state.setRegisteredTrees(newTrees); state.saveDataToStorage(); utils.showToast("Importação concluída!", "success");
  } catch (e) { console.error(e); utils.showToast("Erro na importação.", "error"); } finally { event.target.value = null; }
}
export async function handleFileImport(event) { const file = event.target.files[0]; if(!file) return; utils.showToast("Importe CSV via ZIP para incluir imagens.", "warning"); }
export function sendEmailReport() { let body = "Relatório Resumido:\n\n"; state.registeredTrees.forEach(t => { body += `ID: ${t.id} | ${t.especie} | ${t.risco}\n`; }); window.location.href = `mailto:?subject=Relatório&body=${encodeURIComponent(body)}`; }
export function handleContactForm(e) { e.preventDefault(); }
export async function handleChatSend() {}
