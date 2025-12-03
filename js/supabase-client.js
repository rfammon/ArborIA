import { createClient } from "https://esm.sh/@supabase/supabase-js";
import { CoordinatesService } from "./coordinates.service.js";

// =====================================================
// CONFIGURAÇÃO DO SUPABASE
// =====================================================

const SUPABASE_URL = "https://mbfouxrinygecbxmjckg.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1iZm91eHJpbnlnZWNieG1qY2tnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0MjQxMTUsImV4cCI6MjA4MDAwMDExNX0.MdYJO6R0IvXFOUQTVhy2QzJHQzmech6xAuLnA1Lhoj0";

let _supabase = null;

// =====================================================
// INICIALIZAÇÃO
// =====================================================

async function checkSupabaseConnection() {
  try {
    if (!_supabase) throw new Error("Cliente Supabase não inicializado.");
    const { data, error } = await _supabase.auth.getSession();
    if (error) throw error;
    return { success: true, session: data.session };
  } catch (error) {
    console.error("[Supabase] ❌ Falha na conexão:", error.message);
    return { success: false, error: error.message };
  }
}

function initSupabase() {
  if (_supabase) return;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;
  try {
    _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    checkSupabaseConnection();
    console.log("[Supabase] ✓ Cliente inicializado");
  } catch (e) {
    console.error("[Supabase] ❌ Erro ao inicializar:", e);
  }
}

initSupabase();

// =====================================================
// API SERVICE
// =====================================================

