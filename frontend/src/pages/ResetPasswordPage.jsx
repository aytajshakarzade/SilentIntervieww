import { useState } from 'react';
import { useSearchParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import { Box, Typography, Alert, Stack, CircularProgress } from '@mui/material';
import { useForm } from 'react-hook-form';
import { PremiumCard, PremiumButton, PremiumInput } from '../components/design';
import { useAuth } from '../hooks/useAuth';
import { getErrorMessage } from '../utils/errorUtils';
import { useTranslation } from '../i18n';

export default function ResetPasswordPage(){
 const { t } = useTranslation();
 const [params]=useSearchParams(), navigate=useNavigate(), {resetPassword}=useAuth();
 const token=params.get('token')||'', email=params.get('email')||'';
 const {register,handleSubmit,watch,formState:{errors}}=useForm();
 const [error,setError]=useState(''),[done,setDone]=useState(false),[loading,setLoading]=useState(false);
 const submit=async d=>{setLoading(true);setError('');try{await resetPassword({email,token,newPassword:d.password});setDone(true);setTimeout(()=>navigate('/login'),1200);}catch(e){setError(getErrorMessage(e));}finally{setLoading(false);}};
 return <Box sx={{minHeight:'100vh',display:'grid',placeItems:'center',p:3,bgcolor:'background.default'}}><Box sx={{width:'100%',maxWidth:460}}>
 <Typography component={RouterLink} to="/login" sx={{textDecoration:'none',color:'text.primary',fontWeight:800,fontSize:26,display:'block',mb:3}}>Silent<span style={{color:'#EA7600'}}>Interview</span></Typography>
 <PremiumCard><Stack spacing={3}><Box><Typography variant="h4" fontWeight={800}>{t('uiFixes.createNewPassword')}</Typography><Typography color="text.secondary" sx={{mt:1}}>{email}</Typography></Box>
 {error&&<Alert severity="error">{error}</Alert>}{done&&<Alert severity="success">{t('uiFixes.passwordUpdated')}</Alert>}
 <Box component="form" onSubmit={handleSubmit(submit)}><Stack spacing={2}>
 <PremiumInput label={t('uiFixes.newPassword')} type="password" fullWidth error={!!errors.password} {...register('password',{required:t('uiFixes.passwordRequired'),minLength:{value:8,message:t('uiFixes.minEight')}})}/>
 <PremiumInput label={t('uiFixes.confirmPassword')} type="password" fullWidth error={!!errors.confirm} {...register('confirm',{validate:v=>v===watch('password')||t('uiFixes.passwordsMismatch')})}/>
 <PremiumButton type="submit" fullWidth disabled={loading||!token}>{loading?<CircularProgress size={20}/>: t('uiFixes.updatePassword')}</PremiumButton>
 </Stack></Box></Stack></PremiumCard></Box></Box>;
}
