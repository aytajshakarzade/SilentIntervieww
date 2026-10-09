import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Paper, Typography, Stack, Autocomplete, TextField, Button, Chip,
  Grid, CircularProgress, Alert, Divider, LinearProgress,
} from '@mui/material';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';

import { interviewService } from '../../services/interviewService';
import { aiInterviewService } from '../../services/aiInterviewService';
import { getErrorMessage } from '../../utils/errorUtils';
import { useTranslation } from '../../i18n';
import { AIThinkingIndicator } from '../../components/interview/AIInterviewerPanel';

const RECOMMENDATION_COLOR = {
  'Strong Hire': 'success',
  'Potential Hire': 'info',
  'Needs Review': 'warning',
  'Reject': 'error',
};

export default function CandidateComparisonPage() {
  const { language: locale, t } = useTranslation();

  const [applications, setApplications] = useState([]);
  const [sessionsByApplication, setSessionsByApplication] = useState({});
  const [loadingCandidates, setLoadingCandidates] = useState(true);
  const [error, setError] = useState('');

  const [selectedApplicationIds, setSelectedApplicationIds] = useState([]);
  const [comparing, setComparing] = useState(false);
  const [comparisonText, setComparisonText] = useState('');
  const [reportsBySession, setReportsBySession] = useState({});
  const [loadingReports, setLoadingReports] = useState(false);

  useEffect(() => {
    (async () => {
      setLoadingCandidates(true);
      try {
        const [appsRaw, sessionsRaw] = await Promise.all([
          interviewService.applications.getAll({ pageSize: 200 }),
          interviewService.sessions.getAll({ pageSize: 200 }),
        ]);
        const apps = Array.isArray(appsRaw) ? appsRaw : (appsRaw?.items ?? []);
        const sessions = Array.isArray(sessionsRaw) ? sessionsRaw : (sessionsRaw?.items ?? []);

        const grouped = {};
        sessions.forEach((s) => {
          if (!grouped[s.jobApplicationId]) grouped[s.jobApplicationId] = [];
          grouped[s.jobApplicationId].push(s);
        });

        setApplications(apps);
        setSessionsByApplication(grouped);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoadingCandidates(false);
      }
    })();
  }, []);

  const candidateOptions = useMemo(
    () => applications.map((app) => ({
      id: app.id,
      label: `${app.candidateName} — ${app.jobTitle}`,
      sessions: sessionsByApplication[app.id] || [],
    })).filter((opt) => opt.sessions.some((s) => s.endedAt)),
    [applications, sessionsByApplication],
  );

  const selectedOptions = useMemo(
    () => candidateOptions.filter((opt) => selectedApplicationIds.includes(opt.id)),
    [candidateOptions, selectedApplicationIds],
  );

  const RECOMMENDATION_RANK = { 'Strong Hire': 3, 'Potential Hire': 2, 'Needs Review': 1, 'Reject': 0 };

  const rankedCandidates = useMemo(() => {
    return selectedOptions
      .map((opt) => {
        const session = opt.sessions.find((s) => s.endedAt);
        const report = session ? reportsBySession[session.id] : null;
        return { id: opt.id, label: opt.label, report };
      })
      .sort((a, b) => {
        const rankA = a.report ? (RECOMMENDATION_RANK[a.report.hiringRecommendation] ?? -1) : -2;
        const rankB = b.report ? (RECOMMENDATION_RANK[b.report.hiringRecommendation] ?? -1) : -2;
        if (rankA !== rankB) return rankB - rankA;
        return (b.report?.confidenceScore ?? 0) - (a.report?.confidenceScore ?? 0);
      });
  }, [selectedOptions, reportsBySession]);

  const sessionIdsForSelection = useMemo(
    () => selectedOptions
      .map((opt) => opt.sessions.find((s) => s.endedAt))
      .filter(Boolean)
      .map((s) => s.id),
    [selectedOptions],
  );

  const loadReports = useCallback(async () => {
    if (sessionIdsForSelection.length === 0) return;
    setLoadingReports(true);
    try {
      const entries = await Promise.all(
        sessionIdsForSelection.map(async (sessionId) => {
          try {
            const report = await aiInterviewService.getReport(sessionId);
            return [sessionId, report];
          } catch {
            return [sessionId, null];
          }
        }),
      );
      setReportsBySession(Object.fromEntries(entries));
    } finally {
      setLoadingReports(false);
    }
  }, [sessionIdsForSelection]);

  useEffect(() => { loadReports(); }, [loadReports]);

  const handleCompare = useCallback(async () => {
    if (sessionIdsForSelection.length < 2) return;
    setComparing(true);
    setComparisonText('');
    setError('');
    try {
      const question = sessionIdsForSelection.length === 2
        ? 'Compare these two candidates in detail and tell me who is the better fit and why.'
        : 'Compare these candidates and rank them from strongest to weakest fit, with reasoning.';
      const response = await aiInterviewService.askAssistant(question, sessionIdsForSelection, locale);
      setComparisonText(response.answer);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setComparing(false);
    }
  }, [sessionIdsForSelection, locale]);

  return (
    <Box sx={{ maxWidth: 980, mx: 'auto' }}>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 3 }}>
        <CompareArrowsIcon color="primary" />
        <Typography variant="h5" fontWeight={800}>{t('uiFixes.comparisonTitle')}</Typography>
      </Stack>

      <Paper data-tour="ai-compare-picker" elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, p: 3, mb: 3 }}>
        <Autocomplete
          multiple
          options={candidateOptions}
          loading={loadingCandidates}
          getOptionLabel={(opt) => opt.label}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          value={selectedOptions}
          onChange={(_, values) => setSelectedApplicationIds(values.map((v) => v.id))}
          renderInput={(params) => (
            <TextField {...params} label="Select candidates to compare (2 or more)" placeholder="Search candidates…" />
          )}
        />

        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

        <Box sx={{ mt: 2.5, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            startIcon={comparing ? <CircularProgress size={18} color="inherit" /> : <CompareArrowsIcon />}
            onClick={handleCompare}
            disabled={sessionIdsForSelection.length < 2 || comparing}
          >
            {comparing ? 'Comparing…' : 'Compare with AI'}
          </Button>
        </Box>
      </Paper>

      {/* Ranking */}
      {rankedCandidates.length > 1 && (
        <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, p: 2.5, mb: 3 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <EmojiEventsIcon sx={{ color: 'warning.main' }} />
            <Typography variant="subtitle1" fontWeight={700}>Ranking</Typography>
            <Typography variant="caption" color="text.disabled">
              (by hiring recommendation, then AI confidence)
            </Typography>
          </Stack>
          <Stack spacing={1.25}>
            {rankedCandidates.map((c, i) => (
              <Stack key={c.id} direction="row" alignItems="center" spacing={1.5}>
                <Chip label={`#${i + 1}`} size="small" color={i === 0 ? 'primary' : 'default'} sx={{ fontWeight: 700, minWidth: 40 }} />
                <Typography variant="body2" fontWeight={600} sx={{ flex: 1 }}>{c.label}</Typography>
                {c.report ? (
                  <>
                    <Chip
                      label={c.report.hiringRecommendation}
                      size="small"
                      color={RECOMMENDATION_COLOR[c.report.hiringRecommendation] || 'default'}
                    />
                    <Typography variant="caption" color="text.disabled" sx={{ minWidth: 90, textAlign: 'right' }}>
                      {c.report.confidenceScore}% confidence
                    </Typography>
                  </>
                ) : (
                  <Typography variant="caption" color="text.disabled">No report yet</Typography>
                )}
              </Stack>
            ))}
          </Stack>
        </Paper>
      )}

      {/* Candidate score cards — strengths / weaknesses / justification */}
      {selectedOptions.length > 0 && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {selectedOptions.map((opt) => {
            const session = opt.sessions.find((s) => s.endedAt);
            const report = session ? reportsBySession[session.id] : null;
            return (
              <Grid item xs={12} md={6} key={opt.id}>
                <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, p: 2.5, height: '100%' }}>
                  <Typography variant="subtitle1" fontWeight={700}>{opt.label}</Typography>
                  {loadingReports ? (
                    <LinearProgress sx={{ mt: 2 }} />
                  ) : report ? (
                    <>
                      <Chip
                        label={report.hiringRecommendation || 'Pending'}
                        color={RECOMMENDATION_COLOR[report.hiringRecommendation] || 'default'}
                        size="small"
                        sx={{ mt: 1.5, mb: 1 }}
                      />
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                        {report.executiveSummary}
                      </Typography>

                      {report.strengths?.length > 0 && (
                        <Box sx={{ mb: 1 }}>
                          <Typography variant="caption" fontWeight={700} color="success.main">STRENGTHS</Typography>
                          <Stack spacing={0.25} sx={{ mt: 0.5 }}>
                            {report.strengths.slice(0, 3).map((s, i) => (
                              <Typography key={i} variant="caption" color="text.secondary">• {s}</Typography>
                            ))}
                          </Stack>
                        </Box>
                      )}

                      {report.weaknesses?.length > 0 && (
                        <Box sx={{ mb: 1.5 }}>
                          <Typography variant="caption" fontWeight={700} color="warning.main">WEAKNESSES</Typography>
                          <Stack spacing={0.25} sx={{ mt: 0.5 }}>
                            {report.weaknesses.slice(0, 3).map((w, i) => (
                              <Typography key={i} variant="caption" color="text.secondary">• {w}</Typography>
                            ))}
                          </Stack>
                        </Box>
                      )}

                      <Stack direction="row" spacing={1} alignItems="center">
                        <EmojiEventsIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                        <Typography variant="caption" color="text.disabled">
                          AI confidence: {report.confidenceScore}%
                        </Typography>
                      </Stack>
                    </>
                  ) : (
                    <Typography variant="body2" color="text.disabled" sx={{ mt: 1.5 }}>
                      No AI report generated yet for this candidate.
                    </Typography>
                  )}
                </Paper>
              </Grid>
            );
          })}
        </Grid>
      )}

      {comparing && (
        <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, p: 3, mb: 3 }}>
          <AIThinkingIndicator label="Comparing candidates" />
        </Paper>
      )}

      {comparisonText && (
        <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'primary.main', borderRadius: 3, p: 3 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>AI Comparison</Typography>
          <Divider sx={{ mb: 1.5 }} />
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
            {comparisonText}
          </Typography>
        </Paper>
      )}
    </Box>
  );
}
