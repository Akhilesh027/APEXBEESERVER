import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../../middleware/auth';
import { Vendor } from '../../../models/Vendor';
import { EntitlementService } from '../services/EntitlementService';

/**
 * Express Middleware asserting that vendor has an active feature enabled
 */
export const requireFeature = (featureKey: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Authentication required' });
        return;
      }

      // Admin bypass
      if (req.user.roles && req.user.roles.includes('admin')) {
        return next();
      }

      const vendor = await Vendor.findOne({ userId: req.user.id });
      if (!vendor) {
        res.status(403).json({ success: false, message: 'Vendor account required for this action' });
        return;
      }

      await EntitlementService.assertFeature(vendor._id.toString(), featureKey);
      next();
    } catch (error: any) {
      res.status(error.statusCode || 403).json({
        success: false,
        code: error.code || 'FEATURE_NOT_AVAILABLE',
        message: error.message,
        details: error.details
      });
    }
  };
};

/**
 * Express Middleware asserting that vendor has remaining quota for a count/usage feature
 */
export const requireLimit = (featureKey: string, getAmountFn: (req: AuthRequest) => number = () => 1) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Authentication required' });
        return;
      }

      if (req.user.roles && req.user.roles.includes('admin')) {
        return next();
      }

      const vendor = await Vendor.findOne({ userId: req.user.id });
      if (!vendor) {
        res.status(403).json({ success: false, message: 'Vendor account required for this action' });
        return;
      }

      const requestedAmount = getAmountFn(req);
      await EntitlementService.assertWithinLimit(vendor._id.toString(), featureKey, requestedAmount);
      next();
    } catch (error: any) {
      res.status(error.statusCode || 403).json({
        success: false,
        code: error.code || 'FEATURE_LIMIT_REACHED',
        message: error.message,
        details: error.details
      });
    }
  };
};
