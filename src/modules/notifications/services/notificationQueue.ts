import { Queue, Worker } from 'bullmq';
import { NotificationJob } from '../models/NotificationJob';
import { NotificationService } from './notificationService';
import { getRedisClient } from '../../../config/redis';
import { env } from '../../../config/env';

export class NotificationQueue {
  private static instance: NotificationQueue;
  private isProcessing = false;
  private timer: NodeJS.Timeout | null = null;
  private bullQueue: Queue | null = null;
  private bullWorker: Worker | null = null;

  private constructor() {}

  public static getInstance(): NotificationQueue {
    if (!NotificationQueue.instance) {
      NotificationQueue.instance = new NotificationQueue();
    }
    return NotificationQueue.instance;
  }

  /**
   * Start the background worker loop or BullMQ queue processor.
   */
  public startWorker(intervalMs = 30000) {
    const redis = getRedisClient();
    const isMock = !(redis.status === 'ready' || redis.status === 'connecting');

    if (env.ENABLE_BULLMQ_WORKERS && !isMock) {
      console.log('[NotificationQueue] Initializing BullMQ connection...');
      try {
        this.bullQueue = new Queue('notification-queue', { connection: redis });
        
        this.bullWorker = new Worker(
          'notification-queue',
          async (bullJob) => {
            const { jobId } = bullJob.data;
            await this.processSingleJob(jobId);
          },
          { connection: redis }
        );

        this.bullWorker.on('completed', (job) => {
          console.log(`[NotificationQueue/BullMQ] Job ${job.id} completed successfully.`);
        });

        this.bullWorker.on('failed', (job, err) => {
          console.error(`[NotificationQueue/BullMQ] Job ${job?.id} failed:`, err.message);
        });

        console.log('[NotificationQueue] BullMQ distributed worker started.');
        return;
      } catch (err: any) {
        console.error('[NotificationQueue] Failed to start BullMQ worker, falling back to interval polling:', err.message);
      }
    }

    // Interval Polling Fallback
    if (this.timer) return;
    console.log('[NotificationQueue] Falling back to local MongoDB polling loop.');
    this.timer = setInterval(() => {
      this.processPendingJobs();
    }, intervalMs);

    this.processPendingJobs();
  }

  /**
   * Stop the background loop or BullMQ worker.
   */
  public async stopWorker() {
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
  public async triggerWorker(jobDoc?: any) {
    if (env.ENABLE_BULLMQ_WORKERS && this.bullQueue && jobDoc) {
      try {
        const delay = Math.max(0, new Date(jobDoc.scheduledAt).getTime() - Date.now());
        await this.bullQueue.add(
          'notification-job',
          { jobId: jobDoc._id.toString() },
          { delay }
        );
        return;
      } catch (err: any) {
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
  public async processSingleJob(jobId: string) {
    try {
      const job = await NotificationJob.findById(jobId);
      if (!job || !['pending', 'failed'].includes(job.status)) {
        return;
      }

      // Optimistic Lock: update status to processing atomically
      const lockedJob = await NotificationJob.findOneAndUpdate(
        { _id: jobId, status: { $in: ['pending', 'failed'] } },
        { $set: { status: 'processing' }, $inc: { attempts: 1 } },
        { new: true }
      );

      if (!lockedJob) return;

      let allSuccessful = true;
      const errors: string[] = [];

      for (const recipient of lockedJob.recipients) {
        try {
          const success = await NotificationService.sendNotification(
            lockedJob.eventCode,
            lockedJob.payload,
            recipient.userId
          );
          if (!success) {
            allSuccessful = false;
            errors.push(`Failed dispatch for recipient: ${recipient.userId}`);
          }
        } catch (recipientErr: any) {
          allSuccessful = false;
          errors.push(`Recipient ${recipient.userId} error: ${recipientErr.message}`);
        }
      }

      if (allSuccessful) {
        lockedJob.status = 'completed';
      } else {
        lockedJob.status = lockedJob.attempts >= lockedJob.maxAttempts ? 'failed' : 'failed';
        lockedJob.errorLogs.push(...errors);
      }

      await lockedJob.save();
      console.log(`[NotificationQueue] Job ${lockedJob._id} (${lockedJob.eventCode}) status updated to: ${lockedJob.status}`);
    } catch (err: any) {
      console.error(`[NotificationQueue] Error processing single job ${jobId}:`, err.message);
    }
  }

  /**
   * Scan for pending/failed jobs and process them (fallback polling runner).
   */
  public async processPendingJobs() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const now = new Date();
      const jobs = await NotificationJob.find({
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
    } catch (err: any) {
      console.error('[NotificationQueue] Fatal error during polling sweep:', err.message);
    } finally {
      this.isProcessing = false;
    }
  }
}

export const notificationQueue = NotificationQueue.getInstance();
export default notificationQueue;
