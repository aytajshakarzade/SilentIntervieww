import { useEffect, useMemo, useState } from 'react';
import axiosClient, { unwrap } from '../api/axiosClient';

const FALLBACK = {
  candidate: [
    { id: 'Free', name: 'Free', price: 0, description: 'Build interview confidence with core AI-powered practice.', limits: { monthlyInterviews: 3, monthlyAiActions: 10, monthlyAssistantMessages: 0, activeJobs: -1 }, capabilities: { aiInterview: true, aiHrAssistant: false, advancedAnalytics: false, priorityAi: false }, features: ['3 interviews / month', '10 AI interview/report actions / month', 'AI interview feedback', 'Core reports'] },
    { id: 'Go', name: 'Go', price: 9.99, description: 'More interview practice and deeper AI insights.', limits: { monthlyInterviews: 25, monthlyAiActions: 100, monthlyAssistantMessages: 0, activeJobs: -1 }, capabilities: { aiInterview: true, aiHrAssistant: false, advancedAnalytics: true, priorityAi: true }, features: ['25 interviews / month', '100 AI interview/report actions / month', 'Advanced analytics', 'Priority AI processing'] },
    { id: 'Pro', name: 'Pro', price: 24.99, description: 'Unlimited interview practice and premium AI analysis.', limits: { monthlyInterviews: -1, monthlyAiActions: -1, monthlyAssistantMessages: 0, activeJobs: -1 }, capabilities: { aiInterview: true, aiHrAssistant: false, advancedAnalytics: true, priorityAi: true }, features: ['Unlimited interviews', 'Unlimited AI interview/report actions', 'Advanced analytics', 'Priority AI processing'] },
  ],
  recruiter: [
    { id: 'Free', name: 'Free', price: 0, description: 'Run focused hiring with the essentials.', limits: { monthlyInterviews: -1, monthlyAiActions: 10, monthlyAssistantMessages: 0, activeJobs: 3 }, capabilities: { aiInterview: true, aiHrAssistant: false, advancedAnalytics: false, priorityAi: false }, features: ['3 active jobs', '10 AI interview/report actions / month', 'Candidate management', 'Core analytics'] },
    { id: 'Go', name: 'Go', price: 9.99, description: 'More hiring capacity plus AI-powered recruiting tools.', limits: { monthlyInterviews: -1, monthlyAiActions: 100, monthlyAssistantMessages: 50, activeJobs: 25 }, capabilities: { aiInterview: true, aiHrAssistant: true, advancedAnalytics: true, priorityAi: true }, features: ['25 active jobs', '100 AI interview/report actions / month', 'AI HR Assistant', '50 assistant messages / month', 'Advanced analytics', 'Priority AI processing'] },
    { id: 'Pro', name: 'Pro', price: 24.99, description: 'Unlimited recruiting capacity with premium AI.', limits: { monthlyInterviews: -1, monthlyAiActions: -1, monthlyAssistantMessages: -1, activeJobs: -1 }, capabilities: { aiInterview: true, aiHrAssistant: true, advancedAnalytics: true, priorityAi: true }, features: ['Unlimited active jobs', 'Unlimited AI interview/report actions', 'AI HR Assistant', 'Unlimited assistant messages', 'Advanced analytics', 'Priority AI processing'] },
  ],
};

export function useSubscriptionPlans(role) {
  const normalizedRole = String(role || '').toLowerCase() === 'recruiter' ? 'recruiter' : 'candidate';
  const fallback = useMemo(() => FALLBACK[normalizedRole], [normalizedRole]);
  const [plans, setPlans] = useState(fallback);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setPlans(fallback);
    setLoading(true);
    setError('');
    axiosClient.get(`/subscription/plans?role=${normalizedRole}`)
      .then(unwrap)
      .then((items) => {
        if (!active) return;
        setPlans(Array.isArray(items) && items.length ? items : fallback);
      })
      .catch((err) => {
        if (!active) return;
        setPlans(fallback);
        setError(err?.message || 'Plan information is temporarily unavailable.');
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [normalizedRole, fallback]);

  return { plans, loading, error };
}
