-- =====================================================
-- FIX MISSING COLUMNS - Script Rápido de Correção
-- =====================================================
-- Este script adiciona APENAS as colunas que estão faltando
-- Execute no SQL Editor do Supabase
-- =====================================================

-- ADICIONAR COLUNA 'avaliador' (CRÍTICO - estava faltando!)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'arvores' AND column_name = 'avaliador'
    ) THEN
        ALTER TABLE public.arvores ADD COLUMN avaliador TEXT;
        RAISE NOTICE 'Coluna avaliador adicionada com sucesso';
    ELSE
        RAISE NOTICE 'Coluna avaliador já existe';
    END IF;
END $$;

-- ADICIONAR COLUNA 'nome' (necessária para NOT NULL constraint)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'arvores' AND column_name = 'nome'
    ) THEN
        ALTER TABLE public.arvores ADD COLUMN nome TEXT;
        RAISE NOTICE 'Coluna nome adicionada com sucesso';
    ELSE
        RAISE NOTICE 'Coluna nome já existe';
    END IF;
END $$;

-- ADICIONAR COLUNA 'easting' (coordenada UTM)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'arvores' AND column_name = 'easting'
    ) THEN
        ALTER TABLE public.arvores ADD COLUMN easting NUMERIC(15,2) DEFAULT 0;
        RAISE NOTICE 'Coluna easting adicionada com sucesso';
    ELSE
        RAISE NOTICE 'Coluna easting já existe';
    END IF;
END $$;

-- ADICIONAR COLUNA 'northing' (coordenada UTM)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'arvores' AND column_name = 'northing'
    ) THEN
        ALTER TABLE public.arvores ADD COLUMN northing NUMERIC(15,2) DEFAULT 0;
        RAISE NOTICE 'Coluna northing adicionada com sucesso';
    ELSE
        RAISE NOTICE 'Coluna northing já existe';
    END IF;
END $$;

-- GARANTIR QUE 'altura' EXISTE (pode estar faltando)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'arvores' AND column_name = 'altura'
    ) THEN
        ALTER TABLE public.arvores ADD COLUMN altura NUMERIC(10,2) DEFAULT 0;
        RAISE NOTICE 'Coluna altura adicionada com sucesso';
    ELSE
        RAISE NOTICE 'Coluna altura já existe';
    END IF;
END $$;

-- GARANTIR QUE 'data' EXISTE
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'arvores' AND column_name = 'data'
    ) THEN
        ALTER TABLE public.arvores ADD COLUMN data DATE;
        RAISE NOTICE 'Coluna data adicionada com sucesso';
    ELSE
        RAISE NOTICE 'Coluna data já existe';
    END IF;
END $$;

-- ALTERAR TIPO DE 'dap' PARA NUMERIC SE FOR TEXT
DO $$
DECLARE
    col_type TEXT;
BEGIN
    SELECT data_type INTO col_type
    FROM information_schema.columns
    WHERE table_name = 'arvores' AND column_name = 'dap';

    IF col_type = 'text' THEN
        ALTER TABLE public.arvores ALTER COLUMN dap TYPE NUMERIC(10,2)
        USING CASE
            WHEN dap ~ '^[0-9]+\.?[0-9]*$' THEN dap::NUMERIC(10,2)
            ELSE 0
        END;
        RAISE NOTICE 'Coluna dap convertida de TEXT para NUMERIC';
    ELSIF col_type IS NULL THEN
        ALTER TABLE public.arvores ADD COLUMN dap NUMERIC(10,2) DEFAULT 0;
        RAISE NOTICE 'Coluna dap adicionada';
    ELSE
        RAISE NOTICE 'Coluna dap já está no tipo correto: %', col_type;
    END IF;
END $$;

-- ALTERAR TIPO DE 'altura' PARA NUMERIC SE FOR TEXT
DO $$
DECLARE
    col_type TEXT;
