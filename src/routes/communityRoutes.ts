import { Router } from 'express';
import { protect } from '../middleware/auth';
import {
  getCommunityPosts,
  createCommunityPost,
  toggleLikeCommunityPost,
  reportCommunityPost,
  getCommunityComments,
  createCommunityComment
} from '../controllers/communityController';

const router = Router();

// Public Feed and Comments List
router.get('/posts', getCommunityPosts);
router.get('/posts/:id/comments', getCommunityComments);

// Authenticated user updates
router.post('/posts', protect, createCommunityPost);
router.post('/posts/:id/like', protect, toggleLikeCommunityPost);
router.post('/posts/:id/report', protect, reportCommunityPost);
router.post('/posts/:id/comments', protect, createCommunityComment);

export default router;
