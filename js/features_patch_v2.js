/**
 * ARBORIA 2.0 - FEATURES PATCH V2 (Fix Database Sync & CRUD & EXPORTS)
 * Refactored by Js Master
 */

import * as state from "./state.js";
import * as utils from "./utils.js";
import * as db from "./database.js";
import { TableUI } from "./table.ui.js";
import { ApiService } from "./supabase-client.js";
import { RealtimeService } from "./realtime.service.js";

// ============================================================
// LÓGICA DE RISCO (Risk Engine)
// ============================================================

let currentRiskAssessment = {
  targetCategory: null,
  mitigationAction: "nenhuma",
};

const riskProfile = {
  Baixo: { class: "risk-low" },
  Moderado: { class: "risk-medium" },
  Alto: { class: "risk-high" },
  Extremo: { class: "risk-extreme" },
};

function getFailureProb(score) {
  if (score >= 30) return "Iminente";
  if (score >= 20) return "Provável";
  if (score >= 10) return "Possível";
  return "Improvável";
}

function getImpactProb(targetVal) {
  const value = parseInt(targetVal, 10);
  const map = { 1: "Muito Baixo", 2: "Baixo", 3: "Médio", 4: "Alto" };
  return map[value] || "Muito Baixo";
}

function runTraqMatrices(failureProb, impactProb, targetCategory) {
  const impactProbMap = { "Muito Baixo": 0, Baixo: 1, Médio: 2, Alto: 3 };
  const impactIndex = impactProbMap[impactProb];

  const eventLikelihoodMatrix = {
    Improvável: [
      "Muito Improvável",
      "Muito Improvável",
      "Improvável",
      "Improvável",
    ],
    Possível: ["Muito Improvável", "Improvável", "Provável", "Provável"],
    Provável: ["Improvável", "Provável", "Muito Provável", "Muito Provável"],
    Iminente: [
      "Improvável",
      "Muito Provável",
      "Muito Provável",
      "Muito Provável",
    ],
  };

  const eventLikelihood =
    eventLikelihoodMatrix[failureProb] && impactIndex !== undefined
      ? eventLikelihoodMatrix[failureProb][impactIndex]
      : "Muito Improvável";

  const consequence =
    parseInt(targetCategory, 10) === 4 ? "Severa" : "Significante";
  const consequenceMap = { Mínima: 0, Menor: 1, Significante: 2, Severa: 3 };
  const consequenceIndex = consequenceMap[consequence];

  const riskRatingMatrix = {
    "Muito Provável": ["Moderado", "Alto", "Extremo", "Extremo"],
    Provável: ["Baixo", "Moderado", "Alto", "Extremo"],
    Improvável: ["Baixo", "Baixo", "Moderado", "Alto"],
    "Muito Improvável": ["Baixo", "Baixo", "Baixo", "Moderado"],
  };

  return riskRatingMatrix[eventLikelihood] && consequenceIndex !== undefined
    ? riskRatingMatrix[eventLikelihood][consequenceIndex]
    : "Baixo";
}

function getReducedFailureProb(failureProb) {
  const reductionMap = {
    Iminente: "Provável",
    Provável: "Possível",
    Possível: "Improvável",
    Improvável: "Improvável",
  };
  return reductionMap[failureProb] || "Improvável";
}

// ============================================================
// HELPERS (Sanitization & Extraction)
// ============================================================

