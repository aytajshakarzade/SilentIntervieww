import { useState, useMemo } from 'react';
import {
  Box, Card, CardContent, Typography, Avatar, Chip, Stack, Alert,
  ToggleButtonGroup, ToggleButton,
} from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import { useCandidates } from '../../hooks/useCandidates';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import ScoreRing from '../../components/ui/ScoreRing';
import { getInitials } from '../../utils/formatters';
import { tokens } from '../../theme/index';
import { useTranslation } from '../../i18n';
import CandidateDetailDrawer from './CandidateDetailDrawer';

function getFilters(t) {
  return [
    { value: 'ALL', label: t('candidatesPage.filterAll') },
    { value: 'ABOVE', label: t('candidatesPage.filterAbove') },
    { value: 'BELOW', label: t('candidatesPage.filterBelow') },
    { value: 'PENDING', label: t('candidatesPage.filterPending') },
  ];
}

export default function CandidatesPage() {
  const { t, language } = useTranslation();
  const FILTERS = getFilters(t);
  const { candidates, loading, error } = useCandidates();
  const [filter, setFilter] = useState('ALL');
  const [selectedCandidate, setSelectedCandidate] = useState(null);

  const filtered = useMemo(() => {
    switch (filter) {
      case 'ABOVE': return candidates.filter((c) => c.bestScore != null && c.bestScore >= 70);
      case 'BELOW': return candidates.filter((c) => c.bestScore != null && c.bestScore < 70);
      case 'PENDING': return candidates.filter((c) => c.bestScore == null);
      default: return candidates;
    }
  }, [candidates, filter]);

  const columns = [
    {
      id: 'candidate',
      label: t('candidatesPage.candidate'),
      render: (row) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ bgcolor: tokens.indigo[600], width: 36, height: 36, fontSize: '0.75rem', fontWeight: 700 }}>
            {getInitials(row.displayName || t('candidatesPage.candidateFallback'))}
          </Avatar>
          <Box>
            <Typography variant="body2" fontWeight={600}>{row.displayName || t('candidatesPage.candidateFallback')}</Typography>
            <Typography variant="caption" color="text.secondary">{row.education || '—'}</Typography>
          </Box>
        </Box>
      ),
      value: (row) => String(row.id),
    },
    {
      id: 'skills',
      label: t('candidatesPage.skills'),
      render: (row) => (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {(row.skills || '').split(',').slice(0, 3).map((s) => s.trim()).filter(Boolean).map((s) => (
            <Chip key={s} label={s} size="small" variant="outlined" sx={{ fontSize: '0.65rem', height: 20 }} />
          ))}
          {!row.skills && <Typography variant="caption" color="text.disabled">{t('candidatesPage.notSpecified')}</Typography>}
        </Box>
      ),
      sortable: false,
    },
    {
      id: 'experience',
      label: t('candidatesPage.experience'),
      render: (row) => <Typography variant="body2" color="text.secondary">{row.experience || '—'}</Typography>,
      value: (row) => row.experience,
    },
    {
      id: 'applications',
      label: t('candidatesPage.applications'),
      render: (row) => (
        <Chip label={row.applications.length} size="small" color="primary" variant="outlined" sx={{ fontWeight: 700 }} />
      ),
      value: (row) => row.applications.length,
    },
    {
      id: 'bestScore',
      label: t('candidatesPage.bestScore'),
      render: (row) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ScoreRing score={row.bestScore} size={40} strokeWidth={4} />
        </Box>
      ),
      value: (row) => row.bestScore,
    },
    {
      id: 'status',
      label: t('candidatesPage.status'),
      render: (row) => {
        if (row.bestScore == null) return <StatusBadge status="PENDING" />;
        if (row.bestScore >= 70) return <StatusBadge status="SHORTLISTED" />;
        return <StatusBadge status="REVIEWING" />;
      },
      value: (row) => row.bestScore,
    },
  ];

  // Summary stats
  const shortlisted = candidates.filter((c) => c.bestScore != null && c.bestScore >= 70).length;
  const avgScore = candidates.filter((c) => c.bestScore != null).length
    ? Math.round(candidates.filter((c) => c.bestScore != null).reduce((s, c) => s + c.bestScore, 0) / candidates.filter((c) => c.bestScore != null).length)
    : null;

  return (
    <Box>
      <Box sx={{
        display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between',
        gap: 2, mb: 3, flexWrap: 'wrap', flexDirection: { xs: 'column', sm: 'row' },
      }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>{t('candidatesPage.title')}</Typography>
          <Typography color="text.secondary" variant="body2">{t('candidatesPage.totalShortlisted', { total: candidates.length, shortlisted })}</Typography>
        </Box>
        <Stack direction="row" spacing={1.5} alignItems="center">
          {avgScore != null && (
            <Box sx={{ px: 2, py: 1, bgcolor: 'primary.main', borderRadius: 2, color: 'white' }}>
              <Typography variant="caption" sx={{ opacity: 0.8, display: 'block', fontSize: '0.65rem' }}>{t('candidatesPage.avgScore')}</Typography>
              <Typography fontWeight={700} fontSize="1rem">{avgScore}%</Typography>
            </Box>
          )}
        </Stack>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Filter tabs */}
      <Box sx={{ mb: 2 }}>
        <ToggleButtonGroup value={filter} exclusive onChange={(_, v) => v && setFilter(v)} size="small">
          {FILTERS.map((f) => (
            <ToggleButton key={f.value} value={f.value} sx={{ px: 2, fontSize: '0.75rem', textTransform: 'none', fontWeight: 500 }}>
              {f.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      <Card sx={{ overflow: 'hidden' }}>
        <CardContent sx={{ p: 2.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
            {language === 'az' ? 'Namizədə klikləyin — tam profil, AI nəticələri və recruiter qeydləri açılacaq.' : language === 'ru' ? 'Нажмите на кандидата — откроется полный профиль, результаты ИИ и заметки рекрутера.' : 'Select a candidate to open the full profile, AI results, and recruiter notes.'}
          </Typography>
          <DataTable
            columns={columns}
            rows={filtered}
            loading={loading}
            searchable
            searchPlaceholder={t('candidatesPage.searchPlaceholder')}
            rowKey={(r) => r.id}
            emptyTitle={t('candidatesPage.noCandidatesFound')}
            emptyDescription={t('candidatesPage.noCandidatesFoundDescription')}
            emptyIcon={PeopleIcon}
            defaultSort="bestScore"
            defaultSortDir="desc"
            onRowClick={(row) => setSelectedCandidate(row)}
          />
        </CardContent>
      </Card>

      <CandidateDetailDrawer
        candidate={selectedCandidate}
        open={Boolean(selectedCandidate)}
        onClose={() => setSelectedCandidate(null)}
        language={language}
      />
    </Box>
  );
}
