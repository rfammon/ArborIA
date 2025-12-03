-- Arquivo: update_schema_photos.sql
-- Descrição: Adiciona a coluna image_url na tabela arvores para simplificar a persistência de fotos.

DO $$
BEGIN
    -- Verifica se a coluna image_url existe na tabela arvores
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'arvores' AND column_name = 'image_url') THEN
        ALTER TABLE public.arvores ADD COLUMN image_url TEXT;
    END IF;

    -- Verifica se a coluna hasphoto existe (caso esteja faltando)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'arvores' AND column_name = 'hasphoto') THEN
        ALTER TABLE public.arvores ADD COLUMN hasphoto BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Atualiza as políticas de segurança para permitir acesso a essa nova coluna (geralmente automático, mas bom garantir)
COMMENT ON COLUMN public.arvores.image_url IS 'URL pública da foto principal da árvore.';
