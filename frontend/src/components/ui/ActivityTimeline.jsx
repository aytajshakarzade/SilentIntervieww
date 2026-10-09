import { Box, Chip, Stack, Typography } from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import EmptyState from './EmptyState';
import { useTranslation } from '../../i18n';

const STATUS = {
  az: { applied: 'Müraciət edildi', reviewpending: 'Nəzərdən keçirilir', interviewed: 'Müsahibə keçirildi', shortlisted: 'Qısa siyahıda', accepted: 'Qəbul edildi', hired: 'İşə qəbul edildi', rejected: 'Rədd edildi', offersent: 'Təklif göndərildi', archived: 'Arxivləndi' },
  en: { applied: 'Applied', reviewpending: 'Review pending', interviewed: 'Interviewed', shortlisted: 'Shortlisted', accepted: 'Accepted', hired: 'Hired', rejected: 'Rejected', offersent: 'Offer sent', archived: 'Archived' },
  ru: { applied: 'Отклик', reviewpending: 'На рассмотрении', interviewed: 'Интервью пройдено', shortlisted: 'В шорт-листе', accepted: 'Принят', hired: 'Нанят', rejected: 'Отклонён', offersent: 'Оффер отправлен', archived: 'Архив' },
};

const ACTIONS = {
  az: { applicationstatuschanged: 'Status dəyişdirildi', applicationcreated: 'Müraciət yaradıldı', interviewcreated: 'Müsahibə yaradıldı', reportcreated: 'Hesabat yaradıldı' },
  en: { applicationstatuschanged: 'Application status changed', applicationcreated: 'Application created', interviewcreated: 'Interview created', reportcreated: 'Report created' },
  ru: { applicationstatuschanged: 'Статус отклика изменён', applicationcreated: 'Отклик создан', interviewcreated: 'Интервью создано', reportcreated: 'Отчёт создан' },
};

const ENTITIES = {
  az: { jobapplication: 'Müraciət', interviewsession: 'Müsahibə', report: 'Hesabat', job: 'Vakansiya' },
  en: { jobapplication: 'Application', interviewsession: 'Interview', report: 'Report', job: 'Job' },
  ru: { jobapplication: 'Отклик', interviewsession: 'Интервью', report: 'Отчёт', job: 'Вакансия' },
};

function localizeDescription(description = '', language = 'en') {
  let value = String(description);
  const statusMap = STATUS[language] || STATUS.en;
  value = value.replace(/\b(Applied|ReviewPending|Interviewed|Shortlisted|Accepted|Hired|Rejected|OfferSent|Archived)\b/g, match => statusMap[match.toLowerCase()] || match);
  if (language === 'az') {
    value = value.replace(/ moved to ([^.]+)\.?$/i, ' mərhələsinə keçirildi: $1.');
    value = value.replace(/^Application submitted for (.+)\.?$/i, '$1 üçün müraciət göndərildi.');
  } else if (language === 'ru') {
    value = value.replace(/ moved to ([^.]+)\.?$/i, ' — переход на новый этап.');
    value = value.replace(/^Application submitted for (.+)\.?$/i, 'Отклик на $1 отправлен.');
  }
  return value;
}

function relativeTime(date, language) {
  if (!date) return '—';
  const diff = Math.max(0, Date.now() - new Date(date).getTime());
  const mins = Math.floor(diff / 60000);
  if (language === 'az') {
    if (mins < 1) return 'indi';
    if (mins < 60) return `${mins} dəq əvvəl`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} saat əvvəl`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} gün əvvəl`;
  } else if (language === 'ru') {
    if (mins < 1) return 'только что';
    if (mins < 60) return `${mins} мин назад`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} ч назад`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} дн назад`;
  } else {
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
  }
  return new Date(date).toLocaleDateString(language === 'az' ? 'az-AZ' : language === 'ru' ? 'ru-RU' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ActivityTimeline({ activities = [], compact = false }) {
  const { t, language } = useTranslation();
  if (!activities.length) {
    return <EmptyState title={t('activityTimelineComponent.noActivityYet')} description={t('activityTimelineComponent.noActivityYetDescription')} icon={HistoryIcon} />;
  }

  const actionMap = ACTIONS[language] || ACTIONS.en;
  const entityMap = ENTITIES[language] || ENTITIES.en;

  return <Stack spacing={compact ? 1.25 : 1.75}>
    {activities.map((activity, index) => {
      const actionKey = String(activity.action || '').toLowerCase();
      const entityKey = String(activity.entityType || '').toLowerCase();
      return <Box key={activity.id || index} sx={{ display: 'grid', gridTemplateColumns: '18px 1fr', gap: 1.25 }}>
        <Box sx={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
          <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: index === 0 ? 'primary.main' : 'divider', mt: 0.75, zIndex: 1 }} />
          {index < activities.length - 1 && <Box sx={{ position: 'absolute', top: 16, bottom: -14, width: 1, bgcolor: 'divider' }} />}
        </Box>
        <Box sx={{ pb: compact ? 0.5 : 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'flex-start' }}>
            <Typography variant="body2" fontWeight={650}>{localizeDescription(activity.description, language)}</Typography>
            <Typography variant="caption" color="text.disabled" sx={{ whiteSpace: 'nowrap' }}>{relativeTime(activity.createdAt, language)}</Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.75, mt: 0.65, flexWrap: 'wrap' }}>
            {activity.actorName && <Typography variant="caption" color="text.secondary">{activity.actorName}</Typography>}
            <Chip label={actionMap[actionKey] || activity.action || '—'} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.64rem' }} />
            <Chip label={entityMap[entityKey] || activity.entityType || '—'} size="small" sx={{ height: 20, fontSize: '0.64rem', bgcolor: 'action.hover' }} />
          </Box>
        </Box>
      </Box>;
    })}
  </Stack>;
}
