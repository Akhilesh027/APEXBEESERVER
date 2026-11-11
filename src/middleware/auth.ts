import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { User, RoleType } from '../models/User';
import { Vendor } from '../models/Vendor';
import { BusinessApplication } from '../models/BusinessApplication';

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
      roles: Array.isArray(decoded.roles) ? decoded.roles : []
    };

    next();
  } catch (error) {
    res.status(401).json({ message: 'Not authorized, token invalid' });
  }
};

export const restrictTo = (...allowedRoles: RoleType[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ message: 'Not authenticated' });
      return;
    }

    const currentRoles: RoleType[] = Array.isArray(req.user.roles) ? [...req.user.roles] : [];

    // Admin bypass: if user has the 'admin' role, allow everything
    if (currentRoles.includes('admin')) {
      return next();
    }

    // Fast path: matches decoded token roles directly
    if (currentRoles.some(role => allowedRoles.includes(role))) {
      return next();
    }

    // If token roles do not match, check DB to see if user has been granted roles,
    // has a vendor profile, or approved business application
    try {
      const isObjId = mongoose.Types.ObjectId.isValid(req.user.id);
      const userDoc = isObjId ? await User.findById(req.user.id) : await User.findOne({ email: req.user.email?.toLowerCase().trim() });
      if (userDoc) {
        const dbRoles = Array.isArray(userDoc.roles) ? userDoc.roles : [];

        if (dbRoles.includes('admin')) {
          req.user.roles = dbRoles;
          return next();
        }

        if (dbRoles.some(role => allowedRoles.includes(role))) {
          req.user.roles = dbRoles;
          return next();
        }

        // If 'vendor' is an allowed role, check seller synonyms or vendor profiles
        if (allowedRoles.includes('vendor')) {
          const sellerSynonyms: RoleType[] = ['business_partner', 'food_partner', 'wholesaler', 'manufacturer', 'entrepreneur'];
          if (dbRoles.some(r => sellerSynonyms.includes(r))) {
            req.user.roles = [...new Set([...dbRoles, 'vendor' as RoleType])];
            return next();
          }

          // Check if Vendor profile exists
          const vendorDoc = await Vendor.findOne({
            $or: [
              ...(isObjId ? [{ userId: new mongoose.Types.ObjectId(req.user.id) }] : []),
              { userId: req.user.id },
              ...(req.user.email ? [{ email: req.user.email.toLowerCase().trim() }] : []),
              ...(isObjId ? [{ _id: new mongoose.Types.ObjectId(req.user.id) }] : [])
            ]
          });

          if (vendorDoc) {
            if (!userDoc.roles.includes('vendor')) {
              userDoc.roles.push('vendor');
              await userDoc.save().catch(() => {});
            }
            req.user.roles = [...new Set([...dbRoles, 'vendor' as RoleType])];
            return next();
          }

          // Check if approved business application exists
          const appDoc = await BusinessApplication.findOne({
            $or: [
              ...(isObjId ? [{ userId: new mongoose.Types.ObjectId(req.user.id) }] : []),
              { userId: req.user.id },
              ...(req.user.email ? [{ email: req.user.email.toLowerCase().trim() }] : [])
            ],
            status: { $in: ['approved', 'verified', 'active'] }
          });

          if (appDoc) {
            if (!userDoc.roles.includes('vendor')) {
              userDoc.roles.push('vendor');
              await userDoc.save().catch(() => {});
            }
            req.user.roles = [...new Set([...dbRoles, 'vendor' as RoleType])];
            return next();
          }
        }
      }
    } catch (err) {
      console.error('[restrictTo] Error checking database permissions:', err);
    }

    res.status(403).json({ message: 'Forbidden: You do not have permissions for this action' });
  };
};

export const optionalProtect = async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
  let token: string | undefined;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
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
    } catch {
      // Guest or expired token, proceed without failing
    }
  }

  next();
};
