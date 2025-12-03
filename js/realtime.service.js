/* js/realtime.service.js */

import { ApiService } from "./supabase-client.js";
import { addTree, updateTree, deleteTreeById } from "./state.js";
import { TableUI } from "./table.ui.js";
import * as mapUI from "./map.ui.js";
import * as utils from "./utils.js";
import { loadFromSupabaseSilent } from "./sync-features.js";
import { CoordinatesService } from "./coordinates.service.js";

export const RealtimeService = (() => {
  let subscription = null;
  const STORAGE_KEY = "realtime_sync_enabled";

  const handleInsert = (payload) => {
    console.log("[Realtime] INSERT recebido:", payload.new.id);
    utils.showToast(
      `Novo registro recebido: ${payload.new.nome || payload.new.especie}`,
      "info",
    );

    // Processar coordenadas usando CoordinatesService
    const coords = CoordinatesService.prepareFromDatabase(payload.new);

    // Adapta o payload para o formato local
    const newTree = {
      ...payload.new,
      ...coords, // Inclui coordX, coordY, latitude, longitude processados corretamente
      riskFactors: payload.new.riskfactors || [],
      targetCategory: payload.new.targetcategory,
      mitigation: payload.new.mitigation,
      altura: payload.new.altura,
    };

    addTree(newTree);
    TableUI.render();
    mapUI.updateMapData(true);
  };

  const handleUpdate = (payload) => {
    console.log("[Realtime] UPDATE recebido:", payload.new.id);
    utils.showToast(
      `Registro atualizado: ${payload.new.nome || payload.new.especie}`,
      "info",
    );

    // Processar coordenadas usando CoordinatesService
    const coords = CoordinatesService.prepareFromDatabase(payload.new);

    // Adapta o payload para o formato local
    const updatedTree = {
      ...payload.new,
      ...coords, // Inclui coordX, coordY, latitude, longitude processados corretamente
      riskFactors: payload.new.riskfactors || [],
      targetCategory: payload.new.targetcategory,
      mitigation: payload.new.mitigation,
      altura: payload.new.altura,
    };

    updateTree(updatedTree);
    TableUI.render();
    mapUI.updateMapData(true);
  };

  const handleDelete = (payload) => {
    console.log("[Realtime] DELETE recebido:", payload.old.id);
    utils.showToast(`Registro removido remotamente.`, "info");
    deleteTreeById(payload.old.id);
    TableUI.render();
    mapUI.updateMapData(true);
  };

  const enable = async (silent = false) => {
    const user = await ApiService.getUser();
    if (!user) return false;

    localStorage.setItem(STORAGE_KEY, "true");

    if (subscription) return true;

    try {
      subscription = ApiService.getRealtimeSubscription("trees", {
        INSERT: handleInsert,
        UPDATE: handleUpdate,
        DELETE: handleDelete,
      });

      if (subscription) {
        if (!silent)
          utils.showToast("Sincronização em tempo real ativada.", "success");
        return true;
      }
      return false;
    } catch (e) {
      console.error(e);
      if (!silent) utils.showToast("Falha ao ativar o tempo real.", "error");
      return false;
    }
  };

  const disable = async (silent = false) => {
    localStorage.setItem(STORAGE_KEY, "false");

    if (!subscription) return;

    try {
      await ApiService.removeRealtimeSubscription(subscription);
      subscription = null;
      if (!silent)
        utils.showToast("Sincronização em tempo real desativada.", "info");
    } catch (e) {
      console.error(e);
    }
  };

  /**
   * Chamado ao iniciar o app ou após login.
   * Recupera o estado persistido e ativa se necessário.
   */
  const init = async () => {
    const isEnabled = localStorage.getItem(STORAGE_KEY) === "true";
    if (isEnabled) {
      await enable(true);
    }
  };

  /**
   * Chamado imediatamente após o Login.
   * Força ativação e carrega dados.
   */
  const startAutoSync = async () => {
    // 1. Força persistência para TRUE
    localStorage.setItem(STORAGE_KEY, "true");

    // 2. Ativa o canal Realtime
    await enable(true);

    // 3. Carrega dados iniciais e retorna a promessa
    return loadFromSupabaseSilent();
  };

  return {
    enable,
    disable,
    init,
    startAutoSync,
    get isEnabled() {
      return localStorage.getItem(STORAGE_KEY) === "true";
    },
    get isSubscribed() {
      return !!subscription;
    },
  };
})();
