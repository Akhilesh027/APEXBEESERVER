"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAnalytics = exports.broadcastNotification = exports.deleteTemplate = exports.updateTemplate = exports.createTemplate = exports.getTemplates = exports.updatePreferences = exports.getPreferences = exports.deleteNotification = exports.archiveNotification = exports.markAllRead = exports.markNotificationRead = exports.getUnreadCount = exports.getUserNotifications = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Notification_1 = require("../models/Notification");
const NotificationPreference_1 = require("../models/NotificationPreference");
const NotificationTemplate_1 = require("../models/NotificationTemplate");
const NotificationJob_1 = require("../models/NotificationJob");
const User_1 = require("../../../models/User");
const notificationEmitter_1 = require("../events/notificationEmitter");
/**
 * Gets a paginated list of notifications for the logged-in user.
 */
const getUserNotifications = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        if (req.params.userId && req.params.userId !== req.user.id && !req.user.roles.includes('admin')) {
            res.status(404).json({ success: false, message: 'Resource not found' });
            return;
        }
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const category = req.query.category;
        const readStatus = req.query.readStatus; // 'unread', 'read', 'all'
        const query = {
            recipientId: new mongoose_1.default.Types.ObjectId(userId),
            status: { $ne: 'deleted' }
        };
        if (category) {
            query.category = category;
        }
        if (readStatus === 'unread') {
            query.status = 'unread';
        }
        else if (readStatus === 'read') {
            query.status = 'read';
        }
        else if (readStatus === 'archived') {
            query.status = 'archived';
        }
        const total = await Notification_1.Notification.countDocuments(query);
        const notifications = await Notification_1.Notification.find(query)
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
    }
    catch (error) {
        console.error('Fetch user notifications error:', error);
        res.status(500).json({ success: false, message: 'Server error retrieving notifications', error: error.message });
    }
};
exports.getUserNotifications = getUserNotifications;
/**
 * Gets count of unread notifications.
 */
const getUnreadCount = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const count = await Notification_1.Notification.countDocuments({
            recipientId: new mongoose_1.default.Types.ObjectId(req.user.id),
            status: 'unread'
        });
        res.status(200).json({ success: true, count });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Server error retrieving unread count', error: error.message });
    }
};
exports.getUnreadCount = getUnreadCount;
/**
 * Marks a notification as read.
 */
const markNotificationRead = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
            res.status(400).json({ success: false, message: 'Invalid ID format' });
            return;
        }
        const notif = await Notification_1.Notification.findById(id);
        if (!notif) {
            res.status(404).json({ success: false, message: 'Resource not found' });
            return;
        }
        // Verify ownership
        if (notif.recipientId.toString() !== req.user?.id) {
            res.status(404).json({ success: false, message: 'Resource not found' });
            return;
        }
        notif.status = 'read';
        notif.deliveryTimeline.push({ status: 'read', channel: 'inApp', timestamp: new Date() });
        await notif.save();
        res.status(200).json({ success: true, notification: notif });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Error marking notification read', error: error.message });
    }
};
exports.markNotificationRead = markNotificationRead;
/**
 * Marks all notifications for a user as read.
 */
const markAllRead = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const userId = req.user.id;
        await Notification_1.Notification.updateMany({ recipientId: new mongoose_1.default.Types.ObjectId(userId), status: 'unread' }, {
            $set: { status: 'read' },
            $push: { deliveryTimeline: { status: 'read', channel: 'inApp', timestamp: new Date() } }
        });
        res.status(200).json({ success: true, message: 'All notifications marked as read' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Error marking all read', error: error.message });
    }
};
exports.markAllRead = markAllRead;
/**
 * Archives a specific notification.
 */
const archiveNotification = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
            res.status(400).json({ success: false, message: 'Invalid ID format' });
            return;
        }
        const notif = await Notification_1.Notification.findById(id);
        if (!notif) {
            res.status(404).json({ success: false, message: 'Resource not found' });
            return;
        }
        if (notif.recipientId.toString() !== req.user?.id) {
            res.status(404).json({ success: false, message: 'Resource not found' });
            return;
        }
        notif.status = 'archived';
        await notif.save();
        res.status(200).json({ success: true, notification: notif });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Error archiving notification', error: error.message });
    }
};
exports.archiveNotification = archiveNotification;
/**
 * Deletes (soft delete) a specific notification.
 */
const deleteNotification = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
            res.status(400).json({ success: false, message: 'Invalid ID format' });
            return;
        }
        const notif = await Notification_1.Notification.findById(id);
        if (!notif) {
            res.status(404).json({ success: false, message: 'Resource not found' });
            return;
        }
        if (notif.recipientId.toString() !== req.user?.id) {
            res.status(404).json({ success: false, message: 'Resource not found' });
            return;
        }
        notif.status = 'deleted';
        await notif.save();
        res.status(200).json({ success: true, message: 'Notification deleted' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Error deleting notification', error: error.message });
    }
};
exports.deleteNotification = deleteNotification;
/**
 * Gets user preferences.
 */