const sanitizeCoordinate = (coordValue) => {
  if (coordValue && String(coordValue).toLowerCase() !== "n/a") {
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

// ============================================================
// FUNÇÕES PRINCIPAIS (CRUD)
// ============================================================

export async function handleAddTreeSubmit(event) {
  event.preventDefault();
  const form = event.target;

  try {
    // --- 1. DATA EXTRACTION & VALIDATION ---
    let totalScore = 0;
    form
      .querySelectorAll(".risk-checkbox:checked")
      .forEach((cb) => (totalScore += parseInt(cb.dataset.weight, 10)));
    const checkedRiskFactors = Array.from(
      form.querySelectorAll(".risk-checkbox"),
    ).map((cb) => (cb.checked ? 1 : 0));

    const desktopTargetInput = document.querySelector(
      'input[name="target_category_desktop"]:checked',
    );
    if (desktopTargetInput)
      currentRiskAssessment.targetCategory = desktopTargetInput.value;

    if (!currentRiskAssessment.targetCategory) {
      const mobileTargetInput = document.querySelector(
        'input[name="target_category"]:checked',
      );
      if (mobileTargetInput)
        currentRiskAssessment.targetCategory = mobileTargetInput.value;
    }

    if (currentRiskAssessment.targetCategory === null) {
      utils.showToast(
        "Selecione a 'Taxa de Ocupação do Alvo' antes de registrar.",
        "error",
      );
      return { success: false };
    }

    const especie = document.getElementById("risk-especie").value.trim();
    if (!especie) {
      utils.showToast("Nome da espécie é obrigatório.", "error");
      return { success: false };
    }

    // --- 2. RISK CALCULATION ENGINE ---
    const failureProb = getFailureProb(totalScore);
    const impactProb = getImpactProb(currentRiskAssessment.targetCategory);
    const initialRisk = runTraqMatrices(
      failureProb,
      impactProb,
      currentRiskAssessment.targetCategory,
    );

    let mitigationVal =
      document.getElementById("mitigation-action-desktop")?.value || "nenhuma";
    if (mitigationVal === "nenhuma" && currentRiskAssessment.mitigationAction) {
      mitigationVal = currentRiskAssessment.mitigationAction;
    }
    const mitigationMobile =
      document.getElementById("mitigation-action")?.value;
    if (mitigationMobile && mitigationMobile !== "nenhuma")
      mitigationVal = mitigationMobile;

    currentRiskAssessment.mitigationAction = mitigationVal;

    let residualRisk = initialRisk;
    if (currentRiskAssessment.mitigationAction !== "nenhuma") {
      const reducedFailureProb = getReducedFailureProb(failureProb);
      residualRisk = runTraqMatrices(
        reducedFailureProb,
        impactProb,
        currentRiskAssessment.targetCategory,
      );
    }

    const classificationClass = riskProfile[initialRisk]?.class || "risk-low";

    // --- 3. OBJECT CONSTRUCTION ---
    const editingId = state.editingTreeId;
    const mode = editingId === null ? "add" : "update";

    // Tenta encontrar dados existentes se for edição
    let existingTree = null;
    if (mode === "update") {
      existingTree = state.registeredTrees.find((t) => t.id === editingId);
    }

    let treeData = {
      id: editingId !== null ? editingId : undefined,
      data:
        document.getElementById("risk-data").value ||
        new Date().toISOString().split("T")[0],
      especie: especie,
      nome: especie,
      local: document.getElementById("risk-local").value || "N/A",
      coordX: sanitizeCoordinate(document.getElementById("risk-coord-x").value),
      coordY: sanitizeCoordinate(document.getElementById("risk-coord-y").value),
      utmZoneNum: state.lastUtmZone?.num || 0,
      utmZoneLetter: state.lastUtmZone?.letter || "Z",
      altura: document.getElementById("risk-altura").value || "0",
      dap: document.getElementById("risk-dap").value || "N/A",
      avaliador: document.getElementById("risk-avaliador").value || "N/A",
      observacoes: document.getElementById("risk-obs").value || "N/A",
      pontuacao: totalScore,
      riskFactors: checkedRiskFactors,

      riskLevel: initialRisk,
      residualRisk: residualRisk,
      mitigation: currentRiskAssessment.mitigationAction,
      targetCategory: currentRiskAssessment.targetCategory,
      risco: initialRisk,
      riscoClass: classificationClass,

      // Campos de Foto (inicialmente preserva o que tinha ou define defaults)
      hasPhoto: existingTree ? existingTree.hasPhoto : false,
      photoUrl: existingTree ? existingTree.photoUrl : null,
    };

    let supabaseId = treeData.id;
    let finalPhotoUrl = treeData.photoUrl;

    // --- 4. SERVER SYNC & ID GENERATION ---
    if (RealtimeService.isSubscribed) {
      utils.showToast(
        mode === "add" ? "Criando registro..." : "Atualizando registro...",
        "info",
      );

      // Para 'add', precisamos primeiro salvar para obter o ID (caso o banco gere)
      if (mode === "add") {
        const { data: supabaseData, error: supabaseError } =
          await ApiService.upsertTree(treeData);
        if (supabaseError) throw new Error(supabaseError.message);

        if (supabaseData && supabaseData.length > 0) {
          supabaseId = supabaseData[0].id;
          treeData.id = supabaseId;
        } else {
          throw new Error("Falha ao obter ID do Supabase.");
        }
      } else {
        // Update apenas inicia, mas vamos fazer o upsert final com a foto depois
        supabaseId = editingId;
      }
    } else {
      // Offline/Guest Mode
      if (mode === "add") {
        const maxId =
          state.registeredTrees.length > 0
            ? Math.max(...state.registeredTrees.map((t) => Number(t.id) || 0))
            : 0;
        supabaseId = maxId + 1;
        treeData.id = supabaseId;
      } else {
        supabaseId = editingId;
      }
    }

    // --- 5. PHOTO UPLOAD HANDLING ---
    // Se houver uma NOVA foto na memória (state.currentTreePhoto)
    if (state.currentTreePhoto && supabaseId) {
      try {
        utils.showToast("Enviando foto...", "info");
        const { data: uploadData, error: uploadError } =
          await ApiService.uploadImage(supabaseId, state.currentTreePhoto);

        if (uploadError) throw new Error(uploadError.message);

        if (uploadData?.fullUrl) {
          finalPhotoUrl = uploadData.fullUrl;
          utils.showToast("Foto enviada!", "success");

          // Salva no cache local (IndexedDB)
          await db.saveImageByUrl(finalPhotoUrl, state.currentTreePhoto);
        } else {
          throw new Error("Resposta de upload inválida.");
        }
      } catch (e) {
        console.error("Erro upload:", e);
        utils.showToast(`Falha na foto: ${e.message}`, "error");
      }
    }

    // Atualiza o objeto com a URL final (nova ou existente)
    treeData.photoUrl = finalPhotoUrl;
    treeData.hasPhoto = !!finalPhotoUrl;

    // --- 6. FINAL SYNC (Always Run to save photoUrl) ---
    if (RealtimeService.isSubscribed) {
      const { error: finalUpsertError } = await ApiService.upsertTree(treeData);
      if (finalUpsertError)
        console.warn("Erro no sync final da foto: " + finalUpsertError.message);
      else if (mode === "add")
        utils.showToast(`Registro ID: ${supabaseId} salvo.`, "success");
      else utils.showToast("Registro atualizado com sucesso.", "success");
    }

    // --- 7. LOCAL STATE UPDATE ---
    if (state.setLastEvaluatorName)
      state.setLastEvaluatorName(treeData.avaliador);

    let resultTree;
    if (mode === "add") {
      resultTree = { ...treeData };
      state.registeredTrees.push(resultTree);
    } else {
      const idx = state.registeredTrees.findIndex((t) => t.id === editingId);
      if (idx !== -1) {
        state.registeredTrees[idx] = { ...treeData };
      }
    }

    state.saveDataToStorage();
    state.setEditingTreeId(null);

    // Limpar formulário apenas em caso de SUCESSO
    form.reset();
    document
      .querySelectorAll('input[name^="target_category"]')
      .forEach((r) => (r.checked = false));
    const selects = ["mitigation-action-desktop", "mitigation-action"];
    selects.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "nenhuma";
    });

    currentRiskAssessment.targetCategory = null;
    currentRiskAssessment.mitigationAction = "nenhuma";

    const op = document.querySelector("#photo-preview-container img");
    if (op) op.remove();
    const rb = document.getElementById("remove-photo-btn");
    if (rb) rb.style.display = "none";
    state.setCurrentTreePhoto(null);

    const btn = document.getElementById("add-tree-btn");
    if (btn) btn.innerHTML = "Registrar Árvore";

    if (document.activeElement) document.activeElement.blur();

    TableUI.render();

    return { success: true, tree: resultTree, mode };
  } catch (error) {
    console.error("Critical Error in handleAddTreeSubmit:", error);
    utils.showToast(`Erro: ${error.message}`, "error");
    return { success: false };
  }
}

