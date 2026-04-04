import apiClient from './apiClient';

const API_URL = '/api/products';

export const getProducts = async () => {
  const response = await apiClient.get(API_URL);
  return response.data;
};

export const createProduct = async (data) => {
  const res = await apiClient.post(API_URL, data);
  return res.data;
};
