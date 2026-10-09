import axiosClient, { unwrap } from './axiosClient';

export function createResourceApi(path) {
  return {
    getAll: (params) => axiosClient.get(path, params ? { params } : undefined).then(unwrap),
    getById: (id) => axiosClient.get(`${path}/${id}`).then(unwrap),
    create: (payload) => axiosClient.post(path, payload).then(unwrap),
    update: (id, payload) => axiosClient.put(`${path}/${id}`, payload).then(unwrap),
    remove: (id) => axiosClient.delete(`${path}/${id}`).then(unwrap),
  };
}