export async function handleDeleteTree(id) {
  if (!confirm("Tem certeza que deseja excluir esta árvore permanentemente?"))
    return false;

  console.log("[DEBUG handleDeleteTree] Iniciando deleção, ID:", id);
  console.log("[DEBUG handleDeleteTree] Estado antes da deleção:", {
    totalArvores: state.registeredTrees.length,
    realtimeAtivo: RealtimeService.isSubscribed,
  });

  try {
    // Deletar do servidor primeiro (se conectado)
    if (RealtimeService.isSubscribed) {
      console.log("[DEBUG handleDeleteTree] Deletando do servidor...");
      const { error } = await ApiService.deleteTree(id);
      if (error) {
        console.error("[DEBUG handleDeleteTree] Erro no servidor:", error);
        utils.showToast(
          "Erro ao excluir no servidor: " + error.message,
          "error",
        );
        return false;
      }
      console.log("[DEBUG handleDeleteTree] ✓ Deletado do servidor");
    }

    // Encontrar árvore local
    const t = state.registeredTrees.find(
      (tree) => String(tree.id) === String(id),
    );
    console.log(
      "[DEBUG handleDeleteTree] Árvore encontrada:",
      t ? t.especie : "NÃO ENCONTRADA",
    );

    // Deletar foto se existir
    if (t && t.photoUrl) {
      console.log("[DEBUG handleDeleteTree] Deletando foto...");
      await db.deleteImageByUrl(t.photoUrl);
    }

    // Remover do estado local
    const antesLength = state.registeredTrees.length;
    const n = state.registeredTrees.filter(
      (tree) => String(tree.id) !== String(id),
    );
    console.log("[DEBUG handleDeleteTree] Filtrando árvores:", {
      antes: antesLength,
      depois: n.length,
      removidos: antesLength - n.length,
    });

    state.setRegisteredTrees(n);
    state.saveDataToStorage();

    console.log("[DEBUG handleDeleteTree] ✓ Estado local atualizado");

    TableUI.render();
    utils.showToast("Árvore removida com sucesso.", "success");

    console.log("[DEBUG handleDeleteTree] ✓ Deleção completa");
    return true;
  } catch (error) {
    console.error("[DEBUG handleDeleteTree] ❌ ERRO:", error);
    utils.showToast("Erro ao excluir.", "error");
    return false;
  }
}

