"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Notification = void 0;
// Re-export the modular Notification model to prevent Mongoose OverwriteModelError
// and maintain backward compatibility for existing imports in the codebase.
const Notification_1 = require("../modules/notifications/models/Notification");
Object.defineProperty(exports, "Notification", { enumerable: true, get: function () { return Notification_1.Notification; } });
exports.default = Notification_1.Notification;
