import { axiosClient, unwrap } from './axiosClient';

export const activityApi = {
    getRecent: (take = 12) => axiosClient.get('/Activity', { params: { take } }).then(unwrap),
};
