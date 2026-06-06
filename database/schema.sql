-- Criar extensão para UUID se não existir
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================================
-- 1. TABELA DE TENANTS (Barbearias no modelo SaaS)
-- =========================================================================
CREATE TYPE tenant_status AS ENUM ('pending', 'active', 'rejected', 'suspended');

CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    logo_url TEXT,
    status tenant_status NOT NULL DEFAULT 'pending',
    owner_email VARCHAR(255),
    owner_name VARCHAR(255),
    notes TEXT,
    rejected_reason TEXT,
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- 2. TABELA DE USUÁRIOS (Donos, Gerentes, Funcionários, Clientes, Super Admin)
-- =========================================================================
CREATE TYPE user_role AS ENUM ('super_admin', 'owner', 'manager', 'employee', 'client');

CREATE TABLE users (
    id UUID PRIMARY KEY, -- Referência direta ao ID de autenticação do Supabase Auth
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(30),
    role user_role NOT NULL DEFAULT 'client',
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_tenant_email UNIQUE(tenant_id, email)
);

-- =========================================================================
-- 3. PERFIL DE FUNCIONÁRIOS
-- =========================================================================
CREATE TABLE employee_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    hiring_date DATE NOT NULL,
    commission_percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- 4. ESCALA DE TRABALHO SEMANAL
-- =========================================================================
CREATE TABLE shift_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_profile_id UUID REFERENCES employee_profiles(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0 = Domingo, 6 = Sábado
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    break_start_time TIME,
    break_end_time TIME,
    is_working_day BOOLEAN NOT NULL DEFAULT TRUE,
    
    CONSTRAINT unique_employee_day UNIQUE(employee_profile_id, day_of_week)
);

-- =========================================================================
-- 5. FOLGAS, FÉRIAS E LICENÇAS
-- =========================================================================
CREATE TYPE timeoff_type AS ENUM ('day_off', 'vacation', 'sick_leave', 'temporary_absence');

CREATE TABLE employee_timeoffs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_profile_id UUID REFERENCES employee_profiles(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    type timeoff_type NOT NULL DEFAULT 'day_off',
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    reason TEXT,
    is_approved BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_date_range CHECK (start_date <= end_date)
);

-- =========================================================================
-- 6. SERVIÇOS
-- =========================================================================
CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    duration_minutes INT NOT NULL, -- Duração em minutos (ex: 30, 60, 90)
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- 7. PERFIL DE CLIENTES
-- =========================================================================
CREATE TABLE client_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL UNIQUE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(30),
    whatsapp VARCHAR(30),
    birth_date DATE,
    total_spent DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    visits_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- 8. AGENDAMENTOS (TABELA CENTRAL)
-- =========================================================================
CREATE TYPE appointment_status AS ENUM ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled');

CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    client_profile_id UUID REFERENCES client_profiles(id) ON DELETE CASCADE,
    employee_profile_id UUID REFERENCES employee_profiles(id) ON DELETE CASCADE,
    service_id UUID REFERENCES services(id) ON DELETE CASCADE,
    scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL, -- Calculado e validado como scheduled_time + service.duration_minutes
    status appointment_status NOT NULL DEFAULT 'scheduled',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_appointment_time CHECK (scheduled_time < end_time)
);

-- =========================================================================
-- 9. LISTA DE ESPERA (WAITLIST)
-- =========================================================================
CREATE TABLE waitlists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    client_profile_id UUID REFERENCES client_profiles(id) ON DELETE CASCADE,
    employee_profile_id UUID REFERENCES employee_profiles(id) ON DELETE CASCADE,
    service_id UUID REFERENCES services(id) ON DELETE CASCADE,
    preferred_date DATE NOT NULL,
    preferred_start_time TIME,
    preferred_end_time TIME,
    notified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- 10. FLUXO DE CAIXA / TRANSAÇÕES FINANCEIRAS
-- =========================================================================
CREATE TYPE transaction_type AS ENUM ('income', 'expense');

CREATE TABLE financial_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    type transaction_type NOT NULL,
    category VARCHAR(100) NOT NULL, -- ex: 'service', 'commission', 'rent', 'supplies'
    amount DECIMAL(10,2) NOT NULL,
    description TEXT,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- ÍNDICES DE PERFORMANCE E OTIMIZAÇÃO DE BUSCA E CONCORRÊNCIA
-- =========================================================================

-- Busca rápida de agendamentos por barbeiro e intervalo de tempo (usado no motor de conflitos)
CREATE INDEX idx_appointments_employee_concurrency 
ON appointments(employee_profile_id, scheduled_time, end_time) 
WHERE status != 'cancelled';

-- Filtros rápidos de Tenant para isolamento Multi-Tenancy rápido
CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_employee_profiles_tenant_id ON employee_profiles(tenant_id);
CREATE INDEX idx_services_tenant_id ON services(tenant_id);
CREATE INDEX idx_client_profiles_tenant_id ON client_profiles(tenant_id);
CREATE INDEX idx_appointments_tenant_id ON appointments(tenant_id);
CREATE INDEX idx_financial_transactions_tenant_id ON financial_transactions(tenant_id);

-- Busca de escalas por dia da semana e funcionário
CREATE INDEX idx_shift_schedules_lookup ON shift_schedules(employee_profile_id, day_of_week);

