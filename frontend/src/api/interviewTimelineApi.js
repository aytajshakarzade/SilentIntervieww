import { axiosClient, unwrap } from './axiosClient';

export const interviewTimelineApi = {
    get: (interviewSessionId) => axiosClient.get(`/InterviewTimeline/${interviewSessionId}`).then(unwrap),
};
