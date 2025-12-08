-- =====================================================
-- Tabela para Planos de Intervenção
-- =====================================================

-- Criar tabela planos_intervencao
CREATE TABLE IF NOT EXISTS planos_intervencao (
  id TEXT PRIMARY KEY,
  tree_id UUID REFERENCES arvores(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  intervention_type TEXT NOT NULL,
  techniques TEXT[], -- Array de técnicas
  justification TEXT,
  tools TEXT[], -- Array de ferramentas
  epis TEXT[], -- Array de EPIs
  team_composition JSONB, -- Composição da equipe
  schedule JSONB, -- Datas de início/fim
  durations JSONB, -- Durações das etapas
  responsible TEXT,
  responsible_title TEXT,
  waste_destination TEXT,
  execution_instructions TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_planos_tree_id ON planos_intervencao(tree_id);
CREATE INDEX IF NOT EXISTS idx_planos_user_id ON planos_intervencao(user_id);
CREATE INDEX IF NOT EXISTS idx_planos_created_at ON planos_intervencao(created_at);

-- Constraint única: uma árvore pode ter apenas um plano por usuário
ALTER TABLE planos_intervencao
DROP CONSTRAINT IF EXISTS unique_tree_user_plan;

ALTER TABLE planos_intervencao
ADD CONSTRAINT unique_tree_user_plan
UNIQUE (tree_id, user_id);

-- Políticas RLS (Row Level Security)
ALTER TABLE planos_intervencao ENABLE ROW LEVEL SECURITY;

-- Política para usuários verem apenas seus próprios planos
DROP POLICY IF EXISTS "Users can view their own plans" ON planos_intervencao;
CREATE POLICY "Users can view their own plans" ON planos_intervencao
  FOR SELECT USING (auth.uid() = user_id);

-- Política para usuários inserirem apenas seus próprios planos
DROP POLICY IF EXISTS "Users can insert their own plans" ON planos_intervencao;
CREATE POLICY "Users can insert their own plans" ON planos_intervencao
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Política para usuários atualizarem apenas seus próprios planos
DROP POLICY IF EXISTS "Users can update their own plans" ON planos_intervencao;
CREATE POLICY "Users can update their own plans" ON planos_intervencao
  FOR UPDATE USING (auth.uid() = user_id);

-- Política para usuários excluírem apenas seus próprios planos
DROP POLICY IF EXISTS "Users can delete their own plans" ON planos_intervencao;
CREATE POLICY "Users can delete their own plans" ON planos_intervencao
  FOR DELETE USING (auth.uid() = user_id);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS update_planos_intervencao_updated_at ON planos_intervencao;
CREATE TRIGGER update_planos_intervencao_updated_at
    BEFORE UPDATE ON planos_intervencao
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comentários na tabela
COMMENT ON TABLE planos_intervencao IS 'Planos de intervenção arborícola por usuário e árvore';
COMMENT ON CONSTRAINT unique_tree_user_plan ON planos_intervencao IS 'Cada árvore pode ter apenas um plano por usuário';