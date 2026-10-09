/**
 * getErrorMessage(err, locale?)
 *
 * Converts Axios/API errors to a human-readable string.
 * Pass `locale` ("az" | "en" | "ru") to get language-aware messages for
 * AI configuration errors.  Falls back to English if omitted.
 *
 * NEVER exposes implementation details like "OPENROUTER_API_KEY is not configured".
 */
export function getErrorMessage(err, locale) {
  const axiosError = err?.originalError || err;
  const response   = axiosError?.response?.data;
  const status     = axiosError?.response?.status;


  if (response?.message === 'AI_PROVIDER_AUTH_FAILED') {
    return _aiProviderAuthMsg(locale);
  }
  if (response?.message === 'AI_PROVIDER_UNAVAILABLE') {
    return _aiProviderUnavailableMsg(locale);
  }
  // ── AI not configured ──────────────────────────────────────────────────────
  // IMPORTANT: do not classify every HTTP 503 as an AI configuration problem.
  // Authentication, database, billing, and other services can legitimately
  // return 503. Only the explicit AI sentinel (or a clearly AI-specific
  // response) should produce the AI configuration message.
  if (
    response?.message === 'AI_NOT_CONFIGURED' ||
    response?.data    === 'AI_NOT_CONFIGURED' ||
    (typeof response === 'string' && response === 'AI_NOT_CONFIGURED')
  ) {
    return _aiNotConfiguredMsg(locale);
  }

  // Also catch legacy AI-only messages if they somehow leak through. Keep
  // this deliberately narrow so Google/Stripe/SMTP configuration errors are
  // never mislabeled as AI errors on unrelated pages such as Login.
  const backendMessage = typeof response?.message === 'string' ? response.message : '';
  const backendMessageLower = backendMessage.toLowerCase();
  const looksLikeAiConfigError =
    backendMessage.includes('OPENROUTER_API_KEY') ||
    backendMessage.includes('GROQ_API_KEY') ||
    (backendMessageLower.includes('ai') && backendMessageLower.includes('not configured')) ||
    (backendMessageLower.includes('ai') && backendMessageLower.includes('api key'));

  if (looksLikeAiConfigError) return _aiNotConfiguredMsg(locale);

  // ── Backend user-friendly message ─────────────────────────────────────────
  if (response?.message) return response.message;
  if (response?.detail) return response.detail;
  if (response?.title && response.title !== 'One or more validation errors occurred.') return response.title;

  // ── Validation errors ──────────────────────────────────────────────────────
  if (response?.errors) {
    return Object.values(response.errors).flat().join('\n');
  }

  // ── Subscription / plan limits ────────────────────────────────────────────
  if (status === 402) {
    return 'You’ve reached your current plan limit. Upgrade your plan to continue.';
  }

  // ── Status-specific fallbacks ──────────────────────────────────────────────
  if (status === 401) {
    if (axiosError?.config?.url?.includes('/Auth/login')) {
      return 'Invalid email or password. Please try again.';
    }
    return 'Your session is no longer valid. Please sign in again.';
  }

  const statusMessages = _statusMessages(locale);

  if (status && statusMessages[status]) return statusMessages[status];

  // ── Network / timeout ─────────────────────────────────────────────────────
  if (
    axiosError?.code === 'ECONNABORTED' ||
    axiosError?.message?.includes('timeout')
  ) {
    return 'Request timed out. Please check your connection and try again.';
  }

  if (axiosError?.code === 'ERR_NETWORK') {
    return 'Network error. Please check your internet connection.';
  }

  if (err?.message && err !== axiosError) return err.message;

  return 'Something went wrong. Please try again.';
}


function _statusMessages(locale) {
  switch ((locale || 'en').toLowerCase()) {
    case 'az':
      return {
        400: 'Sorğu düzgün deyil. Məlumatları yoxlayın.',
        403: 'Bu əməliyyat üçün icazəniz yoxdur.',
        404: 'Tələb olunan resurs tapılmadı.',
        409: 'Bu əməliyyat mövcud məlumatlarla ziddiyyət yaradır.',
        422: 'Göndərdiyiniz məlumatlar düzgün deyil. Yenidən yoxlayın.',
        429: 'Çox sayda sorğu göndərildi. Bir az gözləyin.',
        500: 'Server xətası baş verdi. Zəhmət olmasa yenidən cəhd edin.',
        502: 'Xidmət müvəqqəti əlçatmazdır. Bir az sonra yenidən cəhd edin.',
        503: 'Xidmət müvəqqəti əlçatmazdır. Bir az sonra yenidən cəhd edin.',
      };
    case 'ru':
      return {
        400: 'Некорректный запрос. Проверьте введённые данные.',
        403: 'У вас нет разрешения на это действие.',
        404: 'Запрошенный ресурс не найден.',
        409: 'Операция конфликтует с существующими данными.',
        422: 'Проверьте отправленные данные и попробуйте снова.',
        429: 'Слишком много запросов. Немного подождите.',
        500: 'Ошибка сервера. Попробуйте ещё раз позже.',
        502: 'Сервис временно недоступен. Попробуйте позже.',
        503: 'Сервис временно недоступен. Попробуйте позже.',
      };
    default:
      return {
        400: 'Invalid request. Please check your input.',
        403: "You don't have permission to perform this action.",
        404: 'The requested resource was not found.',
        409: 'This action conflicts with existing data. Please try a different approach.',
        422: 'The data you submitted is invalid. Please review and try again.',
        429: 'Too many requests. Please wait a moment and try again.',
        500: 'Server error. Please try again later.',
        502: 'Service temporarily unavailable. Please try again later.',
        503: 'The service is temporarily unavailable. Please try again in a moment.',
      };
  }
}

function _aiNotConfiguredMsg(locale) {
  switch ((locale || 'en').toLowerCase()) {
    case 'az': return 'AI xidməti hazırda konfiqurasiya edilməyib.';
    case 'ru': return 'Сервис ИИ не настроен.';
    default:   return 'AI service is not configured.';
  }
}

function _aiProviderAuthMsg(locale) {
  switch ((locale || 'en').toLowerCase()) {
    case 'az': return 'AI xidməti ilə əlaqə qurularkən doğrulama xətası baş verdi. Sistem konfiqurasiyası yoxlanılır; bir az sonra yenidən cəhd edin.';
    case 'ru': return 'Не удалось подтвердить доступ к AI-сервису. Проверьте конфигурацию и попробуйте ещё раз.';
    default: return 'The AI provider rejected the configured credential. Please check the AI configuration and retry.';
  }
}
