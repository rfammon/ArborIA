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

          // Campos TRAQ - Falha provável e Alvo
          failureProb: row.failureprob,
          targetType: row.targettype,

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
   * Busca uma árvore específica por ID
   * Usa CoordinatesService para processar coordenadas automaticamente
   */
  async getTree(treeId) {
    if (!_supabase) return { data: null, error: "Offline" };

    try {
      const { data: dbData, error } = await _supabase
        .from("arvores")
        .select("*")
        .eq("id", treeId)
        .is("deleted_at", null)
        .single(); // Usar single() pois estamos buscando uma árvore específica

      if (error) {
        if (error.code === 'PGRST116') {
          // Registro não encontrado
          return { data: null, error: null };
        }
        console.error("[Supabase] ❌ Erro ao buscar árvore:", error);
        return { data: null, error };
      }

      if (!dbData) {
        return { data: null, error: null };
      }

      // Processar coordenadas usando o serviço centralizado
      const coords = CoordinatesService.prepareFromDatabase(dbData);

      const mappedTree = {
        id: dbData.id,
        data: dbData.data,
        especie: dbData.especie,
        nome: dbData.nome,
        local: dbData.local,
        avaliador: dbData.avaliador,
        observacoes: dbData.observacoes,

        // Medidas dendrométricas
        dap: dbData.dap,
        altura: dbData.altura,

        // Coordenadas (todas as versões para compatibilidade)
        ...coords,

        // Campos TRAQ
        pontuacao: dbData.pontuacao,
        riskFactors: dbData.riskfactors,
        riskLevel: dbData.risklevel,
        residualRisk: dbData.residualrisk,
        mitigation: dbData.mitigation,
        targetCategory: dbData.targetcategory,
        risco: dbData.risco,
        riscoClass: dbData.riscoclass,

        // Campos TRAQ - Falha provável e Alvo
        failureProb: dbData.failureprob,
        targetType: dbData.targettype,

        // Mídia
        hasPhoto: dbData.hasphoto || false,
        photoUrl: dbData.image_url || null,

        // Timestamps
        created_at: dbData.created_at,
        updated_at: dbData.updated_at,
      };

      console.log(`[Supabase] ✓ Árvore ${treeId} carregada`);
      return { data: mappedTree, error: null };
    } catch (error) {
      console.error("[Supabase] ❌ Erro ao buscar árvore:", error);
      return { data: null, error: error.message };
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

        // Campos TRAQ - Falha provável e Alvo
        failureprob: treeData.failureProb,
        targettype: treeData.targetType,

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

          // Campos TRAQ - Falha provável e Alvo
          failureprob: treeData.failureProb,
          targettype: treeData.targetType,

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

          // Campos TRAQ - Falha provável e Alvo
          failureProb: row.failureprob,
          targetType: row.targettype,

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
  // OPERAÇÕES COM PLANOS DE INTERVENÇÃO
  // ---------------------------------------------------

  /**
   * Salva um plano de intervenção no banco de dados
   * Cada árvore pode ter apenas um plano por usuário
   */
  async savePlan(planData) {
    if (!_supabase) return { error: "Offline" };

    try {
      const user = await this.getUser();
      if (!user) return { error: "Usuário não autenticado" };

      // Verificar se já existe um plano para esta árvore
      const existingResult = await this.checkExistingPlan(planData.treeId);
      if (existingResult.error) throw existingResult.error;

      const dbPayload = {
        id: planData.id,
        tree_id: planData.treeId,
        user_id: user.id,
        intervention_type: planData.interventionType,
        techniques: planData.techniques || [],
        justification: planData.justification,
        tools: planData.tools || [],
        epis: planData.epis || [],
        team_composition: planData.teamComposition,
        schedule: planData.schedule,
        durations: planData.durations,
        responsible: planData.responsible,
        responsible_title: planData.responsibleTitle,
        waste_destination: planData.wasteDestination,
        execution_instructions: planData.executionInstructions,
        failure_prob: planData.failureProb,  // Adicionando campo de falha provável
        target_type: planData.targetType,    // Adicionando campo de alvo
        updated_at: new Date().toISOString()
      };

      let result;
      if (existingResult.data) {
        // Update existing plan - remove id from payload to avoid constraint issues
        const updatePayload = { ...dbPayload };
        delete updatePayload.id; // Don't include id in update payload
        result = await _supabase
          .from('planos_intervencao')
          .update(updatePayload)
          .eq('id', existingResult.data.id);
      } else {
        // Insert new plan
        result = await _supabase
          .from('planos_intervencao')
          .insert(dbPayload);
      }

      if (result.error) throw result.error;

      console.log('[Supabase] ✓ Plano salvo:', planData.id);
      return { data: result.data, error: null };

    } catch (error) {
      console.error('[Supabase] ❌ Erro ao salvar plano:', error);
      return { data: null, error };
    }
  },

  /**
   * Carrega planos de intervenção do usuário logado
   */
  async getUserPlans() {
    if (!_supabase) return { data: [], error: "Offline" };

    try {
      const user = await this.getUser();
      if (!user) return { data: [], error: "Usuário não autenticado" };

      const { data, error } = await _supabase
        .from('planos_intervencao')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Mapear dados do banco para formato da aplicação
      const mappedPlans = data.map(row => ({
        id: row.id,
        treeId: row.tree_id,
        interventionType: row.intervention_type,
        techniques: row.techniques || [],
        justification: row.justification,
        tools: row.tools || [],
        epis: row.epis || [],
        teamComposition: row.team_composition,
        schedule: row.schedule,
        durations: row.durations,
        responsible: row.responsible,
        responsibleTitle: row.responsible_title,
        wasteDestination: row.waste_destination,
        executionInstructions: row.execution_instructions,
        failureProb: row.failure_prob,      // Adicionando campo de falha provável
        targetType: row.target_type,        // Adicionando campo de alvo
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));

      return { data: mappedPlans, error: null };

    } catch (error) {
      console.error('[Supabase] ❌ Erro ao carregar planos:', error);
      return { data: [], error };
    }
  },

  /**
   * Carrega um plano específico por ID
   */
  async getPlan(planId) {
    if (!_supabase) return { data: null, error: "Offline" };

    try {
      const user = await this.getUser();
      if (!user) return { data: null, error: "Usuário não autenticado" };

      const { data, error } = await _supabase
        .from('planos_intervencao')
        .select('*')
        .eq('id', planId)
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      // Mapear para formato da aplicação
      const plan = {
        id: data.id,
        treeId: data.tree_id,
        interventionType: data.intervention_type,
        techniques: data.techniques || [],
        justification: data.justification,
        tools: data.tools || [],
        epis: data.epis || [],
        teamComposition: data.team_composition,
        schedule: data.schedule,
        durations: data.durations,
        responsible: data.responsible,
        responsibleTitle: data.responsible_title,
        wasteDestination: data.waste_destination,
        executionInstructions: data.execution_instructions,
        failureProb: data.failure_prob,      // Adicionando campo de falha provável
        targetType: data.target_type,        // Adicionando campo de alvo
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };

      return { data: plan, error: null };

    } catch (error) {
      console.error('[Supabase] ❌ Erro ao carregar plano:', error);
      return { data: null, error };
    }
  },

  /**
   * Verifica se já existe plano para uma árvore específica
   */
  async checkExistingPlan(treeId) {
    if (!_supabase) return { data: null, error: "Offline" };

    try {
      const user = await this.getUser();
      if (!user) return { data: null, error: "Usuário não autenticado" };

      // Usar maybeSingle() em vez de single() para evitar erro 406
      const { data, error } = await _supabase
        .from('planos_intervencao')
        .select('id, updated_at')
        .eq('tree_id', treeId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      return { data: data || null, error: null };

    } catch (error) {
      console.error('[Supabase] ❌ Erro ao verificar plano existente:', error);
      return { data: null, error };
    }
  },

  /**
   * Exclui um plano de intervenção
   */
  async deletePlan(planId) {
    if (!_supabase) return { error: "Offline" };

    try {
      const user = await this.getUser();
      if (!user) return { error: "Usuário não autenticado" };

      const { error } = await _supabase
        .from('planos_intervencao')
        .delete()
        .eq('id', planId)
        .eq('user_id', user.id);

      if (error) throw error;

      console.log('[Supabase] ✓ Plano excluído:', planId);
      return { error: null };

    } catch (error) {
      console.error('[Supabase] ❌ Erro ao excluir plano:', error);
      return { error };
    }
  },

  /**
   * Atualiza um plano existente (usado para atualizar schedule após recalcular datas)
   */
  async updatePlan(planId, updates) {
    if (!_supabase) return { error: "Offline" };

    try {
      const user = await this.getUser();
      if (!user) return { error: "Usuário não autenticado" };

      const { data, error } = await _supabase
        .from('planos_intervencao')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', planId)
        .eq('user_id', user.id)
        .select();

      if (error) throw error;

      console.log('[Supabase] ✓ Plano atualizado:', planId);
      return { data, error: null };

    } catch (error) {
      console.error('[Supabase] ❌ Erro ao atualizar plano:', error);
      return { data: null, error };
    }
  },

  // ---------------------------------------------------
  // OPERAÇÕES COM DEPENDÊNCIAS DE PLANOS
  // ---------------------------------------------------

  /**
   * Salva uma dependência entre planos
   */
  async saveDependency(dependencyData) {
    if (!_supabase) return { error: "Offline" };

    try {
      const user = await this.getUser();
      if (!user) return { error: "Usuário não autenticado" };

      const dbPayload = {
        user_id: user.id,
        from_plan_id: dependencyData.from,
        to_plan_id: dependencyData.to,
        dependency_type: dependencyData.type,
        lag_days: dependencyData.lag || 0
      };

      const { data, error } = await _supabase
        .from('plan_dependencies')
        .upsert(dbPayload, {
          onConflict: 'user_id,from_plan_id,to_plan_id'
        })
        .select();

      if (error) throw error;

      console.log('[Supabase] ✓ Dependência salva');
      return { data, error: null };

    } catch (error) {
      console.error('[Supabase] ❌ Erro ao salvar dependência:', error);
      return { data: null, error };
    }
  },

  /**
   * Carrega dependências do usuário logado
   */
  async getUserDependencies() {
    if (!_supabase) return { data: [], error: "Offline" };

    try {
      const user = await this.getUser();
      if (!user) return { data: [], error: "Usuário não autenticado" };

      const { data, error } = await _supabase
        .from('plan_dependencies')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;

      // Mapear para formato da aplicação
      const mappedDeps = data.map(row => ({
        from: row.from_plan_id,
        to: row.to_plan_id,
        type: row.dependency_type,
        lag: row.lag_days,
        createdAt: row.created_at
      }));

      console.log(`[Supabase] ✓ ${mappedDeps.length} dependências carregadas`);
      return { data: mappedDeps, error: null };

    } catch (error) {
      console.error('[Supabase] ❌ Erro ao carregar dependências:', error);
      return { data: [], error };
    }
  },

  /**
   * Remove uma dependência
   */
  async deleteDependency(fromPlanId, toPlanId) {
    if (!_supabase) return { error: "Offline" };

    try {
      const user = await this.getUser();
      if (!user) return { error: "Usuário não autenticado" };

      const { error } = await _supabase
        .from('plan_dependencies')
        .delete()
        .eq('user_id', user.id)
        .eq('from_plan_id', fromPlanId)
        .eq('to_plan_id', toPlanId);

      if (error) throw error;

      console.log('[Supabase] ✓ Dependência removida');
      return { error: null };

    } catch (error) {
      console.error('[Supabase] ❌ Erro ao remover dependência:', error);
      return { error };
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
  // OPERAÇÕES COM PROJETOS
  // ---------------------------------------------------

  /**
   * Cria um novo projeto
   */
  async createProject(projectData) {
    if (!_supabase) return { error: "Offline" };

    try {
      const user = await this.getUser();
      if (!user) return { error: "Usuário não autenticado" };

      const dbPayload = {
        user_id: user.id,
        name: projectData.name,
        description: projectData.description,
        status: projectData.status || 'ativo',
        start_date: projectData.startDate,
        end_date: projectData.endDate,
      };

      const { data, error } = await _supabase
        .from('projetos')
        .insert(dbPayload)
        .select()
        .single();

      if (error) throw error;

      console.log('[Supabase] ✓ Projeto criado:', data.id);
      return { data: this._mapProject(data), error: null };

    } catch (error) {
      console.error('[Supabase] ❌ Erro ao criar projeto:', error);
      return { data: null, error };
    }
  },

  /**
   * Lista projetos do usuário com filtros opcionais
   */
  async getProjects(filters = {}) {
    if (!_supabase) return { data: [], error: "Offline" };

    try {
      const user = await this.getUser();
      if (!user) return { data: [], error: "Usuário não autenticado" };

      let query = _supabase
        .from('projetos_com_estatisticas')
        .select('*')
        .eq('user_id', user.id);

      // Aplicar filtros
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.startDateFrom) {
        query = query.gte('start_date', filters.startDateFrom);
      }
      if (filters.startDateTo) {
        query = query.lte('start_date', filters.startDateTo);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;

      const mappedProjects = data.map(p => this._mapProject(p));
      console.log(`[Supabase] ✓ ${mappedProjects.length} projetos carregados`);
      return { data: mappedProjects, error: null };

    } catch (error) {
      console.error('[Supabase] ❌ Erro ao carregar projetos:', error);
      return { data: [], error };
    }
  },

  /**
   * Busca um projeto específico por ID
   */
  async getProject(projectId) {
    if (!_supabase) return { data: null, error: "Offline" };

    try {
      const user = await this.getUser();
      if (!user) return { data: null, error: "Usuário não autenticado" };

      const { data, error } = await _supabase
        .from('projetos_com_estatisticas')
        .select('*')
        .eq('id', projectId)
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      return { data: this._mapProject(data), error: null };

    } catch (error) {
      console.error('[Supabase] ❌ Erro ao carregar projeto:', error);
      return { data: null, error };
    }
  },

  /**
   * Atualiza um projeto existente
   */
  async updateProject(projectId, updates) {
    if (!_supabase) return { error: "Offline" };

    try {
      const user = await this.getUser();
      if (!user) return { error: "Usuário não autenticado" };

      const dbPayload = {};
      if (updates.name !== undefined) dbPayload.name = updates.name;
      if (updates.description !== undefined) dbPayload.description = updates.description;
      if (updates.status !== undefined) dbPayload.status = updates.status;
      if (updates.startDate !== undefined) dbPayload.start_date = updates.startDate;
      if (updates.endDate !== undefined) dbPayload.end_date = updates.endDate;

      const { data, error } = await _supabase
        .from('projetos')
        .update(dbPayload)
        .eq('id', projectId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      console.log('[Supabase] ✓ Projeto atualizado:', projectId);
      return { data: this._mapProject(data), error: null };

    } catch (error) {
      console.error('[Supabase] ❌ Erro ao atualizar projeto:', error);
      return { data: null, error };
    }
  },

  /**
   * Exclui um projeto (e todas suas atividades em cascata)
   */
  async deleteProject(projectId) {
    if (!_supabase) return { error: "Offline" };

    try {
      const user = await this.getUser();
      if (!user) return { error: "Usuário não autenticado" };

      const { error } = await _supabase
        .from('projetos')
        .delete()
        .eq('id', projectId)
        .eq('user_id', user.id);

      if (error) throw error;

      console.log('[Supabase] ✓ Projeto excluído:', projectId);
      return { error: null };

    } catch (error) {
      console.error('[Supabase] ❌ Erro ao excluir projeto:', error);
      return { error };
    }
  },

  // ---------------------------------------------------
  // OPERAÇÕES COM ATIVIDADES
  // ---------------------------------------------------

  /**
   * Cria uma nova atividade em um projeto
   */
  async createActivity(activityData) {
    if (!_supabase) return { error: "Offline" };

    try {
      const user = await this.getUser();
      if (!user) return { error: "Usuário não autenticado" };

      const dbPayload = {
        project_id: activityData.projectId,
        plan_id: activityData.planId || null,
        title: activityData.title,
        description: activityData.description,
        status: activityData.status || 'pendente',
        priority: activityData.priority || 2,
        assigned_to: activityData.assignedTo,
        start_date: activityData.startDate,
        end_date: activityData.endDate,
      };

      const { data, error } = await _supabase
        .from('atividades')
        .insert(dbPayload)
        .select()
        .single();

      if (error) throw error;

      console.log('[Supabase] ✓ Atividade criada:', data.id);
      return { data: this._mapActivity(data), error: null };

    } catch (error) {
      console.error('[Supabase] ❌ Erro ao criar atividade:', error);
      return { data: null, error };
    }
  },

  /**
   * Lista atividades de um projeto
   */
  async getActivities(projectId, filters = {}) {
    if (!_supabase) return { data: [], error: "Offline" };

    try {
      const user = await this.getUser();
      if (!user) return { data: [], error: "Usuário não autenticado" };

      let query = _supabase
        .from('atividades')
        .select('*')
        .eq('project_id', projectId);

      // Aplicar filtros
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.priority) {
        query = query.eq('priority', filters.priority);
      }

      query = query.order('start_date', { ascending: true });

      const { data, error } = await query;

      if (error) throw error;

      const mappedActivities = data.map(a => this._mapActivity(a));
      console.log(`[Supabase] ✓ ${mappedActivities.length} atividades carregadas`);
      return { data: mappedActivities, error: null };

    } catch (error) {
      console.error('[Supabase] ❌ Erro ao carregar atividades:', error);
      return { data: [], error };
    }
  },

  /**
   * Busca uma atividade específica
   */
  async getActivity(activityId) {
    if (!_supabase) return { data: null, error: "Offline" };

    try {
      const { data, error } = await _supabase
        .from('atividades')
        .select('*')
        .eq('id', activityId)
        .single();

      if (error) throw error;

      return { data: this._mapActivity(data), error: null };

    } catch (error) {
      console.error('[Supabase] ❌ Erro ao carregar atividade:', error);
      return { data: null, error };
    }
  },

  /**
   * Atualiza uma atividade existente
   */
  async updateActivity(activityId, updates) {
    if (!_supabase) return { error: "Offline" };

    try {
      const dbPayload = {};
      if (updates.title !== undefined) dbPayload.title = updates.title;
      if (updates.description !== undefined) dbPayload.description = updates.description;
      if (updates.status !== undefined) dbPayload.status = updates.status;
      if (updates.priority !== undefined) dbPayload.priority = updates.priority;
      if (updates.assignedTo !== undefined) dbPayload.assigned_to = updates.assignedTo;
      if (updates.startDate !== undefined) dbPayload.start_date = updates.startDate;
      if (updates.endDate !== undefined) dbPayload.end_date = updates.endDate;

      const { data, error } = await _supabase
        .from('atividades')
        .update(dbPayload)
        .eq('id', activityId)
        .select()
        .single();

      if (error) throw error;

      console.log('[Supabase] ✓ Atividade atualizada:', activityId);
      return { data: this._mapActivity(data), error: null };

    } catch (error) {
      console.error('[Supabase] ❌ Erro ao atualizar atividade:', error);
      return { data: null, error };
    }
  },

  /**
   * Atualiza o status de uma atividade (registra no histórico automaticamente via trigger)
   */
  async updateActivityStatus(activityId, newStatus, comments = null) {
    if (!_supabase) return { error: "Offline" };

    try {
      const user = await this.getUser();
      if (!user) return { error: "Usuário não autenticado" };

      // Atualizar status (trigger registrará automaticamente no histórico)
      const { data: activity, error: updateError } = await _supabase
        .from('atividades')
        .update({ status: newStatus })
        .eq('id', activityId)
        .select()
        .single();

      if (updateError) throw updateError;

      // Se houver comentários, atualizar o último registro do histórico
      if (comments) {
        const { error: historyError } = await _supabase
          .from('atividades_historico')
          .update({ comments: comments })
          .eq('atividade_id', activityId)
          .eq('new_status', newStatus)
          .order('created_at', { ascending: false })
          .limit(1);

        if (historyError) {
          console.warn('[Supabase] ⚠️ Erro ao adicionar comentário ao histórico:', historyError);
        }
      }

      console.log('[Supabase] ✓ Status atualizado:', activityId, '->', newStatus);
      return { data: this._mapActivity(activity), error: null };

    } catch (error) {
      console.error('[Supabase] ❌ Erro ao atualizar status:', error);
      return { data: null, error };
    }
  },

  /**
   * Exclui uma atividade
   */
  async deleteActivity(activityId) {
    if (!_supabase) return { error: "Offline" };

    try {
      const { error } = await _supabase
        .from('atividades')
        .delete()
        .eq('id', activityId);

      if (error) throw error;

      console.log('[Supabase] ✓ Atividade excluída:', activityId);
      return { error: null };

    } catch (error) {
      console.error('[Supabase] ❌ Erro ao excluir atividade:', error);
      return { error };
    }
  },

  /**
   * Busca histórico de uma atividade
   */
  async getActivityHistory(activityId) {
    if (!_supabase) return { data: [], error: "Offline" };

    try {
      const { data, error } = await _supabase
        .from('atividades_historico')
        .select('*')
        .eq('atividade_id', activityId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mappedHistory = data.map(h => ({
        id: h.id,
        activityId: h.atividade_id,
        userId: h.user_id,
        oldStatus: h.old_status,
        newStatus: h.new_status,
        comments: h.comments,
        createdAt: h.created_at,
      }));

      return { data: mappedHistory, error: null };

    } catch (error) {
      console.error('[Supabase] ❌ Erro ao carregar histórico:', error);
      return { data: [], error };
    }
  },

  // ---------------------------------------------------
  // DASHBOARD E ESTATÍSTICAS
  // ---------------------------------------------------

  /**
   * Busca estatísticas para o dashboard
   */
  async getDashboardStats() {
    if (!_supabase) return { data: null, error: "Offline" };

    try {
      const user = await this.getUser();
      if (!user) return { data: null, error: "Usuário não autenticado" };

      // Contar projetos ativos
      const { count: activosCount } = await _supabase
        .from('projetos')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'ativo');

      // Contar atividades pendentes (de todos os projetos ativos)
      const { count: pendentesCount } = await _supabase
        .from('atividades')
        .select('*, projetos!inner(user_id)', { count: 'exact', head: true })
        .eq('projetos.user_id', user.id)
        .eq('status', 'pendente');

      // Atividades atrasadas (data passada e não concluídas)
      const today = new Date().toISOString().split('T')[0];
      const { count: atrasadasCount } = await _supabase
        .from('atividades')
        .select('*, projetos!inner(user_id)', { count: 'exact', head: true })
        .eq('projetos.user_id', user.id)
        .lt('end_date', today)
        .neq('status', 'concluido')
        .neq('status', 'cancelado');

      // Projetos concluídos no mês atual
      const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
      const { count: concluidosMesCount } = await _supabase
        .from('projetos')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'concluido')
        .gte('updated_at', firstDayOfMonth);

      // Próximas 5 atividades urgentes
      const { data: proximasAtividades } = await _supabase
        .from('atividades')
        .select('*, projetos!inner(user_id, name)')
        .eq('projetos.user_id', user.id)
        .in('status', ['pendente', 'em_andamento'])
        .order('start_date', { ascending: true })
        .order('priority', { ascending: false })
        .limit(5);

      const stats = {
        projectsActive: activosCount || 0,
        activitiesPending: pendentesCount || 0,
        activitiesOverdue: atrasadasCount || 0,
        projectsCompletedThisMonth: concluidosMesCount || 0,
        upcomingActivities: proximasAtividades?.map(a => ({
          ...this._mapActivity(a),
          projectName: a.projetos?.name
        })) || [],
      };

      console.log('[Supabase] ✓ Estatísticas do dashboard carregadas');
      return { data: stats, error: null };

    } catch (error) {
      console.error('[Supabase] ❌ Erro ao carregar estatísticas:', error);
      return { data: null, error };
    }
  },

  /**
   * Busca dados para o gráfico Gantt de um projeto
   */
  async getProjectTimeline(projectId) {
    if (!_supabase) return { data: [], error: "Offline" };

    try {
      const user = await this.getUser();
      if (!user) return { data: [], error: "Usuário não autenticado" };

      const { data: activities, error } = await _supabase
        .from('atividades')
        .select('*')
        .eq('project_id', projectId)
        .order('start_date', { ascending: true });

      if (error) throw error;

      // Formatar para o formato esperado pela biblioteca Gantt
      const timelineData = activities.map(a => ({
        id: a.id,
        title: a.title,
        startDate: a.start_date,
        endDate: a.end_date,
        status: a.status,
        priority: a.priority,
        assignedTo: a.assigned_to,
        progress: a.status === 'concluido' ? 100 : a.status === 'em_andamento' ? 50 : 0,
      }));

      return { data: timelineData, error: null };

    } catch (error) {
      console.error('[Supabase] ❌ Erro ao carregar timeline:', error);
      return { data: [], error };
    }
  },

  // ---------------------------------------------------
  // FUNÇÕES AUXILIARES DE MAPEAMENTO
  // ---------------------------------------------------

  _mapProject(row) {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      status: row.status,
      startDate: row.start_date,
      endDate: row.end_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      // Estatísticas (se vier da view)
      totalActivities: row.total_atividades || 0,
      activitiesCompleted: row.atividades_concluidas || 0,
      activitiesPending: row.atividades_pendentes || 0,
      activitiesInProgress: row.atividades_em_andamento || 0,
      activitiesBlocked: row.atividades_bloqueadas || 0,
      activitiesOverdue: row.atividades_atrasadas || 0,
    };
  },

  _mapActivity(row) {
    return {
      id: row.id,
      projectId: row.project_id,
      planId: row.plan_id,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      assignedTo: row.assigned_to,
      startDate: row.start_date,
      endDate: row.end_date,
      completedAt: row.completed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },

  // ---------------------------------------------------
  // UTILITÁRIOS
  // ---------------------------------------------------

  getSupabaseUrl() {
    return SUPABASE_URL;
  },
};

