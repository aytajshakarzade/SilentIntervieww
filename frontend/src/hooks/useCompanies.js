import { useCallback, useEffect, useState } from 'react';
import { companyService } from '../services/companyService';
import { unwrapPaged } from '../utils/unwrapPaged';
import { getErrorMessage } from '../utils/errorUtils';

export function useCompanies(params) {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await companyService.getAll(params);
      setCompanies(unwrapPaged(data));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(params)]); // eslint-disable-line

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  const createCompany = useCallback(async (data) => {
    const created = await companyService.create(data);
    setCompanies((prev) => [created, ...prev]);
    return created;
  }, []);

  const updateCompany = useCallback(async (id, data) => {
    const updated = await companyService.update(id, data);
    setCompanies((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updated } : c))
    );
    return updated;
  }, []);

  const removeCompany = useCallback(async (id) => {
    await companyService.remove(id);
    setCompanies((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const restoreCompany = useCallback(async (id) => {
    await companyService.restore(id);
    await fetchCompanies();
  }, [fetchCompanies]);

  return {
    companies,
    loading,
    error,
    refetch: fetchCompanies,
    createCompany,
    updateCompany,
    removeCompany,
    restoreCompany,
  };
}
