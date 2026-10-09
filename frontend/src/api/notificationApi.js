import { axiosClient, unwrap } from './axiosClient';

export const notificationApi = {
  getMine: (take = 12) => axiosClient.get('/Notification', { params: { take } }).then(unwrap),
  markRead: (id) => axiosClient.put(`/Notification/${id}/read`).then(unwrap),
  markAllRead: () => axiosClient.put('/Notification/read-all').then(unwrap),
};
