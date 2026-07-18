import cloudinary from '../config/cloudinary';
import { env } from '../config/env';

export class CloudinaryUploadService {
  /**
   * Generates a secure pre-signed token for direct client-side uploads to Cloudinary.
   */
  static generateSignature(folder = 'apexbee/proofs'): {
    timestamp: number;
    signature: string;
    apiKey: string;
    cloudName: string;
    folder: string;
  } {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const params = {
      timestamp,
      folder,
    };

    if (!env.CLOUDINARY.API_SECRET || !env.CLOUDINARY.API_KEY || !env.CLOUDINARY.CLOUD_NAME) {
      throw new Error('Cloudinary credentials are not configured.');
    }

    const signature = cloudinary.utils.api_sign_request(params, env.CLOUDINARY.API_SECRET);

    return {
      timestamp,
      signature,
      apiKey: env.CLOUDINARY.API_KEY,
      cloudName: env.CLOUDINARY.CLOUD_NAME,
      folder,
    };
  }
}

export default CloudinaryUploadService;
