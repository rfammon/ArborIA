import { ApiService } from "./supabase-client.js";
import * as state from "./state.js";
import { applyTreeChanges } from "./state.js";
import { showDetailsModal, showConfirmModal } from "./modal.ui.js";
import { TableUI } from "./table.ui.js";
import * as mapUI from "./map.ui.js";
import * as utils from "./utils.js";

/**
 * Carrega dados do Supabase silenciosamente (sem modal), realizando um merge.
 * Ideal para sincronização automática ao logar.
 */
export async function loadFromSupabaseSilent() {
  utils.showToast("Sincronizando dados...", "info");

  const user = await ApiService.getUser();
  if (!user) return; // Silencioso se não logado

  try {
    const { data: trees, error } = await ApiService.getTrees();

    if (error) throw new Error(error.message);
    if (!trees || trees.length === 0) return;

    // Transformação de dados (mesma lógica do loadFromSupabase)
    const transformedTrees = trees.map((tree) => ({
      ...tree,
      // Coordenadas já vêm corretas do CoordinatesService.prepareFromDatabase
      // coordX e coordY já estão mapeados corretamente como easting/northing
      altura: tree.altura || null,
      riskFactors: tree.riskfactors || tree.riskFactors || [],
      targetCategory: tree.targetcategory || tree.targetCategory,
      mitigation: tree.mitigation,
      riskLevel: tree.risklevel || tree.riskLevel,
      residualRisk: tree.residualrisk || tree.residualRisk,
      utmZoneNum: tree.utmzonenum,
      utmZoneLetter: tree.utmzoneletter,
    }));

    // Merge automático
    applyTreeChanges(transformedTrees, "merge");
    TableUI.render();
    mapUI.updateMapData(true);

    utils.showToast("Dados sincronizados.", "success");
  } catch (e) {
    console.error("Erro na sincronização silenciosa:", e);
    // Não mostra erro para não interromper fluxo, ou mostra um toast discreto
  }
}

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
    const { data: trees, error } = await ApiService.getTrees();

    if (error) {
      throw new Error(error.message);
    }

    if (!trees || trees.length === 0) {
      utils.showToast("Nenhum dado de árvore encontrado na nuvem.", "info");
      return;
    }

    // [FIX] Transforma os dados do Supabase para o formato esperado pela UI local.
    // Mapeia snake_case (DB) para camelCase (App) e garante persistência de campos de risco.
    const transformedTrees = trees.map((tree) => ({
      ...tree,
      // Coordenadas já vêm corretas do CoordinatesService.prepareFromDatabase
      // coordX e coordY já estão mapeados corretamente como easting/northing
      // Dados Dendrométricos
      altura: tree.altura || null,
      // Mapeamento Explícito de Campos de Risco
      riskFactors: tree.riskfactors || tree.riskFactors || [], // Garante array
      targetCategory: tree.targetcategory || tree.targetCategory,
      mitigation: tree.mitigation,
      riskLevel: tree.risklevel || tree.riskLevel,
      residualRisk: tree.residualrisk || tree.residualRisk,
      utmZoneNum: tree.utmzonenum,
      utmZoneLetter: tree.utmzoneletter,
    }));

    utils.showToast(
      `Foram encontradas ${transformedTrees.length} árvores. Escolha uma opção.`,
      "success",
    );

    showDetailsModal(
      "Carregar Dados da Nuvem",
      `<p>Foram encontradas <strong>${transformedTrees.length}</strong> árvores no servidor. Como deseja proceder?</p>
             <ul>
                <li><strong>Mesclar:</strong> Adiciona as novas árvores e atualiza as existentes, mantendo as árvores locais que não estão no servidor.</li>
                <li><strong>Substituir:</strong> Apaga todos os dados locais e os substitui pelos dados do servidor.</li>
             </ul>`,
      [
        {
          text: "Mesclar",
          className: "btn btn-secondary",
          onClick: () => {
            applyTreeChanges(transformedTrees, "merge");
            TableUI.render();
            mapUI.updateMapData(true);
            utils.showToast("Dados mesclados com sucesso!", "success");
          },
        },
        {
          text: "Substituir",
          className: "btn btn-primary",
          onClick: () => {
            applyTreeChanges(transformedTrees, "replace");
            TableUI.render();
            mapUI.updateMapData(true);
            utils.showToast("Dados substituídos com sucesso!", "success");
          },
        },
      ],
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
        // Prepara os dados. A conversão de chaves para snake_case é feita pelo ApiService.upsertTrees
        // mas garantimos que as propriedades necessárias estejam presentes no objeto.
        const treesToUpsert = localTrees.map((tree) => {
          const { id, ...treeData } = tree;

          const payload = {
            ...treeData,
            // Assegura que propriedades vitais estejam no payload
            riskFactors: tree.riskFactors,
            targetCategory: tree.targetCategory,
            mitigation: tree.mitigation,
          };

          // Se ID for local, remove para que o Supabase crie um novo
          if (typeof id === "number" || String(id).startsWith("local_")) {
            return {
              ...payload,
              longitude: tree.coordX,
              latitude: tree.coordY,
            };
          }
          // Se ID for UUID, mantém para update
          return {
            ...tree,
            ...payload,
            longitude: tree.coordX,
            latitude: tree.coordY,
          };
        });

        const { data: upsertedTrees, error } =
          await ApiService.upsertTrees(treesToUpsert);

        if (error) {
          throw new Error(error.message);
        }

        // Atualiza estado local com os dados retornados (que agora têm UUIDs definitivos)
        // ApiService.upsertTrees já retorna os dados no formato correto
        if (upsertedTrees && upsertedTrees.length > 0) {
          applyTreeChanges(upsertedTrees, "merge");
          TableUI.render();
          mapUI.updateMapData(true);
        }

        utils.showToast(
          `${upsertedTrees.length} registros foram salvos com sucesso!`,
          "success",
        );
      } catch (e) {
        console.error("Erro ao salvar no Supabase:", e);
        utils.showToast(
          e.message || "Ocorreu um erro ao salvar os dados.",
          "error",
        );
      }
    },
  );
}
