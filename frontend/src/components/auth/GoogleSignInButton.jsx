import { useEffect, useRef, useState } from 'react';
import { Box, CircularProgress, useTheme } from '@mui/material';
import { useTranslation } from '../../i18n';

/**
 * Google Identity Services button with a clean, standard-looking visual.
 *
 * The official Google Identity Services button is rendered directly.
 * We intentionally avoid a transparent overlay because GIS can render its
 * iframe at a slightly different size, which can leave the visible label
 * clickable only intermittently.
 */
export default function GoogleSignInButton({ onCredential, disabled = false, context = 'signin' }) {
  const hostRef = useRef(null);
  const timerRef = useRef(null);
  const callbackRef = useRef(onCredential);
  const disabledRef = useRef(disabled);
  callbackRef.current = onCredential;
  disabledRef.current = disabled;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const { t } = useTranslation();
  const theme = useTheme();

  useEffect(() => {
    let cancelled = false;
    let initialized = false;
    let clientId = String(import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();

    const initialize = () => {
      if (cancelled || initialized || !clientId || !window.google?.accounts?.id || !hostRef.current) return false;

      initialized = true;
      hostRef.current.innerHTML = '';
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: ({ credential }) => {
          if (!credential || disabledRef.current || cancelled) return;
          callbackRef.current?.(credential);
        },
        ux_mode: 'popup',
        auto_select: false,
        cancel_on_tap_outside: true,
        context: context === 'signup' ? 'signup' : 'signin',
        use_fedcm_for_button: true,
      });

      window.google.accounts.id.renderButton(hostRef.current, {
        type: 'standard',
        theme: theme.palette.mode === 'dark' ? 'filled_black' : 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        logo_alignment: 'left',
        width: 380,
      });
      setReady(true);
      return true;
    };

    const load = async () => {
      if (!clientId) {
        try {
          const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';
          const response = await fetch(`${base}/Auth/google/config`, { credentials: 'include', cache: 'no-store' });
          if (response.ok) {
            const payload = await response.json();
            clientId = String(payload?.data?.clientId || payload?.clientId || '').trim();
          }
        } catch {
          // Keep the visible control quiet; the server will expose a useful error on submit.
        }
      }

      if (cancelled) return;
      if (!clientId) {
        setError(t('auth.googleNotConfigured'));
        return;
      }

      let script = document.getElementById('google-gsi');
      if (!script) {
        script = document.createElement('script');
        script.id = 'google-gsi';
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }

      if (initialize()) return;
      let tries = 0;
      timerRef.current = window.setInterval(() => {
        tries += 1;
        if (initialize() || tries >= 100) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
          if (tries >= 100 && !window.google?.accounts?.id) setError(t('auth.googleNotConfigured'));
        }
      }, 100);
    };

    load();

    return () => {
      cancelled = true;
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [context, t, theme.palette.mode]);

  return (
    <Box
      sx={{
        mt: 2.4,
        width: '100%',
        minHeight: 48,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        opacity: disabled ? 0.58 : 1,
        transition: 'opacity .2s ease, transform .2s ease',
        '&:hover': { transform: disabled || !ready ? 'none' : 'translateY(-1px)' },
      }}
    >
      <Box
        ref={hostRef}
        sx={{
          width: 'min(380px, 100%)',
          minHeight: 48,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'hidden',
          borderRadius: 2,
          pointerEvents: disabled ? 'none' : 'auto',
          '& > div': {
            width: '100% !important',
            maxWidth: '380px !important',
            minWidth: '0 !important',
            margin: '0 auto !important',
            display: 'flex !important',
            justifyContent: 'center !important',
          },
          '& iframe': {
            maxWidth: '100% !important',
            border: '0 !important',
          },
        }}
      />
      {error && (
        <Box
          sx={{
            position: 'absolute',
            width: '100%',
            mt: 7,
            textAlign: 'center',
            fontSize: '.69rem',
            color: 'text.secondary',
          }}
        >
          {error}
        </Box>
      )}
    </Box>
  );
}
