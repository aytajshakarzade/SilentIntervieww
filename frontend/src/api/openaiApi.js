import axiosClient, { unwrap } from './axiosClient';

export const openaiApi = {
  transcribe: (file) => {
    const body = new FormData();
    body.append('file', file, file.name || 'answer.webm');
    return axiosClient.post('/OpenAI/transcribe', body, { headers: { 'Content-Type': 'multipart/form-data' } }).then(unwrap);
  },
};
