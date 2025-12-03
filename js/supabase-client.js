import { createClient } from 'https://esm.sh/@supabase/supabase-js';

// CLASSE DE INTEGRAÇÃO COM SUPABASE
const SUPABASE_URL = 'https://mbfouxrinygecbxmjckg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1iZm91eHJpbnlnZWNieG1qY2tnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0MjQxMTUsImV4cCI6MjA4MDAwMDExNX0.MdYJO6R0IvXFOUQTVhy2QzJHQzmech6xAuLnA1Lhoj0';

let _supabase = null;

async function checkSupabaseConnection() {
    try {
        if (!_supabase) throw new Error('Cliente Supabase não inicializado.');
        const { data, error } = await _supabase.auth.getSession();
        if (error) throw error;
        return { success: true, session: data.session };
    } catch (error) {
        console.error('❌ Falha na conexão com Supabase:', error.message);
        return { success: false, error: error.message };
    }
}

function initSupabase() {
    if (_supabase) return;
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;
    try {
        _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        checkSupabaseConnection();
    } catch (e) {
        console.error('❌ Erro ao inicializar cliente Supabase:', e);
    }
}

initSupabase();

export const ApiService = {
    
    async getSession() {
        if (!_supabase) return null;
        const { data, error } = await _supabase.auth.getSession();
        if (error) return null;
        return data.session;
    },

    async login(email, password) {
        if (!_supabase) return { error: 'Supabase não inicializado' };
        const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
        return { data, error };
    },

    async register(email, password) {
        if (!_supabase) return { error: 'Supabase não inicializado' };
        const { data, error } = await _supabase.auth.signUp({ email, password });
        return { data, error };
    },

    async logout() {
        if (!_supabase) return;
        const { error } = await _supabase.auth.signOut();
        return { error };
    },

    async getUser() {
        if (!_supabase) return null;
        const { data: { user } } = await _supabase.auth.getUser();
        return user;
    },

    /**
     * Busca as árvores e converte os nomes das colunas do banco (snake_case)
     * para o modelo da aplicação (camelCase).
     */
    async getTrees(lastSyncTime = null) {
        if (!_supabase) return { data: [], error: 'Offline' };
        
        let query = _supabase.from('arvores').select('*');
        if (lastSyncTime) {
            query = query.gt('updated_at', lastSyncTime);
        }

        const { data: dbData, error } = await query;
        
        if (error) {
            console.error('Erro ao buscar árvores:', error);
            return { data: [], error };
        }

        // [FIX-PHOTOS] Mapeamento explícito de Snake Case (DB) para Camel Case (App)
        const mappedData = dbData.map(row => ({
            id: row.id,
            data: row.data,
            especie: row.especie,
            nome: row.nome,
            local: row.local,
            coordX: row.longitude || row.coordx || 'N/A', // Tenta campos novos e legados
            coordY: row.latitude || row.coordy || 'N/A',
            utmZoneNum: row.utmzonenum,
            utmZoneLetter: row.utmzoneletter,
            dap: row.dap,
            altura: row.altura,
            avaliador: row.avaliador,
            observacoes: row.observacoes,
            pontuacao: row.pontuacao,
            riskFactors: row.riskfactors,
            
            // Campos TRAQ
            riskLevel: row.risklevel,
            residualRisk: row.residualrisk,
            mitigation: row.mitigation,
            targetCategory: row.targetcategory,
            risco: row.risco,
            riscoClass: row.riscoclass,

            // [CRITICAL] Mapeamento da Foto
            hasPhoto: row.hasphoto || false,
            photoUrl: row.image_url || null, // Mapeia image_url do banco para photoUrl da App

            updated_at: row.updated_at
        }));

        console.log(`[Sync] ${mappedData.length} árvores carregadas do servidor.`);
        return { data: mappedData, error: null };
    },

    async upsertTree(treeData) {
        if (!_supabase) return { error: 'Offline' };
        const user = await this.getUser();
        if (!user) return { error: 'Usuário não logado' };

        const dbPayload = {
            user_id: user.id,
            id: treeData.id,
            
            nome: treeData.nome || treeData.especie || 'Nome não especificado',
            especie: treeData.especie,
            data: treeData.data,
            local: treeData.local,
            avaliador: treeData.avaliador,
            observacoes: treeData.observacoes,

            dap: parseFloat(treeData.dap) || 0,
            altura: parseFloat(treeData.altura) || 0,
            latitude: parseFloat(treeData.coordY) || treeData.latitude || 0,
            longitude: parseFloat(treeData.coordX) || treeData.longitude || 0,
            pontuacao: parseInt(treeData.pontuacao) || 0,
            
            utmzonenum: treeData.utmZoneNum,
            utmzoneletter: treeData.utmZoneLetter,

            risklevel: treeData.riskLevel,
            residualrisk: treeData.residualRisk,
            mitigation: treeData.mitigation,
            targetcategory: treeData.targetCategory,
            riskfactors: treeData.riskFactors,
            
            hasphoto: !!treeData.hasPhoto, // Garante boolean
            risco: treeData.risco,
            riscoclass: treeData.riscoClass,
            image_url: treeData.photoUrl, // Salva a URL no campo correto do banco
            updated_at: new Date().toISOString(),
        };

        // Limpeza de campos undefined
        Object.keys(dbPayload).forEach(key => {
            if (dbPayload[key] === undefined) delete dbPayload[key];
        });

        if (dbPayload.id && (typeof dbPayload.id === 'number' || String(dbPayload.id).startsWith('local_'))) {
            delete dbPayload.id;
        }

        const { data, error } = await _supabase
            .from('arvores')
            .upsert(dbPayload)
            .select();

        return { data, error };
    },

    async deleteTree(treeId) {
        if (!_supabase) return { error: 'Offline' };
        const { error } = await _supabase
            .from('arvores')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', treeId);
        return { error };
    },

    async uploadImage(arvoreId, imageFile) {
        if (!_supabase) return { error: 'Offline' };

        const formData = new FormData();
        formData.append('arvore_id', arvoreId);
        formData.append('file', imageFile);

        try {
            const { data: { session } } = await _supabase.auth.getSession();
            if (!session) throw new Error("Usuário não autenticado.");

            const response = await fetch(`${SUPABASE_URL}/functions/v1/image-upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'x-client-info': 'arboria-webapp-v1',
                },
                body: formData,
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Falha na requisição: ${errorText}`);
            }

            const responseData = await response.json();

            // [FIX-PHOTOS] Garante que a URL pública seja retornada
            if (responseData.path) {
                const { data: publicUrlData } = _supabase.storage
                    .from('arvore-imagens')
                    .getPublicUrl(responseData.path);

                responseData.fullUrl = publicUrlData.publicUrl;
            }

            return { data: responseData, error: null };

        } catch (error) {
            return { data: null, error };
        }
    },
    
    getSupabaseUrl() {
        return SUPABASE_URL;
    },

    getRealtimeSubscription(tableName, handlers) {
        if (!_supabase) return null;

        const channel = _supabase.channel(`public:${tableName}`);

        if (handlers.INSERT) {
            channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: tableName }, handlers.INSERT);
        }
        if (handlers.UPDATE) {
            channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: tableName }, handlers.UPDATE);
        }
        if (handlers.DELETE) {
            channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table: tableName }, handlers.DELETE);
        }

        channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                console.log(`[Realtime] Conectado ao canal ${tableName}`);
            }
        });

        return channel;
    },

    async removeRealtimeSubscription(subscription) {
        if (!subscription) return;
        try {
            await _supabase.removeChannel(subscription);
            console.log('[Realtime] Canal removido com sucesso.');
        } catch (error) {
            console.error('[Realtime] Erro ao remover canal:', error);
        }
    }
};
