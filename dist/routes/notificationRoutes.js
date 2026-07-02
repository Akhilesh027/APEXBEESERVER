"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Re-export the modular notification routes to resolve typescript compilation
// and maintain backward compatibility for existing imports in the codebase.
const notificationRoutes_1 = __importDefault(require("../modules/notifications/routes/notificationRoutes"));
exports.default = notificationRoutes_1.default;
