-- =========================================================================
-- SISTEMA DE NOTIFICAÇÕES PUSH (Tabela e Índices)
-- =========================================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subscription JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índice para busca rápida de subscrições por usuário
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);

-- Ativar RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Política de RLS: Usuário só acessa as próprias subscrições
CREATE POLICY push_subscriptions_user_isolation ON push_subscriptions
    FOR ALL
    USING (user_id = auth.uid());
