import axiosClient, { unwrap } from './axiosClient';

export const analyticsApi = {
  getCoreOverview: (period = 'monthly') => axiosClient.get('/Analytics/core-overview', { params: { period } }).then(unwrap),
  getOverview: (period = 'monthly') => axiosClient.get('/Analytics/overview', { params: { period } }).then(unwrap),
};