export async function handleEditTree(id) {
  const t = state.registeredTrees.find(
    (tree) => String(tree.id) === String(id),
  );
  if (!t) {
    utils.showToast(`Erro: Árvore ID ${id} não encontrada.`, "error");
    return null;
  }

  console.log("[DEBUG handleEditTree] Dados da árvore carregados:", {
    id: t.id,
    targetCategory: t.targetCategory,
    mitigation: t.mitigation,
    riskFactors: t.riskFactors,
    pontuacao: t.pontuacao,
  });

  state.setEditingTreeId(id);
  if (state.setLastUtmZone)
    state.setLastUtmZone(t.utmZoneNum || 0, t.utmZoneLetter || "Z");

  const setVal = (elemId, val) => {
    const el = document.getElementById(elemId);
    if (el) el.value = val !== undefined && val !== null ? val : "";
  };

  setVal("risk-data", t.data);
  setVal("risk-especie", t.especie);
  setVal("risk-local", t.local);
  setVal("risk-coord-x", t.coordX);
  setVal("risk-coord-y", t.coordY);
  setVal("risk-dap", t.dap);
  setVal("risk-altura", t.altura);
  setVal("risk-avaliador", t.avaliador);
  setVal("risk-obs", t.observacoes);

  // Mudar para a aba de registro ANTES de configurar checkboxes e radios
  const tabBtn = document.querySelector(
    '.sub-nav-btn[data-target="tab-content-register"]',
  );
  if (tabBtn) {
    tabBtn.click();
    // Aguardar um momento para a aba carregar os elementos
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Restaurar checkboxes de fatores de risco
  const checkboxes = document.querySelectorAll(".risk-checkbox");
  console.log(
    "[DEBUG handleEditTree] Checkboxes encontrados:",
    checkboxes.length,
  );

  checkboxes.forEach((cb) => (cb.checked = false));

  if (t.riskFactors && Array.isArray(t.riskFactors)) {
    console.log(
      "[DEBUG handleEditTree] Restaurando riskFactors:",
      t.riskFactors,
    );
    t.riskFactors.forEach((val, index) => {
      if (val === 1 && checkboxes[index]) {
        checkboxes[index].checked = true;
        console.log(`[DEBUG] Checkbox ${index} marcado`);
      }
    });
  } else {
    console.warn("[DEBUG handleEditTree] riskFactors inválido ou vazio");
  }

  // Restaurar taxa de ocupação do alvo
  console.log(
    "[DEBUG handleEditTree] Tentando restaurar targetCategory:",
    t.targetCategory,
  );

  if (t.targetCategory) {
    const mobileTarget = document.querySelector(
      `input[name="target_category"][value="${t.targetCategory}"]`,
    );
    const desktopTarget = document.querySelector(
      `input[name="target_category_desktop"][value="${t.targetCategory}"]`,
    );

    console.log("[DEBUG handleEditTree] Elementos encontrados:", {
      mobileTarget: !!mobileTarget,
      desktopTarget: !!desktopTarget,
    });

    if (mobileTarget) {
      mobileTarget.checked = true;
      console.log("[DEBUG] Mobile target marcado");
    }
    if (desktopTarget) {
      desktopTarget.checked = true;
      console.log("[DEBUG] Desktop target marcado");
    }
    currentRiskAssessment.targetCategory = t.targetCategory;
  } else {
    console.warn("[DEBUG handleEditTree] targetCategory não existe no objeto");
    currentRiskAssessment.targetCategory = null;
  }

  // Restaurar ação de mitigação
  console.log(
    "[DEBUG handleEditTree] Tentando restaurar mitigation:",
    t.mitigation,
  );

  if (t.mitigation) {
    const mitMobile = document.getElementById("mitigation-action");
    const mitDesktop = document.getElementById("mitigation-action-desktop");

    console.log("[DEBUG handleEditTree] Elementos de mitigação encontrados:", {
      mitMobile: !!mitMobile,
      mitDesktop: !!mitDesktop,
    });

    if (mitMobile) {
      mitMobile.value = t.mitigation;
      console.log("[DEBUG] Mobile mitigation configurado:", mitMobile.value);
    }
    if (mitDesktop) {
      mitDesktop.value = t.mitigation;
      console.log("[DEBUG] Desktop mitigation configurado:", mitDesktop.value);
    }
    currentRiskAssessment.mitigationAction = t.mitigation;
  } else {
    const mitMobile = document.getElementById("mitigation-action");
    const mitDesktop = document.getElementById("mitigation-action-desktop");
    if (mitMobile) mitMobile.value = "nenhuma";
    if (mitDesktop) mitDesktop.value = "nenhuma";
    currentRiskAssessment.mitigationAction = "nenhuma";
  }

  console.log(
    "[DEBUG handleEditTree] Estado final do currentRiskAssessment:",
    currentRiskAssessment,
  );

  // Não chamar clearPhotoPreview pois ele limpa os checkboxes!
  // Limpar apenas a foto preview
  const op = document.querySelector("#photo-preview-container img");
  if (op) {
    try {
      URL.revokeObjectURL(op.src);
    } catch (e) {}
    op.remove();
  }
  const rb = document.getElementById("remove-photo-btn");
  if (rb) rb.style.display = "none";

  if (t.photoUrl) {
    const previewContainer = document.getElementById("photo-preview-container");
    const removeBtn = document.getElementById("remove-photo-btn");
    const preview = document.createElement("img");
    preview.id = "photo-preview";

    try {
      const cachedBlob = await db.getImageByUrl(t.photoUrl);
      if (cachedBlob) {
        preview.src = URL.createObjectURL(cachedBlob);
      } else {
        preview.src = t.photoUrl;
      }

      if (previewContainer) previewContainer.prepend(preview);
      if (removeBtn) removeBtn.style.display = "block";
    } catch (e) {
      console.error("Erro ao carregar preview da foto:", e);
      preview.src = t.photoUrl;
      if (previewContainer) previewContainer.prepend(preview);
    }
  }

  const submitBtn = document.getElementById("add-tree-btn");
  if (submitBtn) {
    submitBtn.innerHTML = `💾 Salvar Alterações`;
  }

  utils.showToast(`Editando árvore: ${t.especie}`, "info");

  return t;
}

export function clearPhotoPreview() {
  const pc = document.getElementById("photo-preview-container");
  const rb = document.getElementById("remove-photo-btn");
  const op = document.querySelector("#photo-preview-container img");

  if (op && pc) {
    try {
      URL.revokeObjectURL(op.src);
    } catch (e) {}
    op.remove();
  }
  if (rb) rb.style.display = "none";

  if (state.setCurrentTreePhoto) state.setCurrentTreePhoto(null);

  const pi = document.getElementById("tree-photo-input");
  if (pi) pi.value = null;

  // NÃO limpar checkboxes e radios aqui - isso deve ser feito apenas após submit bem-sucedido
  // document.querySelectorAll(".risk-checkbox").forEach((cb) => (cb.checked = false));
  // document.querySelectorAll('input[name="target_category_desktop"]').forEach((radio) => (radio.checked = false));
  // currentRiskAssessment = { targetCategory: null, mitigationAction: "nenhuma" };

  TableUI.render();
}

export async function handleGetGPS() {
  const gpsStatus = document.getElementById("gps-status");
  const coordXField = document.getElementById("risk-coord-x");
  const coordYField = document.getElementById("risk-coord-y");
  const getGpsBtn = document.getElementById("get-gps-btn");

  if (!navigator.geolocation) {
    if (gpsStatus) {
      gpsStatus.textContent = "Sem GPS disponível.";
      gpsStatus.className = "instruction-text text-center error";
    }
    return;
  }

  const TIMEOUT_MS = 20000;
  const options = { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 };
  let watchId = null;
  let bestAccuracy = Infinity;
  let timeoutId = null;

  if (getGpsBtn) {
    getGpsBtn.disabled = true;
    getGpsBtn.innerHTML = "Buscando GPS...";
  }
  if (gpsStatus) gpsStatus.innerHTML = "Aguardando sinal < 5m...";

  const cleanup = () => {
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    if (timeoutId !== null) clearTimeout(timeoutId);
    const btn = document.getElementById("get-gps-btn");
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = "Capturar GPS Preciso";
    }
  };

  timeoutId = setTimeout(() => {
    cleanup();
    utils.showToast(
      `Precisão < 5m não atingida em 20s. Melhor: ${bestAccuracy.toFixed(1)}m`,
      "error",
    );
    if (gpsStatus)
      gpsStatus.innerHTML = `Falha. Melhor precisão: ${bestAccuracy.toFixed(1)}m`;
  }, TIMEOUT_MS);

  const processCoord = (coords) => {
    const utmCoords = utils.convertLatLonToUtm(
      coords.latitude,
      coords.longitude,
    );
    if (utmCoords) {
      if (coordXField) coordXField.value = utmCoords.easting.toFixed(0);
      if (coordYField) coordYField.value = utmCoords.northing.toFixed(0);

      if (state.setLastUtmZone)
        state.setLastUtmZone(utmCoords.zoneNum, utmCoords.zoneLetter);

      const dz = document.getElementById("default-utm-zone");
      if (dz) dz.value = `${utmCoords.zoneNum}${utmCoords.zoneLetter}`;

      const gs = document.getElementById("gps-status");
      if (gs) {
        gs.innerHTML = `Precisão: <span style="color:var(--color-forest)">±${coords.accuracy.toFixed(1)}m</span>`;
      }
      utils.showToast("Coordenadas capturadas com sucesso!", "success");
    } else {
      utils.showToast("Erro na conversão de coordenadas UTM.", "error");
    }
    cleanup();
  };

  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      bestAccuracy = Math.min(bestAccuracy, pos.coords.accuracy);
      if (gpsStatus) {
        gpsStatus.innerHTML = `Aguardando... (precisão: ±${pos.coords.accuracy.toFixed(1)}m)`;
      }
      if (pos.coords.accuracy < 5) {
        processCoord(pos.coords);
      }
    },
    (err) => {
      cleanup();
      utils.showToast("Erro no GPS: " + err.message, "error");
    },
    options,
  );
}

