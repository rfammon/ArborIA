-- Arquivo: setup_database.sql
-- CORREÇÃO: Este script ajusta tabelas existentes e cria novas se necessário.

-- 1. TABELA DE PERFIS (PROFILES)
-- Cria a tabela de perfis vinculada aos usuários do Supabase
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    full_name TEXT,
    preferences JSONB DEFAULT '{}'::jsonb
);

-- 2. AJUSTE DA TABELA DE ÁRVORES (ARVORES)
-- Primeiro, garantimos que a tabela existe (caso seja uma instalação limpa)
CREATE TABLE IF NOT EXISTS public.arvores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AGORA, A MÁGICA: Adicionamos as colunas que faltam na tabela existente
-- Isso previne o erro "column does not exist"

-- Adiciona user_id se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'arvores' AND column_name = 'user_id') THEN
        ALTER TABLE public.arvores ADD COLUMN user_id UUID REFERENCES auth.users(id);
    END IF;
END $$;

-- Adiciona updated_at se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'arvores' AND column_name = 'updated_at') THEN
        ALTER TABLE public.arvores ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- Adiciona deleted_at se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'arvores' AND column_name = 'deleted_at') THEN
        ALTER TABLE public.arvores ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- [CORREÇÃO CRÍTICA] Adiciona altura se não existir (Fix PGRST204)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'arvores' AND column_name = 'altura') THEN
        ALTER TABLE public.arvores ADD COLUMN altura TEXT;
    END IF;
END $$;

-- Adiciona outras colunas essenciais para evitar erros futuros
DO $$
BEGIN
    -- Lista de colunas comuns usadas em features.js
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'arvores' AND column_name = 'especie') THEN ALTER TABLE public.arvores ADD COLUMN especie TEXT; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'arvores' AND column_name = 'dap') THEN ALTER TABLE public.arvores ADD COLUMN dap TEXT; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'arvores' AND column_name = 'local') THEN ALTER TABLE public.arvores ADD COLUMN local TEXT; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'arvores' AND column_name = 'observacoes') THEN ALTER TABLE public.arvores ADD COLUMN observacoes TEXT; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'arvores' AND column_name = 'pontuacao') THEN ALTER TABLE public.arvores ADD COLUMN pontuacao INTEGER; END IF;
END $$;

-- 3. HABILITAR RLS (Row Level Security)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arvores ENABLE ROW LEVEL SECURITY;

-- 4. POLÍTICAS DE SEGURANÇA (POLICIES)
-- Removemos políticas antigas para evitar erro de "policy already exists" ao rodar de novo
DROP POLICY IF EXISTS "Usuários podem ver seu próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Usuários podem atualizar seu próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Usuários podem criar seu próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Usuários têm controle total sobre suas árvores" ON public.arvores;

-- Recriamos as políticas

-- Políticas para Profiles
CREATE POLICY "Usuários podem ver seu próprio perfil"
ON public.profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Usuários podem atualizar seu próprio perfil"
ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Usuários podem criar seu próprio perfil"
ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Políticas para Arvores
CREATE POLICY "Usuários têm controle total sobre suas árvores"
ON public.arvores
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 5. TRIGGER PARA UPDATED_AT
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para arvores
DROP TRIGGER IF EXISTS set_updated_at ON public.arvores;
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.arvores
FOR EACH ROW
EXECUTE PROCEDURE handle_updated_at();

-- Trigger para profiles
DROP TRIGGER IF EXISTS set_updated_at_profiles ON public.profiles;
CREATE TRIGGER set_updated_at_profiles
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE PROCEDURE handle_updated_at();
