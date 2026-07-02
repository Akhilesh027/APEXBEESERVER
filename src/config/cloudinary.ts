import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

// Configure Cloudinary only if credentials are set
const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

const isCloudinaryConfigured = !!(cloudName && apiKey && apiSecret);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });
}

export const uploadToCloudinary = async (fileBuffer: Buffer, folder = 'apexbee'): Promise<string | null> => {
  if (!isCloudinaryConfigured) {
    console.log('Cloudinary not configured. Fallback to local storage should be handled by the route.');
    return null;
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder },
      (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          reject(error);
        } else {
          resolve(result?.secure_url || null);
        }
      }
    );
    uploadStream.end(fileBuffer);
  });
};

export default cloudinary;
