import { useEffect, useState } from 'react';
import {
  Alert, Box, Card, CardContent, Chip, Stack, Typography, Accordion,
  AccordionSummary, AccordionDetails, Grid, LinearProgress, List, ListItem,
  ListItemIcon, ListItemText, Divider, TextField,
} from '@mui/material';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PsychologyOutlinedIcon from '@mui/icons-material/PsychologyOutlined';
import RecordVoiceOverOutlinedIcon from '@mui/icons-material/RecordVoiceOverOutlined';
import EngineeringOutlinedIcon from '@mui/icons-material/EngineeringOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import WorkOutlineIcon from '@mui/icons-material/WorkOutline';
import ExtensionOutlinedIcon from '@mui/icons-material/ExtensionOutlined';
import QuestionAnswerOutlinedIcon from '@mui/icons-material/QuestionAnswerOutlined';
import { tokens } from '../../theme/index';
import { useTranslation } from '../../i18n';

function AIExpandableSection({ icon: Icon, title, children, defaultExpanded = false, accent }) {
  return (
    <Accordion
      defaultExpanded={defaultExpanded}
      elevation={0}
      className="report-section"
      sx={{
        border: '1px solid', borderColor: 'divider', borderRadius: '12px !important',
        mb: 1.25, overflow: 'hidden', '&:before': { display: 'none' },
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={1.25} alignItems="center">
          {Icon && <Icon sx={{ fontSize: 19, color: accent || tokens.brand[500] }} />}
          <Typography fontWeight={700} variant="body2">{title}</Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0 }}>{children}</AccordionDetails>
    </Accordion>
  );
}

function EvidenceGauge({ label, value, hint }) {
  const safeValue = Math.min(100, Math.max(0, Number(value) || 0));
  const color = safeValue >= 75 ? tokens.emerald[500] : safeValue >= 50 ? tokens.amber[500] : tokens.rose[500];
  return (
    <Box sx={{ mb: 0.5 }}>
      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.6 }}>
        <Typography variant="caption" color="text.secondary" fontWeight={700}>{label}</Typography>
        <Typography variant="caption" fontWeight={800}>{safeValue}%</Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={safeValue}
        sx={{ height: 7, borderRadius: 4, '& .MuiLinearProgress-bar': { bgcolor: color } }}
      />
      {hint && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>{hint}</Typography>}
    </Box>
  );
}

function PracticeNotes({ reportId, t }) {
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(true);

  useEffect(() => {
    if (!reportId) return;
    try {
      setNotes(localStorage.getItem(`candidate-practice-notes-${reportId}`) || '');
      setSaved(true);
    } catch { /* local storage may be unavailable */ }
  }, [reportId]);

  const handleChange = (event) => {
    setNotes(event.target.value);
    setSaved(false);
  };

  const handleBlur = () => {
    try {
      localStorage.setItem(`candidate-practice-notes-${reportId}`, notes);
      setSaved(true);
    } catch { setSaved(false); }
  };

  return (
    <Card className="report-section no-print">
      <CardContent>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
          <EditNoteOutlinedIcon sx={{ fontSize: 18, color: tokens.brand[500] }} />
          <Typography fontWeight={700} variant="body2">{t('aiReportPanel.practiceNotes')}</Typography>
          <Chip size="small" variant="outlined" label={saved ? t('aiReportPanel.savedInBrowser') : t('aiReportPanel.unsaved')} sx={{ ml: 'auto' }} />
        </Stack>
        <TextField
          fullWidth multiline minRows={3}
          placeholder={t('aiReportPanel.practiceNotesPlaceholder')}
          value={notes}
          onChange={handleChange}
          onBlur={handleBlur}
        />
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          {t('aiReportPanel.practiceNotesHelp')}
        </Typography>
      </CardContent>
    </Card>
  );
}

const NON_JOB_SIGNAL = /eye\s*contact|facial expression|body language|stress level|emotion|culture fit|cultural|confidence|salary|hiring recommendation|pass probability/i;
const isEvidenceItem = (item) => typeof item === 'string' && !NON_JOB_SIGNAL.test(item);

