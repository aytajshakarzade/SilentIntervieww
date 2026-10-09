import { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Avatar, Stack, TextField,
  Button, Chip, CircularProgress, Grid, Divider,
} from '@mui/material';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import WorkHistoryRoundedIcon from '@mui/icons-material/WorkHistoryRounded';
import CodeRoundedIcon from '@mui/icons-material/CodeRounded';
import WorkOutlineRoundedIcon from '@mui/icons-material/WorkOutlineRounded';
import VideocamRoundedIcon from '@mui/icons-material/VideocamRounded';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { candidateService } from '../../services/candidateService';
import { useAuth } from '../../hooks/useAuth';
import { useCandidateProfile } from '../../hooks/useCandidateProfile';
import { getInitials } from '../../utils/formatters';
import ScoreRing from '../../components/ui/ScoreRing';
import EmptyState from '../../components/ui/EmptyState';
import { interviewService } from '../../services/interviewService';
import { useTranslation } from '../../i18n';
import PlanBillingCard from '../../components/profile/PlanBillingCard';

const ACCENTS = { skills: '#F28C28', education: '#2E90E5', experience: '#28C76F' };

function InfoCard({ icon: Icon, title, accent, children }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Box sx={{
            width: 32, height: 32, borderRadius: 1.5, display: 'flex',
            alignItems: 'center', justifyContent: 'center', bgcolor: `${accent}18`, color: accent,
          }}>
            <Icon sx={{ fontSize: 17 }} />
          </Box>
          <Typography variant="subtitle2" fontWeight={700}>{title}</Typography>
        </Box>
        {children}
      </CardContent>
    </Card>
  );
}

