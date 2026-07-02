import { NotificationJob } from '../models/NotificationJob';
import { NotificationService } from './notificationService';

export class NotificationQueue {
  private static instance: NotificationQueue;
  private isProcessing = false;
  private timer: NodeJS.Timeout | null = null;

  private constructor() {}

  public static getInstance(): NotificationQueue {
    if (!NotificationQueue.instance) {
      NotificationQueue.instance = new NotificationQueue();
    }
    return NotificationQueue.instance;
  }

  /**
   * Start the background polling loop.
   * @param intervalMs How frequently the queue scans for pending jobs (default 30 seconds).
   */
  public startWorker(intervalMs = 30000) {
    if (this.timer) return;
    
    console.log('[NotificationQueue] Background worker scheduler started.');
    this.timer = setInterval(() => {
      this.processPendingJobs();
    }, intervalMs);

    // Initial run on startup
    this.processPendingJobs();
  }

  /**
   * Stop the background loop.
   */
  public stopWorker() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('[NotificationQueue] Background worker scheduler stopped.');
    }
  }

  /**
   * Trigger processing immediately (used to process new events immediately).
   */
  public triggerWorker() {
    // Run asynchronously
    setImmediate(() => {
      this.processPendingJobs();
    });
  }

  /**
   * Scan for pending/failed jobs and process them.
   */
  public async processPendingJobs() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const now = new Date();

      // Find jobs: status = 'pending' or 'failed' (attempts < maxAttempts) AND scheduledAt <= now
      const jobs = await NotificationJob.find({
        status: { $in: ['pending', 'failed'] },
        attempts: { $lt: 3 },
        scheduledAt: { $lte: now }
      }).sort({ scheduledAt: 1, createdAt: 1 });

      if (jobs.length === 0) {
        this.isProcessing = false;
        return;
      }

      console.log(`[NotificationQueue] Processing ${jobs.length} notification jobs...`);

      for (const job of jobs) {
        // Lock job to avoid duplicate worker execution
        job.status = 'processing';
        job.attempts += 1;
        await job.save();

        let allSuccessful = true;
        const errors: string[] = [];

        // Send notification to all target recipients
        for (const recipient of job.recipients) {
          try {
            const success = await NotificationService.sendNotification(
              job.eventCode,
              job.payload,
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

        // Update Job Status
        if (allSuccessful) {
          job.status = 'completed';
        } else {
          job.status = job.attempts >= job.maxAttempts ? 'failed' : 'failed'; // worker will re-evaluate based on attempts count
          job.errorLogs.push(...errors);
        }

        await job.save();
        console.log(`[NotificationQueue] Job ${job._id} (${job.eventCode}) status updated to: ${job.status}`);
      }
    } catch (err) {
      console.error('[NotificationQueue] Fatal error during queue processing:', err);
    } finally {
      this.isProcessing = false;
    }
  }
}

export const notificationQueue = NotificationQueue.getInstance();
export default notificationQueue;
