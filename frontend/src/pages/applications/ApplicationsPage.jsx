import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Avatar, Box, Button, Card, Chip, CircularProgress, InputAdornment, Menu, MenuItem, Skeleton, Stack, TextField, Tooltip, Typography, IconButton } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import WorkIcon from '@mui/icons-material/Work';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import toast from 'react-hot-toast';
import EmptyState from '../../components/ui/EmptyState';
import { interviewService } from '../../services/interviewService';
import { getErrorMessage } from '../../utils/errorUtils';
import { getInitials } from '../../utils/formatters';
import { useTranslation } from '../../i18n';

const toItems = (value) => Array.isArray(value) ? value : (value?.items ?? []);
const formatStatus = (status, language = 'en') => {
    const key = String(status || '').toLowerCase().replace(/[^a-z]/g, '');
    const maps = {
        az: { applied: 'Müraciət edildi', reviewpending: 'Nəzərdən keçirilir', interviewed: 'Müsahibə keçirildi', shortlisted: 'Qısa siyahıda', accepted: 'Qəbul edildi', hired: 'İşə qəbul edildi', rejected: 'Rədd edildi', offersent: 'Təklif göndərildi', archived: 'Arxivləndi' },
        en: { applied: 'Applied', reviewpending: 'Review pending', interviewed: 'Interviewed', shortlisted: 'Shortlisted', accepted: 'Accepted', hired: 'Hired', rejected: 'Rejected', offersent: 'Offer sent', archived: 'Archived' },
        ru: { applied: 'Отклик', reviewpending: 'На рассмотрении', interviewed: 'Интервью пройдено', shortlisted: 'В шорт-листе', accepted: 'Принят', hired: 'Нанят', rejected: 'Отклонён', offersent: 'Оффер отправлен', archived: 'Архив' },
    };
    return maps[language]?.[key] || String(status || '').replace(/([a-z])([A-Z])/g, '$1 $2');
};
const statusColor = (status) => {
    const value = String(status || '').toLowerCase();
    if (value.includes('accept') || value.includes('offer')) return 'success';
    if (value.includes('reject')) return 'error';
    if (value.includes('interview')) return 'info';
    if (value.includes('screen') || value.includes('review')) return 'warning';
    return 'default';
};

function MoveMenu({ application, statuses, onMove, disabled, t, language }) {
    const [anchorEl, setAnchorEl] = useState(null);
    const options = (application.availableNextStatuses || []).filter((status) => statuses.includes(status));
    if (!options.length) return null;
    return <>
        <Tooltip title={t('applicationsPage.moveToStage')}>
            <IconButton
                size="small"
                aria-label={t('applicationsPage.moveAriaLabel', { name: application.candidateName || t('applicationsPage.candidateFallback') })}
                aria-haspopup="menu"
                onClick={(event) => setAnchorEl(event.currentTarget)}
                disabled={disabled}
            >
                <MoreVertIcon fontSize="small" />
            </IconButton>
        </Tooltip>
        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
            {options.map((status) => (
                <MenuItem key={status} onClick={() => { setAnchorEl(null); onMove(application, status); }}>
                    {t('applicationsPage.moveTo', { status: formatStatus(status, language) })}
                </MenuItem>
            ))}
        </Menu>
    </>;
}

