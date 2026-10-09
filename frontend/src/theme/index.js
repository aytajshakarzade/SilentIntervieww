import { createTheme } from '@mui/material/styles';

export const tokens = {
  primary:{50:'#fff8ef',100:'#ffead0',200:'#ffd09b',300:'#ffb45e',400:'#ff9a24',500:'#f27c00',600:'#cf5f00',700:'#a94a00',800:'#773300',900:'#4a2100'},
  violet:{400:'#9b8cff',500:'#7c6cff',600:'#6655e8'},
  ink:{50:'#f8f7f5',100:'#e9e7e3',200:'#d1cec8',300:'#aaa69f',400:'#817c74',500:'#5d5852',600:'#403c37',700:'#2b2825',800:'#1c1a18',900:'#100f0e'},
  gray:{50:'#fafafa',100:'#f3f2f0',200:'#e4e1dc',300:'#cbc7c0',400:'#aaa59d',500:'#817c74',600:'#625d56',700:'#47423d',800:'#302c28',900:'#1d1a18'},
  light:{bg1:'#f5f1eb',bg2:'#fbfaf8',bg3:'#eee9e2',card:'#fffdfa'},
  dark:{bg1:'#0c0d10',bg2:'#111318',bg3:'#171922',bg4:'#1d2029',card:'#15171d',border:'rgba(255,255,255,.085)'},
  success:{500:'#2dd47a',100:'#dcfce9'},warning:{500:'#f7b955',100:'#fff2d2'},error:{500:'#ff5c65',100:'#ffe2e4'},info:{500:'#61a8ff',100:'#dcecff'},
};
tokens.brand=tokens.primary; tokens.indigo=tokens.violet; tokens.slate=tokens.gray; tokens.mint=tokens.success; tokens.emerald=tokens.success; tokens.amber=tokens.warning; tokens.rose=tokens.error; tokens.sky=tokens.info;

