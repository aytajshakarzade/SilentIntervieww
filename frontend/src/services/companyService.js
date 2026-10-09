import { createResourceApi, axiosClient, unwrap } from '../api/axiosClient';

const api = createResourceApi('/Company');

export const companyService = {
  getAll: (params) => api.getAll(params),
  getPublic: (country) => axiosClient.get('/Company/public', { params: country ? { country } : undefined }).then(unwrap),
  uploadLogo: (id, file) => { const form = new FormData(); form.append('file', file); return axiosClient.post(`/Company/${id}/logo`, form, { headers: { 'Content-Type': 'multipart/form-data' } }).then(unwrap); },
  getById: (id) => api.getById(id),
  create: (data) => api.create(data),
  update: (id, data) => api.update(id, data),
  remove: (id) => api.remove(id),

  // Leading slash is required — api.put concatenates path + url:
  // "/Company" + "/{id}/restore" → "/Company/{id}/restore" ✓
  // Without it: "/Company" + "{id}/restore" → "/Company{id}/restore" ✗
  restore: (id) => api.put(`/${id}/restore`),
};
