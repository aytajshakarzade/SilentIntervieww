import { motion } from 'framer-motion';
import { Box, Typography, IconButton } from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PremiumCard from './PremiumCard';

const PremiumChartCard = ({ title, children, actions, ...props }) => {
  return (
    <PremiumCard {...props}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
          {title}
        </Typography>
        {actions && (
          <IconButton size="small" sx={{ color: 'text.secondary' }}>
            <MoreVertIcon fontSize="small" />
          </IconButton>
        )}
      </Box>
      <Box sx={{ minHeight: 200 }}>
        {children}
      </Box>
    </PremiumCard>
  );
};

export default PremiumChartCard;