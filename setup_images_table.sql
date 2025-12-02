-- Arquivo: setup_images_table.sql
-- Descrição: Cria a tabela para armazenar metadados de imagens das árvores e configura as políticas de segurança.

-- 1. TABELA DE IMAGENS DE ÁRVORES (arvore_imagens)
CREATE TABLE IF NOT EXISTS public.arvore_imagens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    arvore_id UUID NOT NULL REFERENCES public.arvores(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    original_filename TEXT,
    mime_type TEXT DEFAULT 'image/webp',
    original_size_kb INTEGER,
    compressed_size_kb INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Adiciona comentários para clareza
COMMENT ON TABLE public.arvore_imagens IS 'Metadados para as imagens associadas a cada árvore.';
COMMENT ON COLUMN public.arvore_imagens.arvore_id IS 'Referência para a árvore a que esta imagem pertence.';
COMMENT ON COLUMN public.arvore_imagens.storage_path IS 'Caminho do arquivo no Supabase Storage, ex: bucket/user_id/arvore_id/image_uuid.webp.';

-- 2. HABILITAR RLS (Row Level Security)
ALTER TABLE public.arvore_imagens ENABLE ROW LEVEL SECURITY;

-- 3. POLÍTICAS DE SEGURANÇA (POLICIES)
-- Remove políticas antigas para garantir a recriação sem erros
DROP POLICY IF EXISTS "Usuários podem ver as imagens de suas próprias árvores" ON public.arvore_imagens;
DROP POLICY IF EXISTS "Usuários podem inserir imagens para suas próprias árvores" ON public.arvore_imagens;
DROP POLICY IF EXISTS "Usuários podem apagar as imagens de suas próprias árvores" ON public.arvore_imagens;

-- Política de SELECT: Usuários podem ver as imagens que pertencem às suas árvores.
CREATE POLICY "Usuários podem ver as imagens de suas próprias árvores"
ON public.arvore_imagens FOR SELECT
USING (auth.uid() = user_id);

-- Política de INSERT: Usuários podem adicionar imagens para árvores que lhes pertencem.
-- A verificação garante que o user_id do registro da imagem seja o mesmo do usuário autenticado.
CREATE POLICY "Usuários podem inserir imagens para suas próprias árvores"
ON public.arvore_imagens FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Política de DELETE: Usuários podem apagar as imagens de suas árvores.
CREATE POLICY "Usuários podem apagar as imagens de suas próprias árvores"
ON public.arvore_imagens FOR DELETE
USING (auth.uid() = user_id);

-- 4. ÍNDICES
-- Cria um índice na coluna arvore_id para otimizar as consultas de imagens por árvore.
CREATE INDEX IF NOT EXISTS idx_arvore_imagens_arvore_id ON public.arvore_imagens(arvore_id);
