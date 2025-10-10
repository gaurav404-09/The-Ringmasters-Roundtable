import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Brain, Zap } from 'lucide-react';

const ENTRY_VARIANTS = {
  hidden: { opacity: 0, y: 50, scale: 0.9, rotateX: -15 },
  visible: { opacity: 1, y: 0, scale: 1, rotateX: 0 },
  exit: { opacity: 0, y: 30, scale: 0.92, rotateX: 10 },
};

const PULSE_VARIANTS = {
  pulse: {
    scale: [1, 1.05, 1],
    opacity: [0.5, 0.8, 0.5],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

const PipNotification = ({
  title,
  message,
  avatarUrl,
  actionButtonText,
  onActionClick,
  onDismiss,
}) => {
  const [isThinking, setIsThinking] = useState(true);

  useEffect(() => {
    const thinkTimer = setTimeout(() => setIsThinking(false), 1200);
    // Auto-dismiss after 3 minutes (180,000ms)
    const dismissTimer = setTimeout(() => {
      onDismiss?.();
    }, 180_000);
    return () => {
      clearTimeout(thinkTimer);
      clearTimeout(dismissTimer);
    };
  }, [onDismiss]);

  return (
    <AnimatePresence>
      <motion.div
        initial="hidden"
        animate="visible"
        exit="exit"
        variants={ENTRY_VARIANTS}
        transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
        className="pointer-events-auto relative w-full max-w-md overflow-hidden rounded-[32px] border border-white/15 bg-gradient-to-br from-slate-950/95 via-slate-900/90 to-indigo-950/85 shadow-[0_32px_90px_rgba(99,102,241,0.5),0_0_80px_rgba(14,165,233,0.3)] backdrop-blur-xl"
        style={{ perspective: '1000px' }}
      >
        {/* Animated background effects */}
        <div className="pointer-events-none absolute inset-0">
          <motion.div
            variants={PULSE_VARIANTS}
            animate="pulse"
            className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-cyan-400/30 blur-3xl"
          />
          <motion.div
            variants={PULSE_VARIANTS}
            animate="pulse"
            style={{ animationDelay: '1s' }}
            className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-indigo-500/30 blur-3xl"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/10 via-transparent to-violet-500/10" />
        </div>

        {/* Agent header */}
        <div className="relative border-b border-white/10 bg-white/5 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <motion.div
                animate={isThinking ? { rotate: 360 } : {}}
                transition={{ duration: 2, repeat: isThinking ? Infinity : 0, ease: 'linear' }}
                className="absolute -inset-1 rounded-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-indigo-500 opacity-75 blur"
              />
              <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-full border-2 border-white/20 bg-gradient-to-br from-cyan-500/20 to-indigo-600/20">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Pip avatar"
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl">🤹‍♂️</div>
                )}
              </div>
              {isThinking && (
                <motion.div
                  animate={{ scale: [1, 1.2, 1], opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.6)]"
                >
                  <Brain className="h-3 w-3 text-slate-950" />
                </motion.div>
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.4em] text-cyan-300/80">
                  Pip Intelligence Agent
                </p>
                <motion.div
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="flex items-center gap-1"
                >
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span className="text-[9px] uppercase tracking-wider text-emerald-300/70">Active</span>
                </motion.div>
              </div>
              <p className="mt-1 text-sm font-semibold text-white">
                {isThinking ? 'Analyzing patterns...' : title}
              </p>
            </div>
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-full border border-white/15 bg-white/5 p-1.5 text-white/60 transition hover:border-white/30 hover:bg-white/10 hover:text-white"
              aria-label="Dismiss Pip notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Agent message body */}
        <div className="relative px-5 py-5">
          <AnimatePresence mode="wait">
            {isThinking ? (
              <motion.div
                key="thinking"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-3 text-sm text-white/70"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                >
                  <Sparkles className="h-4 w-4 text-cyan-400" />
                </motion.div>
                <span>Processing travel intelligence...</span>
              </motion.div>
            ) : (
              <motion.div
                key="message"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: 0.2 }}
              >
                <div className="flex items-start gap-2">
                  <Zap className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-400" />
                  <p className="text-sm leading-relaxed text-white/90">{message}</p>
                </div>
                {actionButtonText && onActionClick && (
                  <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    type="button"
                    onClick={onActionClick}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-500 px-5 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white shadow-[0_20px_50px_rgba(14,165,233,0.4)] transition hover:shadow-[0_25px_60px_rgba(14,165,233,0.5)] hover:brightness-110"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {actionButtonText}
                  </motion.button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Agent footer with progress indicator */}
        <div className="relative border-t border-white/10 bg-white/5 px-5 py-3">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.35em] text-white/50">
            <span>AI-powered insight</span>
            <div className="flex items-center gap-2">
              <motion.div
                animate={{ width: ['0%', '100%'] }}
                transition={{ duration: 180, ease: 'linear' }}
                className="h-1 w-16 overflow-hidden rounded-full bg-white/10"
              >
                <div className="h-full w-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-indigo-500" />
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PipNotification;
