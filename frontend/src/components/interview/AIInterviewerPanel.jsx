import { Box, Typography, Paper, Chip, Avatar, Fade } from '@mui/material';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

/**
 * The AI interviewer's avatar + name badge, with a subtle pulsing ring while
 * the AI is "thinking" (generating the plan, evaluating an answer, or
 * deciding the next question).
 */
export function AIInterviewerAvatar({ thinking, name = 'AI Interviewer' }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
      <Box sx={{ position: 'relative' }}>
        <Avatar
          sx={{
            width: 40, height: 40,
            bgcolor: 'rgba(255,255,255,0.18)',
            border: '1px solid rgba(255,255,255,0.3)',
          }}
        >
          <SmartToyIcon sx={{ fontSize: 22 }} />
        </Avatar>
        {thinking && (
          <Box
            sx={{
              position: 'absolute', inset: -3, borderRadius: '50%',
              border: '2px solid rgba(255,255,255,0.55)',
              animation: 'aiPulseRing 1.4s ease-out infinite',
            }}
          />
        )}
      </Box>
      <Box>
        <Typography variant="subtitle2" fontWeight={700} sx={{ lineHeight: 1.2 }}>
          {name}
        </Typography>
        <Typography variant="caption" sx={{ opacity: 0.85 }}>
          {thinking ? 'thinking…' : 'ready'}
        </Typography>
      </Box>
    </Box>
  );
}

/** Small inline "AI is thinking" indicator with animated dots, for use near the question card. */
export function AIThinkingIndicator({ label = 'AI is thinking' }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: 'text.secondary' }}>
      <AutoAwesomeIcon sx={{ fontSize: 15 }} />
      <Typography variant="caption" fontWeight={600}>{label}</Typography>
      <Box className="ai-thinking-dots" sx={{ display: 'flex', gap: 0.4 }}>
        {[0, 1, 2].map((i) => (
          <Box
            key={i}
            sx={{
              width: 4, height: 4, borderRadius: '50%', bgcolor: 'text.secondary',
              animation: 'aiDotBounce 1.2s infinite',
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </Box>
    </Box>
  );
}

/** Section-type chip: technical / behavioral / culture_fit / problem_solving. */
export function SectionTypeChip({ type }) {
  if (!type) return null;
  const config = {
    technical: { label: 'Technical', color: 'info' },
    behavioral: { label: 'Behavioral', color: 'secondary' },
    situational: { label: 'Situational', color: 'primary' },
    soft_skill: { label: 'Soft Skill', color: 'default' },
    culture_fit: { label: 'Culture Fit', color: 'success' },
    problem_solving: { label: 'Problem Solving', color: 'warning' },
  }[type] || { label: type, color: 'default' };

  return (
    <Chip
      label={config.label}
      size="small"
      color={config.color}
      variant="outlined"
      sx={{ fontSize: '0.65rem', height: 22, fontWeight: 600 }}
    />
  );
}

/**
 * Scrollable conversation history: each prior Q/A pair, with the AI's
 * per-answer scoring shown as a compact strip once evaluated.
 */
export function ConversationHistory({ history, t }) {
  if (!history || history.length === 0) {
    return (
      <Typography variant="body2" color="text.disabled" sx={{ py: 2, textAlign: 'center' }}>
        {t?.noHistoryYet || 'Your conversation with the AI interviewer will appear here.'}
      </Typography>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {history.map((turn, i) => (
        <Fade in key={i}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 0.75 }}>
              <Avatar sx={{ width: 24, height: 24, bgcolor: 'primary.main' }}>
                <SmartToyIcon sx={{ fontSize: 14 }} />
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', mb: 0.25, flexWrap: 'wrap' }}>
                  <SectionTypeChip type={turn.sectionType} />
                  {turn.isFollowUp && (
                    <Chip label={t?.followUp || 'Follow-up'} size="small" sx={{ fontSize: '0.6rem', height: 20 }} />
                  )}
                </Box>
                <Typography variant="body2" fontWeight={600}>{turn.question}</Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, pl: 0.25 }}>
              <Avatar sx={{ width: 24, height: 24, bgcolor: 'action.selected', color: 'text.secondary' }}>
                <PersonIcon sx={{ fontSize: 14 }} />
              </Avatar>
              <Typography variant="body2" color="text.secondary" sx={{ flex: 1, whiteSpace: 'pre-wrap' }}>
                {turn.answer || <em>{t?.noAnswer || 'No answer recorded'}</em>}
              </Typography>
            </Box>
            {turn.evaluation && (
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.75, pl: 4 }}>
                {[
                  ['Technical', turn.evaluation.technicalAccuracy],
                  ['Communication', turn.evaluation.communicationScore],
                  ['Depth', turn.evaluation.depthScore],
                ].map(([label, val]) => (
                  <Chip
                    key={label}
                    label={`${label}: ${val ?? '—'}`}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: '0.6rem', height: 20 }}
                  />
                ))}
              </Box>
            )}
          </Box>
        </Fade>
      ))}
    </Box>
  );
}
