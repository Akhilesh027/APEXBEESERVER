import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../../../middleware/auth';
import { Notification } from '../models/Notification';
import { NotificationPreference } from '../models/NotificationPreference';
import { NotificationTemplate } from '../models/NotificationTemplate';
import { NotificationJob } from '../models/NotificationJob';
import { User } from '../../../models/User';
import { notificationEmitter } from '../events/notificationEmitter';

/**
 * Gets a paginated list of notifications for the logged-in user.
 */
export const getUserNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const userId = req.user.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const category = req.query.category as string;
    const readStatus = req.query.readStatus as string; // 'unread', 'read', 'all'

    const query: any = {
      recipientId: new mongoose.Types.ObjectId(userId),
      status: { $ne: 'deleted' }
    };

    if (category) {
      query.category = category;
    }

    if (readStatus === 'unread') {
      query.status = 'unread';
    } else if (readStatus === 'read') {
      query.status = 'read';
    } else if (readStatus === 'archived') {
      query.status = 'archived';
    }

    const total = await Notification.countDocuments(query);
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.status(200).json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      notifications
    });
  } catch (error: any) {
    console.error('Fetch user notifications error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving notifications', error: error.message });
  }
};

/**
 * Gets count of unread notifications.
 */
export const getUnreadCount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const count = await Notification.countDocuments({
      recipientId: new mongoose.Types.ObjectId(req.user.id),
      status: 'unread'
    });

    res.status(200).json({ success: true, count });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Server error retrieving unread count', error: error.message });
  }
};

/**
 * Marks a notification as read.
 */
export const markNotificationRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const notif = await Notification.findById(id);

    if (!notif) {
      res.status(404).json({ success: false, message: 'Notification not found' });
      return;
    }

    // Verify ownership
    if (notif.recipientId.toString() !== req.user?.id) {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }

    notif.status = 'read';
    notif.deliveryTimeline.push({ status: 'read', channel: 'inApp', timestamp: new Date() });
    await notif.save();

    res.status(200).json({ success: true, notification: notif });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Error marking notification read', error: error.message });
  }
};

/**
 * Marks all notifications for a user as read.
 */
export const markAllRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const userId = req.user.id;
    await Notification.updateMany(
      { recipientId: new mongoose.Types.ObjectId(userId), status: 'unread' },
      {
        $set: { status: 'read' },
        $push: { deliveryTimeline: { status: 'read', channel: 'inApp', timestamp: new Date() } }
      }
    );

    res.status(200).json({ success: true, message: 'All notifications marked as read' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Error marking all read', error: error.message });
  }
};

/**
 * Archives a specific notification.
 */
export const archiveNotification = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const notif = await Notification.findById(id);

    if (!notif) {
      res.status(404).json({ success: false, message: 'Notification not found' });
      return;
    }

    if (notif.recipientId.toString() !== req.user?.id) {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }

    notif.status = 'archived';
    await notif.save();

    res.status(200).json({ success: true, notification: notif });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Error archiving notification', error: error.message });
  }
};

/**
 * Deletes (soft delete) a specific notification.
 */
export const deleteNotification = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const notif = await Notification.findById(id);

    if (!notif) {
      res.status(404).json({ success: false, message: 'Notification not found' });
      return;
    }

    if (notif.recipientId.toString() !== req.user?.id) {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }

    notif.status = 'deleted';
    await notif.save();

    res.status(200).json({ success: true, message: 'Notification deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Error deleting notification', error: error.message });
  }
};

/**
 * Gets user preferences.
 */
export const getPreferences = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    let pref = await NotificationPreference.findOne({ userId: req.user.id });
    if (!pref) {
      pref = new NotificationPreference({ userId: req.user.id });
      await pref.save();
    }

    res.status(200).json({ success: true, preferences: pref });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Error fetching preferences', error: error.message });
  }
};

/**
 * Updates user preferences.
 */
