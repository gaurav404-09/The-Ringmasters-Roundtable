import {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import PipNotification from '../components/ui/PipNotification.jsx';
import { fetchNewOpportunities } from '../lib/opportunitiesClient.js';
import { markOpportunitySeen } from '../lib/opportunitiesClient.js';
import { useAuth } from './AuthContext.jsx';

const PipContext = createContext(null);

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `pip-${Math.random().toString(36).slice(2, 10)}`;
};

export const PipProvider = ({ children }) => {
  const [queue, setQueue] = useState([]);
  const { user } = useAuth();
  const pollingRef = useRef(null);
  const fetchingRef = useRef(false);
  const seenOpportunitiesRef = useRef(new Set()); // Track dismissed opportunities
  const [isOnBreak, setIsOnBreak] = useState(false); // 30s break between notifications

  const enqueueNotification = useCallback((notification) => {
    setQueue((prev) => {
      const id = notification.id || generateId();
      if (prev.some((item) => item.id === id)) {
        return prev;
      }
      return [...prev, { ...notification, id }];
    });
  }, []);

  const resetQueue = useCallback(() => {
    setQueue([]);
  }, []);

  const dismissCurrent = useCallback(async () => {
    const current = queue[0];
    if (!current) {
      return;
    }
    
    // Track as seen to prevent re-enqueueing
    seenOpportunitiesRef.current.add(current.id);
    
    // Mark as seen BEFORE removing from queue
    if (current?.onSeen) {
      try {
        console.log('[PipProvider] Marking opportunity as seen:', current.id);
        await current.onSeen();
        console.log('[PipProvider] Successfully marked as seen:', current.id);
      } catch (error) {
        console.error('[PipProvider] Failed to mark Pip notification as seen:', error);
      }
    }
    
    // Remove from queue after marking as seen
    setQueue((prev) => prev.slice(1));
    
    // Start 30-second break before showing next notification
    setIsOnBreak(true);
    console.log('[PipProvider] Starting 30-second break...');
    setTimeout(() => {
      setIsOnBreak(false);
      console.log('[PipProvider] Break ended, ready for next notification');
    }, 30000);
  }, [queue]);

  useEffect(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    if (!user?.uid) {
      resetQueue();
      seenOpportunitiesRef.current.clear(); // Clear seen tracking on logout
      return undefined;
    }
    
    // Clear seen tracking when user changes
    seenOpportunitiesRef.current.clear();

    let cancelled = false;

    const pollIntervalMs = Math.max(
      10000,
      Number(import.meta.env.VITE_PIP_POLL_INTERVAL_MS) || 45000,
    );

    const fetchAndEnqueue = async () => {
      if (fetchingRef.current) {
        return;
      }
      fetchingRef.current = true;
      try {
        console.log('[PipProvider] Starting fetch for UID:', user.uid);
        const opportunities = await fetchNewOpportunities(user.uid);
        console.log('[PipProvider] Fetched opportunities:', opportunities);
        if (cancelled || !Array.isArray(opportunities) || !opportunities.length) {
          console.log('[PipProvider] No opportunities to enqueue, cancelled:', cancelled, 'length:', opportunities?.length);
          return;
        }

        opportunities.forEach((opportunity) => {
          console.log('[PipProvider] Processing opportunity:', opportunity);
          if (!opportunity?.opportunityId) {
            console.log('[PipProvider] Skipping opportunity - no opportunityId');
            return;
          }
          
          // Skip if already seen/dismissed in this session
          if (seenOpportunitiesRef.current.has(opportunity.opportunityId)) {
            console.log('[PipProvider] Skipping already-seen opportunity:', opportunity.opportunityId);
            return;
          }
          
          const pipData = opportunity.pipData || {};
          let seen = false;
          const handleSeen = async () => {
            if (seen) return;
            seen = true;
            try {
              await markOpportunitySeen(user.uid, opportunity.opportunityId);
            } catch (error) {
              console.error('[PipProvider] Failed to mark Pip opportunity as seen:', error);
            }
          };

          console.log('[PipProvider] Enqueuing notification:', {
            id: opportunity.opportunityId,
            title: pipData.title || 'Pip has a tip! 🎪',
            message: pipData.message || 'Check out this travel insight.',
          });

          enqueueNotification({
            id: opportunity.opportunityId,
            title: pipData.title || 'Pip has a tip! 🎪',
            message: pipData.message || 'Check out this travel insight.',
            avatarUrl: pipData.avatarUrl || null,
            actionButtonText: pipData.actionButtonText || null,
            onSeen: handleSeen,
            onAction: pipData.actionUrl
              ? () => window.open(pipData.actionUrl, '_blank', 'noopener,noreferrer')
              : undefined,
          });
        });
      } catch (error) {
        if (!cancelled) {
          console.error('[PipProvider] Failed to fetch Pip opportunities:', error);
        }
      } finally {
        fetchingRef.current = false;
      }
    };

    fetchAndEnqueue();
    pollingRef.current = setInterval(fetchAndEnqueue, pollIntervalMs);

    return () => {
      cancelled = true;
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [user?.uid, enqueueNotification, resetQueue]);

  useEffect(() => {
    if (import.meta.env.DEV) {
      window.__pipQueue = queue;
      window.__pipPendingCount = queue.length;
    }
  }, [queue]);

  // Only show notification if not on break
  const current = (isOnBreak ? null : queue[0]) || null;

  const handleAction = useCallback(() => {
    if (!current) {
      return;
    }
    if (current?.onAction) {
      Promise.resolve(current.onAction()).catch((error) => {
        console.error('[PipProvider] Pip action handler failed:', error);
      });
    }
    dismissCurrent();
  }, [current, dismissCurrent]);

  const value = useMemo(
    () => ({
      enqueueNotification,
      pendingCount: queue.length,
      current,
      resetQueue,
    }),
    [enqueueNotification, queue.length, current, resetQueue]
  );

  return (
    <PipContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-8 right-8 z-[9999] flex max-w-sm flex-col gap-3">
        {current && (
          <div className="pointer-events-auto">
            <PipNotification
              key={current.id}
              title={current.title}
              message={current.message}
              avatarUrl={current.avatarUrl}
              actionButtonText={current.actionButtonText}
              onActionClick={current.onAction ? handleAction : undefined}
              onDismiss={dismissCurrent}
            />
          </div>
        )}
      </div>
    </PipContext.Provider>
  );
};

export const usePip = () => {
  const context = useContext(PipContext);
  if (!context) {
    throw new Error('usePip must be used within a PipProvider');
  }
  return context;
};
