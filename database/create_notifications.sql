-- =========================================================================
-- SISTEMA DE NOTIFICAÇÕES (Tabela e Índices)
-- =========================================================================

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'info',
    read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índice para busca rápida de notificações por usuário
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);

-- Ativar RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Política de RLS: Usuário só lê/modifica as próprias notificações
CREATE POLICY notifications_user_isolation ON notifications
    FOR ALL
    USING (user_id = auth.uid());
