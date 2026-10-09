import { motion } from 'framer-motion';
import { Button } from '@mui/material';
import { forwardRef } from 'react';

const PremiumButton = forwardRef(({ children, variant='contained', glow=true, ...props }, ref) => {
  const MotionButton=motion(Button);
  return <MotionButton ref={ref} variant={variant} {...props}
    whileHover={glow?{y:-1}:{}} whileTap={{scale:.985}} transition={{duration:.18,ease:[.2,.8,.2,1]}}
    sx={{borderRadius:3,minHeight:46,fontWeight:750,padding:'11px 20px',textTransform:'none',boxShadow:variant==='contained'?'0 10px 25px rgba(242,124,0,.20)':'none',...props.sx}}>
    {children}
  </MotionButton>;
});
PremiumButton.displayName='PremiumButton';
export default PremiumButton;
