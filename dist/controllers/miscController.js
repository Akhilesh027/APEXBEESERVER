"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTrainingVideos = exports.createTrainingVideo = exports.replySupportTicket = exports.getSupportTickets = exports.createSupportTicket = exports.updateCoupon = exports.deleteCoupon = exports.getCoupons = exports.createCoupon = exports.deleteCampaign = exports.updateCampaign = exports.getCampaigns = exports.createCampaign = exports.updateServiceRequest = exports.getServiceRequests = exports.createServiceRequest = exports.updateCourse = exports.getCourses = exports.createCourse = void 0;
const Course_1 = require("../models/Course");
const ServiceRequest_1 = require("../models/ServiceRequest");
const Campaign_1 = require("../models/Campaign");
const Coupon_1 = require("../models/Coupon");
const SupportTicket_1 = require("../models/SupportTicket");
const TrainingVideo_1 = require("../models/TrainingVideo");
// --- Course ---
const createCourse = async (req, res) => {
    try {
        const course = new Course_1.Course(req.body);
        await course.save();
        return res.status(201).json({ success: true, course });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.createCourse = createCourse;
const getCourses = async (req, res) => {
    try {
        const filters = {};
        if (req.query.providerId)
            filters.providerId = req.query.providerId;
        if (req.query.status)
            filters.status = req.query.status;
        const courses = await Course_1.Course.find(filters);
        return res.status(200).json({ success: true, courses });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.getCourses = getCourses;
const updateCourse = async (req, res) => {
    try {
        const course = await Course_1.Course.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!course)
            return res.status(404).json({ success: false, message: "Course not found" });
        return res.status(200).json({ success: true, course });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.updateCourse = updateCourse;
// --- ServiceRequest ---
const createServiceRequest = async (req, res) => {
    try {
        const serviceRequest = new ServiceRequest_1.ServiceRequest(req.body);
        await serviceRequest.save();
        return res.status(201).json({ success: true, serviceRequest });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.createServiceRequest = createServiceRequest;
const getServiceRequests = async (req, res) => {
    try {
        const filters = {};
        if (req.query.customerId)
            filters.customerId = req.query.customerId;
        if (req.query.providerId)
            filters.providerId = req.query.providerId;
        if (req.query.status)
            filters.status = req.query.status;
        const serviceRequests = await ServiceRequest_1.ServiceRequest.find(filters);
        return res.status(200).json({ success: true, serviceRequests });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.getServiceRequests = getServiceRequests;
const updateServiceRequest = async (req, res) => {
    try {
        const serviceRequest = await ServiceRequest_1.ServiceRequest.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!serviceRequest)
            return res.status(404).json({ success: false, message: "ServiceRequest not found" });
        return res.status(200).json({ success: true, serviceRequest });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.updateServiceRequest = updateServiceRequest;
// --- Campaign ---
const createCampaign = async (req, res) => {
    try {
        const campaign = new Campaign_1.Campaign(req.body);
        await campaign.save();
        return res.status(201).json({ success: true, campaign });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.createCampaign = createCampaign;
const getCampaigns = async (req, res) => {
    try {
        const filters = {};
        if (req.query.ownerId)
            filters.ownerId = req.query.ownerId;
        if (req.query.status)
            filters.status = req.query.status;
        const campaigns = await Campaign_1.Campaign.find(filters).populate("ownerId", "name email phone roles");
        return res.status(200).json({ success: true, campaigns });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.getCampaigns = getCampaigns;
const updateCampaign = async (req, res) => {
    try {
        const campaign = await Campaign_1.Campaign.findByIdAndUpdate(req.params.id, req.body, { new: true }).populate("ownerId", "name email phone roles");
        if (!campaign)
            return res.status(404).json({ success: false, message: "Campaign not found" });
        return res.status(200).json({ success: true, campaign });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.updateCampaign = updateCampaign;
const deleteCampaign = async (req, res) => {
    try {
        const campaign = await Campaign_1.Campaign.findByIdAndDelete(req.params.id);
        if (!campaign)
            return res.status(404).json({ success: false, message: "Campaign not found" });
        return res.status(200).json({ success: true, message: "Campaign deleted successfully" });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.deleteCampaign = deleteCampaign;
// --- Coupon ---
const createCoupon = async (req, res) => {
    try {
        const coupon = new Coupon_1.Coupon(req.body);
        await coupon.save();
        return res.status(201).json({ success: true, coupon });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.createCoupon = createCoupon;
const getCoupons = async (req, res) => {
    try {
        const coupons = await Coupon_1.Coupon.find();
        return res.status(200).json({ success: true, coupons });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.getCoupons = getCoupons;
const deleteCoupon = async (req, res) => {
    try {
        const coupon = await Coupon_1.Coupon.findByIdAndDelete(req.params.id);
        if (!coupon)
            return res.status(404).json({ success: false, message: "Coupon not found" });
        return res.status(200).json({ success: true, message: "Coupon deleted successfully" });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.deleteCoupon = deleteCoupon;
const updateCoupon = async (req, res) => {
    try {
        const coupon = await Coupon_1.Coupon.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!coupon)
            return res.status(404).json({ success: false, message: "Coupon not found" });
        return res.status(200).json({ success: true, coupon });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.updateCoupon = updateCoupon;
// --- SupportTicket ---
const createSupportTicket = async (req, res) => {
    try {
        const ticket = new SupportTicket_1.SupportTicket(req.body);
        await ticket.save();
        return res.status(201).json({ success: true, ticket });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.createSupportTicket = createSupportTicket;
const getSupportTickets = async (req, res) => {
    try {
        const filters = {};
        if (req.query.userId)
            filters.userId = req.query.userId;
        if (req.query.status)
            filters.status = req.query.status;
        const tickets = await SupportTicket_1.SupportTicket.find(filters).populate("userId", "name email");
        return res.status(200).json({ success: true, tickets });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.getSupportTickets = getSupportTickets;
const replySupportTicket = async (req, res) => {
    try {
        const ticket = await SupportTicket_1.SupportTicket.findById(req.params.id);
        if (!ticket)
            return res.status(404).json({ success: false, message: "Ticket not found" });
        ticket.replies.push({
            senderId: req.body.senderId,
            message: req.body.message,
            timestamp: new Date()
        });
        if (req.body.status) {
            ticket.status = req.body.status;
        }
        await ticket.save();
        return res.status(200).json({ success: true, ticket });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.replySupportTicket = replySupportTicket;
// --- TrainingVideo ---
const createTrainingVideo = async (req, res) => {
    try {
        const trainingVideo = new TrainingVideo_1.TrainingVideo(req.body);
        await trainingVideo.save();
        return res.status(201).json({ success: true, trainingVideo });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.createTrainingVideo = createTrainingVideo;
const getTrainingVideos = async (req, res) => {
    try {
        const filters = {};
        if (req.query.roleType)
            filters.roleType = req.query.roleType;
        const trainingVideos = await TrainingVideo_1.TrainingVideo.find(filters);
        return res.status(200).json({ success: true, trainingVideos });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.getTrainingVideos = getTrainingVideos;