export const updatePreferences = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { channels, categories, quietHours } = req.body;
    let pref = await NotificationPreference.findOne({ userId: req.user.id });

    if (!pref) {
      pref = new NotificationPreference({ userId: req.user.id });
    }

    if (channels) pref.channels = { ...pref.channels, ...channels };
    if (categories) pref.categories = { ...pref.categories, ...categories };
    if (quietHours) pref.quietHours = { ...pref.quietHours, ...quietHours };

    await pref.save();
    res.status(200).json({ success: true, preferences: pref });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Error updating preferences', error: error.message });
  }
};

// ────────────────────────────────────────────────────────────────────────
// ADMINISTRATIVE & TEMPLATE CONTROL ENDPOINTS
// ────────────────────────────────────────────────────────────────────────

export const getTemplates = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const templates = await NotificationTemplate.find({}).sort({ eventCode: 1 });
    res.status(200).json({ success: true, templates });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { eventCode, name, category, titleTemplate, bodyTemplate, channels } = req.body;

    const exists = await NotificationTemplate.findOne({ eventCode });
    if (exists) {
      res.status(400).json({ success: false, message: `Template with eventCode ${eventCode} already exists.` });
      return;
    }

    const template = new NotificationTemplate({
      eventCode,
      name,
      category,
      titleTemplate,
      bodyTemplate,
      channels
    });

    await template.save();
    res.status(201).json({ success: true, template });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const template = await NotificationTemplate.findByIdAndUpdate(id, { $set: req.body }, { new: true });

    if (!template) {
      res.status(404).json({ success: false, message: 'Template not found' });
      return;
    }

    res.status(200).json({ success: true, template });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const template = await NotificationTemplate.findByIdAndDelete(id);

    if (!template) {
      res.status(404).json({ success: false, message: 'Template not found' });
      return;
    }

    res.status(200).json({ success: true, message: 'Template deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Triggers a broadcast event to multiple users.
 */
export const broadcastNotification = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { eventCode, payload, targetRoles, targetPincodes } = req.body;

    // Resolve target recipients based on filters
    const filter: any = { status: 'active' };

    if (targetRoles && targetRoles.length > 0) {
      filter.roles = { $in: targetRoles };
    }

    if (targetPincodes && targetPincodes.length > 0) {
      filter.pincode = { $in: targetPincodes };
    }

    const targetUsers = await User.find(filter).select('_id roles');
    if (targetUsers.length === 0) {
      res.status(400).json({ success: false, message: 'No target users matched filters' });
      return;
    }

    const recipients = targetUsers.map(u => ({
      userId: u._id,
      role: u.roles[0] || 'customer'
    }));

    // Trigger emit via central registry
    notificationEmitter.emitNotification(eventCode, { ...payload, isBroadcast: true }, recipients);

    res.status(200).json({
      success: true,
      message: `Broadcast initiated successfully to ${recipients.length} target users.`
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Aggregates statistics about dispatches for admin analytics dashboard.
 */
export const getAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const totalSent = await Notification.countDocuments();
    const read = await Notification.countDocuments({ status: 'read' });
    const unread = await Notification.countDocuments({ status: 'unread' });
    const archived = await Notification.countDocuments({ status: 'archived' });

    // Aggregate timeline failure dispatches
    const timelineStats = await Notification.aggregate([
      { $unwind: '$deliveryTimeline' },
      {
        $group: {
          _id: { channel: '$deliveryTimeline.channel', status: '$deliveryTimeline.status' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Aggregate queue logs
    const activeJobs = await NotificationJob.countDocuments({ status: 'processing' });
    const pendingJobs = await NotificationJob.countDocuments({ status: 'pending' });
    const completedJobs = await NotificationJob.countDocuments({ status: 'completed' });
    const failedJobs = await NotificationJob.countDocuments({ status: 'failed' });

    res.status(200).json({
      success: true,
      analytics: {
        totalSent,
        read,
        unread,
        archived,
        readRate: totalSent > 0 ? (read / totalSent) * 100 : 0,
        timelineStats,
        jobs: {
          activeJobs,
          pendingJobs,
          completedJobs,
          failedJobs
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
