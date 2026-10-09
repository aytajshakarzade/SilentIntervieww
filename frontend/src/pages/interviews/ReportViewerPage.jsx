import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert, Avatar, Box, Button, Card, CardContent, Chip, Divider, Grid,
  IconButton, LinearProgress, Skeleton, Stack, Tooltip, Typography,
} from '@mui/material';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip,
  ResponsiveContainer, BarChart, Bar, Cell,
} from 'recharts';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PrintIcon from '@mui/icons-material/Print';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import ThumbUpAltOutlinedIcon from '@mui/icons-material/ThumbUpAltOutlined';
import FlagCircleOutlinedIcon from '@mui/icons-material/FlagCircleOutlined';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import RecordVoiceOverOutlinedIcon from '@mui/icons-material/RecordVoiceOverOutlined';
import SpellcheckOutlinedIcon from '@mui/icons-material/SpellcheckOutlined';
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined';
import QuestionAnswerOutlinedIcon from '@mui/icons-material/QuestionAnswerOutlined';
import ScoreRing from '../../components/ui/ScoreRing';
import EmptyState from '../../components/ui/EmptyState';
import InterviewTimeline from '../../components/interview/InterviewTimeline';
import AIReportPanel from '../../components/interview/AIReportPanel';
import { interviewService } from '../../services/interviewService';
import { aiInterviewService } from '../../services/aiInterviewService';
import { jobService } from '../../services/jobService';
import { interviewTimelineApi } from '../../api/interviewTimelineApi';
import { fmtDate } from '../../utils/formatters';
import { getErrorMessage } from '../../utils/errorUtils';
import { getFavorites, toggleFavorite } from '../../utils/reportPrefs';
import { tokens } from '../../theme/index';
import { useTranslation } from '../../i18n';
import { PremiumCard, PremiumButton } from '../../components/design';

const toItems = (value) => Array.isArray(value) ? value : (value?.items ?? []);
const CAMERA_OR_PROXY_METRIC = /eye\s*contact|facial expression|body language|stress level|emotion stability|culture fit|professionalism|confidence|problem solving|leadership|listening|speech pace/i;
const keepAnswerFocusedItem = (value) => typeof value === 'string' && !CAMERA_OR_PROXY_METRIC.test(value);
const durationMinutes = (session) => session?.startedAt && session?.endedAt
  ? Math.max(0, Math.round((new Date(session.endedAt) - new Date(session.startedAt)) / 60000))
  : null;

function SectionCard({ icon: Icon, title, subtitle, children, accent = tokens.brand[500] }) {
  return (
    <PremiumCard>
      <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: subtitle ? 0.25 : 2 }}>
        {Icon && <Icon sx={{ fontSize: 20, color: accent }} />}
        <Typography fontWeight={700}>{title}</Typography>
      </Stack>
      {subtitle && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>{subtitle}</Typography>}
      {children}
    </PremiumCard>
  );
}

function MetricRow({ label, value, hint }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ py: 0.5 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Stack direction="row" spacing={0.75} alignItems="baseline">
        <Typography fontWeight={750}>{value}</Typography>
        {hint && <Typography variant="caption" color="text.disabled">{hint}</Typography>}
      </Stack>
    </Stack>
  );
}

function ScoreBar({ label, value, color = tokens.brand[500] }) {
  return (
    <Box sx={{ mb: 1.5 }}>
      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
        <Typography variant="caption" fontWeight={600} color="text.secondary">{label}</Typography>
        <Typography variant="caption" fontWeight={700}>{value}%</Typography>
      </Stack>
      <LinearProgress variant="determinate" value={Math.min(100, Math.max(0, value))} sx={{ '& .MuiLinearProgress-bar': { bgcolor: color } }} />
    </Box>
  );
}

