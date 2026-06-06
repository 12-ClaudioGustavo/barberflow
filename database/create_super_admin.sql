-- ==========================================================================
-- Script para criar o primeiro Super Admin no BarberFlow
-- Execute este script DIRETAMENTE no SQL Editor do Supabase Dashboard
-- ==========================================================================

-- ⚠️ ATENÇÃO: Este script deve ser executado em DUAS ETAPAS separadas!
-- O PostgreSQL exige que novos valores de ENUM sejam commitados antes de serem usados.

-- ==========================================================================
-- ETAPA 1: Execute SOMENTE esta linha primeiro, depois clique em "Run"
-- ==========================================================================
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin' BEFORE 'owner';

-- ==========================================================================
-- ETAPA 2: Depois de executar a Etapa 1, execute TUDO abaixo (selecione do DO $$ até o final)
-- ==========================================================================
DO $$
DECLARE
  super_admin_uid UUID := '18824ca1-86b8-4773-a414-baadf34e4ffa';
  super_admin_email TEXT := 'superadmin@barberflow.com'; -- ← Substitua pelo e-mail usado
  super_admin_name TEXT := 'Super Admin';
BEGIN
  -- Inserir na tabela users (sem tenant_id, pois Super Admin é global)
  INSERT INTO users (id, tenant_id, name, email, role, is_active)
  VALUES (super_admin_uid, NULL, super_admin_name, super_admin_email, 'super_admin', true)
  ON CONFLICT (id) DO UPDATE SET role = 'super_admin', is_active = true;

  -- Atualizar os metadados do Auth user para incluir a role
  UPDATE auth.users
  SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{role}',
    '"super_admin"'
  )
  WHERE id = super_admin_uid;

  -- Também colocar o nome nos metadados
  UPDATE auth.users
  SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{name}',
    to_jsonb(super_admin_name)
  )
  WHERE id = super_admin_uid;

  RAISE NOTICE 'Super Admin criado com sucesso! UUID: %', super_admin_uid;
END $$;

-- 3. Políticas RLS para permitir Super Admin acessar todos os tenants
-- (Execute apenas se ainda não existirem)

-- Super Admin pode gerenciar todos os tenants
DROP POLICY IF EXISTS super_admin_manage_tenants ON tenants;
CREATE POLICY super_admin_manage_tenants ON tenants
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'super_admin'
    )
  );

-- Super Admin pode ver todos os usuários (para gestão da plataforma)
DROP POLICY IF EXISTS super_admin_view_users ON users;
CREATE POLICY super_admin_view_users ON users
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users AS admin_user
      WHERE admin_user.id = auth.uid()
        AND admin_user.role = 'super_admin'
    )
  );

-- Permitir que o super_admin tenha tenant_id NULL na tabela users
-- (O constraint unique_tenant_email permite NULL no tenant_id por padrão com UNIQUE)
