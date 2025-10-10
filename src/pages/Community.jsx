import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { FaCompass, FaFilter, FaMoon, FaSearch, FaSun, FaSmile, FaFrown, FaMeh } from 'react-icons/fa';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import CommunityPostCard from '../components/CommunityPostCard';
import PostComposer from '../components/PostComposer';
import CommentThread from '../components/CommentThread';
import SentimentStats from '../components/SentimentStats';
import ENV from '../config/env';

const emptyState = {
  posts: [],
  loading: false,
  error: null,
};

const fetchPosts = async (filters) => {
  const params = new URLSearchParams();
  if (filters.destination) params.set('destination', filters.destination);
  if (filters.tag) params.set('tag', filters.tag);
  if (filters.search) params.set('search', filters.search);
  if (filters.sentiment) params.set('sentiment', filters.sentiment);
  params.set('limit', String(filters.limit || 10));

  const response = await api.get(`/community/posts?${params.toString()}`);
  return response.data?.posts || [];
};

const fetchPostDetails = async (postId) => {
  const response = await api.get(`/community/posts/${postId}`, {
    params: { includeComments: true },
  });
  return response.data;
};

const setPostVote = async (postId, direction) => {
  const response = await api.patch(`/community/posts/${postId}/vote`, { direction });
  return response.data?.post;
};

const setCommentVote = async (commentId, direction) => {
  const response = await api.patch(`/community/comments/${commentId}/vote`, { direction });
  return response.data?.comment;
};

const postComment = async (postId, content, parentId) => {
  const response = await api.post(`/community/posts/${postId}/comments`, {
    content,
    parentId,
  });
  return response.data?.comment;
};

const createPost = async (payload) => {
  const ratingValue = Number(payload.rating);
  const normalizedRating = Number.isFinite(ratingValue) && ratingValue > 0 ? ratingValue : null;

  const response = await api.post('/community/posts', {
    title: payload.title,
    content: payload.content,
    source: payload.source,
    destination: payload.destination,
    tags: payload.tags,
    rating: normalizedRating,
    publishToCommunity: payload.publishToCommunity,
  });

  return response.data?.post;
};