export default function createAppTheme(mode='light'){
  const dark=mode==='dark', bg=dark?tokens.dark.bg1:tokens.light.bg1, paper=dark?tokens.dark.card:tokens.light.card, text=dark?'#f6f4f0':'#211d19', secondary=dark?'#aaa8ae':'#6b655e', border=dark?tokens.dark.border:'rgba(42,35,28,.10)';
  return createTheme({
    palette:{mode,primary:{main:tokens.primary[500],light:tokens.primary[400],dark:tokens.primary[600],contrastText:'#fff'},secondary:{main:tokens.violet[500],light:tokens.violet[400],dark:tokens.violet[600],contrastText:'#fff'},background:{default:bg,paper},text:{primary:text,secondary},divider:border,success:{main:tokens.success[500],light:tokens.success[100]},warning:{main:tokens.warning[500],light:tokens.warning[100]},error:{main:tokens.error[500],light:tokens.error[100]},info:{main:'#2fb8e8',light:'#67d5ff',dark:'#1188b2',contrastText:'#fff'}},
    typography:{fontFamily:'"Poppins","Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',h1:{fontWeight:800,letterSpacing:'-.045em'},h2:{fontWeight:800,letterSpacing:'-.04em'},h3:{fontWeight:750,letterSpacing:'-.035em'},h4:{fontWeight:750,letterSpacing:'-.03em'},h5:{fontWeight:700,letterSpacing:'-.02em'},h6:{fontWeight:700},body1:{lineHeight:1.65},body2:{lineHeight:1.55},button:{textTransform:'none',fontWeight:700,letterSpacing:'-.01em'}},
    shape:{borderRadius:18},
    shadows:['none','0 2px 8px rgba(20,15,10,.05)','0 5px 18px rgba(20,15,10,.07)','0 10px 28px rgba(20,15,10,.09)','0 16px 42px rgba(20,15,10,.12)','0 24px 64px rgba(20,15,10,.16)',...Array(21).fill('0 28px 80px rgba(20,15,10,.18)')],
    components:{
      MuiCssBaseline:{styleOverrides:{html:{scrollBehavior:'smooth'},body:{background:bg,color:text,backgroundImage:dark?'radial-gradient(circle at 85% 5%,rgba(124,108,255,.10),transparent 26%),radial-gradient(circle at 15% 85%,rgba(242,124,0,.07),transparent 28%)':'radial-gradient(circle at 90% 0%,rgba(242,124,0,.07),transparent 25%),radial-gradient(circle at 10% 90%,rgba(124,108,255,.045),transparent 25%)',backgroundAttachment:'fixed'}}},
      MuiButton:{defaultProps:{disableElevation:true},styleOverrides:{root:{borderRadius:14,minHeight:48,padding:'11px 19px',fontWeight:800,transition:'transform 180ms cubic-bezier(.2,.8,.2,1),box-shadow 180ms ease,background 180ms ease,border-color 180ms ease','&:hover':{transform:'translateY(-1px)'},'&:active':{transform:'translateY(0)'}},containedPrimary:{background:'linear-gradient(135deg,#ff971e 0%,#e96d00 100%)',boxShadow:'0 10px 24px rgba(242,124,0,.20)','&:hover':{background:'linear-gradient(135deg,#ffa83f 0%,#f07800 100%)',boxShadow:'0 14px 30px rgba(242,124,0,.28)'}},outlined:{borderWidth:1.5,borderColor:border,'&:hover':{borderColor:tokens.primary[400],background:dark?'rgba(242,124,0,.07)':'rgba(242,124,0,.045)'}}}},
      MuiCard:{defaultProps:{elevation:0},styleOverrides:{root:{border:`1px solid ${border}`,borderRadius:28,background:dark?'linear-gradient(145deg,rgba(25,27,34,.96),rgba(16,17,22,.96))':'linear-gradient(145deg,rgba(255,253,250,.96),rgba(248,245,239,.92))',boxShadow:dark?'0 20px 70px rgba(0,0,0,.22)':'0 18px 50px rgba(48,38,26,.08)',transition:'box-shadow 220ms ease,border-color 220ms ease','&:hover':{transform:'none',boxShadow:dark?'0 20px 60px rgba(0,0,0,.28)':'0 20px 55px rgba(48,38,26,.10)'}}}},
      MuiPaper:{defaultProps:{elevation:0},styleOverrides:{root:{backgroundImage:'none',borderColor:border,backgroundColor:paper},rounded:{borderRadius:22}}},
      MuiTextField:{defaultProps:{variant:'outlined',size:'medium'},styleOverrides:{root:{'& .MuiOutlinedInput-root':{borderRadius:14,background:dark?'rgba(255,255,255,.025)':'rgba(255,255,255,.55)',transition:'box-shadow 180ms ease,border-color 180ms ease','&.Mui-focused':{boxShadow:'0 0 0 4px rgba(242,124,0,.11)'}},'& .MuiOutlinedInput-notchedOutline':{borderColor:border,borderWidth:1.5},'& .MuiInputLabel-root':{fontWeight:600,color:secondary}}}},
      MuiChip:{styleOverrides:{root:{borderRadius:10,fontWeight:700,height:32,paddingInline:4}}},
      MuiTableCell:{styleOverrides:{head:{fontWeight:700,fontSize:'.72rem',textTransform:'uppercase',letterSpacing:'.07em',color:secondary,background:dark?'rgba(255,255,255,.025)':'rgba(0,0,0,.018)',borderBottomColor:border,padding:'16px 18px'},body:{fontSize:'.88rem',padding:'18px 18px',borderBottomColor:border}}},
      MuiTableRow:{styleOverrides:{root:{transition:'background 150ms ease','&:hover':{background:dark?'rgba(255,255,255,.025)':'rgba(242,124,0,.025)'}}}},
      MuiTabs:{styleOverrides:{indicator:{height:3,borderRadius:3,background:tokens.primary[500]}}},
      MuiTab:{styleOverrides:{root:{textTransform:'none',fontWeight:700,minHeight:46,borderRadius:12,color:secondary,'&.Mui-selected':{color:text}}}},
      MuiDialog:{styleOverrides:{paper:{borderRadius:24,border:`1px solid ${border}`,background:paper,boxShadow:'0 30px 90px rgba(0,0,0,.35)'}}},
      MuiDrawer:{styleOverrides:{paper:{background:dark?'#0e0f13':'#f8f5ef',backgroundImage:'none'}}},
      MuiTooltip:{defaultProps:{arrow:true},styleOverrides:{tooltip:{fontSize:'.72rem',fontWeight:650,borderRadius:9,padding:'7px 10px',background:dark?'#f5f2ed':'#201c18',color:dark?'#171513':'#fff'}}},
      MuiLinearProgress:{styleOverrides:{root:{height:7,borderRadius:7,background:dark?'rgba(255,255,255,.07)':'rgba(0,0,0,.07)'},bar:{borderRadius:7}}},
    }
  });
}
