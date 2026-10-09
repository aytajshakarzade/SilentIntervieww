import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Alert, Autocomplete, Box, Button, CircularProgress, Divider, MenuItem, Paper,
  Select, Stack, TextField, Typography, Chip
} from '@mui/material';
import PersonSearchRoundedIcon from '@mui/icons-material/PersonSearchRounded';
import BusinessRoundedIcon from '@mui/icons-material/BusinessRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import AddBusinessRoundedIcon from '@mui/icons-material/AddBusinessRounded';
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded';
import { useAuth } from '../hooks/useAuth';
import { getRoleBase, ROUTES } from '../constants/routes';
import { companyService } from '../services/companyService';
import { getErrorMessage } from '../utils/errorUtils';
import { useTranslation } from '../i18n';
import { STORAGE_KEYS } from '../constants/storageKeys';

const REGION_CODES = `AF AL DZ AS AD AO AI AQ AG AR AM AW AU AT AZ BS BH BD BB BY BE BZ BJ BM BT BO BQ BA BW BV BR IO BN BG BF BI CV KH CM CA KY CF TD CL CN CX CC CO KM CG CD CK CR CI HR CU CW CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FK FO FJ FI FR GF PF TF GA GM GE DE GH GI GR GL GD GP GU GT GG GN GW GY HT HM VA HN HK HU IS IN ID IR IQ IE IM IL IT JM JP JE JO KZ KE KI KP KR KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MQ MR MU YT MX FM MD MC MN ME MS MA MZ MM NA NR NP NL NC NZ NI NE NG NU NF MK MP NO OM PK PW PS PA PG PY PE PH PN PL PT PR QA RE RO RU RW BL SH KN LC MF PM VC WS SM ST SA SN RS SC SL SG SX SK SI SB SO ZA GS SS ES LK SD SR SJ SE CH SY TW TJ TZ TH TL TG TK TO TT TN TR TM TC TV UG UA AE GB US UM UY UZ VU VE VN VG VI WF EH YE ZM ZW`.split(' ');

function countryName(code) {
  try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) || code; } catch { return code; }
}
const COUNTRIES = REGION_CODES.map(code => ({ code, name: countryName(code) })).sort((a,b) => a.name.localeCompare(b.name));