const getPreferences = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        let pref = await NotificationPreference_1.NotificationPreference.findOne({ userId: req.user.id });
        if (!pref) {
            pref = new NotificationPreference_1.NotificationPreference({ userId: req.user.id });
            await pref.save();
        }
        res.status(200).json({ success: true, preferences: pref });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching preferences', error: error.message });
    }
};
exports.getPreferences = getPreferences;
/**
 * Updates user preferences.
 */
const updatePreferences = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const { channels, categories, quietHours } = req.body;
        let pref = await NotificationPreference_1.NotificationPreference.findOne({ userId: req.user.id });
        if (!pref) {
            pref = new NotificationPreference_1.NotificationPreference({ userId: req.user.id });
        }
        if (channels)
            pref.channels = { ...pref.channels, ...channels };
        if (categories)
            pref.categories = { ...pref.categories, ...categories };
        if (quietHours)
            pref.quietHours = { ...pref.quietHours, ...quietHours };
        await pref.save();
        res.status(200).json({ success: true, preferences: pref });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Error updating preferences', error: error.message });
    }
};
exports.updatePreferences = updatePreferences;
// ────────────────────────────────────────────────────────────────────────
// ADMINISTRATIVE & TEMPLATE CONTROL ENDPOINTS
// ────────────────────────────────────────────────────────────────────────
const getTemplates = async (req, res) => {
    try {
        const templates = await NotificationTemplate_1.NotificationTemplate.find({}).sort({ eventCode: 1 });
        res.status(200).json({ success: true, templates });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getTemplates = getTemplates;
const createTemplate = async (req, res) => {
    try {
        const { eventCode, name, category, titleTemplate, bodyTemplate, channels } = req.body;
        const exists = await NotificationTemplate_1.NotificationTemplate.findOne({ eventCode });
        if (exists) {
            res.status(400).json({ success: false, message: `Template with eventCode ${eventCode} already exists.` });
            return;
        }
        const template = new NotificationTemplate_1.NotificationTemplate({
            eventCode,
            name,
            category,
            titleTemplate,
            bodyTemplate,
            channels
        });
        await template.save();
        res.status(201).json({ success: true, template });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.createTemplate = createTemplate;
const updateTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        const template = await NotificationTemplate_1.NotificationTemplate.findByIdAndUpdate(id, { $set: req.body }, { new: true });
        if (!template) {
            res.status(404).json({ success: false, message: 'Template not found' });
            return;
        }
        res.status(200).json({ success: true, template });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.updateTemplate = updateTemplate;
const deleteTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        const template = await NotificationTemplate_1.NotificationTemplate.findByIdAndDelete(id);
        if (!template) {
            res.status(404).json({ success: false, message: 'Template not found' });
            return;
        }
        res.status(200).json({ success: true, message: 'Template deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.deleteTemplate = deleteTemplate;
/**
 * Triggers a broadcast event to multiple users.
 */
const broadcastNotification = async (req, res) => {
    try {
        const { eventCode, payload, targetRoles, targetPincodes } = req.body;
        // Resolve target recipients based on filters
        const filter = { status: 'active' };
        if (targetRoles && targetRoles.length > 0) {
            filter.roles = { $in: targetRoles };
        }
        if (targetPincodes && targetPincodes.length > 0) {
            filter.pincode = { $in: targetPincodes };
        }
        const targetUsers = await User_1.User.find(filter).select('_id roles');
        if (targetUsers.length === 0) {
            res.status(400).json({ success: false, message: 'No target users matched filters' });
            return;
        }
        const recipients = targetUsers.map(u => ({
            userId: u._id,
            role: u.roles[0] || 'customer'
        }));
        // Trigger emit via central registry
        notificationEmitter_1.notificationEmitter.emitNotification(eventCode, { ...payload, isBroadcast: true }, recipients);
        res.status(200).json({
            success: true,
            message: `Broadcast initiated successfully to ${recipients.length} target users.`
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.broadcastNotification = broadcastNotification;
/**
 * Aggregates statistics about dispatches for admin analytics dashboard.
 */
const getAnalytics = async (req, res) => {
    try {
        const totalSent = await Notification_1.Notification.countDocuments();
        const read = await Notification_1.Notification.countDocuments({ status: 'read' });
        const unread = await Notification_1.Notification.countDocuments({ status: 'unread' });
        const archived = await Notification_1.Notification.countDocuments({ status: 'archived' });
        // Aggregate timeline failure dispatches
        const timelineStats = await Notification_1.Notification.aggregate([
            { $unwind: '$deliveryTimeline' },
            {
                $group: {
                    _id: { channel: '$deliveryTimeline.channel', status: '$deliveryTimeline.status' },
                    count: { $sum: 1 }
                }
            }
        ]);
        // Aggregate queue logs
        const activeJobs = await NotificationJob_1.NotificationJob.countDocuments({ status: 'processing' });
        const pendingJobs = await NotificationJob_1.NotificationJob.countDocuments({ status: 'pending' });
        const completedJobs = await NotificationJob_1.NotificationJob.countDocuments({ status: 'completed' });
        const failedJobs = await NotificationJob_1.NotificationJob.countDocuments({ status: 'failed' });
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
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getAnalytics = getAnalytics;
