import axiosClient, { unwrap } from './axiosClient';

export const adminApi = {
  dashboard: () => axiosClient.get('/Admin/dashboard').then(unwrap),
  companies: (params = {}) => axiosClient.get('/Admin/companies', { params }).then(unwrap),
  activity: (take = 20) => axiosClient.get('/Admin/activity', { params: { take } }).then(unwrap),
  overview: () => axiosClient.get('/Admin/overview').then(unwrap),
  users: (params = {}) => axiosClient.get('/Admin/users', { params }).then(unwrap),
  setStatus: (id, isActive) => axiosClient.put(`/Admin/users/${id}/status`, { isActive }).then(unwrap),
  setPlan: (id, plan) => axiosClient.put(`/Admin/users/${id}/plan`, { plan }).then(unwrap),
  removeUser: (id) => axiosClient.delete(`/Admin/users/${id}`).then(unwrap),
  restoreUser: (id) => axiosClient.put(`/Admin/users/${id}/restore`).then(unwrap),
};
