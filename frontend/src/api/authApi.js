import axiosClient, { unwrap } from './axiosClient';

export const authApi = {
  login: (payload) => axiosClient.post('/Auth/login', payload).then(unwrap),
  register: (payload) => axiosClient.post('/Auth/register', payload).then(unwrap),
  google: (credential, role = null, companyId = null, companyName = null, companyCountry = null, companyIndustry = null, setupToken = null) => axiosClient.post('/Auth/google', { credential, role, companyId, companyName, companyCountry, companyIndustry, setupToken }).then(unwrap),
  forgotPassword: (email) => axiosClient.post('/Auth/forgot-password', { email }).then(unwrap),
  resetPassword: (payload) => axiosClient.post('/Auth/reset-password', payload).then(unwrap),
  logout: (refreshToken) => axiosClient.post('/Auth/logout', { refreshToken }).then(unwrap),
};
