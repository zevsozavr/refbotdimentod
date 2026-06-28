import { useState, useEffect } from 'react';
import { adminApi } from '../axios';

// Module-level cache so navigating between admin pages doesn't refetch on every mount.
let cache = null;
let inflight = null;
const listeners = new Set();

const notify = () => listeners.forEach((cb) => cb(cache));

export const refreshAdminCounts = async () => {
  if (inflight) return inflight;
  inflight = adminApi.get('/admin/stats')
    .then((res) => {
      cache = {
        pendingUsers: res.data.pending || 0,
        pendingChanges: res.data.pendingChanges || 0,
        activeContests: res.data.activeContests || 0,
      };
      notify();
      return cache;
    })
    .catch(() => cache)
    .finally(() => { inflight = null; });
  return inflight;
};

// Call after an admin action mutates counts (approve/reject/ban, etc.)
export const invalidateAdminCounts = () => { refreshAdminCounts(); };

const useAdminCounts = () => {
  const [counts, setCounts] = useState(cache);

  useEffect(() => {
    listeners.add(setCounts);
    if (!cache) refreshAdminCounts();
    else setCounts(cache);
    return () => { listeners.delete(setCounts); };
  }, []);

  return counts || { pendingUsers: 0, pendingChanges: 0, activeContests: 0 };
};

export default useAdminCounts;
