import { ApiService } from './supabase-client.js';

// SERVIÇO DE SINCRONIZAÇÃO
// Responsável por manter os dados locais (Browser) e remotos (Supabase) em harmonia.

const SYNC_KEY = 'arboria_last_sync_time';

// Função auxiliar para sanitizar campos numéricos
function sanitizeNumericField(value) {
    if (typeof value === 'number') {
        const sanitized = parseFloat(value.toFixed(6));
        if (Math.abs(sanitized) < 1000) {
            return sanitized;
        } else {
            console.warn(`⚠️ Valor numérico ${value} excede o limite. Será ignorado.`);
            return null;
        }
    }
    if (typeof value === 'string' && !isNaN(parseFloat(value)) && isFinite(value)) {
        const numValue = parseFloat(value);
        const sanitized = parseFloat(numValue.toFixed(6));
        if (Math.abs(sanitized) < 1000) {
            return sanitized;
        } else {
            console.warn(`⚠️ Valor numérico string "${value}" excede o limite. Será ignorado.`);
            return null;
        }
    }
    return null;
}

export const SyncService = {
    
    getLastSyncTime() {
        return localStorage.getItem(SYNC_KEY);
    },

    updateLastSyncTime() {
        localStorage.setItem(SYNC_KEY, new Date().toISOString());
    },

    async synchronize(localTrees) {
        console.log('🔄 Iniciando sincronização...');
        
        const user = await ApiService.getUser();
        if (!user) {
            console.warn('⚠️ Usuário não logado. Sincronização abortada.');
            return { success: false, message: 'Usuário não logado' };
        }

        try {
            const lastSync = this.getLastSyncTime();
            const lastSyncDate = lastSync ? new Date(lastSync) : new Date(0);

            // 1. UPLOAD (PUSH)
            let uploadCount = 0;
            
            for (const tree of localTrees) {
                let shouldUpload = false;
                let isLegacyId = false;

                if (typeof tree.id === 'number' || (!isNaN(Number(tree.id)) && tree.id !== null)) {
                    shouldUpload = true;
                    isLegacyId = true;
                }
                else if (tree.needSync) {
                    shouldUpload = true;
                }
                else if (tree.updated_at && new Date(tree.updated_at) > lastSyncDate) {
                    shouldUpload = true;
                }

                if (shouldUpload) {
                    // console.log(`📤 Enviando árvore: ${tree.especie || 'Sem Espécie'} (ID: ${tree.id})`);
                    
                    const treeToUpload = { ...tree };

                    if (!treeToUpload.nome || treeToUpload.nome.trim() === '') {
                        treeToUpload.nome = `Árvore ID: ${tree.id || Date.now()}`;
                    }

                    treeToUpload.dap = sanitizeNumericField(treeToUpload.dap);
                    treeToUpload.altura = sanitizeNumericField(treeToUpload.altura);

                    if (isLegacyId) {
                        delete treeToUpload.id; 
                    }
                    
                    const { data, error } = await ApiService.upsertTree(treeToUpload);
                    
                    if (!error && data && data[0]) {
                        if (isLegacyId) {
                            console.log(`🔀 Migrando ID Local ${tree.id} -> UUID ${data[0].id}`);
                            tree.id = data[0].id;
                        }
                        
                        tree.updated_at = data[0].updated_at;
                        tree.needSync = false;
                        uploadCount++;
                    } else {
                        console.error('❌ Erro ao enviar árvore:', error);
                    }
                }
            }

            // 2. DOWNLOAD (PULL)
            // console.log(`📥 Buscando alterações remotas desde: ${lastSync || 'O início'}`);
            const { data: remoteTrees, error: fetchError } = await ApiService.getTrees(lastSync);

            if (fetchError) throw fetchError;

            // 3. MERGE (FUSÃO)
            let downloadCount = 0;
            const treeMap = new Map();
            
            localTrees.forEach(t => treeMap.set(String(t.id), t));

            if (remoteTrees && remoteTrees.length > 0) {
                remoteTrees.forEach(remoteTree => {
                    const localVersion = treeMap.get(String(remoteTree.id));
                    
                    if (!localVersion || new Date(remoteTree.updated_at) > new Date(localVersion.updated_at || 0)) {
                        
                        // [FIX-PHOTO-MAPPING] Mapeia image_url -> photoUrl
                        const localFormattedTree = {
                            ...remoteTree,
                            coordX: remoteTree.longitude,
                            coordY: remoteTree.latitude,
                            photoUrl: remoteTree.image_url, // Mapeamento CRÍTICO para a UI funcionar
                            hasPhoto: remoteTree.hasphoto,   // Garante consistência com snake_case do banco
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
                stats: { uploaded: uploadCount, downloaded: downloadCount }
            };

        } catch (error) {
            console.error('❌ Erro fatal na sincronização:', error);
            return { success: false, error: error.message || 'Erro desconhecido' };
        }
    }
};