function EvidenceList({ items, emptyText, icon: Icon, color }) {
  if (!items?.length) {
    return <Typography variant="body2" color="text.secondary">{emptyText}</Typography>;
  }
  return (
    <List dense disablePadding>
      {items.map((item, index) => (
        <ListItem key={`${index}-${item}`} disableGutters sx={{ py: 0.45, alignItems: 'flex-start' }}>
          <ListItemIcon sx={{ minWidth: 26, mt: 0.25 }}>
            <Icon sx={{ fontSize: 16, color }} />
          </ListItemIcon>
          <ListItemText primary={<Typography variant="body2" sx={{ lineHeight: 1.65 }}>{item}</Typography>} />
        </ListItem>
      ))}
    </List>
  );
}

/** Candidate-facing, evidence-led feedback. Hiring decisions and private recruiter notes
 * intentionally do not appear on the candidate report route. */
export default function AIReportPanel({ aiReport, loading, error, onGenerate, generating, reportId, questionCount = 0 }) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <Card sx={{ mb: 2.5, p: 3 }} className="report-section">
        <Typography fontWeight={700} sx={{ mb: 1.5 }}>{t('aiReportPanel.title')}</Typography>
        <LinearProgress />
      </Card>
    );
  }

  if (!aiReport) {
    return (
      <Card sx={{ mb: 2.5 }} className="report-section no-print">
        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <AutoAwesomeIcon sx={{ color: tokens.brand[500] }} />
          <Box sx={{ flex: 1, minWidth: 200 }}>
            <Typography fontWeight={800}>{t('aiReportPanel.title')}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {error || t('aiReportPanel.generateDescription')}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
              {t('aiReportPanel.evidenceBasis', { count: questionCount })}
            </Typography>
          </Box>
          <Box
            component="button"
            onClick={onGenerate}
            disabled={generating}
            sx={{
              border: 'none', borderRadius: 2, px: 2.5, py: 1.1,
              cursor: generating ? 'not-allowed' : 'pointer',
              bgcolor: tokens.brand[500], color: 'white', fontWeight: 700,
              fontSize: '0.85rem', fontFamily: 'inherit', opacity: generating ? 0.7 : 1,
            }}
          >
            {generating ? t('aiReportPanel.generating') : t('aiReportPanel.generateButton')}
          </Box>
        </CardContent>
      </Card>
    );
  }

  const isFallback = aiReport.isFallback === true;
  const notEnoughEvidence = t('aiReportPanel.notEnoughEvidence');
  const bodyTextSx = { lineHeight: 1.75, whiteSpace: 'pre-wrap' };
  const safeStrengths = (aiReport.strengths || []).filter(isEvidenceItem);
  const safeWeaknesses = (aiReport.weaknesses || []).filter(isEvidenceItem);
  const safeValidationItems = isFallback ? [] : (aiReport.riskFactors || []).filter(isEvidenceItem);
  const collaborationText = typeof aiReport.cultureFit === 'string' ? aiReport.cultureFit : '';
  const hasAnswerEvidence = /\[?Q\d+\]?/i.test(collaborationText);
  const hasCultureJudgment = /culture\s*fit|cultural|mədəni uyğ|культурн/i.test(collaborationText);
  const showCollaboration = !isFallback && hasAnswerEvidence && !hasCultureJudgment && isEvidenceItem(collaborationText);

  return (
    <Box sx={{ mb: 2.5 }}>
      {isFallback && (
        <Alert severity="warning" icon={<InfoOutlinedIcon />} sx={{ mb: 2, borderRadius: 2 }}>
          <Typography variant="body2" fontWeight={700}>{t('aiReportPanel.fallbackTitle')}</Typography>
          <Typography variant="body2" sx={{ mt: 0.25 }}>{t('aiReportPanel.fallbackBody')}</Typography>
        </Alert>
      )}

      <Card sx={{ overflow: 'hidden', mb: 2 }} className="report-section">
        <Box sx={{ height: 4, bgcolor: isFallback ? tokens.amber[500] : tokens.brand[500] }} />
        <CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1.5 }}>
            <AutoAwesomeIcon sx={{ color: isFallback ? tokens.amber[500] : tokens.brand[500] }} />
            <Typography variant="h6" fontWeight={800}>{t('aiReportPanel.summaryTitle')}</Typography>
            <Chip label={isFallback ? t('aiReportPanel.fallbackChip') : t('aiReportPanel.aiAssistedChip')} size="small" variant="outlined" sx={{ ml: 'auto' }} />
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ ...bodyTextSx, mb: 2 }}>
            {isFallback ? t('aiReportPanel.fallbackSummary') : (aiReport.executiveSummary || notEnoughEvidence)}
          </Typography>

          {!isFallback && aiReport.confidenceScore != null && (
            <Box sx={{ maxWidth: 560, mt: 2 }}>
              <EvidenceGauge
                label={t('aiReportPanel.evidenceConfidence')}
                value={aiReport.confidenceScore}
                hint={t('aiReportPanel.evidenceConfidenceHint')}
              />
            </Box>
          )}

          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
            {t('aiReportPanel.evidenceBasis', { count: questionCount })}
          </Typography>
        </CardContent>
      </Card>

      <Alert severity="info" icon={<InfoOutlinedIcon />} sx={{ mb: 2, borderRadius: 2 }}>
        <Typography variant="body2" fontWeight={700}>{t('aiReportPanel.fairnessTitle')}</Typography>
        <Typography variant="body2" sx={{ mt: 0.25 }}>{t('aiReportPanel.fairnessBody')}</Typography>
      </Alert>

      <AIExpandableSection icon={ExtensionOutlinedIcon} title={t('aiReportPanel.profileTitle')} defaultExpanded>
        <Typography variant="body2" color="text.secondary" sx={bodyTextSx}>
          {isFallback ? notEnoughEvidence : (aiReport.candidateProfile || notEnoughEvidence)}
        </Typography>
      </AIExpandableSection>

      <AIExpandableSection icon={WorkOutlineIcon} title={t('aiReportPanel.roleEvidenceTitle')} accent={tokens.sky[500]}>
        <Typography variant="body2" color="text.secondary" sx={bodyTextSx}>
          {isFallback ? notEnoughEvidence : (aiReport.roleMatch || notEnoughEvidence)}
        </Typography>
      </AIExpandableSection>

      <AIExpandableSection icon={EngineeringOutlinedIcon} title={t('aiReportPanel.technicalTitle')} accent={tokens.sky[500]}>
        <Typography variant="body2" color="text.secondary" sx={bodyTextSx}>
          {aiReport.technicalAnalysis || notEnoughEvidence}
        </Typography>
      </AIExpandableSection>

      <AIExpandableSection icon={RecordVoiceOverOutlinedIcon} title={t('aiReportPanel.communicationTitle')} accent={tokens.mint[500]}>
        <Typography variant="body2" color="text.secondary" sx={bodyTextSx}>
          {aiReport.communicationAnalysis || notEnoughEvidence}
        </Typography>
      </AIExpandableSection>

      <AIExpandableSection icon={PsychologyOutlinedIcon} title={t('aiReportPanel.answerStructureTitle')} accent={tokens.amber[500]}>
        <Typography variant="body2" color="text.secondary" sx={bodyTextSx}>
          {isFallback ? notEnoughEvidence : (aiReport.behaviorAnalysis || notEnoughEvidence)}
        </Typography>
      </AIExpandableSection>

      {showCollaboration && (
        <AIExpandableSection icon={GroupsOutlinedIcon} title={t('aiReportPanel.collaborationTitle')} accent={tokens.emerald[500]}>
          <Typography variant="body2" color="text.secondary" sx={bodyTextSx}>{collaborationText}</Typography>
        </AIExpandableSection>
      )}

      {!isFallback && aiReport.leadershipAnalysis && /\[?Q\d+\]?/i.test(aiReport.leadershipAnalysis) && (
        <AIExpandableSection icon={GroupsOutlinedIcon} title={t('aiReportPanel.leadershipTitle')}>
          <Typography variant="body2" color="text.secondary" sx={bodyTextSx}>{aiReport.leadershipAnalysis}</Typography>
        </AIExpandableSection>
      )}

      <AIExpandableSection icon={PsychologyOutlinedIcon} title={t('aiReportPanel.problemSolvingTitle')} accent={tokens.sky[500]}>
        <Typography variant="body2" color="text.secondary" sx={bodyTextSx}>
          {aiReport.problemSolving || notEnoughEvidence}
        </Typography>
      </AIExpandableSection>

      <Grid container spacing={2} sx={{ mb: 1.25 }}>
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }} className="report-section">
            <Box sx={{ height: 3, bgcolor: tokens.emerald[500] }} />
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.25 }}>
                <CheckCircleOutlineIcon sx={{ fontSize: 18, color: tokens.emerald[500] }} />
                <Typography fontWeight={800} variant="body2">{t('aiReportPanel.strengthsTitle')}</Typography>
              </Stack>
              <EvidenceList items={safeStrengths} emptyText={t('aiReportPanel.noStrengths')} icon={CheckCircleOutlineIcon} color={tokens.emerald[500]} />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }} className="report-section">
            <Box sx={{ height: 3, bgcolor: tokens.amber[500] }} />
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.25 }}>
                <WarningAmberIcon sx={{ fontSize: 18, color: tokens.amber[500] }} />
                <Typography fontWeight={800} variant="body2">{t('aiReportPanel.improveTitle')}</Typography>
              </Stack>
              <EvidenceList items={safeWeaknesses} emptyText={t('aiReportPanel.noImprovements')} icon={WarningAmberIcon} color={tokens.amber[500]} />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }} className="report-section">
            <Box sx={{ height: 3, bgcolor: tokens.sky[500] }} />
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.25 }}>
                <ErrorOutlineIcon sx={{ fontSize: 18, color: tokens.sky[500] }} />
                <Typography fontWeight={800} variant="body2">{t('aiReportPanel.validateTitle')}</Typography>
              </Stack>
              <EvidenceList items={safeValidationItems} emptyText={t('aiReportPanel.noValidationItems')} icon={InfoOutlinedIcon} color={tokens.sky[500]} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <AIExpandableSection icon={TrendingUpOutlinedIcon} title={t('aiReportPanel.developmentTitle')} accent={tokens.mint[500]} defaultExpanded>
        <Typography variant="body2" color="text.secondary" sx={bodyTextSx}>
          {aiReport.learningPotential || notEnoughEvidence}
        </Typography>
      </AIExpandableSection>

      <Card sx={{ mb: 1.25 }} className="report-section">
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.25 }}>
            <TrendingUpOutlinedIcon sx={{ fontSize: 19, color: tokens.brand[500] }} />
            <Typography fontWeight={800} variant="body2">{t('aiReportPanel.nextStepTitle')}</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={bodyTextSx}>
            {aiReport.nextInterviewRecommendation || notEnoughEvidence}
          </Typography>
        </CardContent>
      </Card>

      {aiReport.customFollowUpQuestions?.length > 0 && (
        <Card sx={{ mb: 1.25 }} className="report-section">
          <CardContent>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.25 }}>
              <QuestionAnswerOutlinedIcon sx={{ fontSize: 19, color: tokens.brand[500] }} />
              <Typography fontWeight={800} variant="body2">{t('aiReportPanel.practiceQuestionsTitle')}</Typography>
            </Stack>
            <Divider sx={{ mb: 1.25 }} />
            <List dense disablePadding>
              {aiReport.customFollowUpQuestions.map((question, index) => (
                <ListItem key={`${index}-${question}`} disableGutters alignItems="flex-start" sx={{ py: 0.5 }}>
                  <Chip label={index + 1} size="small" variant="outlined" sx={{ mr: 1.25, mt: 0.15, minWidth: 28 }} />
                  <ListItemText primary={<Typography variant="body2" sx={{ lineHeight: 1.65 }}>{question}</Typography>} />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5, mb: 1.5 }} className="no-print">
        {isFallback
          ? t('aiReportPanel.fallbackMeta', { date: new Date(aiReport.generatedAt).toLocaleString() })
          : t('aiReportPanel.generatedMeta', { model: aiReport.generatedByModel, date: new Date(aiReport.generatedAt).toLocaleString() })}
      </Typography>

      <PracticeNotes reportId={reportId} t={t} />
    </Box>
  );
}
