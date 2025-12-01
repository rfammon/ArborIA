/* js/realtime.service.js */

import { ApiService } from './supabase-client.js';
import { addTree, updateTree, deleteTreeById } from './state.js';
import { TableUI } from './table.ui.js';
import * as mapUI from './map.ui.js';
import * as utils from './utils.js';

export const RealtimeService = (() => {
    let subscription = null;

    const handleInsert = (payload) => {
        utils.showToast(`Novo registro recebido: ${payload.new.especie}`, 'info');
        addTree(payload.new);
        TableUI.render();
        mapUI.updateMapData(true);
    };

    const handleUpdate = (payload) => {
        utils.showToast(`Registro atualizado: ${payload.new.especie}`, 'info');
        updateTree(payload.new);
        TableUI.render();
        mapUI.updateMapData(true);
    };

    const handleDelete = (payload) => {
        utils.showToast(`Registro removido.`, 'info');
        deleteTreeById(payload.old.id);
        TableUI.render();
        mapUI.updateMapData(true);
    };

    const subscribe = async () => {
        const user = await ApiService.getUser();
        if (!user) {
            utils.showToast("Usuário não autenticado para tempo real.", "error");
            return false;
        }

        if (subscription) {
            return true; // Already subscribed
        }

        try {
            subscription = ApiService.getRealtimeSubscription('trees', {
                'INSERT': handleInsert,
                'UPDATE': handleUpdate,
                'DELETE': handleDelete
            });

            if (subscription) {
                utils.showToast("Sincronização em tempo real ativada.", "success");
                return true;
            }
            return false;
        } catch (e) {
            utils.showToast("Falha ao ativar o tempo real.", "error");
            return false;
        }
    };

    const unsubscribe = async () => {
        if (!subscription) return;
        try {
            await ApiService.removeRealtimeSubscription(subscription);
            subscription = null;
            utils.showToast("Sincronização em tempo real desativada.", "info");
        } catch (e) {
            utils.showToast("Erro ao desativar o tempo real.", "error");
        }
    };

    return {
        subscribe,
        unsubscribe,
        get isSubscribed() { return !!subscription; }
    };
})();
