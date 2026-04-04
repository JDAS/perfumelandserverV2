const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET no está configurado');
  }

  return secret;
};

const getJwtExpiresIn = () => process.env.JWT_EXPIRES_IN || '1d';

module.exports = {
  getJwtSecret,
  getJwtExpiresIn,
};
