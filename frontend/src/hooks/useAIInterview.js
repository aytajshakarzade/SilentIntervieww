import { useCallback, useRef, useState } from 'react';
import { interviewService } from '../services/interviewService';
import { aiInterviewService } from '../services/aiInterviewService';
import { getErrorMessage } from '../utils/errorUtils';

// ─── Fallback questions used when AI plan generation is unavailable ──────────
// These activate ONLY when the AI backend (OpenRouter) is unreachable or
// returns an error — the app degrades gracefully instead of failing entirely.
// Questions are returned in the interview session language (not UI locale).
function buildFallbackQuestions(lang) {
  const q = {
    en: [
      'Tell me about yourself and your professional background.',
      'What are your key technical skills and how have you applied them?',
      'Describe a challenging project you worked on and how you handled it.',
      'Where do you see yourself professionally in the next few years?',
      'Do you have any questions about the role or the company?',
    ],
    ru: [
      'Расскажите о себе и своём профессиональном опыте.',
      'Каковы ваши ключевые технические навыки и как вы их применяли?',
      'Опишите сложный проект, над которым вы работали, и как справились.',
      'Где вы видите себя профессионально через несколько лет?',
      'Есть ли у вас вопросы о роли или компании?',
    ],
    az: [
      'Özünüz və peşəkar keçmişiniz haqqında danışın.',
      'Əsas texniki bacarıqlarınız nələrdir və onları necə tətbiq etdiniz?',
      'Üzərində işlədiyiniz çətin bir layihəni təsvir edin.',
      'Özünüzü gəlecəkdə peşəkar olaraq harada görürsünüz?',
      'Rol və ya şirkət haqqında suallarınız varmı?',
    ],
  };
  const texts = q[lang] || q.en;
  return texts.map((text, i) => ({
    questionId: `fallback-${i + 1}`,
    questionText: text,
    sectionType: i === 0 ? 'Introduction' : i === texts.length - 1 ? 'Closing' : 'General',
    isFollowUp: false,
    answeredCount: i,
    totalPlannedCount: texts.length,
    interviewComplete: false,
  }));
}

/**
 * AI-driven interview hook. Each question is resolved live from the AI
 * backend. Falls back to a static question set if AI is unavailable so the
 * interview can always start even without a valid OpenRouter key.
 */
