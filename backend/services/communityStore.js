import admin from 'firebase-admin';
import { getFirestoreClient } from './firebaseAdmin.js';
import { analyzeSentiment } from './sentimentAnalysis.js';

const POSTS_COLLECTION = 'communityPosts';
const COMMENTS_SUBCOLLECTION = 'comments';
const MAX_BATCH_SIZE = 50;

const ensureFirestore = () => {
  const firestore = getFirestoreClient();
  if (!firestore) {
    throw new Error('Firestore is not configured');
  }
  return firestore;
};

const normalizeTags = (tags = []) => {
  if (typeof tags === 'string') {
    return tags
      .split(',')
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean);
  }

  if (Array.isArray(tags)) {
    return tags
      .map((tag) => (typeof tag === 'string' ? tag.trim().toLowerCase() : ''))
      .filter(Boolean);
  }

  return [];
};

const resolveVoteArrays = (data) => {
  const upvotes = Array.isArray(data.upvoteUserIds)
    ? data.upvoteUserIds
    : Array.isArray(data.likeUserIds)
      ? data.likeUserIds
      : [];
  const downvotes = Array.isArray(data.downvoteUserIds) ? data.downvoteUserIds : [];
  return { upvotes, downvotes };
};

const buildPostResponse = (doc, viewerId = null) => {
  const data = doc.data();
  if (!data) return null;

  const { upvotes, downvotes } = resolveVoteArrays(data);
  const userVote = viewerId
    ? upvotes.includes(viewerId)
      ? 'up'
      : downvotes.includes(viewerId)
        ? 'down'
        : null
    : null;

  return {
    id: doc.id,
    title: data.title,
    content: data.content,
    source: data.source || null,
    destination: data.destination || null,
    tags: normalizeTags(data.tags),
    media: data.media || [],
    rating: typeof data.rating === 'number' ? data.rating : null,
    authorId: data.authorId,
    authorName: data.authorName || 'Traveler',
    authorAvatar: data.authorAvatar || null,
    upvoteCount: upvotes.length,
    downvoteCount: downvotes.length,
    userVote,
    commentCount: data.commentCount || 0,
    publishToCommunity: data.publishToCommunity !== false,
    sentiment: data.sentiment || null,
    sentimentConfidence: data.sentimentConfidence || null,
    createdAt: data.createdAt?.toDate?.().toISOString?.() || data.createdAt || null,
    updatedAt: data.updatedAt?.toDate?.().toISOString?.() || data.updatedAt || null,
  };
};

const buildCommentResponse = (doc, viewerId = null) => {
  const data = doc.data();
  if (!data) return null;

  const { upvotes, downvotes } = resolveVoteArrays(data);
  const userVote = viewerId
    ? upvotes.includes(viewerId)
      ? 'up'
      : downvotes.includes(viewerId)
        ? 'down'
        : null
    : null;

  return {
    id: doc.id,
    postId: data.postId,
    parentId: data.parentId || null,
    path: data.path || [],
    content: data.content,
    authorId: data.authorId,
    authorName: data.authorName || 'Traveler',
    authorAvatar: data.authorAvatar || null,
    upvoteCount: upvotes.length,
    downvoteCount: downvotes.length,
    userVote,
    sentiment: data.sentiment || null,
    sentimentConfidence: data.sentimentConfidence || null,
    createdAt: data.createdAt?.toDate?.().toISOString?.() || data.createdAt || null,
    updatedAt: data.updatedAt?.toDate?.().toISOString?.() || data.updatedAt || null,
  };
};

