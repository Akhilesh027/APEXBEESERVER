"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderIdempotencyService = void 0;
const idempotencyService_1 = require("./idempotencyService");
class OrderIdempotencyService {
    static async checkOrRecord(userId, key, payload, session) {
        const result = await idempotencyService_1.IdempotencyService.checkOrRecord(userId, key, payload, session);
        if (result.status === 'completed') {
            return { duplicate: true, response: result.responseBody };
        }
        if (result.status === 'processing') {
            throw new Error('Another request with this idempotency key is already processing.');
        }
        if (result.status === 'conflict') {
            throw new Error('Idempotency key match, but request payload does not match.');
        }
        return { duplicate: false };
    }
    static async updateStatus(userId, key, status, responseBody, session) {
        if (status === 'completed') {
            await idempotencyService_1.IdempotencyService.resolveRecord(userId, key, 201, responseBody, responseBody?.order?._id || undefined, session);
        }
        else {
            await idempotencyService_1.IdempotencyService.failRecord(userId, key, session);
        }
    }
}
exports.OrderIdempotencyService = OrderIdempotencyService;
exports.default = OrderIdempotencyService;
