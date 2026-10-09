import { useEffect, useMemo, useState } from 'react';
import {
  Avatar, Box, Button, Chip, Divider, Drawer, IconButton, LinearProgress,
  Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import WorkOutlineRoundedIcon from '@mui/icons-material/WorkOutlineRounded';
import VideocamRoundedIcon from '@mui/icons-material/VideocamRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import PsychologyRoundedIcon from '@mui/icons-material/PsychologyRounded';
import TimelineRoundedIcon from '@mui/icons-material/TimelineRounded';
import NotesRoundedIcon from '@mui/icons-material/NotesRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import { getInitials } from '../../utils/formatters';

const COPY = {
  az: {
    profile: 'Profil', resume: 'Rezüme', application: 'Müraciət', interview: 'Müsahibə', aiScore: 'AI balı',
    communication: 'Ünsiyyət', confidence: 'Özünəinam', technical: 'Texniki bilik', strengths: 'Güclü tərəflər',
    weaknesses: 'İnkişaf sahələri', recommendation: 'AI tövsiyəsi', notes: 'Recruiter qeydləri', timeline: 'Müsahibə xronologiyası',
    noData: 'Məlumat hələ yoxdur', openResume: 'Rezümeni aç', noResume: 'Rezüme əlavə edilməyib', save: 'Qeydi saxla',
    notePlaceholder: 'Namizəd haqqında daxili qeyd yazın…', noApplications: 'Hələ müraciət yoxdur', noInterviews: 'Hələ müsahibə yoxdur',
    completed: 'Tamamlandı', inProgress: 'Davam edir', score: 'Bal', applied: 'Müraciət', answer: 'Cavab', question: 'Sual',
  },
  en: {
    profile: 'Profile', resume: 'Resume', application: 'Application', interview: 'Interview', aiScore: 'AI Score',
    communication: 'Communication', confidence: 'Confidence', technical: 'Technical', strengths: 'Strengths',
    weaknesses: 'Weaknesses', recommendation: 'AI Recommendation', notes: 'Recruiter Notes', timeline: 'Interview Timeline',
    noData: 'No data yet', openResume: 'Open resume', noResume: 'No resume added', save: 'Save note',
    notePlaceholder: 'Add an internal note about this candidate…', noApplications: 'No applications yet', noInterviews: 'No interviews yet',
    completed: 'Completed', inProgress: 'In progress', score: 'Score', applied: 'Applied', answer: 'Answer', question: 'Question',
  },
  ru: {
    profile: 'Профиль', resume: 'Резюме', application: 'Отклик', interview: 'Интервью', aiScore: 'AI-балл',
    communication: 'Коммуникация', confidence: 'Уверенность', technical: 'Технические знания', strengths: 'Сильные стороны',
    weaknesses: 'Зоны развития', recommendation: 'Рекомендация AI', notes: 'Заметки рекрутера', timeline: 'Хронология интервью',
    noData: 'Данных пока нет', openResume: 'Открыть резюме', noResume: 'Резюме не добавлено', save: 'Сохранить заметку',
    notePlaceholder: 'Добавьте внутреннюю заметку о кандидате…', noApplications: 'Откликов пока нет', noInterviews: 'Интервью пока нет',
    completed: 'Завершено', inProgress: 'В процессе', score: 'Балл', applied: 'Отклик', answer: 'Ответ', question: 'Вопрос',
  },
};

const statusLabel = (status, lang) => {
  const s = String(status || '').toLowerCase();
  const maps = {
    az: { applied: 'Müraciət edildi', reviewpending: 'Nəzərdən keçirilir', interviewed: 'Müsahibə keçirildi', shortlisted: 'Qısa siyahıda', accepted: 'Qəbul edildi', hired: 'İşə qəbul edildi', rejected: 'Rədd edildi', offersent: 'Təklif göndərildi', archived: 'Arxivləndi' },
    en: { applied: 'Applied', reviewpending: 'Review pending', interviewed: 'Interviewed', shortlisted: 'Shortlisted', accepted: 'Accepted', hired: 'Hired', rejected: 'Rejected', offersent: 'Offer sent', archived: 'Archived' },
    ru: { applied: 'Отклик', reviewpending: 'На рассмотрении', interviewed: 'Интервью пройдено', shortlisted: 'В шорт-листе', accepted: 'Принят', hired: 'Нанят', rejected: 'Отклонён', offersent: 'Оффер отправлен', archived: 'Архив' },
  };
  return maps[lang]?.[s.replace(/[^a-z]/g, '')] || String(status || '—').replace(/([a-z])([A-Z])/g, '$1 $2');
};

function Section({ icon: Icon, title, children }) {
  return <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 3, bgcolor: 'background.paper' }}>
    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
      <Box sx={{ width: 34, height: 34, borderRadius: 2.2, display: 'grid', placeItems: 'center', bgcolor: 'rgba(234,118,0,.10)', color: 'primary.main' }}><Icon fontSize="small" /></Box>
      <Typography fontWeight={850}>{title}</Typography>
    </Stack>
    {children}
  </Box>;
}

