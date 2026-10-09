import { useState } from 'react';
import {
  Box, Button, Typography, Chip, IconButton, Tooltip, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Stack, MenuItem, Alert,
  CircularProgress, Card, CardContent, ToggleButtonGroup, ToggleButton,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import RestoreFromTrashIcon from '@mui/icons-material/RestoreFromTrash';
import WorkIcon from '@mui/icons-material/Work';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import DataTable from '../../components/ui/DataTable';
import EmptyState from '../../components/ui/EmptyState';
import { useJobs } from '../../hooks/useJobs';
import { ROUTES } from '../../constants/routes';
import { fmtSalary, truncate } from '../../utils/formatters';
import { useCompanies } from "../../hooks/useCompanies";
import { useTranslation } from '../../i18n';
import { useInterviewConfig, DEFAULT_INTERVIEW_CONFIG } from '../../hooks/useInterviewConfig';

// Config options are fetched dynamically from the backend via useInterviewConfig()

// ─── Inline create/edit dialog ────────────────────────────────────────────────
function JobDialog({ open, onClose, job, onSave, companies, interviewConfig }) {
  const effectiveInterviewConfig = {
    ...DEFAULT_INTERVIEW_CONFIG,
    ...(interviewConfig || {}),
  };
  if (!Array.isArray(effectiveInterviewConfig.experienceLevels) || effectiveInterviewConfig.experienceLevels.length === 0)
    effectiveInterviewConfig.experienceLevels = DEFAULT_INTERVIEW_CONFIG.experienceLevels;
  if (!Array.isArray(effectiveInterviewConfig.difficultyLevels) || effectiveInterviewConfig.difficultyLevels.length === 0)
    effectiveInterviewConfig.difficultyLevels = DEFAULT_INTERVIEW_CONFIG.difficultyLevels;
  if (!Array.isArray(effectiveInterviewConfig.supportedLanguages) || effectiveInterviewConfig.supportedLanguages.length === 0)
    effectiveInterviewConfig.supportedLanguages = DEFAULT_INTERVIEW_CONFIG.supportedLanguages;
  const { t } = useTranslation();
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: job || {
      title: '',
      description: '',
      requirements: '',
      salary: '',
      companyId: '',
      experience: '',
      skills: '',
      difficulty: '',
      language: '',
      estimatedDuration: '',
      culture: '',
    },
  });
  const [saving, setSaving] = useState(false);

  const onSubmit = async (data) => {
    setSaving(true);
    try {
      await onSave({
        ...data,
        salary: Number(data.salary) || 0,
        // Phase 3B — AI Interview Configuration fields are optional; send undefined
        // (not empty string) when unset so the backend's nullable contract holds.
        experience: data.experience || undefined,
        skills: data.skills || undefined,
        difficulty: data.difficulty || undefined,
        language: data.language || undefined,
        estimatedDuration: data.estimatedDuration ? Number(data.estimatedDuration) : undefined,
        culture: data.culture || undefined,
      });
      reset();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>{job ? t('jobs.editJob') : t('jobs.createNewJob')}</DialogTitle>
      <Box component="form" onSubmit={handleSubmit(onSubmit)}>
        <DialogContent sx={{ pt: 1 }}>
          <Stack spacing={2.5}>
            <TextField
              label={t('jobs.jobTitle')}
              fullWidth
              autoFocus
              error={Boolean(errors.title)}
              helperText={errors.title?.message}
              {...register('title', { required: t('jobs.titleRequired') })}
            />
            <TextField
              label={t('jobs.description')}
              fullWidth
              multiline
              rows={3}
              placeholder={t('jobs.descriptionPlaceholder')}
              {...register('description')}
            />
            <TextField
              label={t('jobs.requirementsSkills')}
              fullWidth
              multiline
              rows={3}
              placeholder={t('jobs.requirementsPlaceholder')}
              error={Boolean(errors.requirements)}
              helperText={errors.requirements?.message}
              {...register('requirements', { required: t('jobs.requirementsRequired') })}
            />
            <TextField
              label={t('jobs.salary')}
              type="number"
              fullWidth
              InputProps={{ startAdornment: <Box component="span" sx={{ mr: 0.5, color: 'text.secondary' }}>$</Box> }}
              {...register('salary')}
            />
            <TextField
              select
              label={t('jobs.company')}
              fullWidth
              error={Boolean(errors.companyId)}
              helperText={errors.companyId?.message}
              {...register("companyId", {
                required: t('jobs.companyRequired'),
              })}
            >
              {companies?.map((company) => (
                <MenuItem
                  key={company.id}
                  value={company.id}
                >
                  {company.name}
                </MenuItem>
              ))}
            </TextField>

            <Typography variant="subtitle2" fontWeight={700} sx={{ pt: 1 }}>
              {t('jobs.aiConfigSectionTitle')}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mt: -1.5 }}>
              {t('jobs.aiConfigSectionSubtitle')}
            </Typography>

            <TextField
              select
              label={t('jobs.experience')}
              fullWidth
              defaultValue=""
              {...register('experience')}
            >
              <MenuItem value="">{t('jobs.aiConfigNotSet')}</MenuItem>
              {(effectiveInterviewConfig.experienceLevels ?? []).map((opt) => (
                <MenuItem key={opt} value={opt}>{opt}</MenuItem>
              ))}
            </TextField>

            <TextField
              label={t('jobs.skills')}
              fullWidth
              multiline
              rows={2}
              placeholder={t('jobs.skillsPlaceholder')}
              error={Boolean(errors.skills)}
              helperText={errors.skills?.message}
              {...register('skills', { maxLength: { value: 2000, message: t('jobs.skillsTooLong') } })}
            />

            <TextField
              select
              label={t('jobs.difficulty')}
              fullWidth
              defaultValue=""
              {...register('difficulty')}
            >
              <MenuItem value="">{t('jobs.aiConfigNotSet')}</MenuItem>
              {(effectiveInterviewConfig.difficultyLevels ?? []).map((opt) => (
                <MenuItem key={opt} value={opt}>{t(`jobs.difficulty_${opt}`)}</MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label={t('jobs.language')}
              fullWidth
              defaultValue=""
              {...register('language')}
            >
              <MenuItem value="">{t('jobs.aiConfigNotSet')}</MenuItem>
              {(effectiveInterviewConfig.supportedLanguages ?? []).map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
              ))}
            </TextField>

            <TextField
              label={t('jobs.estimatedDuration')}
              type="number"
              fullWidth
              inputProps={{ min: 1 }}
              error={Boolean(errors.estimatedDuration)}
              helperText={errors.estimatedDuration?.message}
              InputProps={{ endAdornment: <Box component="span" sx={{ ml: 0.5, color: 'text.secondary' }}>{t('jobs.minutes')}</Box> }}
              {...register('estimatedDuration', {
                min: { value: 1, message: t('jobs.estimatedDurationInvalid') },
              })}
            />

            <TextField
              label={t('jobs.culture')}
              fullWidth
              multiline
              rows={2}
              placeholder={t('jobs.culturePlaceholder')}
              error={Boolean(errors.culture)}
              helperText={errors.culture?.message}
              {...register('culture', { maxLength: { value: 2000, message: t('jobs.cultureTooLong') } })}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={onClose} disabled={saving}>{t('jobs.cancel')}</Button>
          <Button type="submit" variant="contained" disabled={saving}>
            {saving ? <CircularProgress size={18} color="inherit" /> : job ? t('jobs.saveChanges') : t('jobs.createJob')}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

// ─── Confirm delete dialog ────────────────────────────────────────────────────
function DeleteDialog({ open, onClose, onConfirm, jobTitle }) {
  const { t } = useTranslation();
  const [deleting, setDeleting] = useState(false);
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>{t('jobs.archiveJob')}</DialogTitle>
      <DialogContent>
        <Alert severity="warning">
          {t('jobs.archiveConfirm', { title: jobTitle })}
        </Alert>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={deleting}>{t('jobs.cancel')}</Button>
        <Button
          variant="contained"
          color="error"
          disabled={deleting}
          onClick={async () => { setDeleting(true); try { await onConfirm(); onClose(); } finally { setDeleting(false); } }}
        >
          {deleting ? <CircularProgress size={18} color="inherit" /> : t('jobs.archive')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function JobsPage() {
  const { t } = useTranslation();
  const { config: interviewConfig } = useInterviewConfig();
  const [showArchived, setShowArchived] = useState(false);

  const {
    jobs,
    loading,
    error,
    createJob,
    updateJob,
    removeJob,
    restoreJob,
  } = useJobs({
    onlyDeleted: showArchived,
  });

  const { companies } = useCompanies();

  const [createOpen, setCreateOpen] = useState(false);
  const [editJob, setEditJob] = useState(null);
  const [deleteJob, setDeleteJob] = useState(null);
  const columns = [
    {
      id: 'title',
      label: t('jobs.jobTitleColumn'),
      render: (row) => (
        <Box>
          <Typography variant="body2" fontWeight={600}>{row.title}</Typography>
          <Typography variant="caption" color="text.secondary">{truncate(row.description, 50)}</Typography>
        </Box>
      ),
    },
 {
  id: "requirements",
  label: t('jobs.skillsRequirementsColumn'),
  render: (row) => (
    <Typography variant="body2" color="text.secondary">
      {truncate(row.requirements || row.skillsRequired || t('jobs.dash'), 60)}
    </Typography>
  ),
      sortable: false,
    },
    {
      id: "company",
      label: t('jobs.companyColumn'),
      render: (row) => {
        const company = companies.find(
          (c) => c.id === row.companyId
        );

        return (
          <Typography variant="body2">
            {company?.name || t('jobs.dash')}
          </Typography>
        );
      },
    },
    {
      id: 'salary',
      label: t('jobs.salaryColumn'),
      render: (row) => <Typography variant="body2" color="text.secondary">{fmtSalary(row.salary)}</Typography>,
    },
    {
      id: 'actions',
      label: '',
      sortable: false,
      align: 'right',
      render: (row) => (
        <Box sx={{ display: "flex", gap: 0.5, justifyContent: "flex-end" }}>
          {!showArchived ? (
            <>
              <Tooltip title={t('jobs.edit')}>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditJob(row);
                  }}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>

              <Tooltip title={t('jobs.delete')}>
                <IconButton
                  size="small"
                  color="error"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteJob(row);
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          ) : (
            <Tooltip title={t('jobs.restore')}>
              <IconButton
                color="success"
                size="small"
                onClick={async (e) => {
                  e.stopPropagation();

                  await restoreJob(row.id);

                  toast.success(t('jobs.jobRestored'));
                }}
              >
                <RestoreFromTrashIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      ),
    },
  ];

  return (
    <Box>
      <Box sx={{
        display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between',
        gap: 2, mb: 3, flexWrap: 'wrap', flexDirection: { xs: 'column', sm: 'row' },
      }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>{t('jobs.title')}</Typography>
          <Typography color="text.secondary" variant="body2">
            {jobs.length} {showArchived ? t('jobs.archivedPosition') : t('jobs.activePosition')} {jobs.length === 1 ? t('jobs.position') : t('jobs.positions')}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap', width: { xs: '100%', sm: 'auto' } }}>
          <ToggleButtonGroup
            value={showArchived ? 'archived' : 'active'}
            exclusive
            size="small"
            onChange={(_, val) => { if (val) setShowArchived(val === 'archived'); }}
            aria-label={t('jobs.jobStatusFilter')}
          >
            <ToggleButton value="active" sx={{ px: 2, textTransform: 'none', fontWeight: 600 }}>
              {t('jobs.active')}
            </ToggleButton>
            <ToggleButton value="archived" sx={{ px: 2, textTransform: 'none', fontWeight: 600 }}>
              {t('jobs.archived')}
            </ToggleButton>
          </ToggleButtonGroup>

          {!showArchived && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCreateOpen(true)}
              data-tour="create-job-btn"
              sx={{ ml: { xs: 'auto', sm: 0 } }}
            >
              {t('jobs.createJobButton')}
            </Button>
          )}
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card>
        <CardContent sx={{ p: 2.5 }}>
          <DataTable
            columns={columns}
            rows={jobs}
            loading={loading}
            searchable
            searchPlaceholder={t('jobs.searchPlaceholder')}
            rowKey={(r) => r.id}
            emptyTitle={t('jobs.noJobsYet')}
            emptyDescription={t('jobs.noJobsYetDescription')}
            emptyIcon={WorkIcon}
            defaultSort="title"
          />
        </CardContent>
      </Card>

      {/* Create dialog */}
      <JobDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        companies={companies}
        interviewConfig={interviewConfig}
        onSave={async (data) => {
          await createJob(data);
          toast.success(t('jobs.jobCreated'));
        }}
      />

      {/* Edit dialog */}
      {editJob && (
        <JobDialog
          open={Boolean(editJob)}
          job={editJob}
          companies={companies}
          interviewConfig={interviewConfig}
          onClose={() => setEditJob(null)}
          onSave={async (data) => { await updateJob(editJob.id, data); toast.success(t('jobs.jobUpdated')); }}
        />
      )}

      {/* Delete/archive dialog */}
      {deleteJob && (
        <DeleteDialog
          open={Boolean(deleteJob)}
          jobTitle={deleteJob.title}
          onClose={() => setDeleteJob(null)}
          onConfirm={async () => { await removeJob(deleteJob.id); toast.success(t('jobs.jobArchived')); }}
        />
      )}
    </Box>
  );
}