export default function ApplicationsPage() {
    const { t, language } = useTranslation();
    const [applications, setApplications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [draggedId, setDraggedId] = useState(null);
    const [updatingId, setUpdatingId] = useState(null);

    const load = useCallback(async () => {
        setLoading(true); setError('');
        try { setApplications(toItems(await interviewService.applications.getAll({ pageNumber: 1, pageSize: 100 }))); }
        catch (requestError) { setError(getErrorMessage(requestError)); }
        finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const visible = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return applications;
        return applications.filter((application) => [application.candidateName, application.jobTitle, application.status].some((value) => String(value || '').toLowerCase().includes(query)));
    }, [applications, search]);
    const statuses = useMemo(() => [...new Set(visible.flatMap((application) => [application.status, ...(application.availableNextStatuses || [])]).filter(Boolean))], [visible]);

    const move = async (application, targetStatus) => {
        if (application.status === targetStatus) return;
        if (!(application.availableNextStatuses || []).includes(targetStatus)) {
            toast.error(t('applicationsPage.notAllowedToMove', { status: formatStatus(targetStatus, language) }));
            return;
        }
        setUpdatingId(application.id);
        try {
            await interviewService.applications.update(application.id, { status: targetStatus });
            toast.success(t('applicationsPage.movedTo', { status: formatStatus(targetStatus, language) }));
            await load();
        } catch (requestError) { toast.error(getErrorMessage(requestError)); }
        finally { setUpdatingId(null); setDraggedId(null); }
    };

    return <Box>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 3, flexWrap: 'wrap' }}><Box><Typography variant="h4" fontWeight={800} sx={{ letterSpacing: '-0.03em' }}>{t('applicationsPage.title')}</Typography><Typography variant="body2" color="text.secondary">{t('applicationsPage.subtitle')}</Typography></Box><Button variant="outlined" startIcon={<RefreshIcon />} onClick={load}>{t('applicationsPage.refresh')}</Button></Box>
        {error && <Alert severity="error" action={<Button color="inherit" size="small" onClick={load}>{t('applicationsPage.retry')}</Button>} sx={{ mb: 2 }}>{error}</Alert>}
        <TextField data-tour="applications-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('applicationsPage.searchPlaceholder')} size="small" sx={{ minWidth: { xs: '100%', sm: 320 }, mb: 2.5 }} InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} />
        {loading ? <Box sx={{ display: 'flex', gap: 2, overflow: 'hidden' }}>{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} variant="rounded" width={300} height={420} sx={{ flexShrink: 0 }} />)}</Box> : !visible.length ? <Card><EmptyState title={applications.length ? t('applicationsPage.noMatchTitle') : t('applicationsPage.noneYetTitle')} description={applications.length ? t('applicationsPage.tryAnotherSearch') : t('applicationsPage.noneYetDescription')} icon={WorkIcon} /></Card> : <Box data-tour="pipeline-board" sx={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: { xs: 'minmax(280px, 88vw)', md: 'minmax(290px, 1fr)' }, gridTemplateRows: '1fr', gap: 2, overflowX: 'auto', pb: 1.5, alignItems: 'start' }}>
            {statuses.map((status) => {
                const columnItems = visible.filter((application) => application.status === status);
                return <Box key={status} onDragOver={(event) => event.preventDefault()} onDrop={() => { const application = applications.find((item) => item.id === draggedId); if (application) move(application, status); }} sx={{ minHeight: 360, p: 1.25, borderRadius: 3, bgcolor: 'action.hover', border: '1px solid', borderColor: draggedId ? 'primary.light' : 'divider', transition: 'border-color 150ms ease' }}><Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 0.5, pb: 1.25 }}><Chip label={formatStatus(status, language)} color={statusColor(status)} size="small" sx={{ fontWeight: 700 }} /><Typography variant="caption" color="text.secondary">{columnItems.length}</Typography></Box><Stack spacing={1.2}>{columnItems.map((application) => <Card key={application.id} draggable onDragStart={() => setDraggedId(application.id)} onDragEnd={() => setDraggedId(null)} sx={{ cursor: 'grab', border: '1px solid', borderColor: updatingId === application.id ? 'primary.main' : 'divider', transition: 'transform 150ms ease, box-shadow 150ms ease', '&:hover': { transform: 'translateY(-2px)', boxShadow: 3 } }}><Box sx={{ p: 1.5 }}><Box sx={{ display: 'flex', gap: 1.2, alignItems: 'flex-start' }}><Avatar sx={{ width: 34, height: 34, bgcolor: 'primary.main', fontSize: '0.7rem', fontWeight: 750 }}>{getInitials(application.candidateName)}</Avatar><Box sx={{ flex: 1, minWidth: 0 }}><Typography variant="body2" fontWeight={750} noWrap>{application.candidateName || t('applicationsPage.candidateFallbackName')}</Typography><Typography variant="caption" color="text.secondary" noWrap>{application.jobTitle || t('applicationsPage.jobOpportunityFallback')}</Typography></Box><Tooltip title={t('applicationsPage.dragToPermittedStage')}><DragIndicatorIcon fontSize="small" color="disabled" /></Tooltip><MoveMenu application={application} statuses={statuses} onMove={move} disabled={updatingId === application.id} t={t} language={language} /></Box><Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1.5 }}><Typography variant="caption" color="text.disabled">{t('applicationsPage.applied', { date: application.appliedAt ? new Date(application.appliedAt).toLocaleDateString() : '—' })}</Typography>{updatingId === application.id ? <CircularProgress size={16} /> : <Chip label={formatStatus(application.status, language)} color={statusColor(application.status)} size="small" variant="outlined" sx={{ height: 21, fontSize: '0.62rem' }} />}</Box></Box></Card>)}</Stack>{!columnItems.length && <Typography variant="caption" color="text.disabled" sx={{ display: 'block', textAlign: 'center', py: 3 }}>{t('applicationsPage.dropEligibleCandidate')}</Typography>}</Box>;
            })}
        </Box>}
    </Box>;
}
