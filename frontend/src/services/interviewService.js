/**
 * interviewService — wraps all interview-related backend endpoints.
 * Field names match backend DTOs exactly (camelCase from JSON serialization).
 *
 * CreateInterviewAnswerRequest: { interviewSessionId, question, answer, order }
 * CreateInterviewSessionRequest: { jobApplicationId, startedAt, language }
 * CreateJobApplicationRequest: { candidateId, jobId }
 * CreateReportRequest: { interviewSessionId, score, feedback }
 * Transcribe: POST /OpenAI/transcribe (multipart: field name "file")
 */
import { createResourceApi, axiosClient, unwrap } from '../api/axiosClient';

const applicationsApi = createResourceApi('/JobApplication');
const sessionsApi     = createResourceApi('/InterviewSession');
const answersApi      = createResourceApi('/InterviewAnswer');
const reportsApi      = createResourceApi('/Report');

export const interviewService = {
  applications: {
    getAll:   (params) => applicationsApi.getAll(params),
    getById:  (id)     => applicationsApi.getById(id),
    create:   (data)   => applicationsApi.create(data),   // { candidateId, jobId }
    update:   (id, d)  => applicationsApi.update(id, d),
    remove:   (id)     => applicationsApi.remove(id),
  },
  sessions: {
    getAll:   (params) => sessionsApi.getAll(params),
    getById:  (id)     => sessionsApi.getById(id),
    create:   (data)   => sessionsApi.create(data),       // { jobApplicationId, startedAt, language }
    update:   (id, d)  => sessionsApi.update(id, d),      // { endedAt }
    remove:   (id)     => sessionsApi.remove(id),
  },
  answers: {
    getAll:   (params) => answersApi.getAll(params),
    getById:  (id)     => answersApi.getById(id),
    create:   (data)   => answersApi.create(data),        // { interviewSessionId, question, answer, order }
    update:   (id, d)  => answersApi.update(id, d),
    remove:   (id)     => answersApi.remove(id),
  },
  reports: {
    getAll:   (params) => reportsApi.getAll(params),
    getById:  (id)     => reportsApi.getById(id),
    create:   (data)   => reportsApi.create(data),        // { interviewSessionId, score, feedback }
    generate: (interviewSessionId) => axiosClient.post(`/Report/generate/${interviewSessionId}`).then(unwrap),
    update:   (id, d)  => reportsApi.update(id, d),
    remove:   (id)     => reportsApi.remove(id),
  },
  openai: {
    /**
     * Transcribe audio via Whisper.
     * POST /api/v1/OpenAI/transcribe  (multipart/form-data, field: "file")
     * Returns: { transcript: string }
     */
    transcribe: async (audioFile) => {
      const form = new FormData();
      form.append('file', audioFile, audioFile.name || 'recording.webm');
      const res = await axiosClient.post('/OpenAI/transcribe', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      // Response shape: { success, data: { transcript } }
      const payload = res.data;
      if (payload?.success === false) throw new Error(payload.message || 'Transcription failed');
      return payload?.data?.transcript ?? payload?.data ?? '';
    },
  },
};
