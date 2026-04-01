const serverless = require("serverless-http");
const app = require("../app");
const mongoose = require("mongoose");

let isConnected = false;

const connectDB = async () => {
  if (isConnected) return;

  await mongoose.connect(process.env.MONGO_URI);
  isConnected = true;
};

const handler = serverless(app, {
  basePath: "/.netlify/functions/api",
});

module.exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  await connectDB();
  return handler(event, context);
};