import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { CommunityPost } from '../models/CommunityPost';
import { CommunityComment } from '../models/CommunityComment';
import { CommunityPostReport } from '../models/CommunityPostReport';
import { User } from '../models/User';

// Helper to check user
const getReqUserId = (req: Request): string | null => {
  return (req as any).user?.id || (req as any).user?._id || null;
};

// 1. GET /community/posts
export const getCommunityPosts = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    let posts = await CommunityPost.find({ status: { $ne: 'deleted' } })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    // Seed default announcements / welcome posts if the collection is empty
    if (posts.length === 0 && page === 1) {
      const defaultPosts = [
        {
          authorId: new mongoose.Types.ObjectId(),
          authorType: 'System' as const,
          authorName: 'ApexBee System',
          authorAvatar: '🐝',
          content: 'Bzzzt! 🐝 Welcome to the ApexBee Community. Get up to 50% off on all items from top vendors in दिल्ली. Sale starts tomorrow at 12 PM!',
          postType: 'announcement' as const,
          likes: [],
          reportedCount: 0,
          status: 'approved' as const
        },
        {
          authorId: new mongoose.Types.ObjectId(),
          authorType: 'System' as const,
          authorName: 'ApexBee Academy',
          authorAvatar: '🎓',
          content: 'Course published: Advanced Digital Marketing for Local Stores. Learn MLM leadership and grow your income network. Enroll now!',
          postType: 'course' as const,
          likes: [],
          reportedCount: 0,
          status: 'approved' as const
        }
      ];

      posts = await CommunityPost.create(defaultPosts);
    }

    const total = await CommunityPost.countDocuments({ status: { $ne: 'deleted' } });

    return res.status(200).json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      posts
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 2. POST /community/posts
export const createCommunityPost = async (req: Request, res: Response) => {
  try {
    const userId = getReqUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { content, mediaUrl, postType } = req.body;
    if (!content) {
      return res.status(400).json({ success: false, message: 'Post content is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const newPost = new CommunityPost({
      authorId: user._id,
      authorType: 'User',
      authorName: user.name,
      authorAvatar: user.profileImage || user.name.slice(0, 2).toUpperCase(),
      content,
      mediaUrl: mediaUrl || '',
      postType: postType || 'general',
      likes: [],
      reportedCount: 0,
      status: 'approved'
    });

    await newPost.save();

    return res.status(201).json({
      success: true,
      message: 'Post published successfully',
      post: newPost
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 3. POST /community/posts/:id/like
export const toggleLikeCommunityPost = async (req: Request, res: Response) => {
  try {
    const userId = getReqUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { id } = req.params;
    const post = await CommunityPost.findById(id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const userOid = new mongoose.Types.ObjectId(userId);
    const likeIndex = post.likes.findIndex((uid) => uid.toString() === userId);

    if (likeIndex > -1) {
      // Unlike
      post.likes.splice(likeIndex, 1);
    } else {
      // Like
      post.likes.push(userOid);
    }

    await post.save();

    return res.status(200).json({
      success: true,
      likesCount: post.likes.length,
      liked: likeIndex === -1,
      post
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 4. POST /community/posts/:id/report
export const reportCommunityPost = async (req: Request, res: Response) => {
  try {
    const userId = getReqUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { id } = req.params;
    const { reason, details } = req.body;

    if (!reason) {
      return res.status(400).json({ success: false, message: 'Report reason is required' });
    }

    const post = await CommunityPost.findById(id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    // Register report
    const newReport = new CommunityPostReport({
      postId: post._id,
      reporterId: new mongoose.Types.ObjectId(userId),
      reason,
      details: details || ''
    });

    await newReport.save();

    // Increment reportedCount
    post.reportedCount += 1;
    if (post.reportedCount >= 5) {
      post.status = 'reported'; // Flag for admin audit
    }
    await post.save();

    return res.status(200).json({
      success: true,
      message: 'Post successfully reported for review'
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 5. GET /community/posts/:id/comments
export const getCommunityComments = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const comments = await CommunityComment.find({ postId: id }).sort({ createdAt: 1 });
    return res.status(200).json({
      success: true,
      comments
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 6. POST /community/posts/:id/comments
export const createCommunityComment = async (req: Request, res: Response) => {
  try {
    const userId = getReqUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { id } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ success: false, message: 'Comment content is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const newComment = new CommunityComment({
      postId: new mongoose.Types.ObjectId(id),
      authorId: user._id,
      authorName: user.name,
      authorAvatar: user.profileImage || user.name.slice(0, 2).toUpperCase(),
      content
    });

    await newComment.save();

    return res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      comment: newComment
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
