import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './authMiddleware.js';

export function roleMiddleware(allowedRoles: Array<'super_admin' | 'owner' | 'manager' | 'employee' | 'client'>) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'User is not authenticated' });
    }

    const { role } = req.user;

    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ 
        error: 'Forbidden: You do not have permission to access this resource' 
      });
    }

    return next();
  };
}
