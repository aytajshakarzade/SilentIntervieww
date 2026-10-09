import { Box } from '@mui/material';

/** Maps a Web Speech API error code to a localized message, falling back to the raw message. */
export function speechErrorLabel(errorCode, fallbackMessage, t) {
  const map = {
    'no-speech': t.errSpeechNoSpeech,
    'audio-capture': t.errSpeechAudioCapture,
    'network': t.errSpeechNetwork,
    'not-allowed': t.errSpeechNotAllowed,
    'service-not-allowed': t.errSpeechServiceNotAllowed,
    'language-not-supported': t.errSpeechLangNotSupported,
    'aborted': t.errSpeechAborted,
    'max-restarts': t.errSpeechMaxRestarts,
    'start-failed': t.errSpeechStartFailed,
  };
  return map[errorCode] || fallbackMessage;
}

export const LOCALE_OPTIONS = [
  { code: 'az', label: 'AZ' },
  { code: 'en', label: 'EN' },
  { code: 'ru', label: 'RU' },
];

/** AZ / EN / RU language selector pill group, used by both the classic and AI interview rooms. */
export function LanguageSelector({ value, onChange, disabled }) {
  return (
    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
      {LOCALE_OPTIONS.map(({ code, label }) => (
        <Box
          key={code}
          component="button"
          type="button"
          disabled={disabled}
          onClick={() => onChange(code)}
          sx={{
            border: '1px solid',
            borderColor: value === code ? 'primary.main' : 'divider',
            bgcolor: value === code ? 'primary.main' : 'transparent',
            color: value === code ? 'white' : 'text.secondary',
            borderRadius: 1.5,
            px: 1,
            py: 0.4,
            fontSize: '0.68rem',
            fontWeight: 700,
            letterSpacing: '0.03em',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
            transition: 'all 150ms ease',
            fontFamily: 'inherit',
            '&:hover': disabled ? {} : {
              borderColor: 'primary.main',
              bgcolor: value === code ? 'primary.main' : 'action.hover',
            },
          }}
        >
          {label}
        </Box>
      ))}
    </Box>
  );
}

export const draftKey = (jobId) => `interview-draft-${jobId}`;
export const aiDraftKey = (jobId) => `ai-interview-draft-${jobId}`;

export function QuestionDots({ total, current, answered }) {
  return (
    <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', flexWrap: 'wrap' }}>
      {Array.from({ length: total }).map((_, i) => (
        <Box
          key={i}
          sx={{
            width: i === current ? 20 : 8,
            height: 8,
            borderRadius: 4,
            transition: 'all 300ms ease',
            bgcolor: i === current
              ? 'primary.main'
              : answered?.[i]
                ? 'success.main'
                : 'divider',
          }}
        />
      ))}
    </Box>
  );
}

export function MicWave({ active }) {
  if (!active) return null;
  return (
    <Box className="wave-bars" sx={{ ml: 1 }}>
      {[1, 2, 3, 4, 5].map((i) => <Box key={i} className="wave-bar" />)}
    </Box>
  );
}
