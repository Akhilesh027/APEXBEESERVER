import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { RoleType } from '../models/User';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    roles: RoleType[];
  };
}

export const protect = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  let token: string | undefined;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    res.status(401).json({ message: 'Not authorized, token missing' });
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretjwtkeyforapexbeebusinessoperatingnetwork') as {
      id: string;
      email: string;
      roles: RoleType[];
    };

    req.user = {
      id: decoded.id,
      email: decoded.email,
      roles: decoded.roles
    };

    next();
  } catch (error) {
    res.status(401).json({ message: 'Not authorized, token invalid' });
  }
};

export const restrictTo = (...allowedRoles: RoleType[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: 'Not authenticated' });
      return;
    }

    // Admin bypass: if user has the 'admin' role, allow everything
    if (req.user.roles.includes('admin')) {
      return next();
    }

    const hasPermission = req.user.roles.some(role => allowedRoles.includes(role));
    if (!hasPermission) {
      res.status(403).json({ message: 'Forbidden: You do not have permissions for this action' });
      return;
    }

    next();
  };
};
