import { useState } from 'react';
import { Box, Typography, Alert, Stack, CircularProgress } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { PremiumCard, PremiumButton, PremiumInput } from '../components/design';
import { useAuth } from '../hooks/useAuth';
import { getErrorMessage } from '../utils/errorUtils';
import { useTranslation } from '../i18n';

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const { forgotPassword } = useAuth();
  const { register, handleSubmit, formState:{errors} } = useForm();
  const [sent,setSent]=useState(false), [error,setError]=useState(''), [loading,setLoading]=useState(false);
  const submit=async ({email})=>{setLoading(true);setError('');try{await forgotPassword(email);setSent(true);}catch(e){setError(getErrorMessage(e));}finally{setLoading(false);}};
  return <Box sx={{minHeight:'100vh',display:'grid',placeItems:'center',p:3,bgcolor:'background.default'}}>
    <Box sx={{width:'100%',maxWidth:460}}>
      <Typography component={RouterLink} to="/login" sx={{textDecoration:'none',color:'text.primary',fontWeight:800,fontSize:26,display:'block',mb:3}}>Silent<span style={{color:'#EA7600'}}>Interview</span></Typography>
      <PremiumCard><Stack spacing={3}>
        <Box><Typography variant="h4" fontWeight={800}>{t('uiFixes.forgotPassword')}</Typography><Typography color="text.secondary" sx={{mt:1}}>{t('uiFixes.forgotPasswordBody')}</Typography></Box>
        {error&&<Alert severity="error">{error}</Alert>}{sent&&<Alert severity="success">{t('uiFixes.resetSent')}</Alert>}
        <Box component="form" onSubmit={handleSubmit(submit)}><Stack spacing={2}>
          <PremiumInput label={t('auth.emailAddress')} type="email" fullWidth error={!!errors.email} {...register('email',{required:t('validation.emailRequired')})}/>
          <PremiumButton type="submit" fullWidth disabled={loading}>{loading?<CircularProgress size={20}/>: t('uiFixes.sendReset')}</PremiumButton>
        </Stack></Box>
        <Typography textAlign="center" color="text.secondary"><RouterLink to="/login">{t('uiFixes.backToSignIn')}</RouterLink></Typography>
      </Stack></PremiumCard>
    </Box>
  </Box>;
}
