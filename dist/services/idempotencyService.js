"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdempotencyService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const IdempotencyRecord_1 = require("../models/IdempotencyRecord");
class IdempotencyService {
    /**
     * Helper to compute a deterministic hash of the request payload.
     */
    static getPayloadHash(payload) {
        const rawString = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
        return crypto_1.default.createHash('sha256').update(rawString).digest('hex');
    }
    /**
     * Checks for an existing key and payload.
     * Creates a 'processing' record if none exists.
     */
    static async checkOrRecord(userId, key, payload, session) {
        const payloadHash = this.getPayloadHash(payload);
        // Find record by unique compound key
        const record = await IdempotencyRecord_1.IdempotencyRecord.findOne({
            userId,
            operation: 'CREATE_ORDER',
            key,
        }).session(session || null);
        if (record) {
            if (record.requestHash !== payloadHash) {
                return { status: 'conflict' };
            }
            if (record.status === 'processing') {
                return { status: 'processing' };
            }
            if (record.status === 'completed') {
                return {
                    status: 'completed',
                    responseCode: record.responseCode,
                    responseBody: record.responseBody,
                };
            }
            if (record.status === 'failed') {
                // Failed state allows retry: flip back to processing
                record.status = 'processing';
                await record.save({ session });
                return { status: 'retry' };
            }
        }
        // Create a new record in processing state
        const newRecord = new IdempotencyRecord_1.IdempotencyRecord({
            userId,
            key,
            operation: 'CREATE_ORDER',
            requestHash: payloadHash,
            status: 'processing',
            // Expires in 24 hours
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });
        try {
            await newRecord.save({ session });
            return { status: 'new' };
        }
        catch (saveErr) {
            if (saveErr.code === 11000) {
                const concurrentRecord = await IdempotencyRecord_1.IdempotencyRecord.findOne({
                    userId,
                    operation: 'CREATE_ORDER',
                    key,
                }).session(session || null);
                if (concurrentRecord) {
                    if (concurrentRecord.status === 'completed') {
                        return {
                            status: 'completed',
                            responseCode: concurrentRecord.responseCode,
                            responseBody: concurrentRecord.responseBody,
                        };
                    }
                    return { status: 'processing' };
                }
            }
            throw saveErr;
        }
    }
    /**
     * Transition record to completed state and save the response details.
     */
    static async resolveRecord(userId, key, responseCode, responseBody, resourceId, session) {
        await IdempotencyRecord_1.IdempotencyRecord.findOneAndUpdate({ userId, operation: 'CREATE_ORDER', key }, {
            status: 'completed',
            responseCode,
            responseBody,
            resourceId,
        }, { session });
    }
    /**
     * Transition record to failed state so that clients can retry.
     */
    static async failRecord(userId, key, session) {
        await IdempotencyRecord_1.IdempotencyRecord.findOneAndUpdate({ userId, operation: 'CREATE_ORDER', key }, { status: 'failed' }, { session });
    }
}
exports.IdempotencyService = IdempotencyService;
exports.default = IdempotencyService;
