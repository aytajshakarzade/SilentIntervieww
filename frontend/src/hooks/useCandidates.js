import { useCallback, useEffect, useState } from 'react';
import { candidateService } from '../services/candidateService';
import { interviewService } from '../services/interviewService';
import { getErrorMessage } from "../utils/errorUtils";
import { unwrapPaged } from "../utils/unwrapPaged";

export function useCandidates() {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCandidates = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [rawCandidates, applications, sessions, reports] = await Promise.all([
        candidateService.getAll(),
        interviewService.applications.getAll(),
        interviewService.sessions.getAll(),
        interviewService.reports.getAll(),
      ]);

      const candidateList = unwrapPaged(rawCandidates);
      const applicationList = unwrapPaged(applications);
      const sessionList = unwrapPaged(sessions);
      const reportList = unwrapPaged(reports);

      const sessionByApp = new Map(
        sessionList.map((s) => [s.jobApplicationId, s])
      );

      const reportBySession = new Map(
        reportList.map((r) => [r.interviewSessionId, r])
      );

      const appsByCandidate = new Map();

      applicationList.forEach((app) => {
        const session = sessionByApp.get(app.id);
        const report = session
          ? reportBySession.get(session.id)
          : null;

        const enrichedApplication = {
          ...app,
          session,
          report,
          score: report?.score ?? null,
        };

        const existing = appsByCandidate.get(app.candidateId) || [];
        existing.push(enrichedApplication);
        appsByCandidate.set(app.candidateId, existing);
      });

      const enrichedCandidates = candidateList.map((candidate) => {
        const candidateApplications =
          appsByCandidate.get(candidate.id) || [];

        const scores = candidateApplications
          .map((a) => a.score)
          .filter((s) => s != null);

        return {
          ...candidate,
          applications: candidateApplications,
          displayName: candidateApplications.find((application) => application.candidateName)?.candidateName || null,
          bestScore:
            scores.length > 0
              ? Math.max(...scores)
              : null,
        };
      });

      setCandidates(enrichedCandidates);
    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  return {
    candidates,
    loading,
    error,
    refetch: fetchCandidates,
  };
}