export default function GoogleAccountSetupPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { googleLogin } = useAuth();
  const [role, setRole] = useState('Candidate');
  const [country, setCountry] = useState('');
  const [company, setCompany] = useState(null);
  const [customCompany, setCustomCompany] = useState('');
  const [companies, setCompanies] = useState([]);
  const [pending, setPending] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [error, setError] = useState('');
  const submitLockRef = useRef(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('silent-interview.google-pending');
      if (!raw) { navigate(ROUTES.LOGIN, { replace: true }); return; }
      setPending(JSON.parse(raw));
    } catch { navigate(ROUTES.LOGIN, { replace: true }); }
  }, [navigate]);

  useEffect(() => {
    if (role !== 'Recruiter' || !country) { setCompanies([]); return; }
    setLoadingCompanies(true);
    setCompany(null);
    companyService.getPublic(country)
      .then(data => setCompanies((Array.isArray(data) ? data : []).slice(0, 20)))
      .catch(err => setError(getErrorMessage(err)))
      .finally(() => setLoadingCompanies(false));
  }, [role, country]);

  const filteredCompanies = useMemo(() => companies.slice(0, 20), [companies]);

  const selectedCountry = COUNTRIES.find(c => c.code === country);
  const selectedCountryName = selectedCountry?.name || country;
  const effectiveCompanyName = customCompany.trim() || company?.name || '';
  const canContinue = role === 'Candidate' || (Boolean(country) && Boolean(effectiveCompanyName));

  const complete = async () => {
    if (!pending?.credential || !canContinue || loading || submitLockRef.current) return;
    submitLockRef.current = true;
    const requestId = ++requestIdRef.current;
    setError(''); setLoading(true);
    try {
      const user = await googleLogin(
        pending.credential,
        role,
        company?.id && company.id !== '00000000-0000-0000-0000-000000000000' ? company.id : null,
        effectiveCompanyName || null,
        country || null,
        company?.industry || null,
        pending.setupToken || null,
      );
      sessionStorage.removeItem('silent-interview.google-pending');
      try { localStorage.setItem(STORAGE_KEYS.newAccountTour, String(user?.id || '1')); } catch { /* ignore storage errors */ }
      navigate(getRoleBase(user?.role), { replace: true });
    } catch (err) {
      if (requestId === requestIdRef.current) setError(getErrorMessage(err));
      submitLockRef.current = false;
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight:'100vh', display:'grid', placeItems:'center', p:{xs:2,md:4}, bgcolor:'#120f0c', position:'relative', overflow:'hidden' }}>
      <Box sx={{ position:'absolute', width:650, height:650, borderRadius:'50%', background:'radial-gradient(circle, rgba(234,118,0,.20), transparent 66%)', top:'-25%', left:'-15%' }}/>
      <Box sx={{ position:'absolute', width:520, height:520, borderRadius:'50%', background:'radial-gradient(circle, rgba(124,92,255,.15), transparent 66%)', bottom:'-25%', right:'-12%' }}/>

      <Paper elevation={0} sx={{ position:'relative', width:'100%', maxWidth:820, borderRadius:5, overflow:'hidden', border:'1px solid rgba(255,255,255,.10)', bgcolor:'#1c1713', color:'#fff', boxShadow:'0 30px 100px rgba(0,0,0,.42)' }}>
        <Box sx={{ p:{xs:3,md:5}, borderBottom:'1px solid rgba(255,255,255,.08)', background:'linear-gradient(135deg, rgba(234,118,0,.12), rgba(255,255,255,.02))' }}>
          <Button component={RouterLink} to={ROUTES.LOGIN} startIcon={<ArrowBackRoundedIcon/>} sx={{ color:'rgba(255,255,255,.65)', textTransform:'none', fontWeight:800, mb:3, '&:hover':{color:'#fff',bgcolor:'rgba(255,255,255,.05)'} }}>{t('googleSetup.back')}</Button>
          <Stack direction="row" spacing={2} alignItems="center">
            <Box sx={{ width:58,height:58,borderRadius:3,display:'grid',placeItems:'center',background:'linear-gradient(135deg,#EA7600,#ff9c33)',boxShadow:'0 12px 30px rgba(234,118,0,.25)' }}><VerifiedRoundedIcon/></Box>
            <Box>
              <Typography variant="h4" sx={{fontWeight:950,letterSpacing:'-.04em'}}>{t('googleSetup.title')}</Typography>
              <Typography sx={{color:'rgba(255,255,255,.62)',mt:.5}}>{t('googleSetup.subtitle')}</Typography>
            </Box>
          </Stack>
          {pending && <Box sx={{mt:3,display:'flex',alignItems:'center',gap:1.2,flexWrap:'wrap'}}><Chip label={pending.name || 'Google account'} sx={{bgcolor:'rgba(255,255,255,.08)',color:'#fff',fontWeight:800}}/><Typography variant="body2" sx={{color:'rgba(255,255,255,.5)'}}>{pending.email}</Typography></Box>}
        </Box>

        <Box sx={{p:{xs:3,md:5}}}>
          {error && <Alert severity="error" sx={{mb:3,borderRadius:3}} onClose={()=>setError('')}>{error}</Alert>}

          <Typography variant="overline" sx={{letterSpacing:'.14em',color:'#EA7600',fontWeight:900}}>{t('googleSetup.workspaceLabel')}</Typography>
          <Typography variant="h6" sx={{fontWeight:900,mt:.4}}>{t('googleSetup.workspaceTitle')}</Typography>
          <Typography sx={{color:'rgba(255,255,255,.55)',fontSize:'.9rem',mt:.5,mb:2.5}}>{t('googleSetup.workspaceDesc')}</Typography>

          <Box sx={{display:'grid',gridTemplateColumns:{xs:'1fr',sm:'1fr 1fr'},gap:1.5}}>
            {[{id:'Candidate',title:t('googleSetup.candidate'),desc:t('googleSetup.candidateDesc'),Icon:PersonSearchRoundedIcon},{id:'Recruiter',title:t('googleSetup.recruiter'),desc:t('googleSetup.recruiterDesc'),Icon:BusinessRoundedIcon}].map(({id,title,desc,Icon})=>{
              const selected=role===id;
              return <Box key={id} role="button" tabIndex={0} onClick={()=>{setRole(id);setCompany(null);setCustomCompany('');}} sx={{p:2.4,borderRadius:3.5,cursor:'pointer',border:'1px solid',borderColor:selected?'#EA7600':'rgba(255,255,255,.10)',background:selected?'rgba(234,118,0,.10)':'rgba(255,255,255,.025)',transition:'180ms ease', '&:hover':{transform:'translateY(-2px)',borderColor:'rgba(234,118,0,.65)'}}}>
                <Stack direction="row" justifyContent="space-between"><Box sx={{width:44,height:44,borderRadius:2.5,display:'grid',placeItems:'center',bgcolor:selected?'#EA7600':'rgba(255,255,255,.07)',color:'#fff'}}><Icon/></Box>{selected&&<CheckCircleRoundedIcon sx={{color:'#EA7600'}}/>}</Stack>
                <Typography sx={{fontWeight:950,mt:1.8}}>{title}</Typography><Typography sx={{color:'rgba(255,255,255,.55)',fontSize:'.84rem',lineHeight:1.55,mt:.5}}>{desc}</Typography>
              </Box>;
            })}
          </Box>

          {role==='Recruiter' && <>
            <Divider sx={{my:4,borderColor:'rgba(255,255,255,.08)'}}/>
            <Typography variant="overline" sx={{letterSpacing:'.14em',color:'#EA7600',fontWeight:900}}>{t('googleSetup.companyLabel')}</Typography>
            <Typography variant="h6" sx={{fontWeight:900,mt:.4}}>{t('googleSetup.companyTitle')}</Typography>
            <Typography sx={{color:'rgba(255,255,255,.55)',fontSize:'.9rem',mt:.5,mb:2.5}}>{t('googleSetup.companyDesc')}</Typography>
            {country && <Chip icon={<PublicRoundedIcon sx={{color:'#EA7600!important'}}/>} label={`${selectedCountryName} · ${companies.length || 0} ${t('googleSetup.company')}`} sx={{mb:2,bgcolor:'rgba(234,118,0,.08)',color:'rgba(255,255,255,.82)',fontWeight:800}}/>}

            <Box sx={{display:'grid',gridTemplateColumns:{xs:'1fr',md:'0.85fr 1.15fr'},gap:2}}>
              <Box>
                <Typography sx={{fontSize:'.78rem',fontWeight:850,color:'rgba(255,255,255,.72)',mb:.8}}>{t('googleSetup.country')}</Typography>
                <Select fullWidth value={country} onChange={e=>{setCountry(e.target.value);setCompany(null);setCustomCompany('');setError('');}} displayEmpty sx={{borderRadius:2.8,color:'#fff',bgcolor:'rgba(255,255,255,.035)','& .MuiOutlinedInput-notchedOutline':{borderColor:'rgba(255,255,255,.12)'},'& .MuiSvgIcon-root':{color:'rgba(255,255,255,.7)'}}}>
                  <MenuItem value="" disabled><Stack direction="row" spacing={1} alignItems="center"><PublicRoundedIcon fontSize="small"/>{t('googleSetup.selectCountry')}</Stack></MenuItem>
                  {COUNTRIES.map(c=><MenuItem key={c.code} value={c.code}>{c.name}</MenuItem>)}
                </Select>
              </Box>
              <Box>
                <Typography sx={{fontSize:'.78rem',fontWeight:850,color:'rgba(255,255,255,.72)',mb:.8}}>{t('googleSetup.company')}</Typography>
                <Autocomplete
                  options={filteredCompanies}
                  value={company}
                  loading={loadingCompanies}
                  onChange={(_,value)=>{setCompany(value);if(value)setCustomCompany('');}}
                  getOptionLabel={o=>o?.name||''}
                  isOptionEqualToValue={(a,b)=>a.name===b.name && a.country===b.country}
                  disabled={!country}
                  noOptionsText={country ? t('googleSetup.noCompany') : t('googleSetup.countryFirst')}
                  popupIcon={<SearchRoundedIcon sx={{color:'rgba(255,255,255,.55)'}}/>}
                  renderOption={(props,o)=><Box component="li" {...props} sx={{'&:hover':{bgcolor:'rgba(234,118,0,.08)!important'}}}><Box sx={{width:36,height:36,borderRadius:2,display:'grid',placeItems:'center',bgcolor:'rgba(234,118,0,.10)',mr:1.3,color:'#EA7600'}}><BusinessRoundedIcon fontSize="small"/></Box><Box><Typography sx={{fontWeight:800}}>{o.name}</Typography><Typography variant="caption" color="text.secondary">{o.industry || t('googleSetup.company') + ' workspace'} · {o.country}</Typography></Box></Box>}
                  renderInput={params=><TextField {...params} placeholder={country ? t('googleSetup.searchCompanies') : t('googleSetup.countryFirst')} InputProps={{...params.InputProps, startAdornment:<SearchRoundedIcon sx={{mr:1,color:'rgba(255,255,255,.4)'}}/>}}/>}
                />
              </Box>
            </Box>

            <Box sx={{mt:2,p:2.2,borderRadius:3,border:'1px dashed rgba(255,255,255,.14)',bgcolor:'rgba(255,255,255,.02)'}}>
              <Stack direction="row" spacing={1.2} alignItems="center"><AddBusinessRoundedIcon sx={{color:'#EA7600'}}/><Box><Typography sx={{fontWeight:850,fontSize:'.9rem'}}>{t('googleSetup.customTitle')}</Typography><Typography sx={{color:'rgba(255,255,255,.48)',fontSize:'.78rem'}}>{t('googleSetup.customDesc')}</Typography></Box></Stack>
              <TextField fullWidth value={customCompany} onChange={e=>{setCustomCompany(e.target.value);setCompany(null);}} placeholder={country ? t('googleSetup.customPlaceholder') : t('googleSetup.countryFirst')} disabled={!country} sx={{mt:1.5}}/>
            </Box>
          </>}

          <Divider sx={{my:4,borderColor:'rgba(255,255,255,.08)'}}/>
          <Stack direction={{xs:'column',sm:'row'}} spacing={1.5} justifyContent="space-between" alignItems={{xs:'stretch',sm:'center'}}>
            <Typography variant="caption" sx={{color:'rgba(255,255,255,.42)',maxWidth:390}}>{t('googleSetup.note')}</Typography>
            <Button onClick={complete} disabled={loading||!canContinue} variant="contained" size="large" endIcon={!loading&&<ArrowBackRoundedIcon sx={{transform:'rotate(180deg)'}}/>} sx={{minHeight:54,minWidth:{sm:250},borderRadius:2.8,fontWeight:950,bgcolor:'#EA7600','&:hover':{bgcolor:'#d96d00'},'&.Mui-disabled':{bgcolor:'rgba(255,255,255,.08)',color:'rgba(255,255,255,.3)'}}}>
              {loading ? <CircularProgress size={22} color="inherit"/> : (role === 'Recruiter' ? t('googleSetup.continueRecruiter') : t('googleSetup.continueCandidate'))}
            </Button>
          </Stack>
        </Box>
      </Paper>
    </Box>
  );
}
