-- Arquivo: update_schema_altura.sql
-- OBJETIVO: Corrigir erro PGRST204 (Coluna 'altura' não encontrada)

-- Este script verifica e cria a coluna 'altura' na tabela 'arvores'.
-- Execute este script no SQL Editor do Supabase.

DO $$
BEGIN
    -- Verifica se a coluna 'altura' existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'arvores' AND column_name = 'altura') THEN
        -- Cria a coluna como TEXT para máxima compatibilidade (aceita "5.5", "5m", "N/A")
        ALTER TABLE public.arvores ADD COLUMN altura TEXT;
        RAISE NOTICE 'Coluna altura criada com sucesso.';
    ELSE
        RAISE NOTICE 'A coluna altura já existe.';
    END IF;

    -- Prevenção: Garante que 'dap' também exista, pois é frequentemente usada com altura
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'arvores' AND column_name = 'dap') THEN
        ALTER TABLE public.arvores ADD COLUMN dap TEXT;
        RAISE NOTICE 'Coluna dap criada com sucesso.';
    END IF;
    
    -- Notificação de recarga de schema (implícito ao rodar DDL no Supabase, mas bom documentar)
    RAISE NOTICE 'Schema atualizado. O cache do PostgREST deve ser invalidado automaticamente.';
END $$;