export default function ReportViewerPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [report, setReport] = useState(null);
  const [job, setJob] = useState(null);
  const [session, setSession] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [aiReport, setAiReport] = useState(null);
  const [aiReportLoading, setAiReportLoading] = useState(false);
  const [aiReportError, setAiReportError] = useState('');
  const [aiReportGenerating, setAiReportGenerating] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true); setError('');
      try {
        const reportData = await interviewService.reports.getById(id);
        if (!active) return;
        setReport(reportData);
        setIsFavorite(getFavorites().has(reportData.id));

        const [sessionData, allAnswers, timelineEvents] = await Promise.all([
          reportData.interviewSessionId ? interviewService.sessions.getById(reportData.interviewSessionId).catch(() => null) : null,
          interviewService.answers.getAll({ pageSize: 200, interviewSessionId: reportData.interviewSessionId }).catch(() => []),
          interviewTimelineApi.get(reportData.interviewSessionId).catch(() => []),
        ]);
        if (!active) return;
        setSession(sessionData);
        const sessionAnswers = toItems(allAnswers)
          .filter((a) => a.interviewSessionId === reportData.interviewSessionId)
          .sort((a, b) => a.order - b.order);
        setAnswers(sessionAnswers);
        setEvents(toItems(timelineEvents));

        if (sessionData?.jobApplicationId) {
          const application = await interviewService.applications.getById(sessionData.jobApplicationId).catch(() => null);
          if (active && application?.jobId) {
            const jobData = await jobService.getById(application.jobId).catch(() => null);
            if (active) setJob(jobData);
          }
        }
      } catch (requestError) {
        if (active) setError(getErrorMessage(requestError));
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    if (!report?.interviewSessionId) return;
    let active = true;
    (async () => {
      setAiReportLoading(true);
      setAiReportError('');
      try {
        const data = await aiInterviewService.getReport(report.interviewSessionId);
        if (active) setAiReport(data);
      } catch (err) {
        if (active) {
          setAiReport(null);
          if (err?.response?.status !== 404) setAiReportError(getErrorMessage(err));
        }
      } finally {
        if (active) setAiReportLoading(false);
      }
    })();
    return () => { active = false; };
  }, [report?.interviewSessionId]);

  const handleGenerateAIReport = async () => {
    if (!report?.interviewSessionId) return;
    setAiReportGenerating(true);
    setAiReportError('');
    try {
      const data = await aiInterviewService.generateReport(report.interviewSessionId);
      setAiReport(data);
    } catch (err) {
      setAiReportError(getErrorMessage(err));
    } finally {
      setAiReportGenerating(false);
    }
  };

  const radarData = useMemo(() => {
    if (!report?.skillBreakdown || !Object.keys(report.skillBreakdown).length) return null;
    const data = Object.entries(report.skillBreakdown)
      .filter(([skill]) => keepAnswerFocusedItem(skill.replace(/([a-z])([A-Z])/g, '$1 $2')))
      .map(([skill, value]) => ({ skill, value }));
    return data.length ? data : null;
  }, [report]);

  const answerFocusedStrengths = useMemo(() => (report?.strengths || []).filter(keepAnswerFocusedItem), [report]);
  const answerFocusedWeaknesses = useMemo(() => (report?.weaknesses || []).filter(keepAnswerFocusedItem), [report]);
  const answerFocusedRecommendations = useMemo(() => (report?.recommendations || []).filter(keepAnswerFocusedItem), [report]);
  const answerFocusedRoadmap = useMemo(() => (report?.improvementRoadmap || []).filter(keepAnswerFocusedItem), [report]);

  const emotionBarData = useMemo(() => {
    if (!report?.emotionAnalysis?.percentages) return null;
    return Object.entries(report.emotionAnalysis.percentages)
      .map(([emotion, pct]) => ({ emotion, pct }))
      .sort((a, b) => b.pct - a.pct);
  }, [report]);

  const eyeContactSeries = useMemo(() => {
    const timeline = report?.eyeContactAnalysis?.timeline;
    if (!timeline?.length) return null;
    return timeline.map((point) => ({ q: `Q${point.questionOrder}`, pct: point.eyeContactPct }));
  }, [report]);

  const minutes = durationMinutes(session);

  if (loading) {
    return (
      <Box>
        <Skeleton width={120} height={32} sx={{ mb: 2 }} />
        <Skeleton variant="rounded" height={180} sx={{ mb: 2.5 }} />
        <Grid container spacing={3.0}>
          <Grid item xs={12} md={8}><Skeleton variant="rounded" height={420} /></Grid>
          <Grid item xs={12} md={4}><Skeleton variant="rounded" height={420} /></Grid>
        </Grid>
      </Box>
    );
  }

  if (error || !report) {
    return (
      <Box>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/candidate/reports')} sx={{ mb: 2 }}>{t('reportViewer.backToReports')}</Button>
        <Alert severity="error">{error || t('reportViewer.notFound')}</Alert>
      </Box>
    );
  }

  const emotionColorFor = (emotion) => {
    const value = emotion.toLowerCase();
    if (['confident', 'happy'].includes(value)) return tokens.emerald[500];
    if (['neutral'].includes(value)) return tokens.sky[500];
    if (['nervous', 'distracted'].includes(value)) return tokens.amber[500];
    return tokens.rose[500];
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2.5 }} className="no-print">
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/candidate/reports')}>{t('reportViewer.backToReports')}</Button>
        <Stack direction="row" spacing={1}>
          <Tooltip title={isFavorite ? t('reportViewer.removeFromFavorites') : t('reportViewer.addToFavorites')}>
            <IconButton onClick={() => setIsFavorite(toggleFavorite(report.id).has(report.id))} aria-label={t('reportViewer.toggleFavoriteAria')}>
              {isFavorite ? <StarIcon sx={{ color: tokens.amber[500] }} /> : <StarBorderIcon />}
            </IconButton>
          </Tooltip>
          <Button variant="outlined" startIcon={<PrintIcon />} onClick={() => window.print()}>{t('reportViewer.exportPdf')}</Button>
        </Stack>
      </Stack>

      {/* Hero */}
      <Card sx={{ overflow: 'hidden', mb: 2.5 }} className="report-section">
        <Box sx={{ height: 5, background: `linear-gradient(90deg, ${tokens.brand[600]}, ${tokens.mint[500]})` }} />
        <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems={{ sm: 'center' }}>
            <ScoreRing score={report.score} size={120} strokeWidth={10} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h5" fontWeight={800}>{job?.title || t('reportViewer.interviewReportFallback')}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {t('reportViewer.completedOn', { date: fmtDate(report.createdAt) })}{minutes != null ? t('reportViewer.minuteInterview', { minutes }) : ''}
              </Typography>
              <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.75} sx={{ mt: 1.5 }}>
                <Chip label={t('reportViewer.overallScore', { score: report.score })} color="primary" />
                {report.grade && <Chip label={t('reportViewer.grade', { grade: report.grade })} variant="outlined" />}
                <Chip label={t('reportViewer.answeredQuestions', { count: answers.length })} variant="outlined" />
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.25 }}>
                {t('reportViewer.scoreDisclaimer')}
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <AIReportPanel
        aiReport={aiReport}
        loading={aiReportLoading}
        error={aiReportError}
        onGenerate={handleGenerateAIReport}
        generating={aiReportGenerating}
        reportId={report.id}
        questionCount={answers.length}
      />

      <Grid container spacing={3.0}>
        <Grid item xs={12} md={8}>
          <Stack spacing={2.5}>
            {radarData && (
              <SectionCard icon={EmojiEventsOutlinedIcon} title={t('reportViewer.skillBreakdown')} subtitle={t('reportViewer.skillBreakdownSubtitle')}>
                <ResponsiveContainer width="100%" height={280}>
                  <RadarChart data={radarData} outerRadius="75%">
                    <PolarGrid stroke={tokens.ink[200]} />
                    <PolarAngleAxis dataKey="skill" tick={{ fontSize: 11, fill: tokens.ink[500] }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <Radar dataKey="value" stroke={tokens.brand[600]} fill={tokens.brand[500]} fillOpacity={0.35} />
                    <ChartTooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </SectionCard>
            )}

            {report.emotionAnalysis && (
              <SectionCard icon={VisibilityOutlinedIcon} title={t('reportViewer.emotionAnalysis')} subtitle={report.emotionAnalysis.dominantEmotion ? t('reportViewer.dominantEmotion', { emotion: report.emotionAnalysis.dominantEmotion }) : undefined}>
                {emotionBarData?.length ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={emotionBarData} layout="vertical" margin={{ left: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={tokens.ink[100]} horizontal={false} />
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="emotion" width={90} tick={{ fontSize: 11 }} />
                      <ChartTooltip formatter={(v) => `${v}%`} />
                      <Bar dataKey="pct" radius={[0, 6, 6, 0]}>
                        {emotionBarData.map((entry) => <Cell key={entry.emotion} fill={emotionColorFor(entry.emotion)} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <Typography variant="body2" color="text.secondary">{t('reportViewer.noEmotionData')}</Typography>}
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5, lineHeight: 1.6 }}>
                  {t('reportViewer.cameraMetricsCaution')}
                </Typography>
              </SectionCard>
            )}

            {report.eyeContactAnalysis && (
              <SectionCard icon={VisibilityOutlinedIcon} title={t('reportViewer.eyeContact')} subtitle={t('reportViewer.eyeContactSubtitle', { pct: report.eyeContactAnalysis.averageEyeContactPct })}>
                {eyeContactSeries?.length ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={eyeContactSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke={tokens.ink[100]} />
                      <XAxis dataKey="q" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                      <ChartTooltip formatter={(v) => `${v}%`} />
                      <Line type="monotone" dataKey="pct" stroke={tokens.sky[500]} strokeWidth={2.5} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <Typography variant="body2" color="text.secondary">{t('reportViewer.noEyeContactData')}</Typography>}
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5, lineHeight: 1.6 }}>
                  {t('reportViewer.cameraMetricsCaution')}
                </Typography>
                {!!report.eyeContactAnalysis.recommendations?.length && (
                  <Stack spacing={0.5} sx={{ mt: 2 }}>
                    {report.eyeContactAnalysis.recommendations.map((rec, i) => (
                      <Typography key={i} variant="body2" color="text.secondary">• {rec}</Typography>
                    ))}
                  </Stack>
                )}
              </SectionCard>
            )}

            {report.speechAnalysis && (
              <SectionCard icon={RecordVoiceOverOutlinedIcon} title={t('reportViewer.speechPacing')}>
                <Grid container spacing={2}>
                  <Grid item xs={6} sm={3}><MetricRow label={t('reportViewer.pace')} value={t('reportViewer.paceValue', { wpm: report.speechAnalysis.wordsPerMinute })} /></Grid>
                  <Grid item xs={6} sm={3}><MetricRow label={t('reportViewer.fillerWords')} value={report.speechAnalysis.fillerWordCount} /></Grid>
                  <Grid item xs={6} sm={3}><MetricRow label={t('reportViewer.longestPause')} value={t('reportViewer.secondsValue', { sec: report.speechAnalysis.longestPauseSec })} /></Grid>
                  <Grid item xs={6} sm={3}><MetricRow label={t('reportViewer.averagePause')} value={t('reportViewer.secondsValue', { sec: report.speechAnalysis.averagePauseSec })} /></Grid>
                </Grid>
                <Divider sx={{ my: 2 }} />
                <ScoreBar label={t('reportViewer.clarity')} value={report.speechAnalysis.clarity} color={tokens.brand[500]} />
                <ScoreBar label={t('reportViewer.fluency')} value={report.speechAnalysis.fluency} color={tokens.mint[500]} />
                <ScoreBar label={t('reportViewer.speakingConfidence')} value={report.speechAnalysis.speakingConfidence} color={tokens.sky[500]} />
              </SectionCard>
            )}

            {report.grammarAnalysis && (
              <SectionCard icon={SpellcheckOutlinedIcon} title={t('reportViewer.grammar')} subtitle={t('reportViewer.grammarSubtitle', { issues: report.grammarAnalysis.totalIssueCount, answered: report.grammarAnalysis.answeredWithGrammarDataCount })}>
                <ScoreBar label={t('reportViewer.averageGrammarScore')} value={report.grammarAnalysis.averageScore} color={tokens.brand[500]} />
              </SectionCard>
            )}

            {report.starAnalysis && (
              <SectionCard icon={EmojiEventsOutlinedIcon} title={t('reportViewer.starCoverage')} subtitle={t('reportViewer.starSubtitle', { score: report.starAnalysis.averageScore })}>
                <Grid container spacing={2}>
                  <Grid item xs={6} sm={3}><ScoreBar label={t('reportViewer.situation')} value={report.starAnalysis.situationCoveragePct} color={tokens.sky[500]} /></Grid>
                  <Grid item xs={6} sm={3}><ScoreBar label={t('reportViewer.task')} value={report.starAnalysis.taskCoveragePct} color={tokens.brand[500]} /></Grid>
                  <Grid item xs={6} sm={3}><ScoreBar label={t('reportViewer.action')} value={report.starAnalysis.actionCoveragePct} color={tokens.mint[500]} /></Grid>
                  <Grid item xs={6} sm={3}><ScoreBar label={t('reportViewer.result')} value={report.starAnalysis.resultCoveragePct} color={tokens.amber[500]} /></Grid>
                </Grid>
              </SectionCard>
            )}

            <SectionCard icon={QuestionAnswerOutlinedIcon} title={t('reportViewer.questionBreakdown')} subtitle={t('reportViewer.questionBreakdownSubtitle')}>
              {answers.length ? (
                <Stack spacing={1.25}>
                  {answers.map((answer) => (
                    <Box key={answer.id} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
                        <Chip label={t('reportViewer.questionShort', { order: answer.order })} size="small" color="primary" />
                        <Typography variant="body2" fontWeight={700}>{answer.question}</Typography>
                      </Stack>
                      <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>{answer.answer}</Typography>
                      {(answer.starScore != null || answer.starComponentsDetected) && (
                        <Box sx={{ mt: 1.25 }}>
                          <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: 'block', mb: 0.75 }}>
                            {t('reportViewer.answerEvidence')}
                          </Typography>
                          <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.75}>
                            {answer.starScore != null && (
                              <Chip size="small" variant="outlined" color="primary" label={t('reportViewer.starAnswerScore', { score: answer.starScore })} />
                            )}
                            {[
                              ['S', t('reportViewer.situation')],
                              ['T', t('reportViewer.task')],
                              ['A', t('reportViewer.action')],
                              ['R', t('reportViewer.result')],
                            ].filter(([code]) => (answer.starComponentsDetected || '').includes(code)).map(([code, label]) => (
                              <Chip key={code} size="small" variant="outlined" label={label} />
                            ))}
                          </Stack>
                        </Box>
                      )}
                    </Box>
                  ))}
                </Stack>
              ) : <EmptyState title={t('reportViewer.noSavedAnswers')} description={t('reportViewer.noSavedAnswersDescription')} icon={QuestionAnswerOutlinedIcon} />}
            </SectionCard>

            <SectionCard icon={QuestionAnswerOutlinedIcon} title={t('reportViewer.interviewTimeline')} subtitle={t('reportViewer.interviewTimelineSubtitle')}>
              <InterviewTimeline events={events} />
            </SectionCard>
          </Stack>
        </Grid>

        <Grid item xs={12} md={4}>
          <Stack spacing={2.5}>
            {!!answerFocusedStrengths.length && (
              <SectionCard icon={ThumbUpAltOutlinedIcon} title={t('reportViewer.strengths')} accent={tokens.emerald[500]}>
                <Stack spacing={1}>
                  {answerFocusedStrengths.map((item, i) => (
                    <Typography key={i} variant="body2" sx={{ color: 'success.dark' }}>• {item}</Typography>
                  ))}
                </Stack>
              </SectionCard>
            )}

            {!!answerFocusedWeaknesses.length && (
              <SectionCard icon={FlagCircleOutlinedIcon} title={t('reportViewer.areasToImprove')} accent={tokens.rose[500]}>
                <Stack spacing={1}>
                  {answerFocusedWeaknesses.map((item, i) => (
                    <Typography key={i} variant="body2" sx={{ color: 'error.dark' }}>• {item}</Typography>
                  ))}
                </Stack>
              </SectionCard>
            )}

            {!!answerFocusedRecommendations.length && (
              <SectionCard icon={LightbulbOutlinedIcon} title={t('reportViewer.recommendations')} accent={tokens.amber[500]}>
                <Stack spacing={1}>
                  {answerFocusedRecommendations.map((item, i) => (
                    <Typography key={i} variant="body2" color="text.secondary">• {item}</Typography>
                  ))}
                </Stack>
              </SectionCard>
            )}

            {!!answerFocusedRoadmap.length && (
              <SectionCard icon={EmojiEventsOutlinedIcon} title={t('reportViewer.improvementRoadmap')} accent={tokens.brand[500]}>
                <Stack spacing={1.5}>
                  {answerFocusedRoadmap.map((item, i) => (
                    <Stack key={i} direction="row" spacing={1.25} alignItems="flex-start">
                      <Avatar sx={{ width: 22, height: 22, fontSize: '0.7rem', bgcolor: tokens.brand[100], color: tokens.brand[700] }}>{i + 1}</Avatar>
                      <Typography variant="body2" color="text.secondary">{item}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </SectionCard>
            )}

            {report.feedback && (
              <SectionCard icon={QuestionAnswerOutlinedIcon} title={t('reportViewer.feedback')}>
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{report.feedback}</Typography>
              </SectionCard>
            )}
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}
