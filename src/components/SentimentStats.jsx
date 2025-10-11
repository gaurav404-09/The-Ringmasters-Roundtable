import { useEffect, useState } from 'react';
import { FaSmile, FaFrown, FaMeh, FaChartBar } from 'react-icons/fa';
import api from '../utils/api';

const SentimentStats = ({ source, destination, tag, revisionKey = 0 }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const params = new URLSearchParams();
        if (source) params.set('source', source);
        if (destination) params.set('destination', destination);
        if (tag) params.set('tag', tag);
        params.set('limit', '100');

        const response = await api.get(`/community/sentiment/stats?${params.toString()}`);
        setStats(response.data?.stats);
      } catch (err) {
        console.error('Failed to fetch sentiment stats:', err);
        setError('Failed to load sentiment statistics');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [source, destination, tag, revisionKey]);

  if (loading) {
    return (
      <div className="w-full max-w-[280px] rounded-3xl border border-white/10 bg-white/95 p-6 shadow-[0_28px_80px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-slate-900/85">
        <div className="flex items-center justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
        </div>
      </div>
    );
  }

  if (error || !stats || stats.totalAnalyzed === 0) {
    return null;
  }

  const sentimentData = [
    {
      type: 'positive',
      count: stats.positive,
      percentage: stats.positivePercentage,
      icon: FaSmile,
      color: 'text-green-500',
      bgColor: 'bg-green-100',
      barColor: 'bg-green-500',
      hexColor: '#22c55e'
    },
    {
      type: 'negative',
      count: stats.negative,
      percentage: stats.negativePercentage,
      icon: FaFrown,
      color: 'text-red-500',
      bgColor: 'bg-red-100',
      barColor: 'bg-red-500',
      hexColor: '#ef4444'
    },
    {
      type: 'neutral',
      count: stats.neutral,
      percentage: stats.neutralPercentage,
      icon: FaMeh,
      color: 'text-gray-500',
      bgColor: 'bg-gray-100',
      barColor: 'bg-gray-500',
      hexColor: '#64748b'
    }
  ];

  const totalCount = Math.max(sentimentData.reduce((acc, item) => acc + item.count, 0), 1);
  let currentAngle = 0;
  const gradientSegments = sentimentData
    .map(({ count, hexColor }) => {
      if (!count) {
        return null;
      }

      const angle = (count / totalCount) * 360;
      const segment = `${hexColor} ${currentAngle}deg ${currentAngle + angle}deg`;
      currentAngle += angle;
      return segment;
    })
    .filter(Boolean);

  if (gradientSegments.length === 0) {
    gradientSegments.push('#94a3b8 0deg 360deg');
  }

  const pieChartStyle = {
    background: `conic-gradient(${gradientSegments.join(', ')})`
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-white/95 p-6 shadow-[0_28px_80px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-slate-900/85">
      <div className="flex items-center gap-3 mb-4">
        <FaChartBar className="text-cyan-500" />
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
          Community Sentiment
        </h3>
      </div>
      
      <div className="space-y-4">
        <div className="text-sm text-slate-600 dark:text-slate-300">
          Based on {stats.totalAnalyzed} analyzed posts
          {stats.totalPosts > stats.totalAnalyzed && (
            <span className="text-slate-400"> ({stats.totalPosts} total posts)</span>
          )}
        </div>

        <div className="flex flex-col items-center gap-6 lg:items-start">
          <div className="relative mx-auto flex h-36 w-36 max-w-full items-center justify-center rounded-full shadow-inner shadow-slate-200 dark:shadow-slate-800 lg:mx-0"
            style={pieChartStyle}
          >
            <div className="flex h-20 w-20 flex-col items-center justify-center rounded-full bg-white/90 text-center text-xs font-medium text-slate-600 shadow dark:bg-slate-900/90 dark:text-slate-300">
              <span className="text-lg font-semibold text-slate-900 dark:text-white">{stats.totalAnalyzed}</span>
              posts
            </div>
          </div>

          <div className="relative z-[1] w-full space-y-3">
            {sentimentData.map(({ type, count, percentage, hexColor }) => (
              <div key={type} className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white/90 px-3 py-2 shadow-sm backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-800/80">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: hexColor }} />
                <div className="space-y-0.5 text-xs text-slate-500 dark:text-slate-300">
                  <div className="flex items-center justify-between gap-3 text-sm font-semibold text-slate-700 capitalize dark:text-slate-100">
                    <span>{type}</span>
                    <span>{percentage}%</span>
                  </div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-500">{count} posts</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {sentimentData.map(({ type, count, percentage, icon: Icon, color, bgColor, barColor }) => (
            <div key={type} className="flex items-center gap-3">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full ${bgColor}`}>
                <Icon className={`text-sm ${color}`} />
              </div>
              
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300 capitalize">
                    {type}
                  </span>
                  <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                    {count} ({percentage}%)
                  </span>
                </div>
                
                <div className="w-full bg-slate-200 rounded-full h-2 dark:bg-slate-700">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${barColor}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Average confidence: {(stats.averageConfidence * 100).toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
  );
};

export default SentimentStats;
