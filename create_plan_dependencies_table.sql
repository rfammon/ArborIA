-- =====================================================
-- Recriar tabela de dependências (caso já exista)
-- =====================================================

-- Remover políticas existentes
DROP POLICY IF EXISTS "Usuários podem ver suas próprias dependências" ON plan_dependencies;
DROP POLICY IF EXISTS "Usuários podem criar suas próprias dependências" ON plan_dependencies;
DROP POLICY IF EXISTS "Usuários podem atualizar suas próprias dependências" ON plan_dependencies;
DROP POLICY IF EXISTS "Usuários podem deletar suas próprias dependências" ON plan_dependencies;

-- Remover trigger se existir
DROP TRIGGER IF EXISTS update_plan_dependencies_modtime ON plan_dependencies;

-- Remover tabela se existir (CUIDADO: apaga dados!)
-- Comente esta linha se quiser manter dados existentes
DROP TABLE IF EXISTS plan_dependencies CASCADE;

-- Criar tabela de dependências
CREATE TABLE plan_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    from_plan_id TEXT NOT NULL,
    to_plan_id TEXT NOT NULL,
    dependency_type TEXT NOT NULL CHECK (dependency_type IN ('FS', 'SS', 'FF', 'SF')),
    lag_days INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_dependency UNIQUE (user_id, from_plan_id, to_plan_id)
);

-- Adicionar comentários
COMMENT ON TABLE plan_dependencies IS 'Dependências entre planos de intervenção para cronograma';
COMMENT ON COLUMN plan_dependencies.from_plan_id IS 'ID do plano predecessor';
COMMENT ON COLUMN plan_dependencies.to_plan_id IS 'ID do plano sucessor';
COMMENT ON COLUMN plan_dependencies.dependency_type IS 'Tipo: FS (Finish-Start), SS (Start-Start), FF (Finish-Finish), SF (Start-Finish)';
COMMENT ON COLUMN plan_dependencies.lag_days IS 'Dias de folga (positivo=atraso, negativo=adiantamento)';

-- Criar índices
CREATE INDEX idx_plan_deps_user ON plan_dependencies(user_id);
CREATE INDEX idx_plan_deps_from ON plan_dependencies(from_plan_id);
CREATE INDEX idx_plan_deps_to ON plan_dependencies(to_plan_id);

-- Habilitar RLS
ALTER TABLE plan_dependencies ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança
CREATE POLICY "Usuários podem ver suas próprias dependências"
    ON plan_dependencies FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar suas próprias dependências"
    ON plan_dependencies FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias dependências"
    ON plan_dependencies FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar suas próprias dependências"
    ON plan_dependencies FOR DELETE
    USING (auth.uid() = user_id);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger
CREATE TRIGGER update_plan_dependencies_modtime
    BEFORE UPDATE ON plan_dependencies
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

-- Verificação
SELECT 'Tabela plan_dependencies criada com sucesso!' as status;
SELECT COUNT(*) as total_policies FROM pg_policies WHERE tablename = 'plan_dependencies';
