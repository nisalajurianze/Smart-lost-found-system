import api from './api';

const locationKnowledgeService = {
  resolve: async (query) => (await api.get('/locations/resolve', { params: { q: query } })).data.data,
  suggest: async (payload) => (await api.post('/locations/suggestions', payload)).data.data,
  listAdmin: async (params = {}, signal) => (await api.get('/locations/admin', { params, signal })).data.data,
  review: async (id, payload) => (await api.patch(`/locations/admin/${id}`, payload)).data.data,
};
export default locationKnowledgeService;