BEGIN
    SELECT data_type INTO col_type
    FROM information_schema.columns
    WHERE table_name = 'arvores' AND column_name = 'altura';

    IF col_type = 'text' THEN
        ALTER TABLE public.arvores ALTER COLUMN altura TYPE NUMERIC(10,2)
        USING CASE
            WHEN altura ~ '^[0-9]+\.?[0-9]*$' THEN altura::NUMERIC(10,2)
            ELSE 0
        END;
        RAISE NOTICE 'Coluna altura convertida de TEXT para NUMERIC';
    ELSE
        RAISE NOTICE 'Coluna altura já está no tipo correto: %', col_type;
    END IF;
END $$;

-- GARANTIR QUE riskfactors EXISTE (manter como JSONB ou criar como INTEGER[])
DO $$
DECLARE
    col_type TEXT;
BEGIN
    SELECT data_type INTO col_type
    FROM information_schema.columns
    WHERE table_name = 'arvores' AND column_name = 'riskfactors';

    IF col_type IS NULL THEN
        -- Se não existe, criar como INTEGER[]
        ALTER TABLE public.arvores ADD COLUMN riskfactors INTEGER[] DEFAULT '{}';
        RAISE NOTICE 'Coluna riskfactors adicionada como INTEGER[]';
    ELSE
        -- Se existe, manter como está (não converter)
        RAISE NOTICE 'Coluna riskfactors já existe como: %', col_type;
    END IF;
END $$;

-- PREENCHER VALORES NULL EM 'nome' COM VALORES DE 'especie'
UPDATE public.arvores
SET nome = COALESCE(especie, 'Árvore sem nome')
WHERE nome IS NULL OR nome = '';

-- MIGRAR DADOS DE coordx/coordy PARA easting/northing (SE EXISTIREM)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'arvores' AND column_name = 'coordx'
    ) THEN
        UPDATE public.arvores
        SET easting = COALESCE(coordx, easting),
            northing = COALESCE(coordy, northing)
        WHERE (easting = 0 OR easting IS NULL) AND coordx IS NOT NULL;

        RAISE NOTICE 'Dados migrados de coordx/coordy para easting/northing';
    END IF;
END $$;

-- MIGRAR DADOS DE longitude/latitude PARA easting/northing (SE APROPRIADO)
DO $$
BEGIN
    -- Apenas migrar se easting/northing estiverem vazios E longitude/latitude tiverem valores grandes (indicando UTM)
    UPDATE public.arvores
    SET easting = longitude,
        northing = latitude
    WHERE (easting = 0 OR easting IS NULL)
      AND longitude > 1000
      AND latitude > 1000;

    IF FOUND THEN
        RAISE NOTICE 'Dados migrados de longitude/latitude para easting/northing';
    END IF;
END $$;

-- PREENCHER utmzonenum COM VALOR PADRÃO (23 - São Paulo) SE NULL
UPDATE public.arvores
SET utmzonenum = 23
WHERE utmzonenum IS NULL
  AND easting IS NOT NULL
  AND northing IS NOT NULL
  AND easting != 0
  AND northing != 0;

-- PREENCHER utmzoneletter COM VALOR PADRÃO (K - Hemisfério Sul) SE NULL
UPDATE public.arvores
SET utmzoneletter = 'K'
WHERE utmzoneletter IS NULL
  AND easting IS NOT NULL
  AND northing IS NOT NULL
  AND easting != 0
  AND northing != 0;

-- =====================================================
-- VERIFICAÇÃO FINAL
-- =====================================================

-- Mostrar colunas críticas da tabela
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'arvores'
  AND column_name IN (
    'avaliador', 'nome', 'easting', 'northing',
    'utmzonenum', 'utmzoneletter', 'dap', 'altura',
    'riskfactors', 'especie', 'data'
  )
ORDER BY column_name;

-- =====================================================
-- FIM DO SCRIPT
-- =====================================================
-- Após executar:
-- 1. Verifique a tabela de resultados acima
-- 2. Recarregue o app com Ctrl+Shift+R
-- 3. Tente registrar uma árvore
-- =====================================================
