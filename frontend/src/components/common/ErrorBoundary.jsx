import { Component } from 'react';
import { Box, Button, Typography, Paper } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import { STORAGE_KEYS } from '../../constants/storageKeys';

// ErrorBoundary can render when something inside the React tree — including
// the LanguageProvider itself — has thrown, so it deliberately does NOT use
// the useTranslation() hook (a hook that reads context from a provider that
// may be the very thing that crashed is not safe here). Instead it reads
// the same persisted language preference the provider uses, directly from
// storage, with English as a safe fallback if that read fails or the value
// is unrecognized.
const COPY = {
  en: { title: 'Something went wrong', fallback: 'An unexpected error occurred. Please try refreshing the page.', reload: 'Reload Application' },
  az: { title: 'Xəta baş verdi', fallback: 'Gözlənilməz xəta baş verdi. Səhifəni yeniləməyi sınayın.', reload: 'Tətbiqi Yenidən Yüklə' },
  ru: { title: 'Что-то пошло не так', fallback: 'Произошла непредвиденная ошибка. Попробуйте обновить страницу.', reload: 'Перезагрузить приложение' },
};

function readLanguage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.language);
    if (stored && COPY[stored]) return stored;
  } catch { /* localStorage unavailable */ }
  return 'en';
}

export class ErrorBoundary extends Component {
  state = { error: null, info: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const copy = COPY[readLanguage()];
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default', p: 3 }}>
        <Paper elevation={0} sx={{ maxWidth: 480, width: '100%', p: 5, textAlign: 'center', border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
          <ErrorOutlineIcon sx={{ fontSize: 56, color: 'error.main', mb: 2 }} />
          <Typography variant="h5" fontWeight={700} gutterBottom>{copy.title}</Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            {this.state.error.message || copy.fallback}
          </Typography>
          <Button variant="contained" startIcon={<RefreshIcon />} onClick={() => window.location.reload()}>
            {copy.reload}
          </Button>
        </Paper>
      </Box>
    );
  }
}