function ActivityCard({ icon: Icon, title, accent, items, emptyLabel, renderItem }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Box sx={{
            width: 32, height: 32, borderRadius: 1.5, display: 'flex',
            alignItems: 'center', justifyContent: 'center', bgcolor: `${accent}18`, color: accent,
          }}>
            <Icon sx={{ fontSize: 17 }} />
          </Box>
          <Typography variant="subtitle2" fontWeight={700}>{title}</Typography>
        </Box>
        {items.length ? (
          <Stack spacing={0}>
            {items.map((item, idx) => (
              <Box key={item.id ?? idx}>
                {renderItem(item)}
                {idx < items.length - 1 && <Divider sx={{ my: 1.1 }} />}
              </Box>
            ))}
          </Stack>
        ) : (
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', py: 2 }}>
            <Typography variant="body2" color="text.disabled">{emptyLabel}</Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

export default function CandidateProfilePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { profile, loading, updateProfile } = useCandidateProfile();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reports, setReports] = useState([]);
  const [applications, setApplications] = useState([]);
  const [sessions, setSessions] = useState([]);

  const { register, handleSubmit, reset } = useForm({
    defaultValues: { skills: '', education: '', experience: '', resumeUrl: '' },
  });

  useEffect(() => {
    if (!profile?.id) return;
    Promise.all([
      interviewService.applications.getAll({ pageSize: 100 }),
      interviewService.sessions.getAll({ pageSize: 100 }),
      interviewService.reports.getAll({ pageSize: 100 }),
    ]).then(([rawApplications, rawSessions, rawReports]) => {
      const ownedApplications = (Array.isArray(rawApplications) ? rawApplications : rawApplications?.items ?? []).filter((application) => application.candidateId === profile.id);
      const ownedSessions = (Array.isArray(rawSessions) ? rawSessions : rawSessions?.items ?? []).filter((session) => ownedApplications.some((application) => application.id === session.jobApplicationId));
      const ownedReports = (Array.isArray(rawReports) ? rawReports : rawReports?.items ?? []).filter((report) => ownedSessions.some((session) => session.id === report.interviewSessionId));
      setApplications(ownedApplications);
      setSessions(ownedSessions);
      setReports(ownedReports);
    }).catch(() => {});
  }, [profile?.id]);

  // Sync form when profile loads
  useEffect(() => {
    if (profile) {
      reset({
        skills: profile.skills ?? '',
        education: profile.education ?? '',
        experience: profile.experience ?? '',
        resumeUrl: profile.resumeUrl ?? '',
      });
    }
  }, [profile, reset]);

  const onSubmit = async (data) => {
    setSaving(true);
    try {
      if (!profile) {
        await candidateService.create({
          userId: user.id,
          ...data,
        });

        toast.success(t('candidateProfile.profileCreated'));

        window.location.reload();
      } else {
        await updateProfile(data);
        toast.success(t('candidateProfile.profileUpdated'));
      }
      setEditing(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const avgScore = reports.length
    ? Math.round(reports.reduce((s, r) => s + (r.score ?? 0), 0) / reports.length)
    : null;

  const bestScore = reports.length
    ? Math.max(...reports.map((r) => r.score ?? 0))
    : null;

  const skillList = (profile?.skills ?? '').split(',').map((s) => s.trim()).filter(Boolean);

  return (
    <Box sx={{ maxWidth: 840, mx: 'auto' }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={800} sx={{ letterSpacing: '-0.03em' }}>{t('candidateProfile.title')}</Typography>
        <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>
          {t('candidateProfile.subtitle')}
        </Typography>
      </Box>

      {/* Header card */}
      <Card sx={{ mb: 3, overflow: 'hidden', position: 'relative' }}>
        <Box sx={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 72,
          background: 'linear-gradient(135deg, #F28C28 0%, #B96313 100%)',
        }} />
        <CardContent sx={{ p: 3, pt: 5, position: 'relative' }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 2.5, flexWrap: 'wrap' }}>
            <Avatar sx={{
              width: 84, height: 84, bgcolor: 'primary.main', fontSize: '1.7rem', fontWeight: 700,
              border: '4px solid', borderColor: 'background.paper', boxShadow: 2,
            }}>
              {getInitials(user?.name)}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 200, pb: 0.5 }}>
              <Typography variant="h6" fontWeight={800}>{user?.name}</Typography>
              <Typography color="text.secondary" variant="body2">{user?.email}</Typography>
              <Chip label={t('candidateProfile.candidateBadge')} size="small" color="secondary" variant="outlined" sx={{ mt: 1, fontSize: '0.7rem', borderRadius: 1 }} />
            </Box>
            <Stack direction="row" spacing={3} alignItems="center" sx={{ pb: 0.5 }}>
              <ScoreRing score={avgScore} size={62} strokeWidth={5} label={t('candidateProfile.avgScore')} />
              <ScoreRing score={bestScore} size={62} strokeWidth={5} label={t('candidateProfile.bestScore')} />
              <Box sx={{ textAlign: 'center', minWidth: 44 }}>
                <Typography variant="h4" fontWeight={800}>{reports.length}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>{t('candidateProfile.interviews')}</Typography>
              </Box>
            </Stack>
          </Box>
        </CardContent>
      </Card>

      <PlanBillingCard />

      {/* Skills display */}
      {!editing && profile && (
        <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
          <Grid item xs={12}>
            <InfoCard icon={CodeRoundedIcon} title={t('candidateProfile.skills')} accent={ACCENTS.skills}>
              {skillList.length ? (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {skillList.map((s) => (
                    <Chip
                      key={s}
                      label={s}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.75rem', borderRadius: 1, borderColor: `${ACCENTS.skills}40`, color: ACCENTS.skills, bgcolor: `${ACCENTS.skills}0c` }}
                    />
                  ))}
                </Box>
              ) : (
                <Typography variant="body2" color="text.disabled">{t('candidateProfile.noSkillsYet')}</Typography>
              )}
            </InfoCard>
          </Grid>
          <Grid item xs={12} md={6}>
            <InfoCard icon={SchoolRoundedIcon} title={t('candidateProfile.education')} accent={ACCENTS.education}>
              <Typography variant="body2" color={profile.education ? 'text.primary' : 'text.disabled'} sx={{ lineHeight: 1.6 }}>
                {profile.education || t('candidateProfile.notSpecified')}
              </Typography>
            </InfoCard>
          </Grid>
          <Grid item xs={12} md={6}>
            <InfoCard icon={WorkHistoryRoundedIcon} title={t('candidateProfile.experience')} accent={ACCENTS.experience}>
              <Typography variant="body2" color={profile.experience ? 'text.primary' : 'text.disabled'} sx={{ lineHeight: 1.6 }}>
                {profile.experience || t('candidateProfile.notSpecified')}
              </Typography>
            </InfoCard>
          </Grid>

          <Grid item xs={12}>
            <Button variant="outlined" startIcon={<EditRoundedIcon />} onClick={() => setEditing(true)}>
              {t('candidateProfile.editProfile')}
            </Button>
          </Grid>

          <Grid item xs={12} md={6}>
            <ActivityCard
              icon={WorkOutlineRoundedIcon}
              title={t('candidateProfile.applications')}
              accent="#2E90E5"
              items={applications.slice(0, 5)}
              emptyLabel={t('candidateProfile.noApplicationsYet')}
              renderItem={(application) => (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'center' }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={650} noWrap>{application.jobTitle}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t('candidateProfile.applied', { date: application.appliedAt ? new Date(application.appliedAt).toLocaleDateString() : '—' })}
                    </Typography>
                  </Box>
                  <Chip
                    label={String(application.status || '').replace(/([a-z])([A-Z])/g, '$1 $2')}
                    size="small"
                    variant="outlined"
                    sx={{ borderRadius: 1, flexShrink: 0 }}
                  />
                </Box>
              )}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <ActivityCard
              icon={VideocamRoundedIcon}
              title={t('candidateProfile.interviewHistory')}
              accent="#8b5cf6"
              items={[...sessions].sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt)).slice(0, 5)}
              emptyLabel={t('candidateProfile.noSessionsYet')}
              renderItem={(session) => (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'center' }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={650} noWrap>
                      {session.endedAt ? t('candidateProfile.completedInterview') : t('candidateProfile.interviewInProgress')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t('candidateProfile.started', { date: session.startedAt ? new Date(session.startedAt).toLocaleDateString() : '—' })}
                    </Typography>
                  </Box>
                  <Chip
                    label={session.endedAt ? t('candidateProfile.completed') : t('candidateProfile.active')}
                    color={session.endedAt ? 'success' : 'info'}
                    size="small"
                    sx={{ borderRadius: 1, flexShrink: 0 }}
                  />
                </Box>
              )}
            />
          </Grid>
        </Grid>
      )}

      {/* No profile yet, not loading, not editing a fresh form implicitly shown */}
      {!editing && !profile && !loading && (
        <Card sx={{ mb: 2.5 }}>
          <CardContent sx={{ p: 2 }}>
            <EmptyState
              icon={CodeRoundedIcon}
              title={t('candidateProfile.setupProfileTitle')}
              description={t('candidateProfile.setupProfileDescription')}
            />
          </CardContent>
        </Card>
      )}

      {/* Edit form */}
      {(editing || !profile) && !loading && (
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2.5 }}>
              {profile ? t('candidateProfile.editProfile') : t('candidateProfile.createYourProfile')}
            </Typography>
            <Box component="form" onSubmit={handleSubmit(onSubmit)}>
              <Stack spacing={2.5}>
                <TextField
                  label={t('candidateProfile.skillsLabel')}
                  fullWidth
                  placeholder={t('candidateProfile.skillsPlaceholder')}
                  helperText={t('candidateProfile.skillsHelper')}
                  {...register('skills')}
                />
                <TextField
                  label={t('candidateProfile.education')}
                  fullWidth
                  multiline
                  rows={2}
                  placeholder={t('candidateProfile.educationPlaceholder')}
                  {...register('education')}
                />
                <TextField
                  label={t('candidateProfile.workExperience')}
                  fullWidth
                  multiline
                  rows={3}
                  placeholder={t('candidateProfile.experiencePlaceholder')}
                  {...register('experience')}
                />
                <TextField
                  label={t('candidateProfile.resumeUrl')}
                  fullWidth
                  placeholder={t('candidateProfile.resumeUrlPlaceholder')}
                  {...register('resumeUrl')}
                />
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  {profile && (
                    <Button
                      variant="outlined"
                      onClick={() => {
                        reset({
                          skills: profile.skills ?? '',
                          education: profile.education ?? '',
                          experience: profile.experience ?? '',
                          resumeUrl: profile.resumeUrl ?? '',
                        });
                        setEditing(false);
                      }}
                      disabled={saving}
                    >
                      {t('candidateProfile.cancel')}
                    </Button>
                  )}
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={saving}
                    startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveRoundedIcon />}
                  >
                    {saving ? t('candidateProfile.saving') : profile ? t('candidateProfile.saveChanges') : t('candidateProfile.createProfile')}
                  </Button>
                </Box>
              </Stack>
            </Box>
          </CardContent>
        </Card>
      )}

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}
    </Box>
  );
}
