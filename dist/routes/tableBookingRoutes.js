"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const tableBookingController_1 = require("../controllers/tableBookingController");
const router = express_1.default.Router();
router.post('/', tableBookingController_1.createTableBooking);
router.get('/customer', tableBookingController_1.getCustomerTableBookings);
router.get('/vendor/:vendorId', tableBookingController_1.getVendorTableBookings);
router.patch('/:id/status', tableBookingController_1.updateTableBookingStatus);
exports.default = router;