export const createCommunityPost = async ({
  uid,
  authorName,
  authorAvatar,
  title,
  source,
  content,
  destination,
  tags,
  rating,
  publishToCommunity,
}) => {
  const firestore = ensureFirestore();

  if (!title || !content) {
    throw new Error('Title and content are required');
  }

  const timestamp = admin.firestore.Timestamp.now();
  const tagsArray = normalizeTags(tags);
  const numericRating = Number.isFinite(Number(rating)) ? Number(rating) : null;

  // Analyze sentiment of the post content
  const sentimentAnalysis = await analyzeSentiment(content.trim());

  const postPayload = {
    authorId: uid,
    authorName: authorName || 'Traveler',
    authorAvatar: authorAvatar || null,
    title: title.trim(),
    content: content.trim(),
    source: source?.trim?.() || null,
    destination: destination?.trim?.() || null,
    tags: tagsArray,
    rating: numericRating,
    upvoteUserIds: [],
    downvoteUserIds: [],
    commentCount: 0,
    publishToCommunity: publishToCommunity !== false,
    sentiment: sentimentAnalysis.sentiment,
    sentimentConfidence: sentimentAnalysis.confidence,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const docRef = await firestore.collection(POSTS_COLLECTION).add(postPayload);
  const postDoc = await docRef.get();
  return buildPostResponse(postDoc, uid);
};

export const listCommunityPosts = async ({ destination, source, tag, search, sentiment, limit = 10, after }, viewerId = null) => {
  const firestore = ensureFirestore();
  let query = firestore.collection(POSTS_COLLECTION).orderBy('createdAt', 'desc');

  const normalizedDestination = typeof destination === 'string' ? destination.trim() : '';
  const normalizedSource = typeof source === 'string' ? source.trim() : '';
  const normalizedTag = typeof tag === 'string' ? tag.trim().toLowerCase() : '';
  const normalizedSearch = typeof search === 'string' ? search.trim().toLowerCase() : '';
  const normalizedSentiment = typeof sentiment === 'string' ? sentiment.trim().toLowerCase() : '';

  // Destination filtering is applied client-side to avoid requiring composite indexes

  // Filter by sentiment if specified (temporarily disabled until index is created)
  // if (normalizedSentiment && ['positive', 'negative', 'neutral'].includes(normalizedSentiment)) {
  //   query = query.where('sentiment', '==', normalizedSentiment);
  // }

  if (after) {
    const afterDoc = await firestore.collection(POSTS_COLLECTION).doc(after).get();
    if (afterDoc.exists) {
      query = query.startAfter(afterDoc);
    }
  }

  const fetchLimit = normalizedTag || normalizedSearch || normalizedSentiment || normalizedSource || normalizedDestination
    ? Math.min(100, Math.max(limit * 3, 30))
    : limit;
  const snapshot = await query.limit(fetchLimit).get();

  let posts = snapshot.docs
    .map((doc) => buildPostResponse(doc, viewerId))
    .filter((post) => post && post.publishToCommunity !== false);

  if (normalizedSource) {
    posts = posts.filter(
      (post) => (post.source || '').trim().toLowerCase() === normalizedSource.toLowerCase()
    );
  }

  if (normalizedTag) {
    posts = posts.filter((post) =>
      Array.isArray(post.tags) && post.tags.some((tagValue) => tagValue === normalizedTag)
    );
  }

  if (normalizedSearch) {
    posts = posts.filter((post) => {
      const haystack = `${post.title || ''} ${post.content || ''}`.toLowerCase();
      const matchesText = haystack.includes(normalizedSearch);
      const matchesTags = Array.isArray(post.tags)
        ? post.tags.some((tagValue) => tagValue.includes(normalizedSearch))
        : false;
      return matchesText || matchesTags;
    });
  }

  if (normalizedDestination) {
    posts = posts.filter(
      (post) => (post.destination || '').trim().toLowerCase() === normalizedDestination.toLowerCase()
    );
  }

  // Client-side sentiment filtering (until Firestore index is created)
  if (normalizedSentiment && ['positive', 'negative', 'neutral'].includes(normalizedSentiment)) {
    posts = posts.filter((post) => post.sentiment === normalizedSentiment);
  }

  return posts.slice(0, limit);
};

export const getCommunityPost = async (postId, viewerId = null) => {
  const firestore = ensureFirestore();
  const docRef = firestore.collection(POSTS_COLLECTION).doc(postId);
  const doc = await docRef.get();
  if (!doc.exists) {
    return null;
  }

  return buildPostResponse(doc, viewerId);
};

const buildCommentTree = (comments) => {
  const map = new Map();
  const roots = [];

  comments.forEach((comment) => {
    map.set(comment.id, { ...comment, replies: [] });
  });

  comments.forEach((comment) => {
    const node = map.get(comment.id);
    if (comment.parentId) {
      const parent = map.get(comment.parentId);
      if (parent) {
        parent.replies.push(node);
      } else {
        roots.push(node);
      }
    } else {
      roots.push(node);
    }
  });

  return roots.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
};

export const getCommunityPostWithComments = async (postId, { limit = 200 } = {}, viewerId = null) => {
  const firestore = ensureFirestore();
  const postDoc = await firestore.collection(POSTS_COLLECTION).doc(postId).get();
  if (!postDoc.exists) {
    return null;
  }

  const commentsSnapshot = await firestore
    .collection(POSTS_COLLECTION)
    .doc(postId)
    .collection(COMMENTS_SUBCOLLECTION)
    .orderBy('createdAt', 'asc')
    .limit(limit)
    .get();

  const comments = commentsSnapshot.docs.map((doc) => buildCommentResponse(doc, viewerId)).filter(Boolean);

  return {
    post: buildPostResponse(postDoc, viewerId),
    comments: buildCommentTree(comments),
  };
};

export const addCommentToPost = async ({
  postId,
  uid,
  authorName,
  authorAvatar,
  content,
  parentId,
}) => {
  const firestore = ensureFirestore();

  if (!content) {
    throw new Error('Comment content is required');
  }

  const postRef = firestore.collection(POSTS_COLLECTION).doc(postId);
  const postDoc = await postRef.get();
  if (!postDoc.exists) {
    throw new Error('Post not found');
  }

  const commentsRef = postRef.collection(COMMENTS_SUBCOLLECTION);

  let path = [];
  if (parentId) {
    const parentDoc = await commentsRef.doc(parentId).get();
    if (!parentDoc.exists) {
      throw new Error('Parent comment not found');
    }
    const parentData = parentDoc.data();
    path = [...(parentData?.path || []), parentId];
  }

  // Analyze sentiment of the comment content
  const sentimentAnalysis = await analyzeSentiment(content.trim());

  const timestamp = admin.firestore.Timestamp.now();
  const commentPayload = {
    postId,
    parentId: parentId || null,
    path,
    content: content.trim(),
    authorId: uid,
    authorName: authorName || 'Traveler',
    authorAvatar: authorAvatar || null,
    upvoteUserIds: [],
    downvoteUserIds: [],
    sentiment: sentimentAnalysis.sentiment,
    sentimentConfidence: sentimentAnalysis.confidence,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const commentRef = await commentsRef.add(commentPayload);
  await commentRef.update({ id: commentRef.id });

  await postRef.update({ commentCount: admin.firestore.FieldValue.increment(1) });

  const savedComment = await commentRef.get();
  return buildCommentResponse(savedComment, uid);
};

const voteArraysForUpdate = (currentUpvotes = [], currentDownvotes = [], uid, direction) => {
  const upSet = new Set(currentUpvotes);
  const downSet = new Set(currentDownvotes);

  upSet.delete(uid);
  downSet.delete(uid);

  if (direction === 'up') {
    upSet.add(uid);
  } else if (direction === 'down') {
    downSet.add(uid);
  }

  return {
    upvoteUserIds: Array.from(upSet),
    downvoteUserIds: Array.from(downSet),
  };
};

export const setPostVote = async ({ postId, uid, direction }) => {
  const firestore = ensureFirestore();
  const postRef = firestore.collection(POSTS_COLLECTION).doc(postId);
  const postDoc = await postRef.get();
  if (!postDoc.exists) {
    throw new Error('Post not found');
  }

  const data = postDoc.data();
  const normalizedDirection = direction === 'up' || direction === 'down' ? direction : null;
  const { upvoteUserIds, downvoteUserIds } = voteArraysForUpdate(
    data.upvoteUserIds,
    data.downvoteUserIds,
    uid,
    normalizedDirection,
  );

  await postRef.update({
    upvoteUserIds,
    downvoteUserIds,
    updatedAt: admin.firestore.Timestamp.now(),
  });

  const updatedDoc = await postRef.get();
  return buildPostResponse(updatedDoc, uid);
};

export const setCommentVote = async ({ commentId, uid, direction }) => {
  const firestore = ensureFirestore();

  const commentQuery = await firestore
    .collectionGroup(COMMENTS_SUBCOLLECTION)
    .where('id', '==', commentId)
    .limit(1)
    .get();

  if (commentQuery.empty) {
    throw new Error('Comment not found');
  }

  const commentDoc = commentQuery.docs[0];
  const commentRef = commentDoc.ref;
  const data = commentDoc.data();
  const normalizedDirection = direction === 'up' || direction === 'down' ? direction : null;
  const { upvoteUserIds, downvoteUserIds } = voteArraysForUpdate(
    data.upvoteUserIds,
    data.downvoteUserIds,
    uid,
    normalizedDirection,
  );

  await commentRef.update({
    upvoteUserIds,
    downvoteUserIds,
    updatedAt: admin.firestore.Timestamp.now(),
  });

  const updatedDoc = await commentRef.get();
  return buildCommentResponse(updatedDoc, uid);
};
