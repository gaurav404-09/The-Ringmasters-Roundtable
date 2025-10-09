import { memo } from 'react';
import { FaArrowDown, FaArrowUp, FaCommentDots } from 'react-icons/fa';

const badgeColors = {
  beach: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  adventure: 'bg-amber-100 text-amber-700 border-amber-200',
  culture: 'bg-rose-100 text-rose-700 border-rose-200',
  default: 'bg-slate-100 text-slate-700 border-slate-200',
};

const CommunityPostCard = ({
  post,
  onOpen,
  onVote,
  userVote,
}) => {
  const renderTag = (tag) => {
    const key = tag?.toLowerCase?.();
    const color = badgeColors[key] || badgeColors.default;
    return (
      <span
        key={tag}
        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium uppercase tracking-wide ${color}`}
      >
        #{tag}
      </span>
    );
  };

  return (
    <article className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/95 p-6 shadow-[0_28px_80px_rgba(15,23,42,0.35)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_36px_120px_rgba(14,22,43,0.5)] dark:border-white/10 dark:bg-slate-900/85">
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-slate-400 dark:text-slate-300">
        <span>
          {post.source && post.destination
            ? `${post.source} → ${post.destination}`
            : post.destination
              ? `Destination · ${post.destination}`
              : 'Travel Community'}
        </span>
        <span>{new Date(post.createdAt).toLocaleDateString()}</span>
      </div>

      <div className="mt-4 space-y-3">
        <h3 className="text-xl font-semibold tracking-tight text-slate-950 dark:text-white">
          {post.title}
        </h3>
        <p className="line-clamp-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {post.content}
        </p>

        {typeof post.rating === 'number' && (
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/60 bg-amber-100/50 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-amber-600">
            Rating: {post.rating.toFixed(1)} / 5
          </div>
        )}
      </div>

      {post.tags?.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {post.tags.map(renderTag)}
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={onOpen}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white shadow-[0_16px_40px_rgba(56,189,248,0.35)] transition hover:shadow-[0_22px_60px_rgba(56,189,248,0.45)]"
        >
          Read Story
        </button>

        <div className="flex items-center gap-4 text-sm font-semibold text-slate-500 dark:text-slate-300">
          <button
            onClick={() => onVote(userVote === 'up' ? null : 'up')}
            className={`flex items-center gap-1.5 transition hover:scale-105 ${
              userVote === 'up' ? 'text-emerald-500' : 'text-slate-400 dark:text-slate-500'
            }`}
            aria-label="Upvote story"
          >
            <FaArrowUp className="text-base" />
            <span>{post.upvoteCount ?? 0}</span>
          </button>

          <button
            onClick={() => onVote(userVote === 'down' ? null : 'down')}
            className={`flex items-center gap-1.5 transition hover:scale-105 ${
              userVote === 'down' ? 'text-rose-500' : 'text-slate-400 dark:text-slate-500'
            }`}
            aria-label="Downvote story"
          >
            <FaArrowDown className="text-base" />
            <span>{post.downvoteCount ?? 0}</span>
          </button>

          <div className="flex items-center gap-1.5">
            <FaCommentDots className="text-base text-cyan-500" />
            <span>{post.commentCount}</span>
          </div>
        </div>
      </div>
    </article>
  );
};

export default memo(CommunityPostCard);
