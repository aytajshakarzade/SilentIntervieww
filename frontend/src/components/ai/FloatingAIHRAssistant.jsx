import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Avatar, Box, Button, CircularProgress, IconButton, Stack, TextField,
  Tooltip, Typography, alpha, useTheme,
} from '@mui/material';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import ForumRoundedIcon from '@mui/icons-material/ForumRounded';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../contexts/AuthContext';
import axiosClient, { unwrap } from '../../api/axiosClient';
import { aiInterviewService } from '../../services/aiInterviewService';
import { aiConversationService } from '../../services/aiConversationService';
import { getErrorMessage } from '../../utils/errorUtils';
import aiAssistantLogo from '../../assets/ai-assistant-logo.png';

const PROMPTS = [
  'aiAssistant.suggestedPrompt1',
  'aiAssistant.suggestedPrompt2',
  'aiAssistant.suggestedPrompt3',
];

function cleanMarkdown(text = '') {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .trim();
}

function Message({ message }) {
  const isUser = message.role === 'user';
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Box sx={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', mb: 1.35, minWidth: 0 }}>
        <Box sx={{ maxWidth: '91%', minWidth: 0, display: 'flex', gap: .8, flexDirection: isUser ? 'row-reverse' : 'row', alignItems: 'flex-end' }}>
          {!isUser && (
            <Avatar sx={{ width: 30, height: 30, flexShrink: 0, bgcolor: 'transparent', border: '1px solid', borderColor: 'divider', p: .25 }}>
              <Box component="img" src={aiAssistantLogo} alt="" sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </Avatar>
          )}
          <Box sx={{ px: 1.55, py: 1.2, borderRadius: isUser ? '18px 18px 6px 18px' : '18px 18px 18px 6px', bgcolor: isUser ? 'primary.main' : 'action.hover', color: isUser ? '#fff' : 'text.primary', border: isUser ? 'none' : '1px solid', borderColor: 'divider', minWidth: 0, overflow: 'hidden' }}>
            <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', wordBreak: 'break-word', lineHeight: 1.62, fontSize: '.82rem' }}>
              {isUser ? message.content : cleanMarkdown(message.content)}
            </Typography>
          </Box>
        </Box>
      </Box>
    </motion.div>
  );
}

