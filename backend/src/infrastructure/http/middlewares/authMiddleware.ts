import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../database/supabase.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    tenantId: string;
    role: 'super_admin' | 'owner' | 'manager' | 'employee' | 'client';
  };
}

export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header is missing' });
  }

  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ error: 'Token error, must be Bearer token' });
  }

  const token = parts[1];

  try {
    // Valida o token diretamente com o servidor do Supabase Auth
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Mapeamos a claim customizada "tenant_id" e a role.
    req.user = {
      id: user.id,
      email: user.email || '',
      tenantId: user.user_metadata?.tenantId || user.app_metadata?.tenant_id || '',
      role: user.user_metadata?.role || user.app_metadata?.role || 'client',
    };

    // Super Admin não pertence a nenhum tenant, portanto dispensa a verificação de tenantId
    if (req.user.role !== 'super_admin' && !req.user.tenantId) {
      return res.status(403).json({ error: 'User is not associated with any tenant' });
    }

    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
