// js/tree.service.js

import * as state from './state.js';
import * as utils from './utils.js';
import * as db from './database.js';
import { TableUI } from './table.ui.js';

export function clearPhotoPreview() {
    const pc = document.getElementById('photo-preview-container');
    const rb = document.getElementById('remove-photo-btn');
    const op = document.querySelector('#photo-preview-container img');

    if (op && pc) { try { URL.revokeObjectURL(op.src); } catch (e) { } op.remove(); }
    if (rb) rb.style.display = 'none';

    if (state.setCurrentTreePhoto) state.setCurrentTreePhoto(null);

    const pi = document.getElementById('tree-photo-input');
    if (pi) pi.value = null;

    const submitBtn = document.getElementById('add-tree-btn');
    if (submitBtn) {
        submitBtn.innerHTML = '➕ Registrar Árvore';
    }
    state.setEditingTreeId(null);

    // Limpa Checkboxes da Tabela Oculta
    const form = document.getElementById('risk-calculator-form');
    if (form) form.reset();

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
        utmZoneNum: (state.getLastUtmZone() && state.getLastUtmZone().num) ? state.getLastUtmZone().num : 0,
        utmZoneLetter: (state.getLastUtmZone() && state.getLastUtmZone().letter) ? state.getLastUtmZone().letter : 'Z',
        dap: document.getElementById('risk-dap').value || 'N/A',
        altura: alturaVal,
        avaliador: document.getElementById('risk-avaliador').value || 'N/A',
        observacoes: document.getElementById('risk-obs').value || 'N/A',
        pontuacao: totalScore,
        risco: classificationText,
        riscoClass: classificationClass,
        riskFactors: checkedRiskFactors,
        hasPhoto: (state.getCurrentTreePhoto() !== null)
    };

    if (state.setLastEvaluatorName) state.setLastEvaluatorName(treeData.avaliador);

    let resultTree;

    if (state.getEditingTreeId() === null) {
        const newTreeId = state.getRegisteredTrees().length > 0 ? Math.max(...state.getRegisteredTrees().map(t => t.id)) + 1 : 1;
        resultTree = { ...treeData, id: newTreeId };
        if (resultTree.hasPhoto) db.saveImageToDB(resultTree.id, state.getCurrentTreePhoto());
        state.setRegisteredTrees([...state.getRegisteredTrees(), resultTree]);
        utils.showToast(`Árvore ID ${resultTree.id} salva!`, 'success');
    } else {
        const idx = state.getRegisteredTrees().findIndex(t => t.id === state.getEditingTreeId());
        if (idx === -1) return { success: false };

        resultTree = { ...treeData, id: state.getEditingTreeId() };
        const original = state.getRegisteredTrees()[idx];

        if (original.hasPhoto && state.getCurrentTreePhoto() === null) {
            resultTree.hasPhoto = true;
        } else if (state.getCurrentTreePhoto() !== null) {
            db.saveImageToDB(resultTree.id, state.getCurrentTreePhoto());
        } else if (!resultTree.hasPhoto && original.hasPhoto) {
            db.deleteImageFromDB(resultTree.id);
        }

        const newTrees = [...state.getRegisteredTrees()];
        newTrees[idx] = resultTree;
        state.setRegisteredTrees(newTrees);
        utils.showToast(`ID ${resultTree.id} atualizado!`, 'success');
    }

    state.saveDataToStorage();

    state.setEditingTreeId(null);
    form.reset();
    clearPhotoPreview();
    if (document.activeElement) document.activeElement.blur();

    TableUI.render();
    return { success: true, tree: resultTree };
}

export function handleDeleteTree(id) {
    const t = state.getRegisteredTrees().find(tree => tree.id === id);
    if (t && t.hasPhoto) db.deleteImageFromDB(id);

    const n = state.getRegisteredTrees().filter(tree => tree.id !== id);
    state.setRegisteredTrees(n);
    state.saveDataToStorage();
    TableUI.render();

    utils.showToast(`Árvore removida.`, 'info');
    return true;
}