-- Busca de folgas ativas de funcionários por intervalo de tempo
CREATE INDEX idx_employee_timeoffs_range ON employee_timeoffs(employee_profile_id, start_date, end_date);

-- =========================================================================
-- TRIGGERS PARA DATA DE ATUALIZAÇÃO (updated_at) E LOGICA FINANCEIRA
-- =========================================================================

CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tenants_changetime BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_users_changetime BEFORE UPDATE ON users FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_employee_changetime BEFORE UPDATE ON employee_profiles FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_services_changetime BEFORE UPDATE ON services FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_appointments_changetime BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- Gatilho de integração financeira automática: ao completar agendamento, cria transação de receita
CREATE OR REPLACE FUNCTION insert_appointment_financial_transaction()
RETURNS TRIGGER AS $$
DECLARE
    service_price DECIMAL(10,2);
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        -- Obter o preço do serviço prestado
        SELECT price INTO service_price FROM services WHERE id = NEW.service_id;
        
        -- Lançar receita do serviço
        INSERT INTO financial_transactions (tenant_id, appointment_id, type, category, amount, description)
        VALUES (NEW.tenant_id, NEW.id, 'income', 'service', service_price, 'Serviço finalizado: ID ' || NEW.id);
        
        -- Atualizar estatísticas do perfil do cliente
        UPDATE client_profiles 
        SET total_spent = total_spent + service_price,
            visits_count = visits_count + 1
        WHERE id = NEW.client_profile_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_appointment_completed
AFTER UPDATE ON appointments
FOR EACH ROW
EXECUTE FUNCTION insert_appointment_financial_transaction();

-- =========================================================================
-- SEGURANÇA: ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================================

-- Ativar RLS em todas as tabelas críticas do tenant
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_timeoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;

-- 1. Políticas para a tabela Tenants (Leitura pelo slug/id público ou por administradores do próprio tenant)
CREATE POLICY tenant_public_read ON tenants
    FOR SELECT
    USING (true);

-- 2. Políticas para a tabela Users (Isolamento de Tenant via JWT claims)
-- Supõe-se que o Supabase Auth JWT contenha a claim customizada "tenant_id"
CREATE POLICY user_tenant_isolation ON users
    FOR ALL
    USING (tenant_id = COALESCE(
        (auth.jwt() ->> 'tenant_id')::uuid,
        (SELECT tenant_id FROM users WHERE id = auth.uid())
    ));

-- 3. Políticas para Employee Profiles
CREATE POLICY employee_tenant_isolation ON employee_profiles
    FOR ALL
    USING (tenant_id = COALESCE(
        (auth.jwt() ->> 'tenant_id')::uuid,
        (SELECT tenant_id FROM users WHERE id = auth.uid())
    ));

-- 4. Políticas para Shift Schedules
CREATE POLICY shift_tenant_isolation ON shift_schedules
    FOR ALL
    USING (tenant_id = COALESCE(
        (auth.jwt() ->> 'tenant_id')::uuid,
        (SELECT tenant_id FROM users WHERE id = auth.uid())
    ));

-- 5. Políticas para Employee Timeoffs
CREATE POLICY timeoff_tenant_isolation ON employee_timeoffs
    FOR ALL
    USING (tenant_id = COALESCE(
        (auth.jwt() ->> 'tenant_id')::uuid,
        (SELECT tenant_id FROM users WHERE id = auth.uid())
    ));

-- 6. Políticas para Services (Clientes e visitantes podem listar serviços ativos de um tenant)
CREATE POLICY service_tenant_isolation ON services
    FOR ALL
    USING (tenant_id = COALESCE(
        (auth.jwt() ->> 'tenant_id')::uuid,
        (SELECT tenant_id FROM users WHERE id = auth.uid())
    ) OR (is_active = true));

-- 7. Políticas para Client Profiles
CREATE POLICY client_tenant_isolation ON client_profiles
    FOR ALL
    USING (tenant_id = COALESCE(
        (auth.jwt() ->> 'tenant_id')::uuid,
        (SELECT tenant_id FROM users WHERE id = auth.uid())
    ));

-- 8. Políticas para Appointments
CREATE POLICY appointment_tenant_isolation ON appointments
    FOR ALL
    USING (tenant_id = COALESCE(
        (auth.jwt() ->> 'tenant_id')::uuid,
        (SELECT tenant_id FROM users WHERE id = auth.uid())
    ));

-- 9. Políticas para Waitlists
CREATE POLICY waitlist_tenant_isolation ON waitlists
    FOR ALL
    USING (tenant_id = COALESCE(
        (auth.jwt() ->> 'tenant_id')::uuid,
        (SELECT tenant_id FROM users WHERE id = auth.uid())
    ));

-- 10. Políticas para Financial Transactions (Apenas Dono e Gerente podem acessar)
CREATE POLICY financial_tenant_isolation ON financial_transactions
    FOR ALL
    USING (
        tenant_id = COALESCE(
            (auth.jwt() ->> 'tenant_id')::uuid,
            (SELECT tenant_id FROM users WHERE id = auth.uid())
        )
        AND EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
              AND users.role IN ('owner', 'manager')
        )
    );
