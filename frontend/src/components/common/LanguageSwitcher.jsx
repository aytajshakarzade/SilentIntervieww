import { useState } from 'react';
import { Box, Menu, MenuItem, ListItemIcon, ListItemText, Tooltip, IconButton } from '@mui/material';
import LanguageIcon from '@mui/icons-material/Language';
import { useTranslation } from '../../i18n';
import { LANGUAGES } from '../../i18n/languages';

/**
 * Compact globe-icon language switcher. Drop it into any toolbar/header —
 * it's self-contained and reads/writes the shared LanguageContext, so
 * switching here updates every page instantly without a reload.
 *
 * variant="icon"   -> just the globe button (default, for AppBar/Sidebar)
 * variant="text"   -> shows the current language label next to the icon
 *                     (nice for the public/auth layout header)
 */
export default function LanguageSwitcher({ variant = 'icon', sx }) {
  const { language, setLanguage, t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const handleSelect = (code) => {
    setLanguage(code);
    setAnchorEl(null);
  };

  return (
    <Box sx={sx}>
      <Tooltip title={t('common.language') || 'Language'}>
        {variant === 'text' ? (
          <Box
            onClick={(e) => setAnchorEl(e.currentTarget)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setAnchorEl(e.currentTarget); }}
            sx={{
              display: 'flex', alignItems: 'center', gap: 0.75, cursor: 'pointer',
              px: 1.25, py: 0.75, borderRadius: 2, color: 'text.secondary',
              transition: 'all 160ms ease',
              '&:hover': { bgcolor: 'action.hover', color: 'text.primary' },
            }}
            data-tour="language-switcher"
          >
            <LanguageIcon fontSize="small" />
            <Box component="span" sx={{ fontSize: '0.8125rem', fontWeight: 600 }}>
              {LANGUAGES[language]?.flag} {LANGUAGES[language]?.label}
            </Box>
          </Box>
        ) : (
          <IconButton
            onClick={(e) => setAnchorEl(e.currentTarget)}
            aria-label={t('common.language') || 'Language'}
            data-tour="language-switcher"
            sx={{
              color: 'text.secondary', width: 40, height: 40, borderRadius: 2.8,
              border: '1px solid', borderColor: 'divider',
              bgcolor: 'action.hover', transition: 'all 160ms ease',
              '&:hover': { color: 'text.primary', borderColor: 'primary.main', transform: 'translateY(-1px)', boxShadow: '0 10px 26px rgba(0,0,0,.09)' },
            }}
          >
            <LanguageIcon fontSize="small" />
          </IconButton>
        )}
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {Object.values(LANGUAGES).map((lang) => (
          <MenuItem
            key={lang.code}
            selected={lang.code === language}
            onClick={() => handleSelect(lang.code)}
            sx={{ minWidth: 160 }}
          >
            <ListItemIcon sx={{ fontSize: '1.1rem', minWidth: 32 }}>{lang.flag}</ListItemIcon>
            <ListItemText primary={lang.label} />
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}
