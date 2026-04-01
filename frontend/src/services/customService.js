import axios from "axios";

export const getObjects = async () => {
  const res = await axios.get("/api/custom-objects");
  return res.data;
};

export const createRecord = async (object, data) => {
  const res = await axios.post(`/api/custom-records/${object}`, data);
  return res.data;
};