export function handleTableFilter() {
  const fi = document.getElementById("table-filter-input");
  if (!fi) return;
  const ft = fi.value.toLowerCase();
  document
    .querySelectorAll("#summary-table-container tbody tr")
    .forEach((r) => {
      r.style.display = r.textContent.toLowerCase().includes(ft) ? "" : "none";
    });
}

export function handleSort(sortKey) {
  if (state.sortState.key === sortKey)
    state.setSortState(
      sortKey,
      state.sortState.direction === "asc" ? "desc" : "asc",
    );
  else state.setSortState(sortKey, "asc");
}

export function getSortValue(tree, key) {
  const numKeys = [
    "id",
    "dap",
    "altura",
    "pontuacao",
    "coordX",
    "coordY",
    "utmZoneNum",
  ];
  if (numKeys.includes(key)) return parseFloat(tree[key]) || 0;
  return (tree[key] || "").toLowerCase();
}

export function convertToLatLon(tree) {
  if (tree.coordX === "N/A" || tree.coordY === "N/A") return null;
  if (typeof window.proj4 === "undefined") return null;

  const e = parseFloat(tree.coordX);
  const n = parseFloat(tree.coordY);
  const zn = tree.utmZoneNum || 23;
  const hemi = "+south";
  const def = `+proj=utm +zone=${zn} ${hemi} +datum=WGS84 +units=m +no_defs`;

  try {
    const ll = window.proj4(def, "EPSG:4326", [e, n]);
    return [ll[1], ll[0]];
  } catch (e) {
    return null;
  }
}

