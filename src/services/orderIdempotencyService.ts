import { ClientSession } from 'mongoose';
import { IdempotencyService } from './idempotencyService';

export class OrderIdempotencyService {
  static async checkOrRecord(
    userId: string,
    key: string,
    payload: any,
    session?: ClientSession
  ) {
    const result = await IdempotencyService.checkOrRecord(userId, key, payload, session);
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

  static async updateStatus(
    userId: string,
    key: string,
    status: 'completed' | 'failed',
    responseBody?: any,
    session?: ClientSession
  ): Promise<void> {
    if (status === 'completed') {
      await IdempotencyService.resolveRecord(userId, key, 201, responseBody, responseBody?.order?._id || undefined, session);
    } else {
      await IdempotencyService.failRecord(userId, key, session);
    }
  }
}

export default OrderIdempotencyService;
