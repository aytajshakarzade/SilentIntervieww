import { useCallback, useEffect, useState } from 'react';
import { jobService } from '../services/jobService';
import { getErrorMessage } from "../utils/errorUtils";
import { unwrapPaged } from "../utils/unwrapPaged";
export function useJobs(params) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await jobService.getAll(params);
      setJobs(unwrapPaged(data));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(params)]); // eslint-disable-line

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const createJob = useCallback(async (data) => {
    const created = await jobService.create(data);
    setJobs((prev) => [created, ...prev]);
    return created;
  }, []);

  const updateJob = useCallback(async (id, data) => {
    const updated = await jobService.update(id, data);
    setJobs((prev) =>
      prev.map((j) =>
        j.id === id
          ? { ...j, ...updated }
          : j
      )
    ); return updated;
  }, []);

  const removeJob = useCallback(async (id) => {
    await jobService.remove(id);
    setJobs((prev) => prev.filter((j) => j.id !== id));
  }, []);
  const restoreJob = useCallback(async (id) => {
    await jobService.restore(id);
    await fetchJobs();
  }, [fetchJobs]);

  return {
    jobs,
    loading,
    error,
    refetch: fetchJobs,
    createJob,
    updateJob,
    removeJob,
    restoreJob,
  };
}
