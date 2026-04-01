import axios from "axios";
import { useAuthStore } from "../store/authStore";

const API_URL = "/api/products";

export const getProducts = async () => {
  const response = await axios.get(API_URL);
  return response.data;
};

export const createProduct = async (data) => {
  const token = useAuthStore.getState().token;

  const res = await axios.post(API_URL, data, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.data;
};