import axios from 'axios';
import { getAccessToken, clearAuth, replaceTokens } from '../services/authService';
import toast from "react-hot-toast";
import { getErrorMessage } from "../utils/errorUtils";
import { STORAGE_KEYS } from '../constants/storageKeys';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

export const axiosClient = axios.create({ baseURL, timeout: 30000, withCredentials: true });
const refreshClient = axios.create({ baseURL, timeout: 20000, withCredentials: true });
let refreshPromise = null;

// Attach Bearer token and language header to every request
axiosClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  
  // Add Accept-Language header based on current language.
  // i18n stores language under a user-scoped key: silent-interview.language.{userId}
  // We find the active key by checking the auth store for the user id.
  try {
    let language = null;
    // Try user-scoped key first (matches i18n/index.jsx storage format)
    const authRaw = localStorage.getItem(STORAGE_KEYS.auth);
    if (authRaw) {
      const auth = JSON.parse(authRaw);
      const uid = auth?.userId || auth?.user?.id;
      if (uid) {
        language = localStorage.getItem(`silent-interview.language.${uid}`);
      }
    }
    // Fallback: guest key
    if (!language) {
      language = localStorage.getItem('silent-interview.language.guest')
        || localStorage.getItem(STORAGE_KEYS.language);
    }
    if (language) {
      config.headers['Accept-Language'] = language;
    }
  } catch {
    // Ignore storage errors
  }
  
  return config;
});

// Auto-refresh on 401
axiosClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const req = error.config;
    const isAuthRoute = req?.url?.includes("/Auth/");
    const isGoogleAuthRoute = req?.url?.includes("/Auth/google");

    if (
      error.response?.status === 401 &&
      !req?._retry &&
      !isAuthRoute
    ) {
      req._retry = true;

      try {
        refreshPromise ??= refreshClient
          .post("/Auth/refresh", {})
          .then(({ data }) => unwrap({ data }))
          .finally(() => {
            refreshPromise = null;
          });

        const refreshed = await refreshPromise;

        replaceTokens(refreshed);

        req.headers.Authorization = `Bearer ${refreshed.accessToken}`;

        return axiosClient(req);
      } catch {
        clearAuth();
        toast.error("Your session has expired. Please sign in again.");
        throw error;
      }
    }

    // Google onboarding renders its own inline error state; do not also emit a
    // global toast for the same request (which otherwise produces duplicate errors).
    const isPlanLimit = error.response?.status === 402;
    if (!isGoogleAuthRoute && !isPlanLimit) toast.error(getErrorMessage(error));

    // Log detailed error for debugging (not shown to user)
    console.error('API Error:', error);

    throw error;
  }
);

/** Unwrap ApiResponse<T> → T */
export function unwrap(response) {
  const payload = response.data;

  if (payload?.success === false) {
    const error = new Error(payload.message || "Request failed.");
    error.response = { data: payload };
    throw error;
  }

  return payload?.data ?? payload;
}

/** Generic resource API factory */
export function createResourceApi(path) {
  return {
    getAll: (params) => axiosClient.get(path, { params }).then(unwrap),
    getById: (id) => axiosClient.get(`${path}/${id}`).then(unwrap),
    create: (data) => axiosClient.post(path, data).then(unwrap),
    update: (id, data) => axiosClient.put(`${path}/${id}`, data).then(unwrap),
    remove: (id) => axiosClient.delete(`${path}/${id}`).then(unwrap),

    // Yeni əlavə et
    put: (url, data = {}) => axiosClient.put(`${path}${url}`, data).then(unwrap),
  };
}

export default axiosClient;
