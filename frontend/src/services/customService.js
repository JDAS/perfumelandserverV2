import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "",
});

export const getCustomObjects = async () => {
  const res = await api.get("/api/custom-objects");
  return res.data;
};

export const getCustomObjectByApiName = async (apiName) => {
  const res = await api.get(`/api/custom-objects/${apiName}`);
  return res.data;
};

export const createCustomObject = async (payload) => {
  const res = await api.post("/api/custom-objects", payload);
  return res.data;
};

export const updateCustomObject = async (apiName, payload) => {
  const res = await api.put(`/api/custom-objects/${apiName}`, payload);
  return res.data;
};

export const deleteCustomObject = async (apiName) => {
  const res = await api.delete(`/api/custom-objects/${apiName}`);
  return res.data;
};

export const getRecords = async (object, params = {}) => {
  const res = await api.get(`/api/custom-records/${object}`, { params });
  return res.data;
};

export const getRecordById = async (object, id) => {
  const res = await api.get(`/api/custom-records/${object}/${id}`);
  return res.data;
};

export const createRecord = async (object, payload) => {
  const res = await api.post(`/api/custom-records/${object}`, payload);
  return res.data;
};

export const updateRecord = async (object, id, payload) => {
  const res = await api.put(`/api/custom-records/${object}/${id}`, payload);
  return res.data;
};

export const deleteRecord = async (object, id) => {
  const res = await api.delete(`/api/custom-records/${object}/${id}`);
  return res.data;
};

export default api;