export function useAIInterview(job, candidateProfile, language = 'en') {
  const [sessionId, setSessionId] = useState(null);
  const [applicationId, setApplicationId] = useState(null);
  const [plan, setPlan] = useState(null);
  const [history, setHistory] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [analytics, setAnalytics] = useState({});
  const [thinking, setThinking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [usingFallback, setUsingFallback] = useState(false);

  // Fallback questions built once per session in the interview language
  const fallbackQuestionsRef = useRef([]);
  const fallbackIndexRef = useRef(0);
  const lastAnswerIdRef = useRef(null);

  // ─── Start interview ──────────────────────────────────────────────────────
  const startSession = useCallback(async () => {
    if (!job?.id || !candidateProfile?.id) {
      throw new Error('Job and candidate profile are required.');
    }

    // Create or reuse a job application for this candidate+job pair
    let app;
    try {
      app = await interviewService.applications.create({
        candidateId: candidateProfile.id,
        jobId: job.id,
      });
    } catch (appErr) {
      // If creation fails (e.g. duplicate), try to find an existing application
      const appsData = await interviewService.applications.getAll({ pageSize: 100 });
      const appsItems = Array.isArray(appsData) ? appsData : (appsData?.items ?? []);
      app = appsItems.find((a) => a.jobId === job.id && a.candidateId === candidateProfile.id);
      if (!app) throw appErr;
    }

    // Create the interview session — the backend will also try to generate
    // an AI plan at this point. If AI fails, the session still gets created.
    const session = await interviewService.sessions.create({
      jobApplicationId: app.id,
      startedAt: new Date().toISOString(),
      language: language,
    });

    setApplicationId(app.id);
    setSessionId(session.id);
    setHistory([]);
    setCurrentAnswer('');
    setCompleted(false);
    setReport(null);
    fallbackIndexRef.current = 0;

    setThinking(true);
    try {
      // Attempt to fetch the AI-generated plan and first question
      let fetchedPlan = null;
      let firstQuestion = null;

      try {
        fetchedPlan = await aiInterviewService.getPlan(session.id);
      } catch {
        // Plan not available (AI key missing / OpenRouter unreachable / timeout)
        fetchedPlan = null;
      }

      if (fetchedPlan) {
        setPlan(fetchedPlan);
        setUsingFallback(false);
        try {
          firstQuestion = await aiInterviewService.getNextQuestion(session.id);
        } catch {
          firstQuestion = null;
        }
      }

      // If AI plan or first question is not available, use fallback questions
      if (!firstQuestion) {
        setUsingFallback(true);
        fallbackIndexRef.current = 0;
        fallbackQuestionsRef.current = buildFallbackQuestions(language);
        firstQuestion = { ...fallbackQuestionsRef.current[0] };
      }

      setCurrentQuestion(firstQuestion);
    } finally {
      setThinking(false);
    }

    return session.id;
  }, [job, candidateProfile, language]);

  // ─── Answer management ────────────────────────────────────────────────────
  const setAnswer = useCallback((text) => {
    setCurrentAnswer(text);
  }, []);

  const setQuestionAnalytics = useCallback((questionId, snapshot) => {
    setAnalytics((prev) => ({ ...prev, [questionId]: { ...(prev[questionId] || {}), ...snapshot } }));
  }, []);

  // ─── Submit answer and advance ────────────────────────────────────────────
  const submitCurrentAnswer = useCallback(async (analyticsOverride) => {
    if (!sessionId || !currentQuestion?.questionText) return { interviewComplete: false };

    const orderIndex = history.length + 1;
    const snap = { ...(analytics[currentQuestion.questionId] || {}), ...(analyticsOverride || {}) };

    const savedAnswer = await interviewService.answers.create({
      interviewSessionId: sessionId,
      question: currentQuestion.questionText,
      answer: currentAnswer || '',
      order: orderIndex,
      timeSpentSec: snap.timeSpentSec ?? null,
      eyeContactPct: snap.eyeContactPct ?? null,
      dominantEmotion: snap.dominantEmotion ?? null,
      speechWpm: snap.speechWpm ?? null,
      fillerWordCount: snap.fillerWordCount ?? null,
      longestPauseSec: snap.longestPauseSec ?? null,
    });

    lastAnswerIdRef.current = savedAnswer.id;

    setThinking(true);
    let evaluation = null;

    if (!usingFallback) {
      try {
        evaluation = await aiInterviewService.evaluateAnswer(sessionId, savedAnswer.id);
      } catch {
        evaluation = null;
      }
    }

    setHistory((prev) => [
      ...prev,
      {
        question: currentQuestion.questionText,
        answer: currentAnswer || '',
        sectionType: currentQuestion.sectionType,
        isFollowUp: currentQuestion.isFollowUp,
        evaluation,
      },
    ]);

    let next = null;

    if (usingFallback) {
      // Advance through the static fallback list
      const fq = fallbackQuestionsRef.current.length > 0 ? fallbackQuestionsRef.current : buildFallbackQuestions(language);
      const nextIndex = fallbackIndexRef.current + 1;
      if (nextIndex >= fq.length) {
        // All fallback questions answered — signal completion
        next = {
          ...fq[fq.length - 1],
          interviewComplete: true,
          answeredCount: fq.length,
        };
      } else {
        fallbackIndexRef.current = nextIndex;
        next = { ...fq[nextIndex], answeredCount: nextIndex };
      }
      setCurrentQuestion(next);
      setCurrentAnswer('');
      setThinking(false);
      return next;
    }

    try {
      next = await aiInterviewService.getNextQuestion(sessionId);
      // If AI says complete but returned a next question object, trust it
      if (!next) {
        next = { interviewComplete: true, answeredCount: orderIndex, totalPlannedCount: orderIndex };
      }
      setCurrentQuestion(next);
      setCurrentAnswer('');
      return next;
    } catch {
      // AI call failed mid-interview — switch to fallback for remaining questions
      setUsingFallback(true);
      fallbackIndexRef.current = 0;
      fallbackQuestionsRef.current = buildFallbackQuestions(language);
      const fallbackNext = { ...fallbackQuestionsRef.current[0], answeredCount: orderIndex };
      setCurrentQuestion(fallbackNext);
      setCurrentAnswer('');
      return fallbackNext;
    } finally {
      setThinking(false);
    }
  }, [sessionId, currentQuestion, currentAnswer, analytics, history.length, usingFallback, language]);

  // ─── Complete interview ───────────────────────────────────────────────────
  const finishInterview = useCallback(async () => {
    if (!sessionId) return;
    setSubmitting(true);
    setError(null);

    try {
      await interviewService.sessions.update(sessionId, {
        endedAt: new Date().toISOString(),
      });

      let newReport = null;
      try {
        newReport = await interviewService.reports.generate(sessionId);
      } catch {
        // Report generation may fail if AI is unavailable; interview still completes
        newReport = null;
      }

      let aiReport = null;
      if (!usingFallback) {
        try {
          aiReport = await aiInterviewService.generateReport(sessionId, language);
        } catch {
          aiReport = null;
        }
      }

      setReport(newReport ? { ...newReport, aiReport } : { aiReport });
      setCompleted(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }, [sessionId, language, usingFallback]);

  const totalPlanned = currentQuestion?.totalPlannedCount ?? plan?.sections?.reduce((n, s) => n + s.questions.length, 0) ?? 5;
  const answeredCount = currentQuestion?.answeredCount ?? history.length;

  return {
    sessionId,
    applicationId,
    plan,
    history,
    currentQuestion,
    currentQuestionText: currentQuestion?.questionText || '',
    currentSectionType: currentQuestion?.sectionType || null,
    isFollowUp: !!currentQuestion?.isFollowUp,
    currentAnswer,
    interviewComplete: !!currentQuestion?.interviewComplete,
    progress: totalPlanned > 0 ? Math.min(100, (answeredCount / totalPlanned) * 100) : 0,
    answeredCount,
    totalPlanned,
    thinking,
    submitting,
    completed,
    report,
    error,
    usingFallback,
    startSession,
    setAnswer,
    setQuestionAnalytics,
    submitCurrentAnswer,
    finishInterview,
  };
}
