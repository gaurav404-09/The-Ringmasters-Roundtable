import { useState } from 'react';
import { FaArrowDown, FaArrowUp, FaReply } from 'react-icons/fa';

const CommentThread = ({
  comments = [],
  onReply,
  onVote,
}) => {
  const [activeReplyId, setActiveReplyId] = useState(null);
  const [replyValue, setReplyValue] = useState('');

  const submitReply = async (commentId) => {
    if (!replyValue.trim()) return;
    const success = await onReply(commentId, replyValue.trim());
    if (success) {
      setReplyValue('');
      setActiveReplyId(null);
    }
  };

  const renderComment = (comment, depth = 0) => {
    const userVote = comment.userVote || null;
    const createdAt = comment.createdAt ? new Date(comment.createdAt).toLocaleString() : '';

    return (
      <div key={comment.id} className="space-y-4" style={{ marginLeft: depth > 0 ? depth * 18 : 0 }}>
        <div className="rounded-3xl border border-white/10 bg-white/90 px-4 py-4 shadow-[0_18px_38px_rgba(15,23,42,0.25)] dark:bg-slate-900/80">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.16em] text-slate-400">
            <span className="flex items-center gap-2 text-slate-500">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 via-blue-500 to-indigo-500 text-[0.7rem] font-semibold text-white shadow-[0_12px_28px_rgba(56,189,248,0.38)]">
                {comment.authorName?.[0]?.toUpperCase?.() || '?'}
              </span>
              {comment.authorName || 'Traveler'}
            </span>
            <span>{createdAt}</span>
          </div>

          <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {comment.content}
          </p>

          <div className="mt-4 flex items-center gap-4 text-xs font-semibold text-slate-500">
            <button
              onClick={() => onVote(comment.id, userVote === 'up' ? null : 'up')}
              className={`flex items-center gap-1.5 transition hover:scale-105 ${
                userVote === 'up' ? 'text-emerald-500' : 'text-slate-400'
              }`}
              aria-label="Upvote comment"
            >
              <FaArrowUp className="text-sm" />
              <span>{comment.upvoteCount ?? 0}</span>
            </button>

            <button
              onClick={() => onVote(comment.id, userVote === 'down' ? null : 'down')}
              className={`flex items-center gap-1.5 transition hover:scale-105 ${
                userVote === 'down' ? 'text-rose-500' : 'text-slate-400'
              }`}
              aria-label="Downvote comment"
            >
              <FaArrowDown className="text-sm" />
              <span>{comment.downvoteCount ?? 0}</span>
            </button>
            <button
              onClick={() => {
                setActiveReplyId(comment.id);
                setReplyValue('');
              }}
              className="flex items-center gap-1.5 text-cyan-600 transition hover:scale-105 hover:text-cyan-500"
            >
              <FaReply className="text-sm" /> Reply
            </button>
          </div>

          {activeReplyId === comment.id && (
            <div className="mt-4 space-y-3">
              <textarea
                value={replyValue}
                onChange={(event) => setReplyValue(event.target.value)}
                rows={3}
                placeholder="Share your thoughts..."
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-200"
              />
              <div className="flex items-center gap-3">
                <button
                  onClick={() => submitReply(comment.id)}
                  className="rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-white shadow-[0_16px_36px_rgba(56,189,248,0.4)]"
                >
                  Send Reply
                </button>
                <button
                  onClick={() => {
                    setActiveReplyId(null);
                    setReplyValue('');
                  }}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {comment.replies?.length > 0 && (
          <div className="space-y-4 border-l border-dashed border-slate-200 pl-6">
            {comment.replies.map((child) => renderComment(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {comments.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white/80 px-6 py-8 text-center text-sm font-semibold text-slate-400">
          No comments yet. Start the conversation!
        </div>
      ) : (
        comments.map((comment) => renderComment(comment))
      )}
    </div>
  );
};

export default CommentThread;
