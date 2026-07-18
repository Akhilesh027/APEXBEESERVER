import { Router, Request, Response } from 'express';
import { uploadDisk } from '../middleware/multer';
import { uploadToCloudinary } from '../config/cloudinary';
import { protect } from '../middleware/auth';
import { CloudinaryUploadService } from '../services/cloudinaryUploadService';
import fs from 'fs';

const router = Router();

router.get('/signature', protect, (req: Request, res: Response) => {
  try {
    const folder = (req.query.folder as string) || 'apexbee/proofs';
    const credentials = CloudinaryUploadService.generateSignature(folder);
    res.status(200).json({ success: true, ...credentials });
  } catch (err: any) {
    console.error('Failed to generate signature:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', protect, uploadDisk.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'No file uploaded' });
      return;
    }

    // Try to upload to Cloudinary
    try {
      const fileBuffer = fs.readFileSync(req.file.path);
      const cloudinaryUrl = await uploadToCloudinary(fileBuffer, 'apexbee');
      if (cloudinaryUrl) {
        // Remove local file
        fs.unlinkSync(req.file.path);
        res.status(200).json({ success: true, url: cloudinaryUrl });
        return;
      }
    } catch (err) {
      console.warn('Cloudinary upload bypassed or failed, using local URL:', err);
    }

    // Fallback to local server URL
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    res.status(200).json({ success: true, url: fileUrl });
  } catch (error: any) {
    console.error('File upload route error:', error);
    res.status(500).json({ message: 'Failed to upload file', error: error.message });
  }
});

router.post('/upload', protect, uploadDisk.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'No file uploaded' });
      return;
    }

    // Try to upload to Cloudinary
    try {
      const fileBuffer = fs.readFileSync(req.file.path);
      const cloudinaryUrl = await uploadToCloudinary(fileBuffer, 'apexbee');
      if (cloudinaryUrl) {
        // Remove local file
        fs.unlinkSync(req.file.path);
        res.status(200).json({ success: true, url: cloudinaryUrl });
        return;
      }
    } catch (err) {
      console.warn('Cloudinary upload bypassed or failed, using local URL:', err);
    }

    // Fallback to local server URL
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    res.status(200).json({ success: true, url: fileUrl });
  } catch (error: any) {
    console.error('File upload route error:', error);
    res.status(500).json({ message: 'Failed to upload file', error: error.message });
  }
});

export default router;
