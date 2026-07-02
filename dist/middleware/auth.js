"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.restrictTo = exports.protect = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const protect = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }
    if (!token) {
        res.status(401).json({ message: 'Not authorized, token missing' });
        return;
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'supersecretjwtkeyforapexbeebusinessoperatingnetwork');
        req.user = {
            id: decoded.id,
            email: decoded.email,
            roles: decoded.roles
        };
        next();
    }
    catch (error) {
        res.status(401).json({ message: 'Not authorized, token invalid' });
    }
};
exports.protect = protect;
const restrictTo = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ message: 'Not authenticated' });
            return;
        }
        console.log('[RestrictTo Check] Email:', req.user.email, 'Roles:', req.user.roles, 'Allowed:', allowedRoles);
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
exports.restrictTo = restrictTo;
