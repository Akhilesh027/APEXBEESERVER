"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportAcademyLeadsAdmin = exports.getAcademyAssigneesAdmin = exports.addAcademyLeadNoteAdmin = exports.scheduleAcademyLeadFollowUpAdmin = exports.assignAcademyLeadAdmin = exports.updateAcademyLeadStatusAdmin = exports.getAcademyAnalyticsAdmin = exports.getAcademyLeadDetailAdmin = exports.getAcademyLeadsAdmin = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const AcademyInterestLead_1 = __importDefault(require("../models/AcademyInterestLead"));
const AcademyLeadActivity_1 = __importDefault(require("../models/AcademyLeadActivity"));
const AcademyAdminAudit_1 = __importDefault(require("../models/AcademyAdminAudit"));
const User_1 = require("../models/User");
// Escape regex special characters
const escapeRegExp = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};
const getAcademyLeadsAdmin = async (req, res) => {
    try {
        const { page = 1, limit = 20, search = '', status, interestType, selectedInterest, stateId, districtId, mandalId, assignedTo, campaignSource, startDate, endDate, followUpStart, followUpEnd, sortBy = 'createdAt', sortOrder = 'desc', } = req.query;
        const query = { isArchived: false };
        // 1. Search Query (escaped regex on leadId, name, mobile, email)
        if (search) {
            const escaped = escapeRegExp(String(search));
            const regex = new RegExp(escaped, 'i');
            query.$or = [
                { leadId: regex },
                { fullName: regex },
                { mobile: regex },
                { normalizedMobile: regex },
                { email: regex },
            ];
        }
        // 2. Filters
        if (status)
            query.status = status;
        if (interestType)
            query.interestType = interestType;
        if (selectedInterest)
            query.selectedInterests = selectedInterest;
        if (stateId)
            query.stateId = stateId;
        if (districtId)
            query.districtId = districtId;
        if (mandalId)
            query.mandalId = mandalId;
        if (assignedTo)
            query.assignedTo = assignedTo;
        if (campaignSource)
            query.campaignSource = campaignSource;
        // Date range filters
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate)
                query.createdAt.$gte = new Date(String(startDate));
            if (endDate)
                query.createdAt.$lte = new Date(String(endDate));
        }
        if (followUpStart || followUpEnd) {
            query.nextFollowUpAt = {};
            if (followUpStart)
                query.nextFollowUpAt.$gte = new Date(String(followUpStart));
            if (followUpEnd)
                query.nextFollowUpAt.$lte = new Date(String(followUpEnd));
        }
        const sortOptions = {};
        sortOptions[String(sortBy)] = sortOrder === 'asc' ? 1 : -1;
        const skipCount = (Number(page) - 1) * Number(limit);
        const totalLeads = await AcademyInterestLead_1.default.countDocuments(query);
        const leads = await AcademyInterestLead_1.default.find(query)
            .populate('userId', 'name email')
            .populate('stateId', 'name')
            .populate('districtId', 'name')
            .populate('mandalId', 'name')
            .populate('assignedTo', 'name email')
            .sort(sortOptions)
            .skip(skipCount)
            .limit(Number(limit))
            .lean();
        // Summary counts for dashboard integration
        const newLeadsCount = await AcademyInterestLead_1.default.countDocuments({ status: 'new', isArchived: false });
        const followUpsDueCount = await AcademyInterestLead_1.default.countDocuments({
            status: 'follow_up',
            nextFollowUpAt: { $lte: new Date() },
            isArchived: false,
        });
        res.status(200).json({
            success: true,
            data: leads,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: totalLeads,
                pages: Math.ceil(totalLeads / Number(limit)),
            },
            summary: {
                new: newLeadsCount,
                followUpsDue: followUpsDueCount,
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
exports.getAcademyLeadsAdmin = getAcademyLeadsAdmin;
const getAcademyLeadDetailAdmin = async (req, res) => {
    try {
        const { leadId } = req.params;
        const lead = await AcademyInterestLead_1.default.findOne({ leadId })
            .populate('userId', 'name email')
            .populate('stateId', 'name')
            .populate('districtId', 'name')
            .populate('mandalId', 'name')
            .populate('assignedTo', 'name email')
            .populate('adminNotes.addedBy', 'name roles')
            .lean();
        if (!lead) {
            return res.status(404).json({ success: false, message: 'Lead not found.' });
        }
        const activities = await AcademyLeadActivity_1.default.find({ leadId: lead._id })
            .populate('performedBy', 'name roles')
            .sort({ createdAt: -1 })
            .lean();
        res.status(200).json({ success: true, data: { ...lead, activities } });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
exports.getAcademyLeadDetailAdmin = getAcademyLeadDetailAdmin;
const getAcademyAnalyticsAdmin = async (req, res) => {
    try {
        const { stateId, districtId, mandalId, assignedTo, campaignSource, startDate, endDate } = req.query;
        const query = { isArchived: false };
        if (stateId)
            query.stateId = stateId;
        if (districtId)
            query.districtId = districtId;
        if (mandalId)
            query.mandalId = mandalId;
        if (assignedTo)
            query.assignedTo = assignedTo;
        if (campaignSource)
            query.campaignSource = campaignSource;
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate)
                query.createdAt.$gte = new Date(String(startDate));
            if (endDate)
                query.createdAt.$lte = new Date(String(endDate));
        }
        const total = await AcademyInterestLead_1.default.countDocuments(query);
        const newCount = await AcademyInterestLead_1.default.countDocuments({ ...query, status: 'new' });
        const entrepreneur = await AcademyInterestLead_1.default.countDocuments({ ...query, interestType: 'become_entrepreneur' });
        const skillDevelopment = await AcademyInterestLead_1.default.countDocuments({ ...query, interestType: 'skill_development' });
        const contacted = await AcademyInterestLead_1.default.countDocuments({ ...query, status: 'contacted' });
        const qualified = await AcademyInterestLead_1.default.countDocuments({ ...query, status: 'qualified' });
        const followUp = await AcademyInterestLead_1.default.countDocuments({ ...query, status: 'follow_up' });
        const followUpsDue = await AcademyInterestLead_1.default.countDocuments({
            ...query,
            status: 'follow_up',
            nextFollowUpAt: { $lte: new Date() },
        });
        const converted = await AcademyInterestLead_1.default.countDocuments({ ...query, status: 'converted' });
        res.status(200).json({
            success: true,
            total,
            new: newCount,
            entrepreneur,
            skillDevelopment,
            contacted,
            qualified,
            followUp,
            followUpsDue,
            converted,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
exports.getAcademyAnalyticsAdmin = getAcademyAnalyticsAdmin;
// Check if status transition is valid
const isValidTransition = (from, to) => {
    const transitions = {
        new: ['contacted', 'not_interested', 'invalid'],
        contacted: ['qualified', 'follow_up', 'not_interested', 'invalid'],
        qualified: ['follow_up', 'converted', 'not_interested'],
        follow_up: ['contacted', 'qualified', 'converted', 'not_interested'],
        converted: [], // Handled separately for privileged admins
        not_interested: ['contacted', 'qualified', 'follow_up', 'new'],
        invalid: ['contacted', 'new'],
    };
    return (transitions[from] || []).includes(to);
};
const updateAcademyLeadStatusAdmin = async (req, res) => {
    const session = await mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const { leadId } = req.params;
        const { status, note } = req.body;
        const authUser = req.user;
        if (!status) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ success: false, message: 'Status is required.' });
        }
        const lead = await AcademyInterestLead_1.default.findOne({ leadId }).session(session);
        if (!lead) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ success: false, message: 'Lead not found.' });
        }
        const currentStatus = lead.status;
        // Enforce status conversion reversal permissions
        if (currentStatus === 'converted') {
            const isPrivileged = authUser.roles.includes('admin') || authUser.roles.includes('superadmin');
            if (!isPrivileged) {
                await session.abortTransaction();
                session.endSession();
                return res.status(403).json({ success: false, message: 'Only admin/superadmin can reopen converted leads.' });
            }
        }
        if (currentStatus !== status && !isValidTransition(currentStatus, status)) {
            // Reopening converted lead checks pass if user is privileged admin
            const isReopeningConverted = currentStatus === 'converted' && (authUser.roles.includes('admin') || authUser.roles.includes('superadmin'));
            if (!isReopeningConverted) {
                await session.abortTransaction();
                session.endSession();
                return res.status(422).json({ success: false, message: `Invalid status transition from ${currentStatus} to ${status}.` });
            }
        }
        // Require transition reason note
        const requireReason = ['not_interested', 'invalid'].includes(status) || currentStatus === 'converted';
        if (requireReason && (!note || note.trim().length === 0)) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ success: false, message: `A reason note is required for transitioning to ${status} or reopening a converted lead.` });
        }
        lead.status = status;
        if (status === 'converted') {
            lead.convertedAt = new Date();
            lead.convertedBy = authUser.id || authUser._id;
        }
        if (note) {
            lead.adminNotes.push({
                note: `[Status Change to ${status}]: ${note}`,
                addedBy: authUser.id || authUser._id,
                addedAt: new Date(),
            });
        }
        await lead.save({ session });
        const activity = new AcademyLeadActivity_1.default({
            leadId: lead._id,
            action: 'status_changed',
            fromStatus: currentStatus,
            toStatus: status,
            performedBy: authUser.id || authUser._id,
            note: note || '',
        });
        await activity.save({ session });
        await session.commitTransaction();
        session.endSession();
        res.status(200).json({ success: true, data: lead });
    }
    catch (error) {
        await session.abortTransaction();
        session.endSession();
        res.status(500).json({ success: false, error: error.message });
    }
};
exports.updateAcademyLeadStatusAdmin = updateAcademyLeadStatusAdmin;
const assignAcademyLeadAdmin = async (req, res) => {
    const session = await mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const { leadId } = req.params;
        const { assignedTo } = req.body;
        const authUser = req.user;
        if (!assignedTo) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ success: false, message: 'assignedTo is required.' });
        }
        const assignee = await User_1.User.findById(assignedTo).session(session);
        if (!assignee || (!assignee.roles.includes('academy_manager') && !assignee.roles.includes('counsellor') && !assignee.roles.includes('admin'))) {
            await session.abortTransaction();
            session.endSession();
            return res.status(422).json({ success: false, message: 'Invalid assignee: User must have admin, academy_manager, or counsellor role.' });
        }
        const lead = await AcademyInterestLead_1.default.findOne({ leadId }).session(session);
        if (!lead) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ success: false, message: 'Lead not found.' });
        }
        lead.assignedTo = assignedTo;
        lead.assignedAt = new Date();
        await lead.save({ session });
        const activity = new AcademyLeadActivity_1.default({
            leadId: lead._id,
            action: 'assigned',
            performedBy: authUser.id || authUser._id,
            note: `Assigned to ${assignee.name}`,
        });
        await activity.save({ session });
        await session.commitTransaction();
        session.endSession();
        res.status(200).json({ success: true, data: lead });
    }
    catch (error) {
        await session.abortTransaction();
        session.endSession();
        res.status(500).json({ success: false, error: error.message });
    }
};
exports.assignAcademyLeadAdmin = assignAcademyLeadAdmin;
const scheduleAcademyLeadFollowUpAdmin = async (req, res) => {
    const session = await mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const { leadId } = req.params;
        const { nextFollowUpAt, note } = req.body;
        const authUser = req.user;
        if (!nextFollowUpAt) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ success: false, message: 'nextFollowUpAt date is required.' });
        }
        const followUpDate = new Date(nextFollowUpAt);
        if (followUpDate <= new Date()) {
            await session.abortTransaction();
            session.endSession();
            return res.status(422).json({ success: false, message: 'Follow-up date must be in the future.' });
        }
        const lead = await AcademyInterestLead_1.default.findOne({ leadId }).session(session);
        if (!lead) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ success: false, message: 'Lead not found.' });
        }
        lead.nextFollowUpAt = followUpDate;
        if (lead.status === 'new' || lead.status === 'contacted') {
            lead.status = 'follow_up';
        }
        if (note) {
            lead.adminNotes.push({
                note: `[Follow-Up Scheduled for ${followUpDate.toLocaleString()}]: ${note}`,
                addedBy: authUser.id || authUser._id,
                addedAt: new Date(),
            });
        }
        await lead.save({ session });
        const activity = new AcademyLeadActivity_1.default({
            leadId: lead._id,
            action: 'follow_up_scheduled',
            performedBy: authUser.id || authUser._id,
            note: note || `Scheduled for ${followUpDate.toLocaleString()}`,
        });
        await activity.save({ session });
        await session.commitTransaction();
        session.endSession();
        res.status(200).json({ success: true, data: lead });
    }
    catch (error) {
        await session.abortTransaction();
        session.endSession();
        res.status(500).json({ success: false, error: error.message });
    }
};
exports.scheduleAcademyLeadFollowUpAdmin = scheduleAcademyLeadFollowUpAdmin;
const addAcademyLeadNoteAdmin = async (req, res) => {
    try {
        const { leadId } = req.params;
        const { note } = req.body;
        const authUser = req.user;
        if (!note || note.trim().length === 0) {
            return res.status(400).json({ success: false, message: 'Note content is required.' });
        }
        const lead = await AcademyInterestLead_1.default.findOne({ leadId });
        if (!lead) {
            return res.status(404).json({ success: false, message: 'Lead not found.' });
        }
        lead.adminNotes.push({
            note,
            addedBy: authUser.id || authUser._id,
            addedAt: new Date(),
        });
        await lead.save();
        const activity = new AcademyLeadActivity_1.default({
            leadId: lead._id,
            action: 'note_added',
            performedBy: authUser.id || authUser._id,
            note,
        });
        await activity.save();
        res.status(200).json({ success: true, data: lead });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
exports.addAcademyLeadNoteAdmin = addAcademyLeadNoteAdmin;
const getAcademyAssigneesAdmin = async (_req, res) => {
    try {
        const users = await User_1.User.find({
            roles: { $in: ['academy_manager', 'counsellor', 'admin', 'superadmin'] },
            status: 'active',
        })
            .select('name email roles')
            .sort({ name: 1 })
            .lean();
        res.status(200).json({ success: true, data: users });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
exports.getAcademyAssigneesAdmin = getAcademyAssigneesAdmin;
// Safe escape for CSV fields to prevent formula injection (=, +, -, @)
const escapeCsvField = (value) => {
    if (value === null || value === undefined)
        return '';
    const str = String(value);
    if (str.startsWith('=') || str.startsWith('+') || str.startsWith('-') || str.startsWith('@')) {
        return `'${str}`;
    }
    return str;
};
const exportAcademyLeadsAdmin = async (req, res) => {
    try {
        const authUser = req.user;
        const { status, interestType, selectedInterest, stateId, districtId, mandalId, assignedTo, campaignSource, startDate, endDate, } = req.query;
        const query = { isArchived: false };
        if (status)
            query.status = status;
        if (interestType)
            query.interestType = interestType;
        if (selectedInterest)
            query.selectedInterests = selectedInterest;
        if (stateId)
            query.stateId = stateId;
        if (districtId)
            query.districtId = districtId;
        if (mandalId)
            query.mandalId = mandalId;
        if (assignedTo)
            query.assignedTo = assignedTo;
        if (campaignSource)
            query.campaignSource = campaignSource;
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate)
                query.createdAt.$gte = new Date(String(startDate));
            if (endDate)
                query.createdAt.$lte = new Date(String(endDate));
        }
        // Limit export to a safe volume (e.g. 5000 leads)
        const leads = await AcademyInterestLead_1.default.find(query)
            .populate('stateId', 'name')
            .populate('districtId', 'name')
            .populate('mandalId', 'name')
            .populate('assignedTo', 'name')
            .sort({ createdAt: -1 })
            .limit(5000)
            .lean();
        // Log the export audit log
        const audit = new AcademyAdminAudit_1.default({
            action: 'leads_exported',
            performedBy: authUser.id || authUser._id,
            filters: query,
            exportedCount: leads.length,
        });
        await audit.save();
        // Construct CSV String
        const headers = [
            'Lead ID',
            'Name',
            'Mobile',
            'Email',
            'Interest Type',
            'Selected Interests',
            'State',
            'District',
            'Mandal / City',
            'Occupation',
            'Qualification',
            'Investment Range',
            'Learning Mode',
            'Status',
            'Assigned To',
            'Next Follow-Up',
            'Created At',
            'Campaign Source',
        ];
        const rows = leads.map(l => [
            escapeCsvField(l.leadId),
            escapeCsvField(l.fullName),
            escapeCsvField(l.mobile),
            escapeCsvField(l.email || ''),
            escapeCsvField(l.interestType),
            escapeCsvField(l.selectedInterests.join(', ')),
            escapeCsvField(l.stateId ? l.stateId.name : ''),
            escapeCsvField(l.districtId ? l.districtId.name : ''),
            escapeCsvField(l.mandalId ? l.mandalId.name : l.city || ''),
            escapeCsvField(l.occupation || ''),
            escapeCsvField(l.qualification || ''),
            escapeCsvField(l.investmentRange || ''),
            escapeCsvField(l.learningMode || ''),
            escapeCsvField(l.status),
            escapeCsvField(l.assignedTo ? l.assignedTo.name : ''),
            escapeCsvField(l.nextFollowUpAt ? l.nextFollowUpAt.toISOString() : ''),
            escapeCsvField(l.createdAt.toISOString()),
            escapeCsvField(l.campaignSource || ''),
        ]);
        const csvContent = [
            headers.join(','),
            ...rows.map(r => r.map(val => `"${val.replace(/"/g, '""')}"`).join(',')),
        ].join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=academy_leads_${Date.now()}.csv`);
        return res.status(200).send(csvContent);
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
exports.exportAcademyLeadsAdmin = exportAcademyLeadsAdmin;
