/**
 * aiInterviewService — wraps all AIInterviewController endpoints.
 * Field names match backend DTOs exactly (camelCase from JSON serialization).
 */
import { axiosClient, unwrap } from '../api/axiosClient';

const BASE = '/AIInterview';

export const aiInterviewService = {
  /**
   * Generate (or regenerate) the AI interview structure for a session.
   * POST /AIInterview/plan
   * body: { interviewSessionId, jobTitle?, jobDescription?, requiredSkills?,
   *         experienceLevel?, companyCulture?, seniorityLevel?,
   *         interviewDurationMinutes?, language? }
   * returns: AIInterviewPlanDto { id, interviewSessionId, interviewTitle, introduction, difficulty,
   *           estimatedDurationMinutes, language,
   *           sections: [{ type, questions: [{ id, order, text, difficultyLevel, expectedAnswer, evaluationCriteria }] }],
   *           createdAt }
   */
  generatePlan: (data) => axiosClient.post(`${BASE}/plan`, data).then(unwrap),

  /** GET /AIInterview/plan/{interviewSessionId} */
  getPlan: (interviewSessionId) =>
    axiosClient.get(`${BASE}/plan/${interviewSessionId}`).then(unwrap),

  /**
   * Resolve the next question the AI interviewer should ask.
   * POST /AIInterview/next-question  body: { interviewSessionId }
   * returns: NextQuestionDto { questionId, questionText, sectionType, isFollowUp,
   *           interviewComplete, answeredCount, totalPlannedCount }
   */
  getNextQuestion: (interviewSessionId) =>
    axiosClient.post(`${BASE}/next-question`, { interviewSessionId }).then(unwrap),

  /**
   * Evaluate a submitted answer.
   * POST /AIInterview/evaluate-answer  body: { interviewSessionId, interviewAnswerId }
   * returns: AnswerEvaluationDto
   */
  evaluateAnswer: (interviewSessionId, interviewAnswerId) =>
    axiosClient.post(`${BASE}/evaluate-answer`, { interviewSessionId, interviewAnswerId }).then(unwrap),

  /**
   * Generate the enterprise AI hiring report for a completed session.
   * POST /AIInterview/report  body: { interviewSessionId, language? }
   */
  generateReport: (interviewSessionId, language) =>
    axiosClient.post(`${BASE}/report`, { interviewSessionId, language }).then(unwrap),

  /** GET /AIInterview/report/{interviewSessionId} */
  getReport: (interviewSessionId) =>
    axiosClient.get(`${BASE}/report/${interviewSessionId}`).then(unwrap),

  /**
   * Ask the AI HR assistant a question, grounded in the recruiter's own data.
   * POST /AIInterview/assistant  body: { question, interviewSessionIds?, language? }
   */
  askAssistant: (question, interviewSessionIds, language, conversationId) =>
    axiosClient.post(`${BASE}/assistant`, { question, interviewSessionIds, language, conversationId }).then(unwrap),

  /** Ping the configured AI provider without consuming a plan allowance. */
  pingAssistant: () => axiosClient.get(`${BASE}/assistant/ping`).then(unwrap),

  /**
   * Get AI interview configuration (experience levels, difficulty, languages, durations).
   * GET /AIInterview/config
   * returns: { experienceLevels, difficultyLevels, supportedLanguages, estimatedDurations }
   */
  getConfig: () => axiosClient.get(`${BASE}/config`).then(unwrap),
};

export default aiInterviewService;
