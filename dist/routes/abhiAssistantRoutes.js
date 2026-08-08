"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const abhiAssistantController_1 = require("../controllers/abhiAssistantController");
const router = express_1.default.Router();
router.get('/hub-data', abhiAssistantController_1.handleAbhiHubData);
router.post('/query', abhiAssistantController_1.handleAbhiQuery);
exports.default = router;
