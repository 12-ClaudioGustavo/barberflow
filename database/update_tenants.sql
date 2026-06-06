-- 1. Criar o enum tenant_status (caso não exista)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tenant_status') THEN
    CREATE TYPE tenant_status AS ENUM ('pending', 'active', 'rejected', 'suspended');
  END IF;
END$$;

-- 2. Adicionar as novas colunas na tabela tenants
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS status tenant_status NOT NULL DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS owner_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS owner_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS rejected_reason TEXT,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS approved_by UUID;
