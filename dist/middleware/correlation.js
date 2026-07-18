"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.correlationMiddleware = void 0;
const crypto_1 = require("crypto");
const env_1 = require("../config/env");
const correlationMiddleware = (req, res, next) => {
    const startTime = Date.now();
    // 1. Establish request correlation ID
    const headerReqId = req.headers['x-request-id'] || req.headers['request-id'];
    const requestId = Array.isArray(headerReqId) ? headerReqId[0] : headerReqId || (0, crypto_1.randomUUID)();
    // Set response header for client tracking
    res.setHeader('x-request-id', requestId);
    // 2. Extract correlation attributes
    const userId = req.user?.id || req.user?._id || req.headers['x-user-id'] || req.body?.userId || req.body?.customerId;
    const orderId = req.headers['x-order-id'] || req.body?.orderId || req.body?.orderNumber || req.params?.orderId;
    const idempotencyKey = req.headers['x-idempotency-key'] ||
        req.headers['idempotency-key'] ||
        req.body?.idempotencyKey;
    const paymentReference = req.headers['x-payment-reference'] ||
        req.body?.transactionId ||
        req.body?.paymentDetails?.upiDetails?.transactionId;
    req.correlation = {
        requestId,
        userId: userId ? String(userId) : undefined,
        orderId: orderId ? String(orderId) : undefined,
        idempotencyKey: idempotencyKey ? String(idempotencyKey) : undefined,
        paymentReference: paymentReference ? String(paymentReference) : undefined,
    };
    // 3. Inject correlation logger
    req.log = (level, msg, ...meta) => {
        const ctx = req.correlation;
        const timestamp = new Date().toISOString();
        // Structured JSON format for production environments
        if (env_1.env.NODE_ENV === 'production' || process.env.STRUCTURED_LOGGING === 'true') {
            const logObject = {
                timestamp,
                level: level.toUpperCase(),
                message: msg,
                requestId: ctx.requestId,
                userId: ctx.userId,
                orderId: ctx.orderId,
                idempotencyKey: ctx.idempotencyKey,
                paymentReference: ctx.paymentReference,
                metadata: meta.length ? meta : undefined,
            };
            const jsonString = JSON.stringify(logObject);
            if (level === 'error') {
                console.error(jsonString);
            }
            else if (level === 'warn') {
                console.warn(jsonString);
            }
            else {
                console.log(jsonString);
            }
            return;
        }
        // Human-readable format for development
        const parts = [
            `[reqId: ${ctx.requestId}]`,
            ctx.userId ? `[userId: ${ctx.userId}]` : '',
            ctx.orderId ? `[orderId: ${ctx.orderId}]` : '',
            ctx.idempotencyKey ? `[idKey: ${ctx.idempotencyKey}]` : '',
            ctx.paymentReference ? `[payRef: ${ctx.paymentReference}]` : '',
        ].filter(Boolean).join(' ');
        const prefix = `${timestamp} ${level.toUpperCase()} ${parts}`;
        if (level === 'error') {
            console.error(`${prefix} - ${msg}`, ...meta);
        }
        else if (level === 'warn') {
            console.warn(`${prefix} - ${msg}`, ...meta);
        }
        else {
            console.log(`${prefix} - ${msg}`, ...meta);
        }
    };
    // Log incoming request
    req.log?.('info', `Incoming request: ${req.method} ${req.originalUrl}`);
    // Track response latency and alert on regressions
    res.on('finish', () => {
        const durationMs = Date.now() - startTime;
        req.log?.('info', `Completed request: ${req.method} ${req.originalUrl} status=${res.statusCode} durationMs=${durationMs}`);
        // Performance regression alerting (e.g. queries or processes taking longer than 1.5s)
        if (durationMs > 1500) {
            req.log?.('warn', `[PERFORMANCE ALERT] Slow request detected: ${req.method} ${req.originalUrl} took ${durationMs}ms (threshold: 1500ms)`);
        }
    });
    next();
};
exports.correlationMiddleware = correlationMiddleware;
exports.default = exports.correlationMiddleware;
