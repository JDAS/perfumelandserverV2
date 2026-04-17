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

export const getBootstrapStatus = async () => {
  const res = await apiClient.get(`${API_URL}/bootstrap-status`);
  return res.data;
};

export const bootstrapAdmin = async (data) => {
  const res = await apiClient.post(`${API_URL}/bootstrap-admin`, data);
  return res.data;
};

export const getUsers = async () => {
  const res = await apiClient.get(`${API_URL}/users`);
  return res.data;
};

export const createAdminUser = async (data) => {
  const res = await apiClient.post(`${API_URL}/users`, data);
  return res.data;
};

export const updatePreferences = async (payload) => {
  const res = await apiClient.put(`${API_URL}/preferences`, payload);
  return res.data;
};
