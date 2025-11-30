-- =================================================================
-- SCRIPT DE ADEQUAÇÃO DE ESQUEMA - ARBORIA 2.0
--
-- OBJETIVO: Alinhar a tabela 'arvores' com os dados enviados pela 
--           aplicação, corrigindo erros de 'numeric field overflow'
--           e 'column does not exist'.
--
-- COMO EXECUTAR:
-- 1. Acesse seu projeto no Supabase.
-- 2. Navegue até a seção "SQL Editor".
-- 3. Clique em "+ New query".
-- 4. Cole o conteúdo completo deste script no editor.
-- 5. Clique em "RUN".
--
-- NOTA: O script é idempotente. Ele só adiciona ou altera colunas
--       se a alteração for necessária. Pode ser executado com
--       segurança múltiplas vezes.
-- =================================================================

DO $$
BEGIN
    RAISE NOTICE 'Iniciando a adequação do esquema da tabela "arvores"...';

    -- -----------------------------------------------------------------
    -- SEÇÃO 1: Adicionar colunas faltantes
    -- Adiciona colunas que existem no objeto 'treeData' do app, mas
    -- podem não existir no banco de dados.
    -- -----------------------------------------------------------------

    -- Adiciona 'nome' (alias para especie)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'arvores' AND column_name = 'nome') THEN
        ALTER TABLE public.arvores ADD COLUMN nome TEXT;
        RAISE NOTICE 'Coluna "nome" adicionada.';
    END IF;

    -- Adiciona 'data' para a data da coleta
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'arvores' AND column_name = 'data') THEN
        ALTER TABLE public.arvores ADD COLUMN data DATE;
        RAISE NOTICE 'Coluna "data" adicionada.';
    END IF;

    -- Adiciona 'avaliador'
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'arvores' AND column_name = 'avaliador') THEN
        ALTER TABLE public.arvores ADD COLUMN avaliador TEXT;
        RAISE NOTICE 'Coluna "avaliador" adicionada.';
    END IF;

    -- Adiciona colunas de coordenadas UTM
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'arvores' AND column_name = 'utmzonenum') THEN
        ALTER TABLE public.arvores ADD COLUMN utmzonenum INTEGER;
        RAISE NOTICE 'Coluna "utmzonenum" adicionada.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'arvores' AND column_name = 'utmzoneletter') THEN
        ALTER TABLE public.arvores ADD COLUMN utmzoneletter TEXT;
        RAISE NOTICE 'Coluna "utmzoneletter" adicionada.';
    END IF;

    -- Adiciona colunas de análise de risco (TRAQ/ISA)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'arvores' AND column_name = 'riskfactors') THEN
        ALTER TABLE public.arvores ADD COLUMN riskfactors JSONB; -- JSONB é ideal para arrays
        RAISE NOTICE 'Coluna "riskfactors" adicionada.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'arvores' AND column_name = 'hasphoto') THEN
        ALTER TABLE public.arvores ADD COLUMN hasphoto BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Coluna "hasphoto" adicionada.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'arvores' AND column_name = 'risklevel') THEN
        ALTER TABLE public.arvores ADD COLUMN risklevel TEXT;
        RAISE NOTICE 'Coluna "risklevel" adicionada.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'arvores' AND column_name = 'residualrisk') THEN
        ALTER TABLE public.arvores ADD COLUMN residualrisk TEXT;
        RAISE NOTICE 'Coluna "residualrisk" adicionada.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'arvores' AND column_name = 'mitigation') THEN
        ALTER TABLE public.arvores ADD COLUMN mitigation TEXT;
        RAISE NOTICE 'Coluna "mitigation" adicionada.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'arvores' AND column_name = 'targetcategory') THEN
        ALTER TABLE public.arvores ADD COLUMN targetcategory TEXT;
        RAISE NOTICE 'Coluna "targetcategory" adicionada.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'arvores' AND column_name = 'risco') THEN
        ALTER TABLE public.arvores ADD COLUMN risco TEXT;
        RAISE NOTICE 'Coluna "risco" adicionada.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'arvores' AND column_name = 'riscoclass') THEN
        ALTER TABLE public.arvores ADD COLUMN riscoclass TEXT;
        RAISE NOTICE 'Coluna "riscoclass" adicionada.';
    END IF;

    -- -----------------------------------------------------------------
    -- SEÇÃO 2: Correção de Tipos de Dados
    -- Altera colunas que foram criadas com o tipo TEXT, mas que a 
    -- aplicação trata como números.
    -- -----------------------------------------------------------------

    -- Corrige DAP e Altura de TEXT para NUMERIC(10, 2)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'arvores' AND column_name = 'dap' AND udt_name = 'text') THEN
        ALTER TABLE public.arvores ALTER COLUMN dap TYPE NUMERIC(10, 2) USING (NULLIF(dap, '')::NUMERIC);
        RAISE NOTICE 'Coluna "dap" alterada de TEXT para NUMERIC(10, 2).';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'arvores' AND column_name = 'altura' AND udt_name = 'text') THEN
        ALTER TABLE public.arvores ALTER COLUMN altura TYPE NUMERIC(10, 2) USING (NULLIF(altura, '')::NUMERIC);
        RAISE NOTICE 'Coluna "altura" alterada de TEXT para NUMERIC(10, 2).';
    END IF;

    -- -----------------------------------------------------------------
    -- SEÇÃO 3: Correção de Colunas de Coordenadas
    -- Adiciona as colunas se não existirem, e garante que o tipo seja
    -- FLOAT8 (DOUBLE PRECISION) para acomodar tanto lat/lon quanto
    -- valores grandes de UTM, resolvendo o 'numeric field overflow'.
    -- -----------------------------------------------------------------

    -- Latitude (Mapeada de coordY)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'arvores' AND column_name = 'latitude') THEN
        ALTER TABLE public.arvores ADD COLUMN latitude DOUBLE PRECISION;
        RAISE NOTICE 'Coluna "latitude" adicionada com o tipo DOUBLE PRECISION.';
    ELSIF (SELECT udt_name FROM information_schema.columns WHERE table_name = 'arvores' AND column_name = 'latitude') <> 'float8' THEN
        ALTER TABLE public.arvores ALTER COLUMN latitude TYPE DOUBLE PRECISION;
        RAISE NOTICE 'Coluna "latitude" teve seu tipo alterado para DOUBLE PRECISION para evitar overflow.';
    END IF;

    -- Longitude (Mapeada de coordX)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'arvores' AND column_name = 'longitude') THEN
        ALTER TABLE public.arvores ADD COLUMN longitude DOUBLE PRECISION;
        RAISE NOTICE 'Coluna "longitude" adicionada com o tipo DOUBLE PRECISION.';
    ELSIF (SELECT udt_name FROM information_schema.columns WHERE table_name = 'arvores' AND column_name = 'longitude') <> 'float8' THEN
        ALTER TABLE public.arvores ALTER COLUMN longitude TYPE DOUBLE PRECISION;
        RAISE NOTICE 'Coluna "longitude" teve seu tipo alterado para DOUBLE PRECISION para evitar overflow.';
    END IF;

    RAISE NOTICE 'Adequação do esquema concluída com sucesso!';

END $$;
