import api from './api';

const aiService = {
  suggestDetailsFromImage: async (imageFile) => {
    const formData = new FormData();
    formData.append('image', imageFile);

    const response = await api.post('/ai/suggest-details', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      timeout: 95_000,
    });
    return response.data;
  },

  resolveLocation: async (query) => {
    const response = await api.post('/ai/location/resolve', { query });
    return response.data.data;
  },

  assessReportDraft: async (payload) => {
    const response = await api.post('/ai/report/assess', payload);
    return response.data.data;
  }
};

export default aiService;