export function handleEditTree(id) {
    const t = state.getRegisteredTrees().find(tree => tree.id === id);
    if (!t) { utils.showToast(`Erro ID ${id}.`, "error"); return null; }

    state.setEditingTreeId(id);
    if (state.setLastUtmZone) state.setLastUtmZone(t.utmZoneNum || 0, t.utmZoneLetter || 'Z');

    const setVal = (elemId, val) => {
        const el = document.getElementById(elemId);
        if (el) el.value = (val !== undefined && val !== null) ? val : '';
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
    if (tabBtn) tabBtn.click();

    utils.showToast(`Editando ID ${id}...`, "info");

    // [FIX] Não abre automaticamente o checklist, o usuário clica se quiser editar
    return t;
}

export function handleClearAll() {
    state.getRegisteredTrees().forEach(t => { if (t.hasPhoto) db.deleteImageFromDB(t.id); });
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
    if (state.getSortState().key === sortKey) state.setSortState(sortKey, state.getSortState().direction === 'asc' ? 'desc' : 'asc');
    else state.setSortState(sortKey, 'asc');
}

export function getSortValue(tree, key) {
    const numKeys = ['id', 'dap', 'altura', 'pontuacao', 'coordX', 'coordY', 'utmZoneNum'];
    if (numKeys.includes(key)) return parseFloat(tree[key]) || 0;
    return (tree[key] || '').toLowerCase();
}

// === MAPA ===
export function convertToLatLon(tree) {
    if (tree.coordX === 'N/A' || tree.coordY === 'N/A') return null;
    if (typeof window.proj4 === 'undefined') return null;

    const e = parseFloat(tree.coordX); const n = parseFloat(tree.coordY);
    const zn = tree.utmZoneNum || 23;
    const hemi = '+south';
    const def = `+proj=utm +zone=${zn} ${hemi} +datum=WGS84 +units=m +no_defs`;

    try {
        const ll = window.proj4(def, "EPSG:4326", [e, n]);
        return [ll[1], ll[0]];
    } catch (e) { return null; }
}

export function handleZoomToPoint(id) {
    const t = state.getRegisteredTrees().find(tr => tr.id === id);
    if (!t) return;

    const coords = utils.convertLatLonToUtm(0, 0);
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
        if (row) {
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            row.style.backgroundColor = '#fff9c4';
            setTimeout(() => row.style.backgroundColor = '', 1500);
        }
    }, 300);
}

export function handleZoomToExtent() { }

export function init() {
    const form = document.getElementById('risk-calculator-form');
    if (form) {
        form.addEventListener('submit', handleAddTreeSubmit);
    }

    const resetBtn = document.getElementById('reset-risk-form-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const form = document.getElementById('risk-calculator-form');
            if (form) {
                form.reset();
            }
            clearPhotoPreview();
        });
    }

    const clearAllBtn = document.getElementById('clear-all-btn');
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', handleClearAll);
    }

    const filterInput = document.getElementById('table-filter-input');
    if (filterInput) {
        filterInput.addEventListener('input', handleTableFilter);
    }

    const photoInput = document.getElementById('tree-photo-input');
    if (photoInput) {
        photoInput.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (!file) return;

            clearPhotoPreview();
            try {
                utils.showToast('Otimizando foto...', 'info');
                const optimizedBlob = await utils.optimizeImage(file, 800, 0.7);
                state.setCurrentTreePhoto(optimizedBlob);

                const previewContainer = document.getElementById('photo-preview-container');
                const removeBtn = document.getElementById('remove-photo-btn');
                const preview = document.createElement('img');
                
                preview.id = 'photo-preview';
                preview.src = URL.createObjectURL(optimizedBlob);
                previewContainer.prepend(preview);
                if (removeBtn) removeBtn.style.display = 'block';

            } catch (error) {
                console.error('Erro ao otimizar imagem:', error);
                utils.showToast('Erro ao processar a foto.', 'error');
                state.setCurrentTreePhoto(null);
                clearPhotoPreview();
            }
        });
    }

    const removePhotoBtn = document.getElementById('remove-photo-btn');
    if (removePhotoBtn) {
        removePhotoBtn.addEventListener('click', clearPhotoPreview);
    }
}

