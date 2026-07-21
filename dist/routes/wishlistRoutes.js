"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const wishlistController_1 = require("../controllers/wishlistController");
const router = express_1.default.Router();
router.get('/:userId', wishlistController_1.getWishlist);
router.post('/toggle', wishlistController_1.toggleWishlist);
router.post('/check', wishlistController_1.checkWishlistStatus);
router.post('/sync', wishlistController_1.syncWishlist);
exports.default = router;
