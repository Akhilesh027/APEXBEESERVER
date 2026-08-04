"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireLimit = exports.requireFeature = void 0;
const Vendor_1 = require("../../../models/Vendor");
const EntitlementService_1 = require("../services/EntitlementService");
/**
 * Express Middleware asserting that vendor has an active feature enabled
 */
const requireFeature = (featureKey) => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                res.status(401).json({ success: false, message: 'Authentication required' });
                return;
            }
            // Admin bypass
            if (req.user.roles && req.user.roles.includes('admin')) {
                return next();
            }
            const vendor = await Vendor_1.Vendor.findOne({ userId: req.user.id });
            if (!vendor) {
                res.status(403).json({ success: false, message: 'Vendor account required for this action' });
                return;
            }
            await EntitlementService_1.EntitlementService.assertFeature(vendor._id.toString(), featureKey);
            next();
        }
        catch (error) {
            res.status(error.statusCode || 403).json({
                success: false,
                code: error.code || 'FEATURE_NOT_AVAILABLE',
                message: error.message,
                details: error.details
            });
        }
    };
};
exports.requireFeature = requireFeature;
/**
 * Express Middleware asserting that vendor has remaining quota for a count/usage feature
 */
const requireLimit = (featureKey, getAmountFn = () => 1) => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                res.status(401).json({ success: false, message: 'Authentication required' });
                return;
            }
            if (req.user.roles && req.user.roles.includes('admin')) {
                return next();
            }
            const vendor = await Vendor_1.Vendor.findOne({ userId: req.user.id });
            if (!vendor) {
                res.status(403).json({ success: false, message: 'Vendor account required for this action' });
                return;
            }
            const requestedAmount = getAmountFn(req);
            await EntitlementService_1.EntitlementService.assertWithinLimit(vendor._id.toString(), featureKey, requestedAmount);
            next();
        }
        catch (error) {
            res.status(error.statusCode || 403).json({
                success: false,
                code: error.code || 'FEATURE_LIMIT_REACHED',
                message: error.message,
                details: error.details
            });
        }
    };
};
exports.requireLimit = requireLimit;
