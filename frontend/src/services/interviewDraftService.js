export function createInterviewDraft({ jobId, job, savedDraft }) {
  const serverQuestions = savedDraft?.questions || [];
  return {
    jobId,
    job,
    questions: serverQuestions,
    answers: savedDraft?.answers || [],
    timer: savedDraft?.timer || 0,
  };
}
