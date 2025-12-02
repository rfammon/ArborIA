/**
 * ARBORIA 2.0 - FEATURES PATCH (Fix Database Sync & CRUD)
 * Patch para corrigir problemas de ID na edição e exclusão.
 */

import * as state from './state.js';
import * as utils from './utils.js';
import * as db from './database.js';
import { TableUI } from './table.ui.js';
import { ApiService } from './supabase-client.js';
import { RealtimeService } from './realtime.service.js';

// ============================================================ 
// LÓGICA DE RISCO (Copiada para garantir escopo local no patch)
// ============================================================ 

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

function getFailureProb(score) {
    if (score >= 30) return 'Iminente';
    if (score >= 20) return 'Provável';
    if (score >= 10) return 'Possível';
    return 'Improvável';
}

function getImpactProb(targetVal) {
    const value = parseInt(targetVal, 10);
    if (value === 1) return 'Muito Baixo';
    if (value === 2) return 'Baixo';
    if (value === 3) return 'Médio';
    if (value === 4) return 'Alto';
    return 'Muito Baixo';
}

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
// FUNÇÕES CORRIGIDAS (handleAddTreeSubmit & handleDeleteTree)
// ============================================================ 

export async function handleAddTreeSubmit(event) {
  event.preventDefault();
  const form = event.target;
  
  let totalScore = 0;
  form.querySelectorAll('.risk-checkbox:checked').forEach(cb => totalScore += parseInt(cb.dataset.weight, 10));
  const checkedRiskFactors = Array.from(form.querySelectorAll('.risk-checkbox')).map(cb => cb.checked ? 1 : 0);
  
  const desktopTargetInput = document.querySelector('input[name="target_category_desktop"]:checked');
  if (desktopTargetInput) {
      currentRiskAssessment.targetCategory = desktopTargetInput.value;
  }
  // Tenta pegar do form mobile se não achou no desktop
  if (!currentRiskAssessment.targetCategory) {
       const mobileTargetInput = document.querySelector('input[name="target_category"]:checked');
       if (mobileTargetInput) currentRiskAssessment.targetCategory = mobileTargetInput.value;
  }

  if (currentRiskAssessment.targetCategory === null) {
      utils.showToast("Selecione a 'Taxa de Ocupação do Alvo' antes de registrar.", "error");
      return { success: false };
  }

  const failureProb = getFailureProb(totalScore);
  const impactProb = getImpactProb(currentRiskAssessment.targetCategory);
  const initialRisk = runTraqMatrices(failureProb, impactProb, currentRiskAssessment.targetCategory);

  let mitigationVal = document.getElementById('mitigation-action-desktop')?.value || 'nenhuma';
  if (mitigationVal === 'nenhuma' && currentRiskAssessment.mitigationAction) {
      mitigationVal = currentRiskAssessment.mitigationAction;
  }
  let mitigationMobile = document.getElementById('mitigation-action')?.value;
  if (mitigationMobile && mitigationMobile !== 'nenhuma') mitigationVal = mitigationMobile;

  currentRiskAssessment.mitigationAction = mitigationVal;

  let residualRisk = initialRisk;
  if (currentRiskAssessment.mitigationAction !== 'nenhuma') {
      const reducedFailureProb = getReducedFailureProb(failureProb);
      residualRisk = runTraqMatrices(reducedFailureProb, impactProb, currentRiskAssessment.targetCategory);
  }

  const classificationClass = riskProfile[initialRisk] ? riskProfile[initialRisk].class : 'risk-low';
  const especie = document.getElementById('risk-especie').value.trim();
  if (!especie) { utils.showToast("Nome da espécie é obrigatório.", 'error'); return { success: false }; }

  // Numeric Overflow Fix
  const sanitizeCoordinate = (coordValue) => {
    if (coordValue && coordValue.toLowerCase() !== 'n/a') {
        let num = parseFloat(coordValue);
        if (!isNaN(num)) {
            num = parseFloat(num.toFixed(6));
            if (Math.abs(num) >= 10000000) {
                num = num > 0 ? 999.999999 : -999.999999;
            }
            return num;
        }
    }
    return coordValue;
  };

  const coordX_sanitized = sanitizeCoordinate(document.getElementById('risk-coord-x').value);
  const coordY_sanitized = sanitizeCoordinate(document.getElementById('risk-coord-y').value);

  // [CORREÇÃO CRÍTICA] Captura ID antes
  const editingId = state.editingTreeId;

  const treeData = {
    id: editingId !== null ? editingId : undefined, // Inclui ID se editando
    
    data: document.getElementById('risk-data').value || new Date().toISOString().split('T')[0],
    especie: especie,
    nome: especie,
    local: document.getElementById('risk-local').value || 'N/A',
    coordX: coordX_sanitized,
    coordY: coordY_sanitized,
    utmZoneNum: (state.lastUtmZone && state.lastUtmZone.num) ? state.lastUtmZone.num : 0,
    utmZoneLetter: (state.lastUtmZone && state.lastUtmZone.letter) ? state.lastUtmZone.letter : 'Z',
    
    // [FIX] Inclusão correta do campo altura
    altura: document.getElementById('risk-altura').value || '0',
    dap: document.getElementById('risk-dap').value || 'N/A',
    
    avaliador: document.getElementById('risk-avaliador').value || 'N/A',
    observacoes: document.getElementById('risk-obs').value || 'N/A',
    pontuacao: totalScore,
    riskFactors: checkedRiskFactors,
    hasPhoto: (state.currentTreePhoto !== null),
    riskLevel: initialRisk,
    residualRisk: residualRisk,
    mitigation: currentRiskAssessment.mitigationAction,
    targetCategory: currentRiskAssessment.targetCategory,
    risco: initialRisk,
    riscoClass: classificationClass,
  };

  // --- SUPABASE SYNC ---
  let supabaseId = null;

  if (RealtimeService.isSubscribed) {
    try {
        const { data: supabaseData, error: supabaseError } = await ApiService.upsertTree(treeData);
        if (supabaseError) {
            throw new Error(supabaseError.message);
        }
        utils.showToast("Sincronizado com o servidor.", "success");
        if (supabaseData && supabaseData.length > 0) {
            supabaseId = supabaseData[0].id;
            treeData.id_supabase = supabaseId;
        }
    } catch (e) {
        console.error("Erro Supabase:", e);
        utils.showToast("Falha ao sincronizar. Salvando localmente.", "error");
    }
  }

  if(state.setLastEvaluatorName) state.setLastEvaluatorName(treeData.avaliador);
  
  let resultTree;
  let mode = 'add';

  if (state.editingTreeId === null) {
    const newTreeId = state.registeredTrees.length > 0 
        ? (Math.max(...state.registeredTrees.map(t => Number(t.id) || 0)) + 1) 
        : 1;

    resultTree = { ...treeData, id: supabaseId || newTreeId }; 
    
    if (resultTree.hasPhoto) db.saveImageToDB(resultTree.id, state.currentTreePhoto);
    state.registeredTrees.push(resultTree);
    utils.showToast(`Árvore salva! (ID: ${resultTree.id})`, 'success');
  } else {
    mode = 'update';
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
    utils.showToast(`Atualizado com sucesso!`, 'success');
  }

  state.saveDataToStorage();
  state.setEditingTreeId(null);
  form.reset();
  
  // Limpa Preview
  const pc = document.getElementById('photo-preview-container');
  const op = document.querySelector('#photo-preview-container img');
  if (op && pc) op.remove();
  const rb = document.getElementById('remove-photo-btn');
  if(rb) rb.style.display = 'none';
  state.setCurrentTreePhoto(null);
  
  document.getElementById('add-tree-btn').innerHTML = 'Registrar Árvore';
  if(document.activeElement) document.activeElement.blur();

  TableUI.render();
  return { success: true, tree: resultTree, mode: mode };
}

export async function handleDeleteTree(id) {
  // 1. Supabase Delete
  if (RealtimeService.isSubscribed) {
      utils.showToast("Excluindo do servidor...", "info");
      const { error } = await ApiService.deleteTree(id);
      if (error) {
          console.error("Erro delete Supabase:", error);
          utils.showToast("Erro ao excluir no servidor.", "error");
      } else {
          utils.showToast("Excluído do servidor.", "success");
      }
  }

  // 2. Local Delete
  const t = state.registeredTrees.find(tree => tree.id === id);
  if (t && t.hasPhoto) db.deleteImageFromDB(id);
  
  const n = state.registeredTrees.filter(tree => tree.id !== id);
  state.setRegisteredTrees(n); 
  state.saveDataToStorage();
  TableUI.render();
  
  utils.showToast(`Removido localmente.`, 'info'); 
  return true;
}
