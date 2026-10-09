import { motion } from 'framer-motion';
import { Card, CardContent } from '@mui/material';
import { forwardRef } from 'react';

const PremiumCard = forwardRef(({ children, hover = true, ...props }, ref) => (
  <motion.div whileHover={hover ? { y: -3 } : {}} transition={{ duration: .24, ease: [.2,.8,.2,1] }}>
    <Card ref={ref} {...props} sx={{
      position:'relative', overflow:'hidden', borderRadius:4,
      background:(theme)=>theme.palette.mode==='dark'?'linear-gradient(145deg,rgba(25,27,34,.96),rgba(16,17,22,.94))':'linear-gradient(145deg,rgba(255,253,250,.96),rgba(248,245,239,.92))',
      border:(theme)=>`1px solid ${theme.palette.divider}`,
      boxShadow:(theme)=>theme.palette.mode==='dark'?'0 18px 55px rgba(0,0,0,.20)':'0 16px 45px rgba(48,38,26,.075)',
      '&::before':{content:'""',position:'absolute',width:180,height:180,right:-100,top:-100,borderRadius:'50%',background:'radial-gradient(circle,rgba(242,124,0,.10),transparent 68%)',pointerEvents:'none'},
      ...props.sx,
    }}>
      <CardContent sx={{p:{xs:2.7,sm:3.2,md:3.4}}}>{children}</CardContent>
    </Card>
  </motion.div>
));
PremiumCard.displayName='PremiumCard';
export default PremiumCard;