export function handleZoomToPoint(id) {
  const t = state.registeredTrees.find((tr) => tr.id === id);
  if (!t) return;

  const latLonCoords = convertToLatLon(t);
  if (!latLonCoords) {
    utils.showToast("Coordenadas inválidas para esta árvore.", "error");
    return;
  }

  state.setZoomTargetCoords(latLonCoords);
  state.setHighlightTargetId(id);
  state.setOpenInfoBoxId(id);

  document
    .querySelector('.sub-nav-btn[data-target="tab-content-mapa"]')
    .click();
}

export function handleMapMarkerClick(id) {
  state.setHighlightTargetId(id);
  document
    .querySelector('.sub-nav-btn[data-target="tab-content-summary"]')
    .click();
  setTimeout(() => {
    const row = document.getElementById(`row-${id}`);
    if (row) {
      row.scrollIntoView({ behavior: "smooth", block: "center" });
      row.classList.add("glow-effect");
      setTimeout(() => row.classList.remove("glow-effect"), 1500);
    }
  }, 300);
}

function getCSVData() {
  if (state.registeredTrees.length === 0) return null;
  const headers = [
    "ID",
    "Data",
    "Especie",
    "CoordX",
    "CoordY",
    "ZonaN",
    "ZonaL",
    "DAP",
    "Altura",
    "Local",
    "Avaliador",
    "Pontos",
    "Risco_Inicial",
    "Risco_Residual",
    "Acao_Mitigadora",
    "Obs",
    "Fatores",
    "Foto",
  ];
  let csv = "\\uFEFF" + headers.join(";") + "\\n";
  state.registeredTrees.forEach((t) => {
    const c = (s) => (s || "").toString().replace(/[\\n;]/g, " ");
    const rf = (t.riskFactors || []).join(",");
    const r = [
      t.id,
      t.data,
      c(t.especie),
      t.coordX,
      t.coordY,
      t.utmZoneNum,
      t.utmZoneLetter,
      t.dap,
      t.altura,
      c(t.local),
      c(t.avaliador),
      t.pontuacao,
      t.riskLevel,
      t.residualRisk,
      t.mitigation,
      c(t.observacoes),
      rf,
      t.hasPhoto ? "Sim" : "Nao",
    ];
    csv += r.join(";") + "\\n";
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
  const body = `Segue o laudo gerado pelo aplicativo ArborIA.\\n\\n${csvData}`;
  const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const link = document.createElement("a");
  link.href = mailtoLink;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportActionZip() {
  if (typeof JSZip === "undefined" || state.registeredTrees.length === 0)
    return;

  const zipStatus = document.getElementById("zip-status");
  if (zipStatus) zipStatus.style.display = "flex";

  try {
    const zip = new JSZip();
    const csv = getCSVData();
    if (csv) zip.file("manifesto_dados_traq.csv", csv);

    db.getAllImagesFromDB().then((images) => {
      if (images.length > 0) {
        const imgFolder = zip.folder("images");
        images.forEach((img) => {
          const t = state.registeredTrees.find((x) => x.id === img.id);
          if (t && t.hasPhoto) {
            let ext = img.imageBlob.type.includes("png") ? "png" : "jpg";
            imgFolder.file(`tree_id_${t.id}.${ext}`, img.imageBlob);
          }
        });
      }
      zip.generateAsync({ type: "blob" }).then((blob) => {
        utils.downloadBlob(
          blob,
          `Backup_ArborIA_TRAQ_${new Date().toISOString().slice(0, 10)}.zip`,
        );
        if (zipStatus) zipStatus.style.display = "none";
      });
    });
  } catch (e) {
    if (zipStatus) zipStatus.style.display = "none";
  }
}

export async function handleImportZip(event) {
  if (typeof JSZip === "undefined") return;
  const file = event.target.files[0];
  if (!file) return;

  const zipStatus = document.getElementById("zip-status");
  if (zipStatus) zipStatus.style.display = "flex";

  try {
    const zip = await JSZip.loadAsync(file);

    let csvFile = zip.file("manifesto_dados_traq.csv");
    let isTraqFormat = true;

    if (!csvFile) {
      csvFile = zip.file("manifesto_dados.csv");
      isTraqFormat = false;
    }

    if (!csvFile) {
      const csvFiles = zip.file(/.*\.csv$/);
      if (csvFiles.length > 0) {
        csvFile = csvFiles[0];
        isTraqFormat = csvFile.name.toLowerCase().includes("traq");
      } else {
        throw new Error("Arquivo CSV não encontrado no ZIP.");
      }
    }

    const csvContent = await csvFile.async("string");
    const lines = csvContent.split("\\n").filter((l) => l.trim() !== "");
    const headers = lines[0]
      .replace(/^\\uFEFF/, "")
      .split(";")
      .map((h) => h.trim());

    if (!isTraqFormat && headers.includes("Risco_Inicial")) {
      isTraqFormat = true;
    }

    let newTrees = [...state.registeredTrees];
    let maxId =
      newTrees.length > 0 ? Math.max(...newTrees.map((t) => t.id)) : 0;

    const riskProfile = {
      Baixo: { class: "risk-low" },
      Moderado: { class: "risk-medium" },
      Alto: { class: "risk-high" },
      Extremo: { class: "risk-extreme" },
    };

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(";");
      if (row.length < 5) continue;

      const newId = ++maxId;
      let tree;

      if (isTraqFormat) {
        const dataMap = headers.reduce((obj, header, index) => {
          obj[header] = row[index];
          return obj;
        }, {});

        tree = {
          id: newId,
          data: dataMap["Data"],
          especie: dataMap["Especie"],
          local: dataMap["Local"],
          coordX: dataMap["CoordX"],
          coordY: dataMap["CoordY"],
          utmZoneNum: parseInt(dataMap["ZonaN"]) || 0,
          utmZoneLetter: dataMap["ZonaL"],
          dap: dataMap["DAP"],
          altura: dataMap["Altura"],
          avaliador: dataMap["Avaliador"],
          observacoes: dataMap["Obs"],
          pontuacao:
            parseInt(dataMap["Pontos_Checklist"] || dataMap["Pontos"]) || 0,
          riskFactors: (dataMap["Fatores_IDs"] || dataMap["Fatores"] || "")
            .split(",")
            .map(Number),
          hasPhoto:
            (dataMap["Tem_Foto"] || dataMap["Foto"] || "")
              .trim()
              .toLowerCase() === "sim",
          targetType: dataMap["Alvo_Tipo"] || "Não Informado",
          failureProb: dataMap["Prob_Falha"] || "Não Avaliado",
          riskLevel: dataMap["Risco_Inicial"] || "Baixo",
          residualRisk: dataMap["Risco_Residual"] || "Baixo",
          mitigation: dataMap["Mitigacao"] || "nenhuma",
          risco: dataMap["Risco_Inicial"] || "Baixo",
          riscoClass: (
            riskProfile[dataMap["Risco_Inicial"]] || { class: "risk-low" }
          ).class,
        };
      } else {
        const pontuacao = parseInt(row[11]) || 0;
        let riskLevel = "Baixo";
        let riskClass = "risk-low";
        if (pontuacao >= 20) {
          riskLevel = "Alto";
          riskClass = "risk-high";
        } else if (pontuacao >= 10) {
          riskLevel = "Moderado";
          riskClass = "risk-medium";
        }

        tree = {
          id: newId,
          data: row[1],
          especie: row[2],
          local: row[9],
          coordX: row[3],
          coordY: row[4],
          utmZoneNum: parseInt(row[5]) || 0,
          utmZoneLetter: row[6],
          dap: row[7],
          altura: row[8],
          avaliador: row[10],
          observacoes: row[13],
          pontuacao: pontuacao,
          riskFactors: (row[14] || "").split(",").map(Number),
          hasPhoto: (row[15] || "").trim().toLowerCase() === "sim",
          targetType: "Legado",
          failureProb: "Não Avaliado",
          riskLevel: riskLevel,
          residualRisk: riskLevel,
          mitigation: "nenhuma",
          risco: riskLevel,
          riscoClass: riskClass,
        };
      }

      if (tree.hasPhoto) {
        const oldId = isTraqFormat
          ? headers.includes("ID")
            ? row[headers.indexOf("ID")]
            : row[0]
          : row[0];
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

    const u = await import("./utils.js");
    u.showToast("Importação TRAQ concluída!", "success");
  } catch (e) {
    console.error(e);
    const u = await import("./utils.js");
    u.showToast("Erro crítico na importação.", "error");
  } finally {
    if (zipStatus) zipStatus.style.display = "none";
    event.target.value = null;
  }
}

export function initChecklistFlashCard() {
  console.log("Checklist Flash Card Init");
}

/**
 * Handle Clear All Export (explicitly added to solve SyntaxError)
 */
export async function handleClearAll() {
  state.setRegisteredTrees([]);
  state.saveDataToStorage();
  try {
    if (db && typeof db.clearAllImages === "function")
      await db.clearAllImages();
  } catch (e) {
    console.warn("Could not clear ImageDB:", e);
  }
  utils.showToast("Todos os dados locais foram apagados.", "success");
  // Force UI refresh
  TableUI.render();
}
