import { useState } from 'react';
import { useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import { getErrorMessage } from "../utils/errorUtils";
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import {
  Box, TextField, Typography, Alert, InputAdornment, IconButton,
  Checkbox, FormControlLabel, Divider, Paper, Stack, CircularProgress,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import EmailIcon from '@mui/icons-material/Email';
import LockIcon from '@mui/icons-material/Lock';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { useAuth } from '../hooks/useAuth';
import { getRoleBase, ROUTES } from '../constants/routes';
import { useTranslation } from '../i18n';
import LanguageSwitcher from '../components/common/LanguageSwitcher';
import GoogleSignInButton from '../components/auth/GoogleSignInButton';
import { PremiumCard, PremiumButton, PremiumInput } from '../components/design';

// ─── Animated brand illustration ─────────────────────────────────────────────
function BrandPanel() {
  const { t } = useTranslation();
  return (
    <Box
      sx={{
        flex: 1,
        display: { xs: 'none', lg: 'flex' },
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'radial-gradient(circle at 72% 18%, rgba(124,108,255,.16), transparent 24%), radial-gradient(circle at 25% 72%, rgba(242,124,0,.16), transparent 28%), linear-gradient(145deg,#0c0d10 0%,#111318 52%,#171922 100%)',
        p: {md:6, xl:8},
        position: 'relative',
        borderRight: '1px solid rgba(255,255,255,.08)',
        overflow: 'hidden',
      }}
    >
      {/* Back to home */}
      <Box
        component={RouterLink}
        to={ROUTES.HOME}
        sx={{
          position: 'absolute', top: 28, left: 28, zIndex: 20, display: 'flex', alignItems: 'center', gap: 1,
          color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: '0.82rem', fontWeight: 600,
          px: 1.5, py: 0.75, borderRadius: 2, border: '1px solid rgba(255,255,255,0.12)',
          transition: 'all 160ms ease',
          '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.2)' },
        }}
      >
        <ArrowBackRoundedIcon sx={{ fontSize: 16 }} />
        {t('auth.backToHome')}
      </Box>

      <Box className="ambient-grid" sx={{position:'absolute',inset:0,opacity:.22,maskImage:'linear-gradient(to bottom,black,transparent 88%)'}} />
      <Box sx={{position:'absolute',top:'11%',right:'10%',width:110,height:110,border:'1px solid rgba(255,255,255,.08)',borderRadius:'30%',transform:'rotate(18deg)',animation:'floatSoft 5s ease-in-out infinite'}} />
      <Box sx={{position:'absolute',bottom:'12%',left:'9%',width:80,height:80,border:'1px solid rgba(242,124,0,.20)',borderRadius:'50%',boxShadow:'0 0 80px rgba(242,124,0,.10)'}} />

      {/* Background glow */}
      <Box sx={{ position: 'absolute', top: '20%', left: '30%', width: 300, height: 300, background: 'radial-gradient(circle, rgba(234,118,0,0.30) 0%, transparent 70%)', borderRadius: '50%' }} />
      <Box sx={{ position: 'absolute', bottom: '20%', right: '20%', width: 200, height: 200, background: 'radial-gradient(circle, rgba(255,156,51,0.22) 0%, transparent 70%)', borderRadius: '50%' }} />

      {/* Waveform illustration */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4, position:'relative' }}>
        {[0.3, 0.6, 1, 0.8, 0.5, 0.9, 0.4, 0.7, 1, 0.6, 0.3].map((h, i) => (
          <Box
            key={i}
            sx={{
              width: 5,
              height: `${h * 72}px`,
              background: `linear-gradient(180deg, rgba(255,173,72,${0.45 + h * 0.5}), rgba(242,124,0,.85))`,
              borderRadius: 1,
              animation: `waveBar ${0.6 + i * 0.08}s ease-in-out infinite alternate`,
              animationDelay: `${i * 0.07}s`,
            }}
          />
        ))}
      </Box>

      <Typography
        variant="h3"
        sx={{ color: '#fff', fontFamily: '"Poppins", sans-serif', fontWeight: 700, textAlign: 'center', lineHeight: 1.2, mb: 2 }}
      >
        {t('auth.tagline1')}<br />
        <Box component="span" sx={{ background: 'linear-gradient(135deg, #EA7600, #FF9C33)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
          {t('auth.tagline2')}
        </Box>
      </Typography>
      <Typography sx={{ color: 'rgba(255,255,255,0.6)', textAlign: 'center', maxWidth: 500, lineHeight: 1.75, mb: 4 }}>
        {t('auth.heroSubtitle')}
      </Typography>

      {/* Feature chips */}
      {[
        ['⚡', t('auth.featureRoleAccess')],
        ['🎯', t('auth.featureAiScored')],
        ['📊', t('auth.featureAnalytics')],
      ].map(([icon, label]) => (
        <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5, px: 2.5, py: 1, bgcolor: 'rgba(255,255,255,0.07)', borderRadius: 2, border: '1px solid rgba(255,255,255,0.1)', width: '100%', maxWidth: 430 }}>
          <Typography sx={{ fontSize: '1rem' }}>{icon}</Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.875rem', fontWeight: 500 }}>{label}</Typography>
        </Box>
      ))}
    </Box>
  );
}

