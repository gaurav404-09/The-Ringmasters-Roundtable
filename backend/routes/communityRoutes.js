import express from 'express';
import verifyFirebaseToken from '../middleware/verifyFirebaseToken.js';
import {
  createCommunityPost,
  listCommunityPosts,
  getCommunityPost,
  getCommunityPostWithComments,
  addCommentToPost,
  setPostVote,
  setCommentVote,
} from '../services/communityStore.js';

const router = express.Router();

const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return next();
  }

  try {
    await verifyFirebaseToken(req, res, next);
  } catch (error) {
    console.error('[communityRoutes] optional auth failed', error);
    next();
  }
};

router.get('/posts', optionalAuth, async (req, res) => {
  try {
    const { destination, tag, search, limit, after } = req.query;
    const parsedLimit = limit ? Math.min(parseInt(limit, 10) || 10, 25) : 10;

    const posts = await listCommunityPosts({
      destination,
      tag,
      search,
      limit: parsedLimit,
      after,
    }, req.user?.uid ?? null);

    res.json({ success: true, posts });
  } catch (error) {
    console.error('[GET /api/community/posts] error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch posts' });
  }
});

router.get('/posts/:postId', optionalAuth, async (req, res) => {
  try {
    const { postId } = req.params;
    const { includeComments } = req.query;

    if (!postId) {
      return res.status(400).json({ success: false, error: 'Post id is required' });
    }

    if (includeComments === 'true') {
      const result = await getCommunityPostWithComments(postId, {}, req.user?.uid ?? null);
      if (!result) {
        return res.status(404).json({ success: false, error: 'Post not found' });
      }
      return res.json({ success: true, ...result });
    }

    const post = await getCommunityPost(postId, req.user?.uid ?? null);
    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    return res.json({ success: true, post });
  } catch (error) {
    console.error('[GET /api/community/posts/:postId] error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch post' });
  }
});

router.post('/posts', verifyFirebaseToken, async (req, res) => {
  try {
    const { title, content, source, destination, tags, rating, publishToCommunity } = req.body;
    const parsedTags = (() => {
      if (!tags) return [];
      if (Array.isArray(tags)) return tags;
      try {
        const possibleJson = JSON.parse(tags);
        if (Array.isArray(possibleJson)) {
          return possibleJson;
        }
      } catch (error) {
        // ignore json parse errors, treat as comma-separated string
      }
      return tags;
    })();

    const post = await createCommunityPost({
      uid: req.user.uid,
      authorName: req.user.name,
      authorAvatar: req.user.picture,
      title,
      source,
      content,
      destination,
      tags: parsedTags,
      rating,
      publishToCommunity,
    });

    res.status(201).json({ success: true, post });
  } catch (error) {
    console.error('[POST /api/community/posts] error:', error);
    const status = error.message?.includes('required') ? 400 : 500;
    res.status(status).json({ success: false, error: error.message || 'Failed to create post' });
  }
});

router.post('/posts/:postId/comments', verifyFirebaseToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const { content, parentId } = req.body || {};
    if (!postId) {
      return res.status(400).json({ success: false, error: 'Post id is required' });
    }

    const comment = await addCommentToPost({
      postId,
      uid: req.user.uid,
      authorName: req.user.name,
      authorAvatar: req.user.picture,
      content,
      parentId,
    });

    res.status(201).json({ success: true, comment });
  } catch (error) {
    console.error('[POST /api/community/posts/:postId/comments] error:', error);
    const status = error.message?.includes('required') ? 400 : 500;
    res.status(status).json({ success: false, error: error.message || 'Failed to add comment' });
  }
});

router.patch('/posts/:postId/vote', verifyFirebaseToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const { direction } = req.body || {};

    if (!postId) {
      return res.status(400).json({ success: false, error: 'Post id is required' });
    }

    if (!['up', 'down', null].includes(direction)) {
      return res.status(400).json({ success: false, error: 'Invalid vote direction' });
    }

    const post = await setPostVote({ postId, uid: req.user.uid, direction });
    res.json({ success: true, post });
  } catch (error) {
    console.error('[PATCH /api/community/posts/:postId/like] error:', error);
    const status = error.message === 'Post not found' ? 404 : 500;
    res.status(status).json({ success: false, error: error.message || 'Failed to update vote' });
  }
});

router.patch('/comments/:commentId/vote', verifyFirebaseToken, async (req, res) => {
  try {
    const { commentId } = req.params;
    const { direction } = req.body || {};

    if (!commentId) {
      return res.status(400).json({ success: false, error: 'Comment id is required' });
    }

    if (!['up', 'down', null].includes(direction)) {
      return res.status(400).json({ success: false, error: 'Invalid vote direction' });
    }

    const comment = await setCommentVote({ commentId, uid: req.user.uid, direction });
    res.json({ success: true, comment });
  } catch (error) {
    console.error('[PATCH /api/community/comments/:commentId/like] error:', error);
    const status = error.message === 'Comment not found' ? 404 : 500;
    res.status(status).json({ success: false, error: error.message || 'Failed to update vote' });
  }
});

export default router;
