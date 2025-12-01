import { ApiService } from './supabase-client.js';
import * as state from './state.js';
import { applyTreeChanges } from './state.js';
import { showDetailsModal, showConfirmModal } from './modal.ui.js';
import { TableUI } from './table.ui.js';
import * as mapUI from './map.ui.js';
import * as utils from './utils.js';

/**
 * Carrega os dados do Supabase e oferece opções de mesclagem ou substituição.
 */
export async function loadFromSupabase() {
    utils.showToast("Carregando dados da nuvem...", "info");

    const user = await ApiService.getUser();
    if (!user) {
        utils.showToast("Você precisa estar logado para carregar dados.", "error");
        return;
    }

    try {
        // Corrected to use the right function name from ApiService
        const { data: trees, error } = await ApiService.getTrees();

        if (error) {
            throw new Error(error.message);
        }

        if (!trees || trees.length === 0) {
            utils.showToast("Nenhum dado de árvore encontrado na nuvem.", "info");
            return;
        }

        utils.showToast(`Foram encontradas ${trees.length} árvores. Escolha uma opção.`, "success");

        showDetailsModal(
            'Carregar Dados da Nuvem',
            `<p>Foram encontradas <strong>${trees.length}</strong> árvores no servidor. Como deseja proceder?</p>
             <ul>
                <li><strong>Mesclar:</strong> Adiciona as novas árvores e atualiza as existentes, mantendo as árvores locais que não estão no servidor.</li>
                <li><strong>Substituir:</strong> Apaga todos os dados locais e os substitui pelos dados do servidor.</li>
             </ul>`,
            [
                {
                    text: 'Mesclar',
                    className: 'btn btn-secondary',
                    onClick: () => {
                        applyTreeChanges(trees, 'merge');
                        TableUI.render();
                        mapUI.updateMapData(true);
                        utils.showToast('Dados mesclados com sucesso!', 'success');
                    }
                },
                {
                    text: 'Substituir',
                    className: 'btn btn-primary',
                    onClick: () => {
                        applyTreeChanges(trees, 'replace');
                        TableUI.render();
                        mapUI.updateMapData(true);
                        utils.showToast('Dados substituídos com sucesso!', 'success');
                    }
                }
            ]
        );

    } catch (e) {
        console.error("Erro ao carregar do Supabase:", e);
        utils.showToast("Falha ao buscar dados da nuvem.", "error");
    }
}

/**
 * Salva todos os dados locais no Supabase.
 */
export async function saveToSupabase() {
    utils.showToast("Preparando para salvar na nuvem...", "info");

    const user = await ApiService.getUser();
    if (!user) {
        utils.showToast("Você precisa estar logado para salvar os dados.", "error");
        return;
    }

    const localTrees = state.registeredTrees;
    if (!localTrees || localTrees.length === 0) {
        utils.showToast("Nenhuma árvore local para salvar.", "info");
        return;
    }

    showConfirmModal(
        `Salvar ${localTrees.length} árvores na nuvem?`,
        "Isso enviará seus dados locais para o servidor. Registros existentes com o mesmo ID serão atualizados.",
        async () => {
            utils.showToast("Enviando dados... Por favor, aguarde.", "info");
            try {
                const upsertPromises = localTrees.map(tree => ApiService.upsertTree(tree));
                const results = await Promise.all(upsertPromises);

                const errors = results.filter(res => res.error);

                if (errors.length > 0) {
                    throw new Error(`Falha ao salvar ${errors.length} registros. Primeira falha: ${errors[0].error.message}`);
                }

                utils.showToast(`${results.length} registros foram salvos com sucesso!`, "success");
            } catch (e) {
                console.error("Erro ao salvar no Supabase:", e);
                utils.showToast(e.message || "Ocorreu um erro ao salvar os dados.", "error");
            }
        }
    );
}
