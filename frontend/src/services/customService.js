import apiClient from './apiClient';

/* =========================
   Objetos personalizados
========================= */
export const getLookupOptions = async (object) => {
  const res = await apiClient.get(`/api/custom-records/${object}`, {
    params: { page: 1, limit: 100, sortBy: 'createdAt', sortOrder: 'desc' },
  });
  return res.data;
};

export const getObjects = async () => {
  const res = await apiClient.get('/api/custom-objects');
  return res.data;
};

export const getObjectByApiName = async (apiName) => {
  const res = await apiClient.get(`/api/custom-objects/${apiName}`);
  return res.data;
};

export const createObject = async (payload) => {
  const res = await apiClient.post('/api/custom-objects', payload);
  return res.data;
};

export const updateObject = async (apiName, payload) => {
  const res = await apiClient.put(`/api/custom-objects/${apiName}`, payload);
  return res.data;
};

export const deleteObject = async (apiName) => {
  const res = await apiClient.delete(`/api/custom-objects/${apiName}`);
  return res.data;
};

export const getSuites = async () => {
  const res = await apiClient.get("/api/suites");
  return res.data;
};

export const installSuite = async (suiteId) => {
  const res = await apiClient.post(`/api/suites/${suiteId}/install`);
  return res.data;
};

export const getCustomObjects = getObjects;
export const getCustomObjectByApiName = getObjectByApiName;
export const createCustomObject = createObject;
export const updateCustomObject = updateObject;
export const deleteCustomObject = deleteObject;

/* =========================
   Registros dinámicos
========================= */

export const getRecords = async (object, params = {}) => {
  const res = await apiClient.get(`/api/custom-records/${object}`, { params });
  return res.data;
};

export const getRecordById = async (object, id) => {
  const res = await apiClient.get(`/api/custom-records/${object}/${id}`);
  return res.data;
};

export const createRecord = async (object, payload) => {
  const res = await apiClient.post(`/api/custom-records/${object}`, payload);
  return res.data;
};

export const updateRecord = async (object, id, payload) => {
  const res = await apiClient.put(`/api/custom-records/${object}/${id}`, payload);
  return res.data;
};

export const deleteRecord = async (object, id) => {
  const res = await apiClient.delete(`/api/custom-records/${object}/${id}`);
  return res.data;
};

export const getRelatedRecords = async (
  object,
  id,
  relatedObject,
  relatedField,
  params = {}
) => {
  const res = await apiClient.get(
    `/api/custom-records/${object}/${id}/related/${relatedObject}/${relatedField}`,
    { params }
  );
  return res.data;
};

export default apiClient;
