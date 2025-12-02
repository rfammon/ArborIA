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
    // Only initialize if _supabase is not already set
    if (_supabase) {
        console.warn("Supabase client already initialized. Skipping re-initialization.");
        return;
    }

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

    async getTrees(lastSyncTime = null) {
        if (!_supabase) return { data: [], error: 'Offline' };
        
        let query = _supabase.from('arvores').select('*');
        if (lastSyncTime) {
            query = query.gt('updated_at', lastSyncTime);
        }

        const { data, error } = await query;
        if (error) console.error('Erro ao buscar árvores:', error);
        return { data, error };
    },

    async upsertTree(treeData) {
        if (!_supabase) return { error: 'Offline' };
        const user = await this.getUser();
        if (!user) return { error: 'Usuário não logado' };

        // [FIX-CRITICAL] Payload agora inclui TODOS os campos de treeData,
        // resolvendo o erro 'null value in column "nome"' e prevenindo
        // a perda de dados de outros campos.
        const dbPayload = {
            user_id: user.id,
            id: treeData.id, // O upsert usará o ID para encontrar o registro a ser atualizado
            
            // --- Dados principais ---
            nome: treeData.nome || treeData.especie || 'Nome não especificado', // Garante que 'nome' nunca seja nulo
            especie: treeData.especie,
            data: treeData.data,
            local: treeData.local,
            avaliador: treeData.avaliador,
            observacoes: treeData.observacoes,

            // --- Dados Numéricos (com sanitização/fallback) ---
            dap: parseFloat(treeData.dap) || 0,
            altura: parseFloat(treeData.altura) || 0,
            latitude: parseFloat(treeData.coordY) || treeData.latitude || 0,
            longitude: parseFloat(treeData.coordX) || treeData.longitude || 0,
            pontuacao: parseInt(treeData.pontuacao) || 0,
            
            // --- Coordenadas UTM ---
            utmzonenum: treeData.utmZoneNum,
            utmzoneletter: treeData.utmZoneLetter,

            // --- Análise de Risco (TRAQ) ---
            risklevel: treeData.riskLevel,
            residualrisk: treeData.residualRisk,
            mitigation: treeData.mitigation,
            targetcategory: treeData.targetCategory,
            riskfactors: treeData.riskFactors, // Deve ser um array ou JSON
            
            // --- Metadados ---
            hasphoto: treeData.hasPhoto,
            risco: treeData.risco,
            riscoclass: treeData.riscoClass,
            updated_at: new Date().toISOString(),
        };

        // Limpeza de campos undefined para não enviar chaves desnecessárias
        Object.keys(dbPayload).forEach(key => {
            if (dbPayload[key] === undefined) {
                delete dbPayload[key];
            }
        });

        // Se o ID for numérico (legado) ou "local_", não o envie para que o Supabase gere um UUID
        if (dbPayload.id && (typeof dbPayload.id === 'number' || String(dbPayload.id).startsWith('local_'))) {
            delete dbPayload.id;
        }

        const { data, error } = await _supabase
            .from('arvores')
            .upsert(dbPayload)
            .select();

        return { data, error };
    },

    async upsertTrees(treesData) {
        if (!_supabase) return { error: 'Offline' };
        const user = await this.getUser();
        if (!user) return { error: 'Usuário não logado' };

        const payloads = treesData.map(treeData => {
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
                hasphoto: treeData.hasPhoto,
                risco: treeData.risco,
                riscoclass: treeData.riscoClass,
                updated_at: new Date().toISOString(),
            };

            // Clean undefined
            Object.keys(dbPayload).forEach(key => {
                if (dbPayload[key] === undefined) delete dbPayload[key];
            });

            // Handle local IDs (don't send them, let Supabase generate UUID)
            if (dbPayload.id && (typeof dbPayload.id === 'number' || String(dbPayload.id).startsWith('local_'))) {
                delete dbPayload.id;
            }

            return dbPayload;
        });

        const { data, error } = await _supabase
            .from('arvores')
            .upsert(payloads)
            .select();

        return { data, error };
    },
    
    // Alias para compatibilidade com chamadas antigas que esperam saveTree
    async saveTree(treeData) {
        return this.upsertTree(treeData);
    },

    async deleteTree(treeId) {
        if (!_supabase) return { error: 'Offline' };
        const { error } = await _supabase
            .from('arvores')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', treeId);
        return { error };
    },

    async getProfile() {
        if (!_supabase) return { error: 'Offline' };
        const user = await this.getUser();
        if (!user) return { error: 'Usuário não logado' };

        const { data, error } = await _supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
        return { data, error };
    },

    async upsertProfile(profileData) {
        if (!_supabase) return { error: 'Offline' };
        const user = await this.getUser();
        if (!user) return { error: 'Usuário não logado' };

        const payload = {
            id: user.id,
            updated_at: new Date().toISOString(),
            ...profileData
        };

        const { data, error } = await _supabase
            .from('profiles')
            .upsert(payload)
            .select();
        return { data, error };
    },

    getRealtimeSubscription(tableName, handlers) {
        if (!_supabase) return null;
        
        const channel = _supabase.channel(`public:${tableName}`);
        
        channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: tableName }, payload => {
            if (handlers.INSERT) handlers.INSERT(payload);
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: tableName }, payload => {
            if (handlers.UPDATE) handlers.UPDATE(payload);
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: tableName }, payload => {
            if (handlers.DELETE) handlers.DELETE(payload);
        })
        .subscribe(status => {
            if (status === 'SUBSCRIBED') {
                console.log(`Realtime channel subscribed for table: ${tableName}`);
            } else if (status === 'CHANNEL_ERROR') {
                console.error(`Realtime channel error for table: ${tableName}`);
            } else if (status === 'TIMED_OUT') {
                console.warn(`Realtime channel timed out for table: ${tableName}`);
            }
        });

        return channel;
    },

    async removeRealtimeSubscription(subscription) {
        if (subscription) {
            await _supabase.removeChannel(subscription);
        }
    }
};
