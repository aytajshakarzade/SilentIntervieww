import { createResourceApi } from './resourceApi';
export const interviewApi = {
  applications: createResourceApi('/JobApplication'),
  sessions: createResourceApi('/InterviewSession'),
  answers: createResourceApi('/InterviewAnswer'),
  reports: createResourceApi('/Report'),
};
