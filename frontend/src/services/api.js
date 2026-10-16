import axios from 'axios';

const api = axios.create({
  baseURL: 'http://127.0.0.1:5001',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  response => response,
  error => {
    const message =
      error.response?.data?.details ||
      error.response?.data?.error ||
      error.message ||
      'An error occurred';

    return Promise.reject(new Error(message));
  }
);

export const incidentsApi = {
  getAll: (params = {}) => api.get('/incidents', { params }),

  getById: id => api.get(`/incidents/${id}`),

  create: data => api.post('/incidents', data),

  verify: (id, evidence) =>
    api.post(`/incidents/${id}/verify`, { evidence }),

  resolve: (id, resolution, notes) =>
    api.post(`/incidents/${id}/resolve`, { resolution, notes }),

  getNotes: id => api.get(`/incidents/${id}/notes`),

  addNote: (id, note, author) =>
    api.post(`/incidents/${id}/notes`, { note, author }),
};

export const detectionApi = {
  detect: data => api.post('/detect', data),
};

export const threatIntelApi = {
  getAll: (verifiedOnly = false) =>
    api.get('/threat-intelligence', {
      params: { verified_only: verifiedOnly },
    }),

  create: data => api.post('/threat-intelligence', data),

  verify: id => api.post(`/threat-intelligence/${id}/verify`),

  review: (id, data) => api.post(`/threat-intelligence/${id}/review`, data),
};

export const reportersApi = {
  getReputation: address =>
    api.get(`/reporters/${address}/reputation`),
};

export const verificationApi = {
  getHistory: (limit = 20) => api.get('/verification/history', { params: { limit } }),
};

export const researchApi = {
  getDetectorComparison: () => api.get('/detector/comparison'),
  getResponseEffectiveness: () => api.get('/response/effectiveness'),
  getResponseEvaluations: (limit = 10) => api.get('/response/evaluations', { params: { limit } }),
  simulateResponse: data => api.post('/response/simulate', data),
  authorizeResponse: data => api.post('/response/authorize', data),
  getContainers: () => api.get('/monitor/containers'),
  toggleContainerWorkload: mode => api.post('/monitor/containers/workload', { mode }),
};

export const statsApi = {
  getStats: () => api.get('/stats'),
};

export const healthApi = {
  check: () => api.get('/health'),
};

export const auditApi = {
  getLogs: (params = {}) => api.get('/audit-logs', { params }),
};

export const monitorApi = {
  getSystemMetrics: () => api.get('/monitor/system-metrics'),
};

export const reportsApi = {
  exportUrl: (format = 'csv') => `http://127.0.0.1:5001/reports/export?format=${format}`,
  getExport: (format = 'json') => api.get('/reports/export', { params: { format } }),
};

export const evaluationApi = {
  getResults: (threshold = 35) => api.get('/evaluation/results', { params: { threshold } }),
  run: (threshold = 35) => api.post('/evaluation/run', { threshold }),
};

export default api;