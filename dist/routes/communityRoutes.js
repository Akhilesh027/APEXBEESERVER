"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const communityController_1 = require("../controllers/communityController");
const router = (0, express_1.Router)();
// Public Feed and Comments List
router.get('/posts', communityController_1.getCommunityPosts);
router.get('/posts/:id/comments', communityController_1.getCommunityComments);
// Authenticated user updates
router.post('/posts', auth_1.protect, communityController_1.createCommunityPost);
router.post('/posts/:id/like', auth_1.protect, communityController_1.toggleLikeCommunityPost);
router.post('/posts/:id/report', auth_1.protect, communityController_1.reportCommunityPost);
router.post('/posts/:id/comments', auth_1.protect, communityController_1.createCommunityComment);
exports.default = router;