const Community = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ destination: '', tag: '', search: '', sentiment: '', limit: 12 });
  const [state, setState] = useState(emptyState);
  const [showComposer, setShowComposer] = useState(false);
  const [composerPrefill, setComposerPrefill] = useState({ source: '', destination: '' });
  const [activePost, setActivePost] = useState(null);
  const [activePostDetails, setActivePostDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [postingComment, setPostingComment] = useState(false);
  const commentInputRef = useRef(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('community-theme') === 'dark';
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    localStorage.setItem('community-theme', isDarkMode ? 'dark' : 'light');

    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const openComposerParam = params.get('openComposer');
    const sourceParam = params.get('source') || '';
    const destinationParam = params.get('destination') || '';

    if (openComposerParam === '1') {
      setComposerPrefill({ source: sourceParam, destination: destinationParam });
      setShowComposer(true);
    }

    if (openComposerParam || sourceParam || destinationParam) {
      params.delete('openComposer');
      params.delete('source');
      params.delete('destination');
      const nextSearch = params.toString();
      navigate({ pathname: location.pathname, search: nextSearch ? `?${nextSearch}` : '' }, { replace: true });
    }
  }, [location.pathname, location.search, navigate]);

  const loadPosts = async () => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      const posts = await fetchPosts(filters);
      setState({ posts, loading: false, error: null });
    } catch (error) {
      console.error('Failed to fetch posts', error);
      setState({ posts: [], loading: false, error: error.message || 'Failed to fetch posts' });
      toast.error('Unable to load community posts.');
    }
  };

  useEffect(() => {
    loadPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.destination, filters.tag, filters.search, filters.sentiment]);

  const openPost = async (post) => {
    try {
      setActivePost(post);
      setLoadingDetails(true);
      const data = await fetchPostDetails(post.id);
      setActivePostDetails(data);
    } catch (error) {
      console.error('Failed to fetch post details', error);
      toast.error('Unable to fetch post details.');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleVotePost = async (postId, direction) => {
    try {
      const updated = await setPostVote(postId, direction);
      setState((prev) => ({
        ...prev,
        posts: prev.posts.map((post) => (post.id === updated.id ? updated : post)),
      }));

      setActivePost((prev) => (prev?.id === updated.id ? { ...prev, ...updated } : prev));

      if (activePostDetails?.post?.id === postId) {
        setActivePostDetails((prev) => ({ ...prev, post: updated }));
      }
    } catch (error) {
      console.error('Failed to update post vote', error);
      toast.error('Could not update vote.');
    }
  };

  const handleVoteComment = async (commentId, direction) => {
    if (!activePostDetails) return;

    try {
      const updatedComment = await setCommentVote(commentId, direction);
      setActivePostDetails((prev) => {
        if (!prev) return prev;

        const updateComment = (comments) =>
          comments.map((comment) => {
            if (comment.id === updatedComment.id) {
              return { ...comment, ...updatedComment };
            }

            if (comment.replies?.length) {
              return {
                ...comment,
                replies: updateComment(comment.replies),
              };
            }

            return comment;
          });

        return {
          ...prev,
          comments: updateComment(prev.comments || []),
        };
      });
    } catch (error) {
      console.error('Failed to update comment vote', error);
      toast.error('Could not update comment vote.');
    }
  };

  const handleCommentSubmit = async (parentId, content) => {
    if (!activePost?.id) return false;
    const targetPostId = activePost.id;
    try {
      const comment = await postComment(activePost.id, content, parentId);
      setActivePostDetails((prev) => {
        if (!prev) return prev;

        const injectComment = (comments) => {
          if (!parentId) return [comment, ...comments];

          return comments.map((item) => {
            if (item.id === parentId) {
              const replies = item.replies ? [comment, ...item.replies] : [comment];
              return { ...item, replies };
            }

            if (item.replies?.length) {
              return {
                ...item,
                replies: injectComment(item.replies),
              };
            }

            return item;
          });
        };

        return {
          ...prev,
          comments: injectComment(prev.comments || []),
          post: {
            ...prev.post,
            commentCount: (prev.post.commentCount || 0) + 1,
          },
        };
      });

      setState((prev) => ({
        ...prev,
        posts: prev.posts.map((post) =>
          post.id === targetPostId
            ? { ...post, commentCount: (post.commentCount || 0) + 1 }
            : post
        ),
      }));

      setActivePost((prev) =>
        prev?.id === targetPostId
          ? { ...prev, commentCount: (prev.commentCount || 0) + 1 }
          : prev
      );

      toast.success('Comment posted');
      return true;
    } catch (error) {
      console.error('Failed to post comment', error);
      toast.error('Could not post your comment.');
      return false;
    }
  };

  const submitRootComment = async () => {
    const textarea = commentInputRef.current;
    if (!textarea) return;

    const value = textarea.value.trim();
    if (!value) return;

    if (!user) {
      toast.error('Sign in to join the discussion!');
      return;
    }

    if (postingComment) return;

    setPostingComment(true);
    try {
      const success = await handleCommentSubmit(null, value);
      if (success) {
        textarea.value = '';
      }
    } finally {
      setPostingComment(false);
    }
  };

  const handleCreatePost = async (payload) => {
    if (!user) {
      toast.error('Please sign in to share a story.');
      return false;
    }

    setSubmitting(true);
    try {
      const post = await createPost(payload);
      setState((prev) => ({
        ...prev,
        posts: [post, ...prev.posts],
      }));
      toast.success('Your story is now live!');
      return true;
    } catch (error) {
      console.error('Failed to create post', error);
      toast.error(error.response?.data?.error || 'Could not publish your story.');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const filteredTags = useMemo(() => {
    const tagSet = new Set();
    state.posts.forEach((post) => (post.tags || []).forEach((tag) => tagSet.add(tag)));
    return Array.from(tagSet).slice(0, 12);
  }, [state.posts]);

  return (
    <div className={isDarkMode ? 'dark' : ''}>
      <div className="relative min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 py-16 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-br from-cyan-200/40 via-blue-100/30 to-indigo-200/30 dark:from-slate-900/40 dark:via-slate-800/30 dark:to-slate-900/40" />

        <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-14 px-4 sm:px-6 lg:px-10">
          <header className="space-y-6 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-3 rounded-full border border-white/40 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 shadow-[0_18px_42px_rgba(56,189,248,0.25)] dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-slate-200"
            >
              <FaCompass className="text-cyan-500" /> Wanderer's Roundtable
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl"
            >
              Discover real stories from travelers like you
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="mx-auto max-w-2xl text-sm leading-relaxed text-slate-500 dark:text-slate-300"
            >
              Explore tips, itineraries, and unforgettable moments shared by our community.
              Filter by destination, uncover hidden gems, and contribute your own adventures.
            </motion.p>

            <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 rounded-3xl border border-white/30 bg-white/80 p-4 shadow-[0_24px_70px_rgba(15,23,42,0.25)] backdrop-blur-xl sm:flex-row sm:items-center dark:border-white/10 dark:bg-slate-900/70 dark:shadow-[0_24px_70px_rgba(2,6,23,0.6)]">
              <div className="flex flex-1 items-center gap-2 rounded-2xl bg-white px-4 py-2 shadow-inner dark:bg-slate-900/80">
                <FaSearch className="text-slate-400 dark:text-slate-500" />
                <input
                  value={filters.search}
                  onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
                  placeholder="Search stories by keywords"
                  className="w-full bg-transparent text-sm font-semibold text-slate-600 outline-none dark:text-slate-200"
                />
              </div>

              <div className="flex flex-1 items-center gap-2">
                <div className="flex-1 rounded-2xl bg-white px-4 py-2 shadow-inner dark:bg-slate-900/80 dark:text-slate-200">
                  <input
                    value={filters.destination}
                    onChange={(event) => setFilters((prev) => ({ ...prev, destination: event.target.value }))}
                    placeholder="Destination filter (e.g. Goa)"
                    className="w-full bg-transparent text-sm font-semibold text-slate-600 outline-none dark:text-slate-200"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setIsDarkMode((prev) => !prev)}
                  aria-pressed={isDarkMode}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 shadow-sm transition hover:border-cyan-400 hover:text-cyan-500 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:border-cyan-500 dark:hover:text-cyan-400"
                >
                  {isDarkMode ? <FaSun className="text-sm text-amber-400" /> : <FaMoon className="text-sm text-cyan-500" />}
                  {isDarkMode ? 'Light' : 'Dark'}
                </button>

              </div>
            </div>

            {/* Sentiment Filter Buttons */}
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              {[
                { key: '', label: 'All Posts', icon: FaFilter },
                { key: 'positive', label: 'Positive', icon: FaSmile },
                { key: 'negative', label: 'Negative', icon: FaFrown },
                { key: 'neutral', label: 'Neutral', icon: FaMeh }
              ].map(({ key, label, icon: Icon }) => {
                const active = filters.sentiment === key;
                return (
                  <button
                    key={key}
                    onClick={() =>
                      setFilters((prev) => ({ ...prev, sentiment: key, search: '' }))
                    }
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] transition ${
                      active
                        ? 'border-cyan-500 bg-cyan-500/10 text-cyan-600 shadow-[0_16px_38px_rgba(56,189,248,0.28)]'
                        : 'border-slate-200 bg-white text-slate-500 hover:border-cyan-400 hover:text-cyan-500 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300'
                    }`}
                  >
                    <Icon className="text-[0.65rem]" /> {label}
                  </button>
                );
              })}
            </div>

            {filteredTags.length > 0 && (
              <div className="flex flex-wrap justify-center gap-3 pt-2">
                {filteredTags.map((tag) => {
                  const active = filters.tag === tag;
                  return (
                    <button
                      key={tag}
                      onClick={() =>
                        setFilters((prev) => ({ ...prev, tag: active ? '' : tag, search: '' }))
                      }
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] transition ${
                        active
                          ? 'border-cyan-500 bg-cyan-500/10 text-cyan-600 shadow-[0_16px_38px_rgba(56,189,248,0.28)]'
                          : 'border-slate-200 bg-white text-slate-500 hover:border-cyan-400 hover:text-cyan-500 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300'
                      }`}
                    >
                      <FaFilter className="text-[0.65rem]" /> #{tag}
                    </button>
                  );
                })}
              </div>
            )}
          </header>

          <div className="grid grid-cols-1 gap-12 lg:grid-cols-4">
            {/* Sentiment Stats Sidebar */}
            <div className="relative z-20 lg:col-span-1 lg:pr-6">
              <SentimentStats 
                destination={filters.destination} 
                tag={filters.tag}
              />
            </div>

            {/* Posts Grid */}
            <section className="relative z-10 grid grid-cols-1 gap-10 md:grid-cols-2 lg:col-span-3 lg:grid-cols-2 lg:pl-8">
              {state.loading && (
                <div className="col-span-full flex justify-center">
                  <div className="h-12 w-12 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
                </div>
              )}

              {!state.loading && state.posts.length === 0 && (
                <div className="col-span-full rounded-3xl border border-dashed border-cyan-200 bg-white/70 px-10 py-12 text-center text-sm font-semibold text-slate-400 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
                  No stories yet. Be the first voyager to share your experience!
                </div>
              )}

              {state.posts.map((post) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <CommunityPostCard
                    post={post}
                    userVote={post.userVote || null}
                    onOpen={() => openPost(post)}
                    onVote={(direction) => {
                      if (!user) {
                        toast.error('Sign in to rate this story!');
                        return;
                      }
                      handleVotePost(post.id, direction);
                    }}
                  />
                </motion.div>
              ))}
            </section>
          </div>
        </div>

        {activePost && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 backdrop-blur-xl">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ duration: 0.3 }}
              className="relative h-[85vh] w-full max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-white/95 shadow-[0_40px_120px_rgba(15,23,42,0.55)] dark:border-white/10 dark:bg-slate-900/95 dark:shadow-[0_40px_120px_rgba(2,6,23,0.6)]"
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500" />
              <div className="flex h-full flex-col">
                <div className="flex items-center justify-between border-b border-white/10 px-8 py-5 dark:border-slate-700/40">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400 dark:text-white/80">
                      {activePost.destination || 'Community Post'}
                    </p>
                    <h3 className="text-2xl font-semibold text-slate-900 dark:text-white">
                      {activePost.title}
                    </h3>
                  </div>
                  <button
                    onClick={() => {
                      setActivePost(null);
                      setActivePostDetails(null);
                    }}
                    className="rounded-full border border-white/20 bg-white/20 px-4 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-600 transition hover:bg-white/30 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-200"
                  >
                    Close
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-8 py-6">
                  {loadingDetails && (
                    <div className="flex justify-center py-8">
                      <div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
                    </div>
                  )}

                  {!loadingDetails && activePostDetails && (
                    <div className="space-y-8">
                      <article className="space-y-5">
                        <div className="flex items-center gap-4 text-xs uppercase tracking-[0.16em] text-slate-400 dark:text-slate-300">
                          <span>{activePostDetails.post.authorName || 'Traveler'}</span>
                          <span>·</span>
                          <span>
                            {new Date(activePostDetails.post.createdAt).toLocaleString()}
                          </span>
                        </div>

                        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-200">
                          {activePostDetails.post.content}
                        </p>

                        {typeof activePostDetails.post.rating === 'number' && (
                          <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/60 bg-amber-100/60 px-4 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-amber-600">
                            Community rating: {activePostDetails.post.rating.toFixed(1)} / 5
                          </div>
                        )}
                      </article>

                      <div className="rounded-3xl border border-white/10 bg-white/90 px-6 py-5 shadow-[0_20px_48px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-slate-900/80">
                        <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-200">
                          Comments ({activePostDetails.post.commentCount})
                        </h4>
                        <div className="mt-4">
                          <CommentThread
                            comments={activePostDetails.comments || []}
                            onVote={(commentId, direction) => {
                              if (!user) {
                                toast.error('Sign in to vote!');
                                return false;
                              }
                              handleVoteComment(commentId, direction);
                              return true;
                            }}
                            onReply={(parentId, value) => {
                              if (!user) {
                                toast.error('Sign in to join the discussion!');
                                return false;
                              }
                              return handleCommentSubmit(parentId, value);
                            }}
                          />
                        </div>
                      </div>
                      <div className="rounded-3xl border border-dashed border-slate-200 bg-white/80 px-6 py-5 dark:border-slate-700 dark:bg-slate-900/70">
                        <h5 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-200">
                          Share your thoughts
                        </h5>
                        <textarea
                          ref={commentInputRef}
                          rows={3}
                          placeholder="What did you love about this adventure?"
                          className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-cyan-400"
                          onKeyDown={async (event) => {
                            if (event.key === 'Enter' && event.metaKey) {
                              event.preventDefault();
                              await submitRootComment();
                            }
                          }}
                        />
                        <div className="mt-3 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
                          <span>Press ⌘+Enter to send.</span>
                          <button
                            type="button"
                            onClick={submitRootComment}
                            className="rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 px-4 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-white shadow-[0_16px_36px_rgba(56,189,248,0.35)] transition hover:scale-[1.02]"
                            disabled={postingComment}
                          >
                            {postingComment ? 'Submitting…' : 'Submit Comment'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}

        <PostComposer
          isOpen={showComposer}
          onClose={() => setShowComposer(false)}
          onSubmit={handleCreatePost}
          submitting={submitting}
          prefill={composerPrefill}
        />
      </div>
    </div>
  );
};

export default Community;
