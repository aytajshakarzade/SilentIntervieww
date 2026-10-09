import { motion } from 'framer-motion';
import { Tooltip } from '@mui/material';
import { forwardRef } from 'react';

const PremiumTooltip = forwardRef(({ children, title, placement = 'top', arrow = true, ...props }, ref) => {
  return (
    <Tooltip
      ref={ref}
      title={title}
      placement={placement}
      arrow={arrow}
      {...props}
      slotProps={{
        tooltip: {
          sx: {
            bgcolor: 'grey.900',
            color: 'white',
            fontSize: '0.875rem',
            fontWeight: 500,
            borderRadius: 2,
            padding: '8px 12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          },
        },
        arrow: {
          sx: {
            color: 'grey.900',
          },
        },
      }}
    >
      {children}
    </Tooltip>
  );
});

PremiumTooltip.displayName = 'PremiumTooltip';

export default PremiumTooltip;