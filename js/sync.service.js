import { ApiService } from './supabase-client.js';

// SERVIÇO DE SINCRONIZAÇÃO
// Responsável por manter os dados locais (Browser) e remotos (Supabase) em harmonia.

const SYNC_KEY = 'arboria_last_sync_time';

// Função auxiliar para sanitizar campos numéricos
// Garante que o valor se encaixe em NUMERIC(9,6) (max 3 inteiros, 6 decimais)
function sanitizeNumericField(value) {
    if (typeof value === 'number') {
        // Arredonda para 6 casas decimais e garante que o valor absoluto é < 1000
        const sanitized = parseFloat(value.toFixed(6));
        if (Math.abs(sanitized) < 1000) {
            return sanitized;
        } else {
            console.warn(`⚠️ Valor numérico ${value} excede o limite (max 999.999999). Será retornado como null.`);
            return null; // Ou um valor padrão seguro, dependendo do requisito
        }
    }
    // Tenta converter strings para número se for o caso
    if (typeof value === 'string' && !isNaN(parseFloat(value)) && isFinite(value)) {
        const numValue = parseFloat(value);
        const sanitized = parseFloat(numValue.toFixed(6));
        if (Math.abs(sanitized) < 1000) {
            return sanitized;
        } else {
            console.warn(`⚠️ Valor numérico em string "${value}" excede o limite. Será retornado como null.`);
            return null;
        }
    }
    return null; // Retorna null para valores não numéricos ou inválidos
}

export const SyncService = {
    
    getLastSyncTime() {
        return localStorage.getItem(SYNC_KEY);
    },

    updateLastSyncTime() {
        localStorage.setItem(SYNC_KEY, new Date().toISOString());
    },

    /**
     * Função principal: Envia mudanças locais e baixa mudanças remotas.
     * @param {Array} localTrees - Lista atual de árvores no estado local.
     * @returns {Object} - Resultado { success, updatedTrees, stats: { uploaded, downloaded } }
     */
    async synchronize(localTrees) {
        console.log('🔄 Iniciando sincronização...');
        
        const user = await ApiService.getUser();
        if (!user) {
            console.warn('⚠️ Usuário não logado. Sincronização abortada.');
            return { success: false, message: 'Usuário não logado' };
        }

        try {
            const lastSync = this.getLastSyncTime();
            const lastSyncDate = lastSync ? new Date(lastSync) : new Date(0); // Epoch se nunca sincronizou

            // 1. UPLOAD (PUSH)
            let uploadCount = 0;
            
            // Iterar sobre uma cópia para evitar problemas ao modificar IDs durante o loop
            for (const tree of localTrees) {
                let shouldUpload = false;
                let isLegacyId = false;

                // Critério A: ID Numérico (dado criado localmente, nunca syncado com UUID)
                if (typeof tree.id === 'number' || (!isNaN(Number(tree.id)) && tree.id !== null)) { // Verifica também se não é null
                    shouldUpload = true;
                    isLegacyId = true;
                }
                // Critério B: Flag explícita
                else if (tree.needSync) {
                    shouldUpload = true;
                }
                // Critério C: Modificado após a última sincronização
                else if (tree.updated_at && new Date(tree.updated_at) > lastSyncDate) {
                    shouldUpload = true;
                }

                if (shouldUpload) {
                    console.log(`📤 Enviando árvore: ${tree.especie || 'Sem Espécie'} (ID: ${tree.id})`);
                    
                    const treeToUpload = { ...tree };

                    // [FIX-23502]: Garantir que 'nome' não seja nulo
                    if (!treeToUpload.nome || treeToUpload.nome.trim() === '') {
                        treeToUpload.nome = `Árvore ID: ${tree.id || Date.now()}`;
                        console.warn(`⚠️ Campo 'nome' estava nulo/vazio para árvore ${tree.id}. Atribuído: '${treeToUpload.nome}'`);
                    }

                    // [FIX-22003]: Sanitizar campos numéricos antes do upload
                    treeToUpload.dap = sanitizeNumericField(treeToUpload.dap);
                    treeToUpload.altura = sanitizeNumericField(treeToUpload.altura);
                    // Adicione outros campos numéricos que possam existir e precisar de sanitização
                    // Ex: treeToUpload.latitude = sanitizeNumericField(treeToUpload.latitude);
                    // Ex: treeToUpload.longitude = sanitizeNumericField(treeToUpload.longitude);
                    // Ex: treeToUpload.inclinacao = sanitizeNumericField(treeToUpload.inclinacao);

                    // Se for ID legado (numérico), mandamos NULL para o Supabase gerar UUID
                    if (isLegacyId) {
                        delete treeToUpload.id; 
                    }
                    
                    const { data, error } = await ApiService.upsertTree(treeToUpload);
                    
                    if (!error && data && data[0]) {
                        // Sucesso!
                        // Se era ID numérico, atualizamos o objeto local com o novo UUID
                        if (isLegacyId) {
                            console.log(`🔀 Migrando ID Local ${tree.id} -> UUID ${data[0].id}`);
                            tree.id = data[0].id;
                        }
                        
                        // Atualiza timestamp e remove flag
                        tree.updated_at = data[0].updated_at;
                        tree.needSync = false;
                        uploadCount++;
                    } else {
                        console.error('❌ Erro ao enviar árvore:', error);
                    }
                }
            }

            // 2. DOWNLOAD (PULL)
            console.log(`📥 Buscando alterações remotas desde: ${lastSync || 'O início'}`);
            const { data: remoteTrees, error: fetchError } = await ApiService.getTrees(lastSync);

            if (fetchError) throw fetchError;

            // 3. MERGE (FUSÃO)
            let downloadCount = 0;
            const treeMap = new Map();
            
            // Popula mapa com locais
            localTrees.forEach(t => treeMap.set(String(t.id), t));

            if (remoteTrees && remoteTrees.length > 0) {
                remoteTrees.forEach(remoteTree => {
                    const localVersion = treeMap.get(String(remoteTree.id));
                    
                    // Se não existe localmente, ou se a remota é mais nova
                    if (!localVersion || new Date(remoteTree.updated_at) > new Date(localVersion.updated_at || 0)) {
                        
                        // [DIAGNOSTIC-FIX] Transforma o dado remoto para o formato local esperado.
                        // O Supabase armazena 'longitude' e 'latitude', mas a UI espera 'coordX' e 'coordY'.
                        const localFormattedTree = {
                            ...remoteTree,
                            coordX: remoteTree.longitude, // Mapeia longitude -> coordX
                            coordY: remoteTree.latitude,  // Mapeia latitude -> coordY
                            needSync: false
                        };
                        
                        treeMap.set(String(remoteTree.id), localFormattedTree);
                        downloadCount++;
                    }
                });
            }

            const mergedTrees = Array.from(treeMap.values());

            this.updateLastSyncTime();
            console.log(`✅ Sync fim. Up: ${uploadCount}, Down: ${downloadCount}`);

            return { 
                success: true, 
                updatedTrees: mergedTrees,
                stats: { uploaded: uploadCount, downloaded: downloadCount } // Nomes corrigidos para main.js
            };

        } catch (error) {
            console.error('❌ Erro fatal na sincronização:', error);
            return { success: false, error: error.message || 'Erro desconhecido' }; // Retorna a mensagem de erro para o frontend
        }
    }
};