// ─── Main login form ─────────────────────────────────────────────────────────
export default function LoginPage() {
  const { login, googleLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname;
  const { t, language } = useTranslation();

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);


  const handleGoogleCredential = async (credential) => {
    setError('');
    try {
      const result = await googleLogin(credential);
      if (result?.requiresSetup) {
        sessionStorage.setItem('silent-interview.google-pending', JSON.stringify(resultWithCredential(result, credential)));
        navigate('/auth/google/setup', { replace: true });
        return;
      }
      navigate(from || getRoleBase(result?.role), { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, language));
    }
  };

  function resultWithCredential(result, credential) { return { ...result, credential }; }


  const { register, handleSubmit, formState: { errors } } = useForm();

  const onSubmit = async (data) => {
    setError('');
    setLoading(true);
    try {
      // ✅ AUTH BUG FIX:
      // After login, we receive the user object with role, and IMMEDIATELY
      // navigate to the role-appropriate dashboard using React Router.
      // The old monolithic engine never called navigate() — it relied on
      // internal state.view which only worked if the component re-rendered
      // with the right role check.
      const user = await login({ email: data.email, password: data.password });
      const destination = from || getRoleBase(user?.role);
      navigate(destination, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, language));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box className="fade-in" sx={{ display: 'flex', minHeight: '100vh' }}>
      <BrandPanel />

      {/* Form panel */}
      <Box
        sx={{
          width: { xs: '100%', lg: 480 },
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          px: { xs: 3, sm: 6 },
          py: 6,
          bgcolor: 'background.paper', backgroundImage: (theme) => theme.palette.mode === 'dark' ? 'linear-gradient(180deg,rgba(255,255,255,.018),transparent 38%), radial-gradient(circle at 100% 0%,rgba(242,124,0,.05),transparent 30%)' : 'linear-gradient(180deg,rgba(255,255,255,.7),transparent 42%)',
        }}
      >
        {/* Logo */}
        <Box sx={{ mb: 4, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box>
            <Typography
              component={RouterLink}
              to={ROUTES.HOME}
              variant="h5"
              sx={{ fontFamily: '"Poppins", sans-serif', fontWeight: 700, mb: 0.5, textDecoration: 'none', color: 'text.primary', display: 'inline-block' }}
            >
              Silent<Box component="span" sx={{ color: '#EA7600' }}>Interview</Box>
            </Typography>
            <Typography color="text.secondary" variant="body2">
              {t('auth.signInToWorkspace')}
            </Typography>
          </Box>
          <LanguageSwitcher variant="text" />
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        <PremiumCard>
          <Box component="form" onSubmit={handleSubmit(onSubmit)}>
            <Stack spacing={3}>
              <PremiumInput
                label={t('auth.emailAddress')}
                type="email"
                fullWidth
                autoComplete="email"
                error={Boolean(errors.email)}
                helperText={errors.email?.message}
                icon={<EmailIcon fontSize="small" />}
                {...register('email', { required: t('validation.emailRequired'), pattern: { value: /\S+@\S+\.\S+/, message: t('validation.emailInvalid') } })}
              />

              <PremiumInput
                label={t('auth.password')}
                type={showPassword ? 'text' : 'password'}
                fullWidth
                autoComplete="current-password"
                error={Boolean(errors.password)}
                helperText={errors.password?.message}
                icon={<LockIcon fontSize="small" />}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowPassword((s) => !s)} edge="end">
                        {showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                {...register('password', { required: t('validation.passwordRequired') })}
              />

              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <FormControlLabel
                  control={<Checkbox size="small" />}
                  label={<Typography variant="caption">{t('auth.rememberMe')}</Typography>}
                />
                <Typography component={RouterLink} to="/forgot-password" variant="caption" sx={{ color: '#EA7600', cursor: 'pointer', fontWeight: 600, textDecoration: 'none' }}>
                  {t('auth.forgotPassword')}
                </Typography>
              </Box>

              <PremiumButton
                type="submit"
                fullWidth
                variant="contained"
                disabled={loading}
              >
                {loading ? <CircularProgress size={20} color="inherit" /> : t('auth.signInToDashboard')}
              </PremiumButton>
            </Stack>
          </Box>
        </PremiumCard>

        <GoogleSignInButton onCredential={handleGoogleCredential} disabled={loading} context="signin" />

        <Divider sx={{ my: 3 }}>
          <Typography variant="caption" color="text.disabled">{t('common.or')}</Typography>
        </Divider>


        <Typography variant="body2" color="text.secondary" sx={{ mt: 4, textAlign: 'center' }}>
          {t('auth.noAccount')}{' '}
          <RouterLink to={ROUTES.REGISTER} style={{ color: 'inherit', fontWeight: 600, textDecoration: 'underline' }}>
            {t('auth.register')}
          </RouterLink>
        </Typography>
      </Box>
    </Box>
  );
}
