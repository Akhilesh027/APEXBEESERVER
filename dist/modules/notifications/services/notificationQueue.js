"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationQueue = exports.NotificationQueue = void 0;
const bullmq_1 = require("bullmq");
const NotificationJob_1 = require("../models/NotificationJob");
const notificationService_1 = require("./notificationService");
const redis_1 = require("../../../config/redis");
const env_1 = require("../../../config/env");
class NotificationQueue {
    static instance;
    isProcessing = false;
    timer = null;
    bullQueue = null;
    bullWorker = null;
    constructor() { }
    static getInstance() {
        if (!NotificationQueue.instance) {
            NotificationQueue.instance = new NotificationQueue();
        }
        return NotificationQueue.instance;
    }
    /**
     * Start the background worker loop or BullMQ queue processor.
     */
    startWorker(intervalMs = 30000) {
        const redis = (0, redis_1.getRedisClient)();
        const isMock = !(redis.status === 'ready' || redis.status === 'connecting');
        if (env_1.env.ENABLE_BULLMQ_WORKERS && !isMock) {
            console.log('[NotificationQueue] Initializing BullMQ connection...');
            try {
                this.bullQueue = new bullmq_1.Queue('notification-queue', { connection: redis });
                this.bullWorker = new bullmq_1.Worker('notification-queue', async (bullJob) => {
                    const { jobId } = bullJob.data;
                    await this.processSingleJob(jobId);
                }, { connection: redis });
                this.bullWorker.on('completed', (job) => {
                    console.log(`[NotificationQueue/BullMQ] Job ${job.id} completed successfully.`);
                });
                this.bullWorker.on('failed', (job, err) => {
                    console.error(`[NotificationQueue/BullMQ] Job ${job?.id} failed:`, err.message);
                });
                console.log('[NotificationQueue] BullMQ distributed worker started.');
                return;
            }
            catch (err) {
                console.error('[NotificationQueue] Failed to start BullMQ worker, falling back to interval polling:', err.message);
            }
        }
        // Interval Polling Fallback
        if (this.timer)
            return;
        console.log('[NotificationQueue] Falling back to local MongoDB polling loop.');
        this.timer = setInterval(() => {
            this.processPendingJobs();
        }, intervalMs);
        this.processPendingJobs();
    }
    /**
     * Stop the background loop or BullMQ worker.
     */
    async stopWorker() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
            console.log('[NotificationQueue] Interval polling stopped.');
        }
        if (this.bullWorker) {
            await this.bullWorker.close();
            this.bullWorker = null;
            console.log('[NotificationQueue] BullMQ worker closed.');
        }
        if (this.bullQueue) {
            await this.bullQueue.close();
            this.bullQueue = null;
        }
    }
    /**
     * Trigger processing immediately for a newly saved job document.
     */
    async triggerWorker(jobDoc) {
        if (env_1.env.ENABLE_BULLMQ_WORKERS && this.bullQueue && jobDoc) {
            try {
                const delay = Math.max(0, new Date(jobDoc.scheduledAt).getTime() - Date.now());
                await this.bullQueue.add('notification-job', { jobId: jobDoc._id.toString() }, { delay });
                return;
            }
            catch (err) {
                console.error('[NotificationQueue] Failed to append job to BullMQ, falling back to immediate sweep:', err.message);
            }
        }
        setImmediate(() => {
            this.processPendingJobs();
        });
    }
    /**
     * Process a specific single job using atomic state mutations.
     */
    async processSingleJob(jobId) {
        try {
            const job = await NotificationJob_1.NotificationJob.findById(jobId);
            if (!job || !['pending', 'failed'].includes(job.status)) {
                return;
            }
            // Optimistic Lock: update status to processing atomically
            const lockedJob = await NotificationJob_1.NotificationJob.findOneAndUpdate({ _id: jobId, status: { $in: ['pending', 'failed'] } }, { $set: { status: 'processing' }, $inc: { attempts: 1 } }, { new: true });
            if (!lockedJob)
                return;
            let allSuccessful = true;
            const errors = [];
            for (const recipient of lockedJob.recipients) {
                try {
                    const success = await notificationService_1.NotificationService.sendNotification(lockedJob.eventCode, lockedJob.payload, recipient.userId);
                    if (!success) {
                        allSuccessful = false;
                        errors.push(`Failed dispatch for recipient: ${recipient.userId}`);
                    }
                }
                catch (recipientErr) {
                    allSuccessful = false;
                    errors.push(`Recipient ${recipient.userId} error: ${recipientErr.message}`);
                }
            }
            if (allSuccessful) {
                lockedJob.status = 'completed';
            }
            else {
                lockedJob.status = lockedJob.attempts >= lockedJob.maxAttempts ? 'failed' : 'failed';
                lockedJob.errorLogs.push(...errors);
            }
            await lockedJob.save();
            console.log(`[NotificationQueue] Job ${lockedJob._id} (${lockedJob.eventCode}) status updated to: ${lockedJob.status}`);
        }
        catch (err) {
            console.error(`[NotificationQueue] Error processing single job ${jobId}:`, err.message);
        }
    }
    /**
     * Scan for pending/failed jobs and process them (fallback polling runner).
     */
    async processPendingJobs() {
        if (this.isProcessing)
            return;
        this.isProcessing = true;
        try {
            const now = new Date();
            const jobs = await NotificationJob_1.NotificationJob.find({
                status: { $in: ['pending', 'failed'] },
                attempts: { $lt: 3 },
                scheduledAt: { $lte: now }
            }).sort({ scheduledAt: 1, createdAt: 1 });
            if (jobs.length === 0) {
                this.isProcessing = false;
                return;
            }
            console.log(`[NotificationQueue] Polling sweep processing ${jobs.length} jobs...`);
            for (const job of jobs) {
                await this.processSingleJob(job._id.toString());
            }
        }
        catch (err) {
            console.error('[NotificationQueue] Fatal error during polling sweep:', err.message);
        }
        finally {
            this.isProcessing = false;
        }
    }
}
exports.NotificationQueue = NotificationQueue;
exports.notificationQueue = NotificationQueue.getInstance();
exports.default = exports.notificationQueue;
