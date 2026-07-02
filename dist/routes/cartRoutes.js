"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cartController_1 = require("../controllers/cartController");
const router = express_1.default.Router();
router.get('/:userId', cartController_1.getCart);
router.post('/add', cartController_1.addToCart);
router.put('/:userId', cartController_1.updateCartItemQuantity);
router.delete('/:userId', cartController_1.removeFromCart);
exports.default = router;
