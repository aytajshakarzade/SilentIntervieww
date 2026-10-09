import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Button, Typography, LinearProgress, IconButton, Chip, CircularProgress,
  Alert, Paper, Stack, Tooltip,
} from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import SpeedIcon from '@mui/icons-material/Speed';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PsychologyIcon from '@mui/icons-material/Psychology';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';

import { jobService } from '../../services/jobService';
import { useAIInterview } from '../../hooks/useAIInterview';
import { useAIOrchestrator, AI_IS } from '../../hooks/useAIOrchestrator';
import { useCandidateProfile } from '../../hooks/useCandidateProfile';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { useMicrophone } from '../../hooks/useMicrophone';
import { useTimer } from '../../hooks/useTimer';
import { useInterviewAnalytics } from '../../hooks/useInterviewAnalytics';
import { useCamera } from '../../hooks/useCamera';
import { useEyeContact } from '../../hooks/useEyeContact';
import { useEmotion } from '../../hooks/useEmotion';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { ROUTES } from '../../constants/routes';
import { fmtDuration } from '../../utils/formatters';
import CameraPreview from '../../components/interview/CameraPreview';
import MicrophoneIndicator from '../../components/interview/MicrophoneIndicator';
import EyeContactIndicator from '../../components/interview/EyeContactIndicator';
import EmotionIndicator from '../../components/interview/EmotionIndicator';
import SpeechStatus from '../../components/interview/SpeechStatus';
import { useTranslation } from '../../i18n';
import { UI_LABELS } from '../../constants/interviewUiLabels';
import { MicWave, LanguageSelector } from '../../components/interview/InterviewUIShared';
import {
  AIInterviewerAvatar, AIThinkingIndicator, SectionTypeChip, ConversationHistory,
} from '../../components/interview/AIInterviewerPanel';
import { PremiumCard, PremiumButton } from '../../components/design';
import UpgradeLimitCard from '../../components/billing/UpgradeLimitCard';

function speechErrorLabelLocal(errorCode, fallbackMessage, t) {
  const map = {
    'no-speech': t.errSpeechNoSpeech,
    'audio-capture': t.errSpeechAudioCapture,
    'network': t.errSpeechNetwork,
    'not-allowed': t.errSpeechNotAllowed,
    'service-not-allowed': t.errSpeechServiceNotAllowed,
    'language-not-supported': t.errSpeechLangNotSupported,
    'aborted': t.errSpeechAborted,
    'max-restarts': t.errSpeechMaxRestarts,
    'start-failed': t.errSpeechStartFailed,
  };
  return map[errorCode] || fallbackMessage;
}

