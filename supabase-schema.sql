-- =====================================================
-- SCRIPT DE CONFIGURAÇÃO DA TABELA ARVORES
-- ArborIA - Sistema de Registro de Árvores
-- =====================================================

-- 1. Remover tabela existente se necessário (CUIDADO: isso apaga todos os dados!)
-- DROP TABLE IF EXISTS public.arvores CASCADE;

-- 2. Criar tabela com estrutura correta
CREATE TABLE IF NOT EXISTS public.arvores (
    -- Identificação e metadados
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Informações básicas da árvore
    nome TEXT NOT NULL DEFAULT 'Nome não especificado',
    especie TEXT,
    data DATE,
    local TEXT,
    avaliador TEXT,
    observacoes TEXT,

    -- Medidas dendrométricas
    dap NUMERIC(10, 2) DEFAULT 0,
    altura NUMERIC(10, 2) DEFAULT 0,

    -- Coordenadas UTM (Sistema principal)
    easting NUMERIC(15, 2) NOT NULL DEFAULT 0,
    northing NUMERIC(15, 2) NOT NULL DEFAULT 0,
    utmzonenum INTEGER,
    utmzoneletter VARCHAR(1),

    -- Coordenadas geográficas (Backup/Legado)
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),

    -- Avaliação de risco TRAQ
    pontuacao INTEGER DEFAULT 0,
    riskfactors INTEGER[] DEFAULT '{}',
    risklevel TEXT,
    residualrisk TEXT,
    mitigation TEXT,
    targetcategory TEXT,
    risco TEXT,
    riscoclass TEXT,

    -- Imagem
    hasphoto BOOLEAN DEFAULT FALSE,
    image_url TEXT,

    -- Controle de timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- 3. Criar índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_arvores_user_id ON public.arvores(user_id);
CREATE INDEX IF NOT EXISTS idx_arvores_especie ON public.arvores(especie);
CREATE INDEX IF NOT EXISTS idx_arvores_utmzonenum ON public.arvores(utmzonenum);
CREATE INDEX IF NOT EXISTS idx_arvores_created_at ON public.arvores(created_at);
CREATE INDEX IF NOT EXISTS idx_arvores_updated_at ON public.arvores(updated_at);
CREATE INDEX IF NOT EXISTS idx_arvores_deleted_at ON public.arvores(deleted_at);

-- 4. Criar função para atualizar automaticamente updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Criar trigger para updated_at
DROP TRIGGER IF EXISTS update_arvores_updated_at ON public.arvores;
CREATE TRIGGER update_arvores_updated_at
    BEFORE UPDATE ON public.arvores
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 6. Habilitar Row Level Security (RLS)
ALTER TABLE public.arvores ENABLE ROW LEVEL SECURITY;

-- 7. Remover políticas existentes
DROP POLICY IF EXISTS "Usuários podem visualizar suas próprias árvores" ON public.arvores;
DROP POLICY IF EXISTS "Usuários podem inserir suas próprias árvores" ON public.arvores;
DROP POLICY IF EXISTS "Usuários podem atualizar suas próprias árvores" ON public.arvores;
DROP POLICY IF EXISTS "Usuários podem deletar suas próprias árvores" ON public.arvores;

-- 8. Criar políticas RLS
CREATE POLICY "Usuários podem visualizar suas próprias árvores"
    ON public.arvores FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir suas próprias árvores"
    ON public.arvores FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias árvores"
    ON public.arvores FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar suas próprias árvores"
    ON public.arvores FOR DELETE
    USING (auth.uid() = user_id);

-- 9. Comentários na tabela e colunas
COMMENT ON TABLE public.arvores IS 'Tabela principal de registro de árvores com avaliação de risco TRAQ';
COMMENT ON COLUMN public.arvores.easting IS 'Coordenada Leste UTM em metros';
COMMENT ON COLUMN public.arvores.northing IS 'Coordenada Norte UTM em metros';
COMMENT ON COLUMN public.arvores.utmzonenum IS 'Número da zona UTM (1-60)';
COMMENT ON COLUMN public.arvores.utmzoneletter IS 'Letra da zona UTM (hemisfério)';
COMMENT ON COLUMN public.arvores.dap IS 'Diâmetro à Altura do Peito em centímetros';
COMMENT ON COLUMN public.arvores.altura IS 'Altura total da árvore em metros';
COMMENT ON COLUMN public.arvores.pontuacao IS 'Pontuação total de risco calculada';
COMMENT ON COLUMN public.arvores.riskfactors IS 'Array de IDs dos fatores de risco detectados';
COMMENT ON COLUMN public.arvores.deleted_at IS 'Data de exclusão lógica (soft delete)';

-- 10. Adicionar constraints de validação
ALTER TABLE public.arvores
    ADD CONSTRAINT check_utmzonenum_range
    CHECK (utmzonenum IS NULL OR (utmzonenum >= 1 AND utmzonenum <= 60));

ALTER TABLE public.arvores
    ADD CONSTRAINT check_utmzoneletter_valid
    CHECK (utmzoneletter IS NULL OR utmzoneletter ~ '^[A-Z]$');

ALTER TABLE public.arvores
    ADD CONSTRAINT check_dap_positive
    CHECK (dap >= 0);

ALTER TABLE public.arvores
    ADD CONSTRAINT check_altura_positive
    CHECK (altura >= 0);

ALTER TABLE public.arvores
    ADD CONSTRAINT check_pontuacao_range
    CHECK (pontuacao >= 0 AND pontuacao <= 100);

-- =====================================================
-- SCRIPT PARA CORRIGIR DADOS EXISTENTES
-- =====================================================

-- 11. Atualizar árvores existentes com utmzonenum NULL
-- Este comando define zona 23 como padrão para árvores no Brasil
-- AJUSTE conforme necessário para sua região
UPDATE public.arvores
SET utmzonenum = 23
WHERE utmzonenum IS NULL
  AND easting IS NOT NULL
  AND northing IS NOT NULL
  AND easting != 0
  AND northing != 0;

-- 12. Atualizar árvores existentes com utmzoneletter NULL
-- 'K' é usado para o hemisfério sul (Brasil)
UPDATE public.arvores
SET utmzoneletter = 'K'
WHERE utmzoneletter IS NULL
  AND easting IS NOT NULL
  AND northing IS NOT NULL
  AND easting != 0
  AND northing != 0;

-- =====================================================
-- QUERIES ÚTEIS PARA DIAGNÓSTICO
-- =====================================================

-- Verificar árvores com coordenadas inválidas
-- SELECT id, nome, especie, easting, northing, utmzonenum, utmzoneletter
-- FROM public.arvores
-- WHERE utmzonenum IS NULL OR utmzoneletter IS NULL;

-- Contar árvores por zona UTM
-- SELECT utmzonenum, utmzoneletter, COUNT(*) as total
-- FROM public.arvores
-- GROUP BY utmzonenum, utmzoneletter
-- ORDER BY utmzonenum;

-- Verificar árvores recentemente atualizadas
-- SELECT id, nome, especie, utmzonenum, utmzoneletter, updated_at
-- FROM public.arvores
-- ORDER BY updated_at DESC
-- LIMIT 10;

-- =====================================================
-- FIM DO SCRIPT
-- =====================================================
