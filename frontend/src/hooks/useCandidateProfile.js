import { useCallback, useEffect, useState } from 'react';
import { candidateService } from '../services/candidateService';
import { useAuth } from './useAuth';
import { getErrorMessage } from '../utils/errorUtils';

/**
 * Returns the CandidateDto linked to the current authenticated user.
 * If no profile exists yet, `profile` is null and `ensureProfile` can
 * be called to create one automatically.
 */
export function useCandidateProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProfile = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const data = await candidateService.getAll();
      const items = Array.isArray(data) ? data : (data?.items ?? []);
      const mine = items.find((c) => c.userId === user.id) || null;
      setProfile(mine);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  /**
   * Ensure a candidate profile exists for the current user.
   * If one already exists, returns it immediately.
   * If none exists, creates one automatically with sensible defaults
   * and returns the newly created profile.
   * Throws only when authentication or the backend call fails.
   */
  const ensureProfile = useCallback(async () => {
    if (!user?.id) {
      throw new Error('Not authenticated');
    }

    // Fetch current candidates scoped to this user
    const data = await candidateService.getAll();
    const items = Array.isArray(data) ? data : (data?.items ?? []);
    let mine = items.find((c) => c.userId === user.id) || null;

    if (!mine) {
      // No profile exists yet — create one with defaults so the interview
      // flow can proceed without requiring the user to manually fill a form.
      try {
        mine = await candidateService.create({
          userId: user.id,
          resumeUrl: '',
          skills: '',
          education: '',
          experience: '',
        });
      } catch (createErr) {
        // If create fails (e.g. profile was just created by a concurrent
        // request), try to fetch again before giving up.
        const retryData = await candidateService.getAll();
        const retryItems = Array.isArray(retryData) ? retryData : (retryData?.items ?? []);
        mine = retryItems.find((c) => c.userId === user.id) || null;
        if (!mine) {
          throw createErr;
        }
      }
    }

    setProfile(mine);
    return mine;
  }, [user?.id]);

  const updateProfile = useCallback(async (data) => {
    if (!profile?.id) throw new Error('No candidate profile');
    await candidateService.update(profile.id, data);
    setProfile((p) => ({ ...p, ...data }));
  }, [profile]);

  return { profile, loading, error, refetch: fetchProfile, ensureProfile, updateProfile };
}
