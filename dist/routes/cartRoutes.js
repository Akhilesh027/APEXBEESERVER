"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const cartController_1 = require("../controllers/cartController");
const router = express_1.default.Router();
const optionalProtect = (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }
    if (token) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'supersecretjwtkeyforapexbeebusinessoperatingnetwork');
            req.user = decoded;
        }
        catch (error) {
            // Allow request to proceed using body.userId
        }
    }
    next();
};
router.get('/:userId', cartController_1.getCart);
router.post('/add', optionalProtect, cartController_1.addToCart);
router.put('/:userId', cartController_1.updateCartItemQuantity);
router.delete('/:userId', cartController_1.removeFromCart);
exports.default = router;
