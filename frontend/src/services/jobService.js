import { createResourceApi } from '../api/axiosClient';

const api = createResourceApi('/Job');

export const jobService = {
  getAll: (params) => api.getAll(params),
  getById: (id) => api.getById(id),
  create: (data) => api.create(data),
  update: (id, data) => api.update(id, data),
  remove: (id) => api.remove(id),

  restore: (id) => api.put(`/${id}/restore`),
};