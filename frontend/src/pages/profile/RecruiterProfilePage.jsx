import { useEffect, useState, useCallback } from 'react';
import { Box, Card, CardContent, Typography, Avatar, Stack, Chip, Alert, CircularProgress } from '@mui/material';
import BusinessIcon from '@mui/icons-material/Business';
import { useAuth } from '../../hooks/useAuth';
import { recruiterService } from '../../services/recruiterService';
import { companyService } from '../../services/companyService';
import { getInitials } from '../../utils/formatters';
import { useTranslation } from '../../i18n';
import PlanBillingCard from '../../components/profile/PlanBillingCard';

export default function RecruiterProfilePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [recruiter, setRecruiter] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [recs, comps] = await Promise.all([recruiterService.getAll(), companyService.getAll()]);
      const recList = Array.isArray(recs) ? recs : recs?.items ?? [];
      const compList = Array.isArray(comps) ? comps : comps?.items ?? [];
      setCompanies(compList);
      setRecruiter(recList.find(r => r.userId === user?.id) ?? null);
    } catch {
      setRecruiter(null);
    } finally { setLoading(false); }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);
  const myCompany = companies.find(c => c.id === recruiter?.companyId);

  return (
    <Box sx={{ maxWidth: 760, pb: 5 }}>
      <Box sx={{ mb: 3 }}><Typography variant="h5" fontWeight={800}>{t('recruiterProfile.title')}</Typography><Typography color="text.secondary" variant="body2">{t('recruiterProfile.subtitle')}</Typography></Box>
      <Card sx={{ mb: 3 }}><CardContent sx={{ p: 3 }}><Stack direction="row" spacing={2.5} alignItems="center"><Avatar sx={{ width: 72, height: 72, bgcolor: 'primary.main', fontSize: '1.5rem', fontWeight: 800 }}>{getInitials(user?.name)}</Avatar><Box><Typography variant="h6" fontWeight={800}>{user?.name}</Typography><Typography color="text.secondary" variant="body2">{user?.email}</Typography><Stack direction="row" spacing={1} sx={{ mt: 1 }}><Chip label={t('recruiterProfile.recruiterBadge')} size="small" color="primary" variant="outlined"/>{myCompany&&<Chip label={myCompany.name} size="small" color="secondary" variant="outlined"/>}</Stack></Box></Stack></CardContent></Card>
      <PlanBillingCard />
      <Card sx={{ mt: 3 }}><CardContent sx={{ p: 3 }}><Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 2 }}><Box sx={{ p: 1, bgcolor: 'primary.main', borderRadius: 1.5, display: 'flex' }}><BusinessIcon sx={{ fontSize: 17, color: '#fff' }}/></Box><Box><Typography variant="subtitle2" fontWeight={800}>Company workspace</Typography><Typography variant="caption" color="text.secondary">Selected during account creation</Typography></Box></Stack>{loading?<Box sx={{display:'grid',placeItems:'center',py:4}}><CircularProgress size={24}/></Box>:myCompany?<Box sx={{p:2,bgcolor:'action.hover',borderRadius:2.5,border:'1px solid',borderColor:'divider'}}><Typography fontWeight={850}>{myCompany.name}</Typography><Typography variant="caption" color="text.secondary">{myCompany.industry||'General'}</Typography>{myCompany.website&&<Typography variant="caption" color="primary" sx={{display:'block',mt:.5}}>{myCompany.website}</Typography>}</Box>:<Alert severity="info">No company workspace is linked to this recruiter.</Alert>}</CardContent></Card>
    </Box>
  );
}
