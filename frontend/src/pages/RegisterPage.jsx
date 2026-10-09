import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import {
  Alert, Autocomplete, Box, CircularProgress, Divider, FormControl,
  FormHelperText, InputAdornment, IconButton, InputLabel, LinearProgress,
  MenuItem, Select, Stack, TextField, Typography, Chip,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import PersonIcon from '@mui/icons-material/Person';
import EmailIcon from '@mui/icons-material/Email';
import LockIcon from '@mui/icons-material/Lock';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import BusinessRoundedIcon from '@mui/icons-material/BusinessRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { useAuth } from '../hooks/useAuth';
import { ROUTES, getRoleBase } from '../constants/routes';
import { getErrorMessage } from '../utils/errorUtils';
import { useTranslation } from '../i18n';
import { PremiumCard, PremiumButton, PremiumInput } from '../components/design';
import GoogleSignInButton from '../components/auth/GoogleSignInButton';
import { STORAGE_KEYS } from '../constants/storageKeys';
import { companyService } from '../services/companyService';

const COUNTRY_CODES = `AF AL DZ AS AD AO AI AQ AG AR AM AW AU AT AZ BS BH BD BB BY BE BZ BJ BM BT BO BQ BA BW BV BR IO BN BG BF BI CV KH CM CA KY CF TD CL CN CX CC CO KM CG CD CK CR CI HR CU CW CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FK FO FJ FI FR GF PF TF GA GM GE DE GH GI GR GL GD GP GU GT GG GN GW GY HT HM VA HN HK HU IS IN ID IR IQ IE IM IL IT JM JP JE JO KZ KE KI KP KR KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MQ MR MU YT MX FM MD MC MN ME MS MZ MM NA NR NP NL NC NZ NI NE NG NU NF MK MP NO OM PK PW PS PA PG PY PE PH PN PL PT PR QA RE RO RU RW BL SH KN LC MF PM VC WS SM ST SA SN RS SC SL SG SX SK SI SB SO ZA GS SS ES LK SD SR SJ SE CH SY TW TJ TZ TH TL TG TK TO TT TN TR TM TC TV UG UA AE GB US UM UY UZ VU VE VN VG VI WF EH YE ZM ZW`.split(' ');
function countryName(code, locale='en') { try { return new Intl.DisplayNames([locale === 'az' ? 'az' : locale === 'ru' ? 'ru' : 'en'], { type: 'region' }).of(code) || code; } catch { return code; } }

const COPY = {
  az: {
    workspace: 'İş sahəsi', country: 'Ölkə', company: 'Şirkət', searchCompany: 'Şirkət axtarın...', loadingCompanies: 'Şirkətlər yüklənir...', noCompanies: 'Bu ölkə üzrə hazırda şirkət tapılmadı.', custom: 'Şirkətiniz siyahıda yoxdur?', customPlaceholder: 'Şirkət adını yazın', selected: 'seçildi', countryHint: 'Ölkəni seçin — şirkətlər dərhal görünəcək.', companyHint: 'Siyahıdan şirkəti seçin və ya adını daxil edin.', recruiterNeedsCompany: 'Recruiter hesabı üçün şirkət seçmək tələb olunur.', general: 'Ümumi', website: 'Veb sayt',
  },
  ru: {
    workspace: 'Рабочее пространство', country: 'Страна', company: 'Компания', searchCompany: 'Поиск компании...', loadingCompanies: 'Загрузка компаний...', noCompanies: 'Компании для этой страны пока не найдены.', custom: 'Нет вашей компании в списке?', customPlaceholder: 'Введите название компании', selected: 'выбрана', countryHint: 'Выберите страну — компании появятся сразу.', companyHint: 'Выберите компанию из списка или введите название.', recruiterNeedsCompany: 'Для аккаунта рекрутера необходимо выбрать компанию.', general: 'Общее', website: 'Сайт',
  },
  en: {
    workspace: 'Workspace', country: 'Country', company: 'Company', searchCompany: 'Search companies...', loadingCompanies: 'Loading companies...', noCompanies: 'No companies found for this country yet.', custom: 'Can’t find your company?', customPlaceholder: 'Enter company name', selected: 'selected', countryHint: 'Choose a country — companies appear instantly.', companyHint: 'Select a company from the directory or enter its name.', recruiterNeedsCompany: 'Recruiter accounts require a company selection.', general: 'General', website: 'Website',
  },
};

function calcStrength(pwd, t) {
  if (!pwd) return { score: 0, label: '', color: '' };
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[a-z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 1) return { score: 20, label: t('registerPage.strengthWeak'), color: 'error' };
  if (score === 2) return { score: 40, label: t('registerPage.strengthFair'), color: 'warning' };
  if (score <= 4) return { score: 60, label: t('registerPage.strengthGood'), color: 'info' };
  if (score === 5) return { score: 80, label: t('registerPage.strengthStrong'), color: 'success' };
  return { score: 100, label: t('registerPage.strengthExcellent'), color: 'success' };
}
function getRequirements(t) { return [
  { label: t('registerPage.req8Chars'), test: p => p.length >= 8 },
  { label: t('registerPage.reqUppercase'), test: p => /[A-Z]/.test(p) },
  { label: t('registerPage.reqLowercase'), test: p => /[a-z]/.test(p) },
  { label: t('registerPage.reqNumber'), test: p => /[0-9]/.test(p) },
  { label: t('registerPage.reqSpecialChar'), test: p => /[^A-Za-z0-9]/.test(p) },
]; }

function BrandPanel({ t }) {
  return <Box sx={{ flex:1, display:{xs:'none',lg:'flex'}, flexDirection:'column', justifyContent:'center', alignItems:'center', background:'radial-gradient(circle at 55% 38%, rgba(234,118,0,.16), transparent 30%), linear-gradient(150deg,#17120e,#2b1d14 55%,#201812)', p:6, position:'relative', overflow:'hidden' }}>
    <Box component={RouterLink} to={ROUTES.HOME} sx={{ position:'absolute',top:28,left:28,zIndex:20,display:'flex',alignItems:'center',gap:1,color:'rgba(255,255,255,.65)',textDecoration:'none',px:1.5,py:.75,borderRadius:2,border:'1px solid rgba(255,255,255,.12)','&:hover':{color:'#fff',bgcolor:'rgba(255,255,255,.06)'} }}><ArrowBackRoundedIcon sx={{fontSize:17}}/>{t('auth.backToHome')}</Box>
    <motion.div animate={{ y:[0,-8,0] }} transition={{ duration:4, repeat:Infinity, ease:'easeInOut' }}><Box sx={{ width:90,height:90,borderRadius:7,display:'grid',placeItems:'center',background:'linear-gradient(145deg,rgba(234,118,0,.22),rgba(255,255,255,.04))',border:'1px solid rgba(234,118,0,.25)',boxShadow:'0 25px 70px rgba(234,118,0,.16)',mb:4 }}><Box sx={{display:'flex',alignItems:'center',gap:.7}}>{[.3,.7,1,.55,.85,.45,.75].map((h,i)=><Box key={i} sx={{width:4,height:24*h,borderRadius:4,bgcolor:'#ff9c33',animation:`waveBar ${.55+i*.08}s ease-in-out infinite alternate`,animationDelay:`${i*.06}s`}}/>)}</Box></Box></motion.div>
    <Typography variant="h3" sx={{color:'#fff',fontWeight:850,textAlign:'center',lineHeight:1.08,letterSpacing:'-.045em',mb:2}}>{t('registerPage.joinTeams')}<br/><Box component="span" sx={{background:'linear-gradient(135deg,#EA7600,#FFB15C)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>{t('registerPage.smarterEveryDay')}</Box></Typography>
    <Typography sx={{color:'rgba(255,255,255,.58)',textAlign:'center',maxWidth:420,lineHeight:1.75,mb:5}}>{t('registerPage.brandSubtitle')}</Typography>
    <Stack spacing={1.2} sx={{width:'100%',maxWidth:420}}>{[['⚡',t('registerPage.recruiterRole'),t('registerPage.recruiterDesc')],['🎯',t('registerPage.candidateRole'),t('registerPage.candidateDesc')]].map(([icon,title,desc])=><Box key={title} sx={{display:'flex',gap:1.5,alignItems:'flex-start',p:2,borderRadius:3,bgcolor:'rgba(255,255,255,.045)',border:'1px solid rgba(255,255,255,.08)'}}><Typography sx={{fontSize:'1.3rem'}}>{icon}</Typography><Box><Typography sx={{color:'#fff',fontWeight:800,fontSize:'.9rem'}}>{title}</Typography><Typography sx={{color:'rgba(255,255,255,.5)',fontSize:'.77rem',lineHeight:1.5}}>{desc}</Typography></Box></Box>)}</Stack>
  </Box>;
}

export default function RegisterPage() {
  const { t, language } = useTranslation();
  const { register: authRegister, login, googleLogin } = useAuth();
  const navigate = useNavigate();
  const copy = COPY[language] || COPY.en;
  const [showPassword,setShowPassword]=useState(false), [showConfirm,setShowConfirm]=useState(false), [error,setError]=useState(''), [loading,setLoading]=useState(false);
  const [country,setCountry]=useState(''); const [company,setCompany]=useState(null); const [customCompany,setCustomCompany]=useState(''); const [companies,setCompanies]=useState([]); const [loadingCompanies,setLoadingCompanies]=useState(false);
  const { register, handleSubmit, watch, formState:{errors} } = useForm({ defaultValues:{ role:'Candidate' } });
  const role=watch('role','Candidate'); const password=watch('password',''); const strength=calcStrength(password,t); const requirements=getRequirements(t);
  const countries=useMemo(()=>COUNTRY_CODES.map(code=>({code,name:countryName(code,language)})).sort((a,b)=>a.name.localeCompare(b.name)),[language]);

  useEffect(()=>{
    if(role!=='Recruiter' || !country){ setCompanies([]); setCompany(null); return; }
    let cancelled=false; setLoadingCompanies(true); setError(''); setCompany(null); setCustomCompany('');
    const timer=setTimeout(()=>companyService.getPublic(country).then(data=>{if(!cancelled)setCompanies(Array.isArray(data)?data.slice(0,20):[])}).catch(err=>{if(!cancelled)setError(getErrorMessage(err))}).finally(()=>{if(!cancelled)setLoadingCompanies(false)}),180);
    return()=>{cancelled=true;clearTimeout(timer)};
  },[role,country]);

  const handleGoogleCredential=async credential=>{setError('');setLoading(true);try{const result=await googleLogin(credential);if(result?.requiresSetup){sessionStorage.setItem('silent-interview.google-pending',JSON.stringify({...result,credential}));navigate('/auth/google/setup',{replace:true});return;}navigate(getRoleBase(result?.role),{replace:true});}catch(err){setError(getErrorMessage(err));}finally{setLoading(false);}};

  const onSubmit=async data=>{
    setError('');
    if(data.role==='Recruiter' && !country){setError(copy.countryHint);return;}
    const selectedName=customCompany.trim() || company?.name || '';
    if(data.role==='Recruiter' && !selectedName){setError(copy.recruiterNeedsCompany);return;}
    setLoading(true);
    try{
      await authRegister({fullName:data.fullName,email:data.email,password:data.password,confirmPassword:data.confirmPassword,role:data.role,companyId:null,companyName:selectedName||null,companyCountry:country||null,companyIndustry:company?.industry||null,companyWebsite:company?.website||null});
      const user=await login({email:data.email,password:data.password});
      try{localStorage.setItem(STORAGE_KEYS.newAccountTour,String(user?.id||'1'));}catch{}
      navigate(getRoleBase(user?.role),{replace:true});
    }catch(err){setError(getErrorMessage(err));}finally{setLoading(false);}
  };

  return <Box className="fade-in" sx={{display:'flex',minHeight:'100vh'}}><BrandPanel t={t}/><Box sx={{width:{xs:'100%',lg:560},display:'flex',flexDirection:'column',justifyContent:'center',px:{xs:2.5,sm:5},py:4,overflowY:'auto',bgcolor:'background.paper'}}>
    <Box sx={{mb:3}}><Typography component={RouterLink} to={ROUTES.HOME} variant="h5" sx={{fontWeight:800,textDecoration:'none',color:'text.primary'}}>Silent<Box component="span" sx={{color:'#EA7600'}}>Interview</Box></Typography><Typography color="text.secondary" variant="body2">{t('registerPage.createAccountSubtitle')}</Typography></Box>
    {error&&<Alert severity="error" sx={{mb:2,borderRadius:3}} onClose={()=>setError('')}>{error}</Alert>}
    <PremiumCard sx={{p:{xs:2,sm:2.5}}}><Box component="form" onSubmit={handleSubmit(onSubmit)}><Stack spacing={2.2}>
      <Stack direction={{xs:'column',sm:'row'}} spacing={1.3}><PremiumInput label={t('registerPage.fullName')} fullWidth autoComplete="name" error={Boolean(errors.fullName)} helperText={errors.fullName?.message} icon={<PersonIcon fontSize="small"/>} {...register('fullName',{required:t('registerPage.fullNameRequired'),minLength:{value:2,message:t('registerPage.nameTooShort')}})}/><PremiumInput label={t('registerPage.emailAddress')} type="email" fullWidth autoComplete="email" error={Boolean(errors.email)} helperText={errors.email?.message} icon={<EmailIcon fontSize="small"/>} {...register('email',{required:t('registerPage.emailRequired'),pattern:{value:/\S+@\S+\.\S+/,message:t('registerPage.emailInvalid')}})}/></Stack>
      <FormControl fullWidth error={Boolean(errors.role)}><InputLabel>{t('registerPage.iAmA')}</InputLabel><Select label={t('registerPage.iAmA')} defaultValue="Candidate" {...register('role',{required:true})}><MenuItem value="Candidate">{t('registerPage.roleCandidate')}</MenuItem><MenuItem value="Recruiter">{t('registerPage.roleRecruiter')}</MenuItem></Select>{errors.role&&<FormHelperText>{t('registerPage.selectRole')}</FormHelperText>}</FormControl>
      {role==='Recruiter'&&<Box sx={{p:1.7,borderRadius:3.5,bgcolor:'action.hover',border:'1px solid',borderColor:'divider'}}><Stack direction="row" spacing={1} alignItems="center" sx={{mb:1.2}}><BusinessRoundedIcon sx={{color:'primary.main'}}/><Box><Typography fontWeight={900} sx={{fontSize:'.9rem'}}>{copy.workspace}</Typography><Typography variant="caption" color="text.secondary">{copy.countryHint}</Typography></Box></Stack><Stack spacing={1.3}>
        <Autocomplete options={countries} value={countries.find(x=>x.code===country)||null} onChange={(_,v)=>setCountry(v?.code||'')} getOptionLabel={x=>`${x.name} (${x.code})`} renderInput={params=><TextField {...params} label={copy.country} placeholder={copy.country} InputProps={{...params.InputProps,startAdornment:<><InputAdornment position="start"><PublicRoundedIcon fontSize="small"/></InputAdornment>{params.InputProps.startAdornment}</>}}/>}/>
        {country&&<Autocomplete options={companies} loading={loadingCompanies} value={company} onChange={(_,v)=>{setCompany(v);setCustomCompany('')}} getOptionLabel={x=>x?.name||''} isOptionEqualToValue={(a,b)=>a.name===b.name} noOptionsText={loadingCompanies?copy.loadingCompanies:copy.noCompanies} renderOption={(props,option)=><Box component="li" {...props} sx={{display:'flex',gap:1.2,alignItems:'center','&:hover':{bgcolor:'action.hover'}}}><Box sx={{width:36,height:36,borderRadius:2,display:'grid',placeItems:'center',bgcolor:'rgba(234,118,0,.10)',color:'primary.main',fontWeight:900}}>{option.name?.slice(0,1).toUpperCase()}</Box><Box><Typography fontWeight={800} sx={{fontSize:'.82rem'}}>{option.name}</Typography><Typography variant="caption" color="text.secondary">{option.industry||copy.general}{option.website?` · ${option.website}`:''}</Typography></Box></Box>} renderInput={params=><TextField {...params} label={copy.company} placeholder={copy.searchCompany} InputProps={{...params.InputProps,startAdornment:<><InputAdornment position="start"><SearchRoundedIcon fontSize="small"/></InputAdornment>{params.InputProps.startAdornment}</>}}/>}/>} 
        <Box sx={{pt:.2}}><Typography variant="caption" color="text.secondary">{copy.custom}</Typography><TextField fullWidth size="small" value={customCompany} onChange={e=>{setCustomCompany(e.target.value);setCompany(null)}} placeholder={copy.customPlaceholder} sx={{mt:.6}}/></Box>
        {company&&<Chip size="small" icon={<CheckCircleIcon/>} label={`${company.name} — ${copy.selected}`} color="success" variant="outlined" sx={{width:'fit-content'}}/>}
      </Stack></Box>}
      <Box><PremiumInput label={t('registerPage.password')} type={showPassword?'text':'password'} fullWidth autoComplete="new-password" error={Boolean(errors.password)} helperText={errors.password?.message} icon={<LockIcon fontSize="small"/>} InputProps={{endAdornment:<InputAdornment position="end"><IconButton size="small" onClick={()=>setShowPassword(s=>!s)}>{showPassword?<VisibilityOffIcon fontSize="small"/>:<VisibilityIcon fontSize="small"/>}</IconButton></InputAdornment>}} {...register('password',{required:t('registerPage.passwordRequired'),minLength:{value:8,message:t('registerPage.passwordMinLength')},validate:{uppercase:v=>/[A-Z]/.test(v)||t('registerPage.reqUppercase'),lowercase:v=>/[a-z]/.test(v)||t('registerPage.reqLowercase'),number:v=>/[0-9]/.test(v)||t('registerPage.reqNumber'),specialChar:v=>/[^A-Za-z0-9]/.test(v)||t('registerPage.reqSpecialChar')}})}/>{password&&<Box sx={{mt:1}}><Box sx={{display:'flex',justifyContent:'space-between',mb:.5}}><Typography variant="caption" color="text.secondary">{t('registerPage.passwordStrength')}</Typography><Typography variant="caption" color={`${strength.color}.main`} fontWeight={700}>{strength.label}</Typography></Box><LinearProgress variant="determinate" value={strength.score} color={strength.color||'primary'} sx={{height:6,borderRadius:3}}/><Box sx={{mt:1,display:'grid',gridTemplateColumns:'1fr 1fr',gap:.4}}>{requirements.map(r=><Box key={r.label} sx={{display:'flex',alignItems:'center',gap:.4}}>{r.test(password)?<CheckCircleIcon sx={{fontSize:12,color:'success.main'}}/>:<RadioButtonUncheckedIcon sx={{fontSize:12,color:'text.disabled'}}/>}<Typography variant="caption" color={r.test(password)?'success.main':'text.disabled'} sx={{fontSize:'.66rem'}}>{r.label}</Typography></Box>)}</Box></Box>}</Box>
      <PremiumInput label={t('registerPage.confirmPassword')} type={showConfirm?'text':'password'} fullWidth autoComplete="new-password" error={Boolean(errors.confirmPassword)} helperText={errors.confirmPassword?.message} icon={<LockIcon fontSize="small"/>} InputProps={{endAdornment:<InputAdornment position="end"><IconButton size="small" onClick={()=>setShowConfirm(s=>!s)}>{showConfirm?<VisibilityOffIcon fontSize="small"/>:<VisibilityIcon fontSize="small"/>}</IconButton></InputAdornment>}} {...register('confirmPassword',{required:t('registerPage.confirmPasswordRequired'),validate:value=>value===password||t('registerPage.passwordsNotMatch')})}/>
      <PremiumButton type="submit" fullWidth variant="contained" disabled={loading}>{loading?<CircularProgress size={20} color="inherit"/>:t('registerPage.createAccount')}</PremiumButton>
    </Stack></Box></PremiumCard>
    <GoogleSignInButton onCredential={handleGoogleCredential} disabled={loading} context="signup"/><Divider sx={{my:2.2}}><Typography variant="caption" color="text.disabled">{t('common.or')}</Typography></Divider><Typography variant="body2" color="text.secondary" sx={{textAlign:'center'}}>{t('registerPage.alreadyHaveAccount')} <Typography component={RouterLink} to={ROUTES.LOGIN} variant="body2" sx={{color:'#EA7600',fontWeight:700,textDecoration:'none'}}>{t('registerPage.signIn')}</Typography></Typography>
  </Box></Box>;
}
