import { Outlet } from 'react-router-dom';
import { IconButton, Stack, Tooltip } from '@mui/material';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import { Box } from '@mui/material';
import AmbientField from '../design/AmbientField';

/** Minimal layout for public pages — no sidebar or top nav. */
export default function PublicLayout({ colorMode = 'dark', toggleColorMode }) {
  return (
    <Box sx={{ position: 'relative', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AmbientField compact />
      <Stack direction="row" spacing={1} sx={{ position:'fixed', top:{xs:14,sm:20}, right:{xs:14,sm:22}, zIndex:40 }}>
        <Tooltip title={colorMode === 'dark' ? 'Light mode' : 'Dark mode'}>
          <IconButton onClick={toggleColorMode} aria-label={colorMode === 'dark' ? 'Light mode' : 'Dark mode'} sx={{ width:42,height:42,borderRadius:3,bgcolor:(t)=>t.palette.mode==='dark'?'rgba(255,255,255,.06)':'rgba(255,255,255,.82)',border:'1px solid',borderColor:'divider',color:'text.primary',boxShadow:'0 10px 28px rgba(0,0,0,.12)','&:hover':{borderColor:'primary.main',transform:'translateY(-1px)'} }}>
            {colorMode === 'dark' ? <LightModeRoundedIcon fontSize="small" /> : <DarkModeRoundedIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Stack>
      <Box sx={{ position: 'relative', zIndex: 1 }}><Outlet /></Box>
    </Box>
  );
}