function Score({ label, value }) {
  const numeric = Number.isFinite(Number(value)) ? Math.max(0, Math.min(100, Number(value))) : null;
  return <Box sx={{ p: 1.35, borderRadius: 2.5, bgcolor: 'action.hover' }}>
    <Stack direction="row" justifyContent="space-between" sx={{ mb: .7 }}><Typography variant="caption" color="text.secondary">{label}</Typography><Typography variant="caption" fontWeight={850}>{numeric == null ? '—' : `${numeric}%`}</Typography></Stack>
    <LinearProgress variant="determinate" value={numeric ?? 0} sx={{ height: 7, borderRadius: 99 }} />
  </Box>;
}

export default function CandidateDetailDrawer({ candidate, open, onClose, language = 'en' }) {
  const copy = COPY[language] || COPY.en;
  const [note, setNote] = useState('');
  const applications = candidate?.applications || [];
  const interviews = useMemo(() => applications.map(a => a.session).filter(Boolean), [applications]);
  const reports = useMemo(() => applications.map(a => a.report).filter(Boolean), [applications]);
  const bestReport = useMemo(() => [...reports].sort((a, b) => Number(b.score || 0) - Number(a.score || 0))[0] || null, [reports]);
  const breakdown = bestReport?.skillBreakdown || {};
  const resumeUrl = candidate?.resumeUrl || '';

  useEffect(() => {
    if (!candidate?.id) return;
    try { setNote(localStorage.getItem(`silent-interview.recruiter-note.${candidate.id}`) || ''); } catch { setNote(''); }
  }, [candidate?.id]);

  const saveNote = () => {
    if (!candidate?.id) return;
    try { localStorage.setItem(`silent-interview.recruiter-note.${candidate.id}`, note); } catch { /* storage can be unavailable */ }
  };

  if (!candidate) return null;

  return <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: { xs: '100%', sm: 560, lg: 650 }, bgcolor: 'background.default', backgroundImage: 'radial-gradient(circle at 90% 0%, rgba(234,118,0,.08), transparent 28%)' } }}>
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2.3, borderBottom: '1px solid', borderColor: 'divider', position: 'sticky', top: 0, zIndex: 2, bgcolor: 'background.default', backdropFilter: 'blur(18px)' }}>
        <Stack direction="row" spacing={1.4} alignItems="center">
          <Avatar sx={{ width: 54, height: 54, bgcolor: 'primary.main', fontWeight: 900 }}>{getInitials(candidate.displayName || candidate.fullName)}</Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}><Typography variant="h6" fontWeight={950} noWrap>{candidate.displayName || candidate.fullName || 'Candidate'}</Typography><Typography variant="body2" color="text.secondary" noWrap>{candidate.education || candidate.experience || copy.noData}</Typography></Box>
          {bestReport?.score != null && <Chip label={`${bestReport.score}%`} color="success" sx={{ fontWeight: 900 }} />}
          <IconButton onClick={onClose} aria-label="Close"><CloseRoundedIcon /></IconButton>
        </Stack>
      </Box>

      <Box sx={{ p: 2, overflowY: 'auto', overscrollBehavior: 'contain' }}>
        <Stack spacing={1.5}>
          <Section icon={PsychologyRoundedIcon} title={copy.profile}>
            <Stack spacing={1}><Typography variant="body2"><b>{candidate.skills || '—'}</b></Typography><Typography variant="body2" color="text.secondary">{candidate.experience || copy.noData}</Typography></Stack>
          </Section>

          <Section icon={DescriptionRoundedIcon} title={copy.resume}>
            {resumeUrl ? <Button href={resumeUrl} target="_blank" rel="noreferrer" variant="outlined" endIcon={<OpenInNewRoundedIcon />} sx={{ textTransform: 'none' }}>{copy.openResume}</Button> : <Typography variant="body2" color="text.secondary">{copy.noResume}</Typography>}
          </Section>

          <Section icon={WorkOutlineRoundedIcon} title={copy.application}>
            {applications.length ? <Stack spacing={1}>{applications.map(app => <Box key={app.id} sx={{ p: 1.25, borderRadius: 2.5, bgcolor: 'action.hover' }}><Stack direction="row" justifyContent="space-between" spacing={1}><Box minWidth={0}><Typography fontWeight={750} noWrap>{app.jobTitle || '—'}</Typography><Typography variant="caption" color="text.secondary">{app.appliedAt ? new Date(app.appliedAt).toLocaleDateString() : '—'}</Typography></Box><Chip size="small" label={statusLabel(app.status, language)} variant="outlined" /></Stack></Box>)}</Stack> : <Typography variant="body2" color="text.secondary">{copy.noApplications}</Typography>}
          </Section>

          <Section icon={VideocamRoundedIcon} title={copy.interview}>
            {interviews.length ? <Stack spacing={1}>{interviews.map(session => <Box key={session.id} sx={{ p: 1.25, borderRadius: 2.5, bgcolor: 'action.hover' }}><Stack direction="row" justifyContent="space-between"><Box><Typography fontWeight={750}>{session.endedAt ? copy.completed : copy.inProgress}</Typography><Typography variant="caption" color="text.secondary">{session.startedAt ? new Date(session.startedAt).toLocaleString() : '—'}</Typography></Box><Chip size="small" label={session.endedAt ? copy.completed : copy.inProgress} color={session.endedAt ? 'success' : 'info'} /></Stack></Box>)}</Stack> : <Typography variant="body2" color="text.secondary">{copy.noInterviews}</Typography>}
          </Section>

          <Section icon={AutoAwesomeRoundedIcon} title={copy.aiScore}>
            <Stack spacing={1.1}>
              <Score label={copy.aiScore} value={bestReport?.score ?? candidate.bestScore} />
              <Score label={copy.communication} value={breakdown.Communication} />
              <Score label={copy.confidence} value={breakdown.Confidence} />
              <Score label={copy.technical} value={breakdown.TechnicalKnowledge} />
            </Stack>
          </Section>

          <Section icon={AutoAwesomeRoundedIcon} title={copy.strengths}>
            {bestReport?.strengths?.length ? <Stack spacing={.8}>{bestReport.strengths.slice(0, 6).map((x, i) => <Typography key={i} variant="body2">• {x}</Typography>)}</Stack> : <Typography variant="body2" color="text.secondary">{copy.noData}</Typography>}
          </Section>

          <Section icon={TimelineRoundedIcon} title={copy.weaknesses}>
            {bestReport?.weaknesses?.length ? <Stack spacing={.8}>{bestReport.weaknesses.slice(0, 6).map((x, i) => <Typography key={i} variant="body2">• {x}</Typography>)}</Stack> : <Typography variant="body2" color="text.secondary">{copy.noData}</Typography>}
          </Section>

          <Section icon={AutoAwesomeRoundedIcon} title={copy.recommendation}>
            <Stack spacing={1}><Chip label={bestReport?.hiringRecommendation || copy.noData} color={bestReport?.score >= 70 ? 'success' : 'warning'} sx={{ width: 'fit-content', fontWeight: 850 }} /><Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.65 }}>{bestReport?.aiSummary || bestReport?.feedback || copy.noData}</Typography>{bestReport?.recommendations?.length ? <Stack spacing={.6}>{bestReport.recommendations.slice(0, 4).map((x, i) => <Typography variant="caption" color="text.secondary" key={i}>• {x}</Typography>)}</Stack> : null}</Stack>
          </Section>

          <Section icon={NotesRoundedIcon} title={copy.notes}>
            <TextField value={note} onChange={e => setNote(e.target.value)} fullWidth multiline minRows={4} placeholder={copy.notePlaceholder} /><Button onClick={saveNote} variant="contained" sx={{ mt: 1.2, alignSelf: 'flex-start' }}>{copy.save}</Button>
            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: .7 }}>Internal browser note</Typography>
          </Section>

          <Section icon={TimelineRoundedIcon} title={copy.timeline}>
            {bestReport?.timeline?.length ? <Stack spacing={1}>{bestReport.timeline.slice(0, 8).map(item => <Box key={item.order} sx={{ pl: 1.5, borderLeft: '2px solid', borderColor: 'primary.main' }}><Typography variant="caption" color="text.secondary">Q{item.order} · {item.qualityScore != null ? `${copy.score}: ${item.qualityScore}%` : ''}</Typography><Typography variant="body2" fontWeight={700} sx={{ mt: .25 }}>{item.question}</Typography><Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: .4 }}>{item.answer}</Typography></Box>)}</Stack> : <Typography variant="body2" color="text.secondary">{copy.noData}</Typography>}
          </Section>
        </Stack>
      </Box>
    </Box>
  </Drawer>;
}