export const ApiService = {
  // ---------------------------------------------------
  // AUTENTICAÇÃO
  // ---------------------------------------------------

  async getSession() {
    if (!_supabase) return null;
    const { data, error } = await _supabase.auth.getSession();
    if (error) return null;
    return data.session;
  },

  async login(email, password) {
    if (!_supabase) return { error: "Supabase não inicializado" };
    const { data, error } = await _supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  },

  async register(email, password) {
    if (!_supabase) return { error: "Supabase não inicializado" };
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
    const {
      data: { user },
    } = await _supabase.auth.getUser();
    return user;
  },

  // ---------------------------------------------------
  // OPERAÇÕES COM ÁRVORES
  // ---------------------------------------------------

  /**
   * Busca árvores do banco de dados
   * Usa CoordinatesService para processar coordenadas automaticamente
   */
  async getTrees(lastSyncTime = null) {
    if (!_supabase) return { data: [], error: "Offline" };

    try {
      let query = _supabase.from("arvores").select("*").is("deleted_at", null); // Filtrar registros deletados

      if (lastSyncTime) {
        query = query.gt("updated_at", lastSyncTime);
      }

      const { data: dbData, error } = await query;

      if (error) {
        console.error("[Supabase] ❌ Erro ao buscar árvores:", error);
        return { data: [], error };
      }

      // Mapear cada linha usando CoordinatesService
      const mappedData = dbData.map((row) => {
        // Processar coordenadas usando o serviço centralizado
        const coords = CoordinatesService.prepareFromDatabase(row);

        return {
          id: row.id,
          data: row.data,
          especie: row.especie,
          nome: row.nome,
          local: row.local,
          avaliador: row.avaliador,
          observacoes: row.observacoes,

          // Medidas dendrométricas
          dap: row.dap,
          altura: row.altura,

          // Coordenadas (todas as versões para compatibilidade)
          ...coords,

          // Campos TRAQ
          pontuacao: row.pontuacao,
          riskFactors: row.riskfactors,
          riskLevel: row.risklevel,
          residualRisk: row.residualrisk,
          mitigation: row.mitigation,
          targetCategory: row.targetcategory,
          risco: row.risco,
          riscoClass: row.riscoclass,

          // Mídia
          hasPhoto: row.hasphoto || false,
          photoUrl: row.image_url || null,

          // Timestamps
          created_at: row.created_at,
          updated_at: row.updated_at,
        };
      });

      console.log(`[Supabase] ✓ ${mappedData.length} árvores carregadas`);
      return { data: mappedData, error: null };
    } catch (error) {
      console.error("[Supabase] ❌ Erro ao buscar árvores:", error);
      return { data: [], error: error.message };
    }
  },

  /**
   * Insere ou atualiza uma árvore no banco de dados
   * Usa CoordinatesService para normalizar coordenadas automaticamente
   */
  async upsertTree(treeData) {
    if (!_supabase) return { error: "Offline" };

    try {
      const user = await this.getUser();
      if (!user) return { error: "Usuário não logado" };

      console.log("[Supabase] Processando dados da árvore:", {
        id: treeData.id,
        especie: treeData.especie,
        coordX: treeData.coordX,
        coordY: treeData.coordY,
        utmZoneNum: treeData.utmZoneNum,
        utmZoneLetter: treeData.utmZoneLetter,
      });

      // Usar CoordinatesService para preparar coordenadas
      const coordsForDB = CoordinatesService.prepareForDatabase(treeData);

      console.log("[Supabase] Coordenadas normalizadas:", coordsForDB);

      // Montar payload para o banco
      const dbPayload = {
        user_id: user.id,
        id: treeData.id,

        // Informações básicas
        nome: treeData.nome || treeData.especie || "Nome não especificado",
        especie: treeData.especie,
        data: treeData.data,
        local: treeData.local,
        avaliador: treeData.avaliador,
        observacoes: treeData.observacoes,

        // Medidas dendrométricas
        dap: treeData.dap ? parseFloat(treeData.dap) : 0,
        altura: treeData.altura ? parseFloat(treeData.altura) : 0,

        // Coordenadas UTM (SISTEMA ÚNICO)
        easting: coordsForDB.easting,
        northing: coordsForDB.northing,
        utmzonenum: coordsForDB.utmzonenum,
        utmzoneletter: coordsForDB.utmzoneletter,

        // Também salvar em latitude/longitude para compatibilidade com mapas legados
        latitude: coordsForDB.northing, // Temporário para compatibilidade
        longitude: coordsForDB.easting, // Temporário para compatibilidade

        // Avaliação de risco
        pontuacao: parseInt(treeData.pontuacao) || 0,
        riskfactors: treeData.riskFactors || [],
        risklevel: treeData.riskLevel,
        residualrisk: treeData.residualRisk,
        mitigation: treeData.mitigation,
        targetcategory: treeData.targetCategory,
        risco: treeData.risco,
        riscoclass: treeData.riscoClass,

        // Mídia
        hasphoto: !!treeData.hasPhoto,
        image_url: treeData.photoUrl,

        // Timestamp
        updated_at: new Date().toISOString(),
      };

      // Remover campos undefined
      Object.keys(dbPayload).forEach((key) => {
        if (dbPayload[key] === undefined) delete dbPayload[key];
      });

      // Remover ID se for local ou numérico (será gerado pelo banco)
      if (
        dbPayload.id &&
        (typeof dbPayload.id === "number" ||
          String(dbPayload.id).startsWith("local_"))
      ) {
        delete dbPayload.id;
      }

      console.log("[Supabase] Payload final:", {
        id: dbPayload.id,
        nome: dbPayload.nome,
        easting: dbPayload.easting,
        northing: dbPayload.northing,
        utmzonenum: dbPayload.utmzonenum,
        utmzoneletter: dbPayload.utmzoneletter,
      });

      // Executar upsert
      const { data, error } = await _supabase
        .from("arvores")
        .upsert(dbPayload)
        .select();

      if (error) {
        console.error("[Supabase] ❌ Erro no upsert:", error);
        return { data: null, error };
      }

      console.log("[Supabase] ✓ Árvore salva:", data);
      console.log(
        "[Supabase] Tipo de retorno:",
        Array.isArray(data) ? "Array" : typeof data,
      );
      console.log("[Supabase] Quantidade de registros:", data?.length);
      console.log("[Supabase] Primeiro registro ID:", data?.[0]?.id);

      return { data: data, error: null };
    } catch (error) {
      console.error("[Supabase] ❌ Erro ao salvar árvore:", error);
      return { data: null, error: error.message };
    }
  },

  /**
   * Insere ou atualiza múltiplas árvores no banco de dados (operação em lote)
   * Usa CoordinatesService para normalizar coordenadas automaticamente
   */
  async upsertTrees(treesData) {
    if (!_supabase) return { data: [], error: "Offline" };

    try {
      const user = await this.getUser();
      if (!user) return { data: [], error: "Usuário não logado" };

      console.log(`[Supabase] Processando ${treesData.length} árvores em lote`);

      // Preparar payload para cada árvore
      const dbPayloads = treesData.map((treeData) => {
        // Usar CoordinatesService para preparar coordenadas
        const coordsForDB = CoordinatesService.prepareForDatabase(treeData);

        // Montar payload para o banco
        const dbPayload = {
          user_id: user.id,
          id: treeData.id,

          // Informações básicas
          nome: treeData.nome || treeData.especie || "Nome não especificado",
          especie: treeData.especie,
          data: treeData.data,
          local: treeData.local,
          avaliador: treeData.avaliador,
          observacoes: treeData.observacoes,

          // Medidas dendrométricas
          dap: treeData.dap ? parseFloat(treeData.dap) : 0,
          altura: treeData.altura ? parseFloat(treeData.altura) : 0,

          // Coordenadas UTM (SISTEMA ÚNICO)
          easting: coordsForDB.easting,
          northing: coordsForDB.northing,
          utmzonenum: coordsForDB.utmzonenum,
          utmzoneletter: coordsForDB.utmzoneletter,

          // Também salvar em latitude/longitude para compatibilidade com mapas legados
          latitude: coordsForDB.northing,
          longitude: coordsForDB.easting,

          // Avaliação de risco
          pontuacao: parseInt(treeData.pontuacao) || 0,
          riskfactors: treeData.riskFactors || [],
          risklevel: treeData.riskLevel,
          residualrisk: treeData.residualRisk,
          mitigation: treeData.mitigation,
          targetcategory: treeData.targetCategory,
          risco: treeData.risco,
          riscoclass: treeData.riscoClass,

          // Mídia
          hasphoto: !!treeData.hasPhoto,
          image_url: treeData.photoUrl,

          // Timestamp
          updated_at: new Date().toISOString(),
        };

        // Remover campos undefined
        Object.keys(dbPayload).forEach((key) => {
          if (dbPayload[key] === undefined) delete dbPayload[key];
        });

        // Remover ID se for local ou numérico (será gerado pelo banco)
        if (
          dbPayload.id &&
          (typeof dbPayload.id === "number" ||
            String(dbPayload.id).startsWith("local_"))
        ) {
          delete dbPayload.id;
        }

        return dbPayload;
      });

      console.log(
        `[Supabase] Executando upsert em lote de ${dbPayloads.length} registros`,
      );

      // Executar upsert em lote
      const { data: dbData, error } = await _supabase
        .from("arvores")
        .upsert(dbPayloads)
        .select();

      if (error) {
        console.error("[Supabase] ❌ Erro no upsert em lote:", error);
        return { data: [], error };
      }

      // Mapear dados retornados para o formato da aplicação
      const mappedData = dbData.map((row) => {
        // Processar coordenadas usando o serviço centralizado
        const coords = CoordinatesService.prepareFromDatabase(row);

        return {
          id: row.id,
          data: row.data,
          especie: row.especie,
          nome: row.nome,
          local: row.local,
          avaliador: row.avaliador,
          observacoes: row.observacoes,

          // Medidas dendrométricas
          dap: row.dap,
          altura: row.altura,

          // Coordenadas (todas as versões para compatibilidade)
          ...coords,

          // Campos TRAQ
          pontuacao: row.pontuacao,
          riskFactors: row.riskfactors,
          riskLevel: row.risklevel,
          residualRisk: row.residualrisk,
          mitigation: row.mitigation,
          targetCategory: row.targetcategory,
          risco: row.risco,
          riscoClass: row.riscoclass,

          // Mídia
          hasPhoto: row.hasphoto || false,
          photoUrl: row.image_url || null,

          // Timestamps
          created_at: row.created_at,
          updated_at: row.updated_at,
        };
      });

      console.log(`[Supabase] ✓ ${mappedData.length} árvores salvas em lote`);
      return { data: mappedData, error: null };
    } catch (error) {
      console.error("[Supabase] ❌ Erro ao salvar árvores em lote:", error);
      return { data: [], error: error.message };
    }
  },

  /**
   * Remove permanentemente uma árvore do banco de dados (hard delete)
   */
  async deleteTree(treeId) {
    if (!_supabase) return { error: "Offline" };

    console.log("[Supabase] Deletando árvore:", treeId);

    const { error } = await _supabase.from("arvores").delete().eq("id", treeId);

    if (error) {
      console.error("[Supabase] Erro ao deletar:", error);
    } else {
      console.log("[Supabase] Árvore deletada com sucesso");
    }

    return { error };
  },

  // ---------------------------------------------------
  // UPLOAD DE IMAGENS
  // ---------------------------------------------------

  async uploadImage(arvoreId, imageFile) {
    if (!_supabase) return { error: "Offline" };

    const formData = new FormData();
    formData.append("arvore_id", arvoreId);
    formData.append("file", imageFile);

    try {
      const {
        data: { session },
      } = await _supabase.auth.getSession();
      if (!session) throw new Error("Usuário não autenticado.");

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/image-upload`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "x-client-info": "arboria-webapp-v1",
          },
          body: formData,
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Falha na requisição: ${errorText}`);
      }

      const responseData = await response.json();

      if (responseData.path) {
        const { data: publicUrlData } = _supabase.storage
          .from("arvore-imagens")
          .getPublicUrl(responseData.path);

        responseData.fullUrl = publicUrlData.publicUrl;
      }

      return { data: responseData, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // ---------------------------------------------------
  // REALTIME
  // ---------------------------------------------------

  getRealtimeSubscription(tableName, handlers) {
    if (!_supabase) return null;

    const channel = _supabase.channel(`public:${tableName}`);

    if (handlers.INSERT) {
      channel.on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: tableName },
        handlers.INSERT,
      );
    }
    if (handlers.UPDATE) {
      channel.on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: tableName },
        handlers.UPDATE,
      );
    }
    if (handlers.DELETE) {
      channel.on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: tableName },
        handlers.DELETE,
      );
    }

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        console.log(`[Realtime] ✓ Conectado ao canal ${tableName}`);
      }
    });

    return channel;
  },

  async removeRealtimeSubscription(subscription) {
    if (!subscription) return;
    try {
      await _supabase.removeChannel(subscription);
      console.log("[Realtime] ✓ Canal removido");
    } catch (error) {
      console.error("[Realtime] ❌ Erro ao remover canal:", error);
    }
  },

  // ---------------------------------------------------
  // UTILITÁRIOS
  // ---------------------------------------------------

  getSupabaseUrl() {
    return SUPABASE_URL;
  },
};