export default function AIInterviewRoomPage() {
  const { id: jobId } = useParams();
  const navigate = useNavigate();
  const { language: locale } = useTranslation();
  const t = UI_LABELS[locale] || UI_LABELS.en;

  const [job, setJob] = useState(null);
  const [jobLoading, setJobLoading] = useState(true);
  const [jobError, setJobError] = useState(null);
  const { profile, loading: profileLoading, ensureProfile } = useCandidateProfile();

  // The interview language is defined by the vacancy configuration selected
  // by the recruiter. Candidate UI locale may change independently, but it
  // must never change the language of an already-configured interview.
  const interviewLanguage = job?.language || 'en';

  useEffect(() => {
    let cancelled = false;
    const loadJob = async () => {
      if (!jobId) {
        setJob(null);
        setJobLoading(false);
        setJobError('Missing job id.');
        return;
      }

      setJobLoading(true);
      setJobError(null);
      try {
        const data = await jobService.getById(jobId);
        if (!cancelled) setJob(data || null);
      } catch (error) {
        if (!cancelled) {
          setJob(null);
          setJobError(error?.message || 'Job could not be loaded.');
        }
      } finally {
        if (!cancelled) setJobLoading(false);
      }
    };

    loadJob();
    return () => { cancelled = true; };
  }, [jobId]);
  const interview = useAIInterview(job, profile, interviewLanguage);

  const { seconds, elapsed, start: startTimer, stop: stopTimer } = useTimer(900);

  const { stats, onSpeakingStart, onSpeakingStop, resetTracker } = useInterviewAnalytics(
    interview.currentAnswer || '',
    elapsed,
  );

  const mic = useMicrophone({ onSpeakingStart, onSpeakingStop });
  const camera = useCamera();
  const eyeContact = useEyeContact();
  const emotion = useEmotion();
  const sr = useSpeechRecognition(interviewLanguage);

  const [showConversation, setShowConversation] = useState(true);

  const {
    state, initError, isOffline, timerPaused,
    startInterview, submitAndAdvance, submitInterview, toggleTimerPause,
  } = useAIOrchestrator({
    jobId, interview, sr, mic, camera, eyeContact, emotion,
    timer: { start: startTimer, stop: stopTimer },
    analytics: { stats, resetTracker },
    navigate, ensureProfile, resultsRoute: ROUTES.CANDIDATE_RESULTS, t,
  });

  const handleToggleSpeech = useCallback(() => {
    if (state !== AI_IS.RUNNING) return;
    if (sr.listening) {
      sr.stop();
    } else {
      sr.start(interview.currentAnswer || '', (text) => interview.setAnswer(text));
    }
  }, [state, sr, interview]);

  const handleAdvance = useCallback(async () => {
    // submitAndAdvance handles the interviewComplete case internally:
    // it transitions directly to SUBMITTING and calls finishInterview() exactly once.
    await submitAndAdvance();
  }, [submitAndAdvance]);

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (jobLoading || profileLoading) return <LoadingSpinner fullPage message={t.loading} />;

  if (!job) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Alert severity="error">{jobError || t.jobNotFound}</Alert>
        <Button sx={{ mt: 2 }} onClick={() => navigate(ROUTES.CANDIDATE_INTERVIEWS)}>
          {t.backToInterviews}
        </Button>
      </Box>
    );
  }

  // ─── Pre-start screen ─────────────────────────────────────────────────────
  if (state === AI_IS.READY || state === AI_IS.INITIALIZING) {
    return (
      <Box sx={{ maxWidth: 620, mx: 'auto', py: { xs: 2, sm: 5 } }}>
        <Paper
          elevation={0}
          sx={{
            border: '1px solid', borderColor: 'divider', borderRadius: 4,
            overflow: 'hidden', textAlign: 'center',
            boxShadow: '0 20px 48px rgba(15,15,20,0.08)',
          }}
        >
          <Box
            sx={{
              background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
              color: '#fff', px: 4, py: 4.5, position: 'relative',
            }}
          >
            <Chip
              label={job.language === 'ru' ? 'Русский' : job.language === 'az' ? 'Azərbaycan dili' : 'English'}
              size="small"
              sx={{
                position: 'absolute', top: 14, right: 14,
                color: '#fff', borderColor: 'rgba(255,255,255,0.45)',
                bgcolor: 'rgba(255,255,255,0.10)',
                fontWeight: 700,
              }}
              variant="outlined"
            />
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
              <AIInterviewerAvatar thinking={state === AI_IS.STARTING} name="AI Interviewer" />
            </Box>
            <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: '-0.02em', mt: 1 }}>
              {job.title}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.85 }}>
              AI-Powered Adaptive Interview
            </Typography>
          </Box>

          <Box sx={{ p: 4 }}>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" justifyContent="center" sx={{ mb: 2.5 }}>
              {job.experience && (
                <Chip label={`Təcrübə: ${job.experience}`} size="small" variant="outlined" />
              )}
              {job.difficulty && (
                <Chip label={`Çətinlik: ${job.difficulty}`} size="small" variant="outlined" />
              )}
              {job.estimatedDuration && (
                <Chip label={`${job.estimatedDuration} dəqiqə`} size="small" variant="outlined" />
              )}
            </Stack>

            {job.skills && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, lineHeight: 1.6 }}>
                <strong>Müsahibə bacarıq fokusu:</strong> {job.skills}
              </Typography>
            )}

            <Typography color="text.secondary" sx={{ mb: 3, lineHeight: 1.75 }}>
              An AI interviewer will ask you a personalized set of questions based on this role,
              adapt follow-ups based on what you say, and produce a detailed hiring report when you finish.
              Your camera and microphone will be used.
            </Typography>

            {initError && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{initError}</Alert>}

            <Stack direction="row" spacing={1.5} justifyContent="center">
              <PremiumButton variant="outlined" onClick={() => navigate(ROUTES.CANDIDATE_INTERVIEWS)}>
                {t.cancel}
              </PremiumButton>
              <PremiumButton
                variant="contained"
                onClick={() => startInterview()}
                disabled={state === AI_IS.STARTING}
              >
                {state === AI_IS.STARTING ? <CircularProgress size={20} color="inherit" /> : t.startFresh}
              </PremiumButton>
            </Stack>
          </Box>
        </Paper>
      </Box>
    );
  }

  // ─── Error ────────────────────────────────────────────────────────────────
  if (state === AI_IS.ERROR) {
    if (initError === 'PLAN_LIMIT_REACHED') {
      return (
        <Box sx={{ p: { xs: 2, sm: 4 }, maxWidth: 860, mx: 'auto', mt: { xs: 1, sm: 4 } }}>
          <UpgradeLimitCard resource="interviews" title="Aylıq müsahibə limitiniz bitib" />
        </Box>
      );
    }
    return (
      <Box sx={{ p: 4, textAlign: 'center', maxWidth: 480, mx: 'auto', mt: { xs: 2, sm: 6 } }}>
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2, textAlign: 'left' }}>
          {initError || t.errUnexpected}
        </Alert>
        <PremiumButton variant="contained" onClick={() => navigate(ROUTES.CANDIDATE_INTERVIEWS)}>
          {t.backToInterviews}
        </PremiumButton>
      </Box>
    );
  }

  // ─── Active interview ─────────────────────────────────────────────────────
  if (state === AI_IS.STARTING || state === AI_IS.RUNNING || state === AI_IS.CHANGING_QUESTION || state === AI_IS.SUBMITTING) {
    const timerWarning = seconds < 120;
    const isBusy = state === AI_IS.SUBMITTING || state === AI_IS.CHANGING_QUESTION || interview.thinking;
    const isSubmitting = state === AI_IS.SUBMITTING;

    return (
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '336px 1fr' },
          gap: { xs: 2, md: 3 },
          minHeight: 'calc(100vh - 128px)',
          alignItems: 'start',
        }}
      >
        {/* ── Left panel — camera / mic / eye contact / emotion / timer: unchanged device logic ── */}
        <Box sx={{
          position: { md: 'sticky' }, top: 80, display: 'flex', flexDirection: 'column', gap: 1.75,
          maxHeight: { md: 'calc(100vh - 96px)' }, overflowY: { md: 'auto' }, pr: { md: 0.5 },
          '&::-webkit-scrollbar': { width: 5 },
          '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 3 },
        }}>
          <Box sx={{ width: '100%', minHeight: 189, flexShrink: 0 }}>
            <CameraPreview
              videoRef={camera.videoRef}
              stream={camera.stream}
              hasStream={Boolean(camera.stream)}
              videoReady={camera.videoReady}
              videoEnabled={camera.videoEnabled}
              cameras={camera.cameras}
              onToggleVideo={camera.toggleVideo}
              onSwitchCamera={camera.switchCamera}
              t={t}
            />
          </Box>

          <Paper
            elevation={0}
            sx={{
              border: '1px solid',
              borderColor: mic.speaking ? 'success.main' : 'divider',
              borderRadius: 2, p: 1.5,
              transition: 'border-color 200ms ease',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                {t.microphone}
              </Typography>
              {sr.listening && (
                <Chip
                  label={t.rec} size="small" color="error"
                  sx={{
                    fontSize: '0.58rem', height: 18, fontWeight: 700,
                    animation: 'recordPulse 1.5s infinite',
                    '& .MuiChip-label': { px: 0.75 },
                  }}
                />
              )}
            </Box>
            <MicrophoneIndicator active={mic.active} level={mic.level} speaking={mic.speaking} t={t} />
          </Paper>

          <Paper
            elevation={0}
            sx={{
              border: '1px solid',
              borderColor: eyeContact.status.lookingAwayWarn ? 'error.main' : 'divider',
              borderRadius: 2, p: 1.75,
              transition: 'border-color 300ms ease',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
              <VisibilityIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                {t.eyeContact}
              </Typography>
              {eyeContact.status.eyeContactPct !== null && (
                <Typography
                  variant="caption"
                  sx={{
                    ml: 'auto', fontWeight: 700,
                    color: eyeContact.status.eyeContactPct >= 70 ? 'success.main' : 'warning.main',
                  }}
                >
                  {eyeContact.status.eyeContactPct}%
                </Typography>
              )}
            </Box>
            <EyeContactIndicator
              status={eyeContact.status}
              loading={eyeContact.loading}
              error={eyeContact.error === 'Eye contact detection unavailable.' ? t.errEyeContactUnavailable : eyeContact.error}
              active={eyeContact.active}
              t={t}
            />
          </Paper>

          <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.75 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
              <PsychologyIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                {t.emotion}
              </Typography>
              <Typography variant="caption" color="text.disabled" sx={{ ml: 'auto', fontSize: '0.6rem' }}>
                {t.approxOnly}
              </Typography>
            </Box>
            <EmotionIndicator
              result={emotion.result}
              loading={emotion.loading}
              error={emotion.error === 'Emotion detection unavailable.' ? t.errEmotionUnavailable : emotion.error}
              active={emotion.active}
              t={t}
            />
          </Paper>

          <Paper
            elevation={0}
            sx={{
              border: '1px solid',
              borderColor: timerWarning ? 'warning.main' : 'divider',
              borderRadius: 2, p: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AccessTimeIcon sx={{ fontSize: 16, color: timerWarning ? 'warning.main' : 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary">{t.timeRemaining}</Typography>
              <Box sx={{ ml: 'auto' }}>
                <Tooltip title={timerPaused ? 'Resume timer' : 'Pause timer'}>
                  <IconButton size="small" onClick={toggleTimerPause} sx={{ p: 0.25 }}>
                    {timerPaused
                      ? <PlayArrowIcon sx={{ fontSize: 14, color: 'success.main' }} />
                      : <PauseIcon sx={{ fontSize: 14, color: 'text.secondary' }} />}
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
            <Typography
              variant="h5" fontWeight={700}
              sx={{
                fontFamily: 'monospace',
                color: timerPaused ? 'text.disabled' : timerWarning ? 'warning.main' : 'text.primary',
                mt: 0.5,
              }}
            >
              {fmtDuration(seconds)}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={(seconds / 900) * 100}
              color={timerWarning ? 'warning' : 'primary'}
              sx={{ mt: 1 }}
            />
          </Paper>

          <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="caption" color="text.secondary">{t.progress}</Typography>
              <Typography variant="caption" fontWeight={600}>
                {interview.answeredCount} {t.of} {interview.totalPlanned || '…'}
              </Typography>
            </Box>
            <LinearProgress variant="determinate" value={interview.progress} sx={{ height: 6, borderRadius: 3 }} />
          </Paper>

          <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.5 }}>
              <SpeedIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                {t.liveAnalytics}
              </Typography>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, mb: 1 }}>
              {[
                [stats.wordCount, t.words],
                [stats.charCount, t.chars2],
                [stats.wpm > 0 ? stats.wpm : '—', t.wpm],
              ].map(([val, label]) => (
                <Box key={label} sx={{ textAlign: 'center' }}>
                  <Typography variant="body2" fontWeight={700} sx={{ lineHeight: 1.2 }}>{val}</Typography>
                  <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.6rem' }}>{label}</Typography>
                </Box>
              ))}
            </Box>
            {stats.fillerWordCount > 0 && (
              <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.75, fontSize: '0.68rem' }}>
                ⚠ {stats.fillerWordCount} {t.filler} {stats.fillerWordCount === 1 ? t.fillerWord : t.fillerWords}
              </Typography>
            )}
          </Paper>
        </Box>

        {/* ── Right panel — AI interviewer, question, conversation history ── */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {isOffline && (
            <Alert severity="warning" icon={<WifiOffIcon fontSize="small" />}>
              {t.offline}
            </Alert>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <LanguageSelector value={interviewLanguage} onChange={() => {}} disabled />
          </Box>

          {/* AI Interviewer header + question card */}
          <Paper
            elevation={0}
            sx={{
              border: '1px solid', borderColor: 'primary.main',
              borderRadius: 3, p: 3,
              background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
              color: 'white',
              boxShadow: '0 12px 28px rgba(79,70,229,0.28)',
              transition: 'box-shadow 250ms ease',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <AIInterviewerAvatar thinking={interview.thinking} />
              {interview.currentSectionType && <SectionTypeChip type={interview.currentSectionType} />}
            </Box>

            {interview.thinking ? (
              <Box sx={{ py: 1 }}>
                <AIThinkingIndicator label="Preparing your next question" />
              </Box>
            ) : (
              <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.5 }}>
                {interview.isFollowUp && (
                  <Chip
                    label="Follow-up"
                    size="small"
                    sx={{ mb: 1, bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontSize: '0.65rem' }}
                  />
                )}
                <Box component="span" sx={{ display: 'block' }}>
                  {interview.currentQuestionText}
                </Box>
              </Typography>
            )}
          </Paper>

          {/* Answer */}
          <Paper
            elevation={0}
            sx={{
              border: '1px solid', borderColor: 'divider', borderRadius: 3, p: 3,
              transition: 'border-color 200ms ease',
              opacity: interview.thinking ? 0.6 : 1,
              pointerEvents: interview.thinking ? 'none' : 'auto',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography variant="subtitle2" fontWeight={600}>{t.yourAnswer}</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <MicWave active={sr.recognizing} />
                {sr.supported && (
                  <Tooltip title={sr.listening ? t.stopMicrophone : t.speakAnswer}>
                    <IconButton
                      onClick={handleToggleSpeech}
                      size="small"
                      color={sr.listening ? 'error' : 'default'}
                      sx={sr.listening ? { animation: 'recordPulse 1.5s infinite' } : {}}
                    >
                      {sr.listening ? <MicIcon fontSize="small" /> : <MicOffIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                )}
                <Typography variant="caption" color="text.disabled">
                  {stats.charCount} {t.chars}
                </Typography>
              </Box>
            </Box>

            <Box
              component="textarea"
              value={
                sr.listening && sr.interim
                  ? ((interview.currentAnswer || '').trimEnd() + ' ' + sr.interim).trim()
                  : (interview.currentAnswer || '')
              }
              onChange={(e) => {
                if (!sr.listening) interview.setAnswer(e.target.value);
              }}
              readOnly={sr.listening}
              placeholder={sr.listening ? t.listenPlaceholder : t.typePlaceholder}
              rows={8}
              sx={{
                width: '100%', p: 2,
                border: '1px solid',
                borderColor: sr.listening ? 'primary.main' : 'divider',
                borderRadius: 2,
                fontSize: '0.95rem', fontFamily: 'Inter, sans-serif',
                lineHeight: 1.7, resize: 'vertical', outline: 'none',
                bgcolor: sr.listening ? 'action.hover' : 'background.default',
                color: 'text.primary',
                cursor: sr.listening ? 'default' : 'text',
                transition: 'border-color 200ms ease, background-color 200ms ease',
                '&:focus': { borderColor: 'primary.main', boxShadow: '0 0 0 3px rgba(79,70,229,0.1)' },
                boxSizing: 'border-box',
              }}
            />

            <SpeechStatus
              listening={sr.listening}
              interim={sr.interim}
              error={sr.error ? speechErrorLabelLocal(sr.errorCode, sr.error, t) : null}
              t={t}
            />
          </Paper>

          {interview.error && <Alert severity="error">{interview.error}</Alert>}

          {/* Navigation */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: { xs: 1, md: 0 } }}>
            <Button
              size="small"
              onClick={() => setShowConversation((v) => !v)}
              sx={{ textTransform: 'none' }}
            >
              {showConversation ? 'Hide conversation' : 'Show conversation'} ({interview.history.length})
            </Button>
            <Box sx={{ flex: 1 }} />
            <Button
              variant="contained"
              endIcon={isBusy ? <CircularProgress size={16} color="inherit" /> : <NavigateNextIcon />}
              onClick={handleAdvance}
              disabled={isBusy || !interview.currentAnswer?.trim()}
              sx={{ px: 3.5 }}
            >
              {isSubmitting ? t.submitting : (isBusy ? 'Processing…' : t.next)}
            </Button>
          </Box>

          {/* Conversation history */}
          {showConversation && (
            <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, p: 2.5 }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
                Conversation History
              </Typography>
              <ConversationHistory history={interview.history} t={t} />
            </Paper>
          )}
        </Box>
      </Box>
    );
  }

  return null;
}