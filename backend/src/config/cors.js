const parseAllowedOrigins = () => {
  const raw = process.env.CORS_ORIGIN || '';

  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const createCorsOptions = () => {
  const allowedOrigins = parseAllowedOrigins();
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      if (!isProduction || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`Origen no permitido por CORS: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };
};

module.exports = { createCorsOptions };
