import crypto from 'crypto';
import { ClientSession } from 'mongoose';
import { IdempotencyRecord } from '../models/IdempotencyRecord';

export interface IdempotencyCheckResult {
  status: 'new' | 'processing' | 'completed' | 'retry' | 'conflict';
  responseCode?: number;
  responseBody?: any;
}

export class IdempotencyService {
  /**
   * Helper to compute a deterministic hash of the request payload.
   */
  static getPayloadHash(payload: any): string {
    const rawString = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
    return crypto.createHash('sha256').update(rawString).digest('hex');
  }

  /**
   * Checks for an existing key and payload.
   * Creates a 'processing' record if none exists.
   */
  static async checkOrRecord(
    userId: string,
    key: string,
    payload: any,
    session?: ClientSession
  ): Promise<IdempotencyCheckResult> {
    const payloadHash = this.getPayloadHash(payload);
    
    // Find record by unique compound key
    const record = await IdempotencyRecord.findOne({
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
    const newRecord = new IdempotencyRecord({
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
    } catch (saveErr: any) {
      if (saveErr.code === 11000) {
        const concurrentRecord = await IdempotencyRecord.findOne({
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
  static async resolveRecord(
    userId: string,
    key: string,
    responseCode: number,
    responseBody: any,
    resourceId?: string,
    session?: ClientSession
  ): Promise<void> {
    await IdempotencyRecord.findOneAndUpdate(
      { userId, operation: 'CREATE_ORDER', key },
      {
        status: 'completed',
        responseCode,
        responseBody,
        resourceId,
      },
      { session }
    );
  }

  /**
   * Transition record to failed state so that clients can retry.
   */
  static async failRecord(
    userId: string,
    key: string,
    session?: ClientSession
  ): Promise<void> {
    await IdempotencyRecord.findOneAndUpdate(
      { userId, operation: 'CREATE_ORDER', key },
      { status: 'failed' },
      { session }
    );
  }
}

export default IdempotencyService;
