import axios from "axios";

export const getObjects = async () => {
  const res = await axios.get("/api/custom-objects");
  return res.data;
};

export const getObjectByApiName = async (apiName) => {
  const res = await axios.get(`/api/custom-objects/${apiName}`);
  return res.data;
};

export const updateObject = async (apiName, data) => {
  const res = await axios.put(`/api/custom-objects/${apiName}`, data);
  return res.data;
};

export const deleteObject = async (apiName) => {
  const res = await axios.delete(`/api/custom-objects/${apiName}`);
  return res.data;
};

export const createRecord = async (object, data) => {
  const res = await axios.post(`/api/custom-records/${object}`, data);
  return res.data;
};

export const getRecords = async (object) => {
  const res = await axios.get(`/api/custom-records/${object}`);
  return res.data;
};
export const getRecordById = async (object, id) => {
  const res = await axios.get(`/api/custom-records/${object}/${id}`);
  return res.data;
};

export const updateRecord = async (object, id, data) => {
  const res = await axios.put(`/api/custom-records/${object}/${id}`, data);
  return res.data;
};

export const deleteRecord = async (object, id) => {
  const res = await axios.delete(`/api/custom-records/${object}/${id}`);
  return res.data;
};