export default function FloatingAIHRAssistant() {
  const { t, language: locale } = useTranslation();
  const { user, isRecruiter } = useAuth();
  const theme = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [usage, setUsage] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [lastFailedPrompt, setLastFailedPrompt] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const [providerState, setProviderState] = useState('unknown');
  const mountedRef = useRef(true);

  const refreshSubscription = useCallback(async () => {
    if (!isRecruiter) return;
    try {
      const [sub, currentUsage] = await Promise.all([
        axiosClient.get('/subscription/me').then(unwrap),
        axiosClient.get('/subscription/usage').then(unwrap),
      ]);
      if (!mountedRef.current) return;
      setSubscription(sub);
      setUsage(currentUsage);
    } catch {
      if (!mountedRef.current) return;
      const fallbackPlan = user?.plan || 'Free';
      setSubscription({
        plan: fallbackPlan,
        limits: {
          hasAssistant: ['Go', 'Pro'].includes(fallbackPlan),
          monthlyAssistantMessages: fallbackPlan === 'Pro' ? -1 : fallbackPlan === 'Go' ? 50 : 0,
        },
      });
    }
  }, [isRecruiter, user?.plan]);

  useEffect(() => {
    mountedRef.current = true;
    refreshSubscription();
    return () => { mountedRef.current = false; };
  }, [refreshSubscription]);

  const plan = subscription?.plan || user?.plan || 'Free';
  const hasAssistant = subscription?.limits?.hasAssistant === true;
  const assistantLimit = usage?.assistantMessages?.limit ?? subscription?.limits?.monthlyAssistantMessages ?? 0;
  const assistantUsed = usage?.assistantMessages?.used ?? 0;
  const unlimited = assistantLimit < 0;
  const limitReached = !unlimited && assistantLimit >= 0 && assistantUsed >= assistantLimit;
  const remaining = unlimited ? null : Math.max(0, assistantLimit - assistantUsed);

  const loadLatestConversation = useCallback(async () => {
    if (!hasAssistant) return;
    try {
      const conversations = await aiConversationService.getConversations();
      const latest = Array.isArray(conversations) ? conversations[0] : null;
      if (!latest?.id) return;
      const history = await aiConversationService.getConversationMessages(latest.id);
      if (!mountedRef.current) return;
      setConversationId(latest.id);
      setMessages((Array.isArray(history) ? history : []).map((m) => ({
        role: m.role,
        content: m.content,
      })));
    } catch {
      // Conversation history is optional; the assistant remains usable without it.
    }
  }, [hasAssistant]);

  useEffect(() => {
    if (!open || !hasAssistant) return undefined;
    let cancelled = false;
    aiInterviewService.pingAssistant()
      .then(() => { if (!cancelled && mountedRef.current) setProviderState('online'); })
      .catch((err) => {
        if (cancelled || !mountedRef.current) return;
        const status = err?.response?.status;
        if (status === 503 || status === 502) setProviderState('offline');
      });
    return () => { cancelled = true; };
  }, [hasAssistant, open]);

  useEffect(() => {
    if (open && hasAssistant && !messages.length && !conversationId) loadLatestConversation();
  }, [conversationId, hasAssistant, loadLatestConversation, messages.length, open]);

  const ensureConversation = useCallback(async () => {
    if (conversationId) return conversationId;
    const conversation = await aiConversationService.createConversation({
      title: 'AI HR Assistant',
      language: locale,
    });
    if (mountedRef.current) setConversationId(conversation.id);
    return conversation.id;
  }, [conversationId, locale]);

  const send = useCallback(async (preset) => {
    const text = (preset ?? input).trim();
    if (!text || sending) return;
    if (!hasAssistant) { setError(t('aiAssistant.upgradeRequired')); return; }
    if (limitReached) { setError(t('aiAssistant.assistantLimitReached')); return; }

    const tempId = `msg-${Date.now()}`;
    setMessages((prev) => [...prev, { id: tempId, role: 'user', content: text }]);
    setInput('');
    setSending(true);
    setError('');
    setLastFailedPrompt('');

    try {
      const activeConversationId = await ensureConversation();
      const response = await aiInterviewService.askAssistant(text, [], locale, activeConversationId);
      if (!response?.answer) throw new Error('AI returned an empty response.');

      if (mountedRef.current) {
        setMessages((prev) => [...prev, { id: `ai-${Date.now()}`, role: 'assistant', content: response.answer }]);
        setProviderState('online');
      }

      // Persist only successful turns. Failed provider calls therefore do not
      // consume an assistant message in the live usage counter.
      await Promise.all([
        aiConversationService.addMessage(activeConversationId, { role: 'user', content: text }),
        aiConversationService.addMessage(activeConversationId, { role: 'assistant', content: response.answer }),
      ]);
      await refreshSubscription();
    } catch (err) {
      if (!mountedRef.current) return;
      setMessages((prev) => prev.filter((message) => message.id !== tempId));
      const friendlyError = getErrorMessage(err, locale);
      setLastFailedPrompt(text);
      setError(friendlyError);
      if (err?.response?.status === 503 || err?.response?.status === 502) {
        setProviderState('offline');
        // Keep provider failures explicit in the conversation UI. Never replace
        // them with the misleading 'no interview data' response.
        setMessages((prev) => [...prev, {
          id: `ai-error-${Date.now()}`,
          role: 'assistant',
          content: friendlyError,
        }]);
      }
    } finally {
      if (mountedRef.current) setSending(false);
    }
  }, [ensureConversation, hasAssistant, input, limitReached, locale, refreshSubscription, sending, t]);

  useEffect(() => {
    if (open) setError('');
  }, [open]);

  if (!isRecruiter) return null;

  const statusLabel = providerState === 'online'
    ? (locale === 'az' ? 'AI aktivdir' : locale === 'ru' ? 'ИИ активен' : 'AI online')
    : providerState === 'offline'
      ? (locale === 'az' ? 'AI əlçatmazdır' : locale === 'ru' ? 'ИИ недоступен' : 'AI unavailable')
      : (locale === 'az' ? 'AI hazırdır' : locale === 'ru' ? 'ИИ готов' : 'AI ready');

  return (
    <>
      <Tooltip title={t('aiAssistant.title')} placement="left">
        <motion.div
          data-tour="ai-hr-fab"
          whileHover={{ scale: 1.06, y: -3 }}
          whileTap={{ scale: .93 }}
          animate={{ y: [0, -6, 0] }}
          transition={{ y: { duration: 3.8, repeat: Infinity, ease: 'easeInOut' } }}
          style={{ position: 'fixed', right: 24, bottom: 24, zIndex: 1400 }}
        >
          <Box component="button" onClick={() => setOpen((v) => !v)} aria-label={t('aiAssistant.title')} sx={{ position: 'relative', width: { xs: 58, sm: 66 }, height: { xs: 58, sm: 66 }, p: .65, border: '1px solid rgba(255,255,255,.22)', borderRadius: '50%', cursor: 'pointer', background: 'linear-gradient(145deg, rgba(234,118,0,.34), rgba(74,80,230,.30))', boxShadow: '0 16px 42px rgba(0,0,0,.35), 0 0 0 7px rgba(234,118,0,.055)', backdropFilter: 'blur(16px)', display: 'grid', placeItems: 'center', '&::before': { content: '""', position: 'absolute', inset: -7, borderRadius: '50%', border: '1px solid rgba(234,118,0,.18)', animation: 'aiPulse 2.8s ease-out infinite' }, '&::after': { content: '""', position: 'absolute', width: 9, height: 9, right: 7, top: 7, borderRadius: '50%', bgcolor: providerState === 'offline' ? 'error.main' : '#22c55e', boxShadow: providerState === 'offline' ? `0 0 0 4px ${alpha(theme.palette.error.main, .12)}` : '0 0 0 4px rgba(34,197,94,.12)' } }}>
            <Box component="img" src={aiAssistantLogo} alt="" sx={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 7px 14px rgba(0,0,0,.35))' }} />
          </Box>
        </motion.div>
      </Tooltip>

      <AnimatePresence>
        {open && (
          <Box sx={{ position: 'fixed', right: { xs: 12, sm: 22 }, bottom: { xs: 12, sm: 22 }, zIndex: 1399, pointerEvents: 'none' }}>
            <Box sx={{ pointerEvents: 'none' }}>
              <motion.div
                initial={{ opacity: 0, y: 18, scale: .96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 18, scale: .96 }}
                transition={{ duration: .24, ease: [.16, 1, .3, 1] }}
                style={{ width: 'min(430px, calc(100vw - 24px))', height: 'min(640px, calc(100vh - 92px))', pointerEvents: 'auto' }}
              >
                <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: { xs: 4, sm: 5 }, border: '1px solid', borderColor: 'divider', bgcolor: theme.palette.background.paper, boxShadow: '0 28px 100px rgba(0,0,0,.5), 0 0 0 1px rgba(234,118,0,.08)' }}>
                  <Box sx={{ p: { xs: 1.7, sm: 2 }, background: 'linear-gradient(135deg, rgba(234,118,0,.20), rgba(91,94,232,.12))', borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Stack direction="row" spacing={1.25} alignItems="center">
                      <Box sx={{ width: 50, height: 50, borderRadius: 3.2, p: .25, flexShrink: 0, background: 'linear-gradient(145deg, rgba(234,118,0,.18), rgba(91,94,232,.16))', boxShadow: '0 12px 30px rgba(0,0,0,.16)' }}>
                        <Box component="img" src={aiAssistantLogo} alt="" sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" spacing={.75} alignItems="center">
                          <Typography fontWeight={950} sx={{ fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t('aiAssistant.title')}</Typography>
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: providerState === 'offline' ? 'error.main' : '#22c55e', flexShrink: 0 }} />
                        </Stack>
                        <Typography color="text.secondary" sx={{ fontSize: '.73rem', lineHeight: 1.45 }}>{t('aiAssistant.subtitle')}</Typography>
                      </Box>
                      <IconButton onClick={() => setOpen(false)} aria-label={t('common.close')} sx={{ flexShrink: 0 }}><CloseRoundedIcon /></IconButton>
                    </Stack>
                  </Box>

                  <Box sx={{ px: 1.5, pt: 1.5 }}>
                    <Box sx={{ px: 1.35, py: 1.15, borderRadius: 3, bgcolor: hasAssistant ? alpha(theme.palette.success.main, .06) : alpha(theme.palette.warning.main, .07), border: '1px solid', borderColor: hasAssistant ? alpha(theme.palette.success.main, .16) : alpha(theme.palette.warning.main, .2) }}>
                      <Stack direction="row" spacing={1.05} alignItems="center">
                        {hasAssistant ? <CheckCircleRoundedIcon sx={{ color: 'success.main', fontSize: 19 }} /> : <LockRoundedIcon sx={{ color: 'warning.main', fontSize: 19 }} />}
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography fontWeight={900} sx={{ fontSize: '.75rem' }}>{hasAssistant ? `${plan} · ${statusLabel}` : t('aiAssistant.upgradeTitle')}</Typography>
                          <Typography color="text.secondary" sx={{ fontSize: '.68rem', lineHeight: 1.5 }}>
                            {hasAssistant
                              ? unlimited
                                ? t('aiAssistant.unlimitedAssistantMessages')
                                : `${assistantUsed} / ${assistantLimit} ${t('aiAssistant.assistantMessagesUsedSuffix')} · ${remaining} ${t('aiAssistant.assistantMessagesRemaining')}`
                              : t('aiAssistant.upgradeDescription')}
                          </Typography>
                        </Box>
                        {!hasAssistant && <Button size="small" onClick={() => navigate('/billing')} endIcon={<ArrowForwardRoundedIcon sx={{ fontSize: 14 }} />} sx={{ fontWeight: 850, minWidth: 0, whiteSpace: 'nowrap' }}>{t('aiAssistant.upgradeButton')}</Button>}
                      </Stack>
                    </Box>
                  </Box>

                  {providerState === 'offline' && hasAssistant && (
                    <Box sx={{ px: 1.5, pt: 1.2 }}>
                      <Box sx={{ px: 1.2, py: 1, borderRadius: 2.8, bgcolor: alpha(theme.palette.error.main, .045), border: '1px solid', borderColor: alpha(theme.palette.error.main, .14) }}>
                        <Stack direction="row" spacing={1} alignItems="flex-start">
                          <ErrorOutlineRoundedIcon sx={{ color: 'error.main', fontSize: 18, mt: .05 }} />
                          <Box sx={{ flex: 1 }}>
                            <Typography fontWeight={850} sx={{ fontSize: '.72rem' }}>{t('aiAssistant.providerUnavailableTitle')}</Typography>
                            <Typography color="text.secondary" sx={{ fontSize: '.66rem', lineHeight: 1.45 }}>{t('aiAssistant.providerUnavailableDescription')}</Typography>
                          </Box>
                          {lastFailedPrompt && <Button size="small" onClick={() => send(lastFailedPrompt)} disabled={sending} sx={{ minWidth: 0, px: .8, py: .2, fontSize: '.66rem', textTransform: 'none' }}>{locale === 'az' ? 'Yenidən sına' : locale === 'ru' ? 'Повторить' : 'Retry'}</Button>}
                        </Stack>
                      </Box>
                    </Box>
                  )}

                  <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: { xs: 1.4, sm: 1.8 }, py: 1.4, overscrollBehavior: 'contain' }}>
                    {messages.length === 0 ? (
                      <Box sx={{ minHeight: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', px: 1 }}>
                        <motion.div animate={{ y: [0, -5, 0] }} transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}>
                          <Box sx={{ width: 84, height: 84, p: .25, mb: 1.8, borderRadius: '29px', background: 'linear-gradient(145deg, rgba(234,118,0,.15), rgba(91,94,232,.12))', boxShadow: '0 16px 35px rgba(234,118,0,.08)' }}><Box component="img" src={aiAssistantLogo} alt="" sx={{ width: '100%', height: '100%', objectFit: 'contain' }} /></Box>
                        </motion.div>
                        <Typography fontWeight={950} sx={{ fontSize: '1.05rem' }}>{t('aiAssistant.emptyStateTitle')}</Typography>
                        <Typography color="text.secondary" sx={{ mt: .5, mb: 2.2, fontSize: '.76rem', lineHeight: 1.6, maxWidth: 330 }}>{t('aiAssistant.emptyStateDescription')}</Typography>
                        <Stack spacing={.85} sx={{ width: '100%', maxWidth: 380 }}>
                          {PROMPTS.map((key) => <Button key={key} onClick={() => send(t(key))} disabled={!hasAssistant || limitReached || sending} variant="outlined" endIcon={<ArrowForwardRoundedIcon sx={{ fontSize: 15 }} />} sx={{ justifyContent: 'space-between', textAlign: 'left', textTransform: 'none', borderRadius: 2.8, py: 1, px: 1.35, fontSize: '.74rem', lineHeight: 1.38, '&:hover': { background: alpha(theme.palette.primary.main, .06) } }}>{t(key)}</Button>)}
                        </Stack>
                      </Box>
                    ) : messages.map((message, i) => <Message key={message.id || i} message={message} />)}
                    {sending && <Box sx={{ display: 'flex', alignItems: 'center', gap: .8, mt: 1 }}><Avatar sx={{ width: 30, height: 30, bgcolor: 'transparent', border: '1px solid', borderColor: 'divider', p: .25 }}><Box component="img" src={aiAssistantLogo} alt="" sx={{ width: '100%', height: '100%', objectFit: 'contain' }} /></Avatar><Typography color="text.secondary" sx={{ fontSize: '.74rem' }}>{t('aiAssistant.typing')}</Typography></Box>}
                  </Box>

                  <Box sx={{ p: 1.35, borderTop: '1px solid', borderColor: 'divider', bgcolor: alpha(theme.palette.background.default, .55) }}>
                    {error && providerState !== 'offline' && <Box sx={{ mb: .9, p: .9, borderRadius: 2.5, bgcolor: alpha(theme.palette.error.main, .05), border: '1px solid', borderColor: alpha(theme.palette.error.main, .14) }}><Stack direction="row" spacing={.8} alignItems="flex-start"><Typography sx={{ flex: 1, px: .2, color: 'error.main', fontSize: '.7rem', lineHeight: 1.4, overflowWrap: 'anywhere' }}>{error}</Typography>{lastFailedPrompt && <Button size="small" onClick={() => send(lastFailedPrompt)} disabled={sending} sx={{ minWidth: 'auto', px: 1, py: .25, textTransform: 'none', fontSize: '.68rem' }}>{locale === 'az' ? 'Yenidən sına' : locale === 'ru' ? 'Повторить' : 'Retry'}</Button>}</Stack></Box>}
                    <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: .55, p: .55, pl: 1.2, borderRadius: 3.2, border: '1px solid', borderColor: input.trim() && hasAssistant && !limitReached ? alpha(theme.palette.primary.main, .55) : 'divider', bgcolor: theme.palette.background.paper, transition: 'border-color .18s ease, box-shadow .18s ease', boxShadow: input.trim() && hasAssistant && !limitReached ? `0 0 0 3px ${alpha(theme.palette.primary.main, .06)}` : 'none' }}>
                      <TextField fullWidth multiline maxRows={4} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} disabled={!hasAssistant || limitReached || sending} placeholder={hasAssistant ? t('aiAssistant.inputPlaceholder') : t('aiAssistant.lockedInputPlaceholder')} variant="standard" InputProps={{ disableUnderline: true }} sx={{ minWidth: 0, '& .MuiInputBase-root': { fontSize: '.79rem', lineHeight: 1.5, py: .25 } }} />
                      <IconButton onClick={() => send()} disabled={!hasAssistant || limitReached || sending || !input.trim()} sx={{ width: 40, height: 40, flexShrink: 0, bgcolor: input.trim() && hasAssistant && !limitReached ? 'primary.main' : 'action.hover', color: input.trim() && hasAssistant && !limitReached ? '#fff' : 'text.disabled', transition: 'transform .18s ease' }}>{sending ? <CircularProgress size={16} color="inherit" /> : <SendRoundedIcon sx={{ fontSize: 18 }} />}</IconButton>
                    </Box>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: .8, px: .2 }}>
                      <Stack direction="row" alignItems="center" spacing={.5}><ForumRoundedIcon sx={{ fontSize: 11, color: 'text.disabled' }} /><Typography color="text.disabled" sx={{ fontSize: '.63rem' }}>{conversationId ? t('aiAssistant.conversationActive') : t('aiAssistant.newConversationReady')}</Typography></Stack>
                      <Stack direction="row" justifyContent="center" alignItems="center" spacing={.5}><AutoAwesomeRoundedIcon sx={{ fontSize: 11, color: 'primary.main' }} /><Typography color="text.disabled" sx={{ fontSize: '.63rem' }}>{t('aiAssistant.sendTooltip')}</Typography></Stack>
                    </Stack>
                  </Box>
                </Box>
              </motion.div>
            </Box>
          </Box>
        )}
      </AnimatePresence>
    </>
  );
}
