import { Box, Chip, Stack, Typography } from '@mui/material';
import TimelineIcon from '@mui/icons-material/Timeline';
import { fmtDate } from '../../utils/formatters';
import EmptyState from '../ui/EmptyState';
import { useTranslation } from '../../i18n';

const colorForEvent = (type) => {
    const value = String(type || '').toLowerCase();
    if (value.includes('complete')) return 'success';
    if (value.includes('violation') || value.includes('error')) return 'error';
    if (value.includes('answer') || value.includes('save')) return 'info';
    return 'primary';
};

export default function InterviewTimeline({ events = [] }) {
    const { t } = useTranslation();
    if (!events.length) return <EmptyState title={t('interviewTimelineComponent.noRecordedEvents')} description={t('interviewTimelineComponent.noRecordedEventsDescription')} icon={TimelineIcon} />;

    return (
        <Stack spacing={1.5}>
            {events.map((event, index) => (
                <Box key={event.id} sx={{ display: 'grid', gridTemplateColumns: '20px 1fr', gap: 1.25 }}>
                    <Box sx={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: `${colorForEvent(event.type)}.main`, mt: 0.55, zIndex: 1 }} />
                        {index < events.length - 1 && <Box sx={{ position: 'absolute', top: 15, bottom: -16, width: 1, bgcolor: 'divider' }} />}
                    </Box>
                    <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                            <Chip label={event.type} color={colorForEvent(event.type)} size="small" sx={{ height: 21, fontSize: '0.66rem' }} />
                            <Typography variant="caption" color="text.disabled">{fmtDate(event.occurredAt)}</Typography>
                        </Box>
                        {event.detail && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{event.detail}</Typography>}
                    </Box>
                </Box>
            ))}
        </Stack>
    );
}
