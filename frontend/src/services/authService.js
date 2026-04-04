import apiClient from './apiClient';

const API_URL = '/api/auth';

export const login = async (data) => {
  const res = await apiClient.post(`${API_URL}/login`, data);
  return res.data;
};

export const register = async (data) => {
  const res = await apiClient.post(`${API_URL}/register`, data);
  return res.data;
};
