const dotenv = require('dotenv');

dotenv.config();

const required = ['DATABASE_URL', 'JWT_SECRET'];

function validateEnv() {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length && process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  if (process.env.NODE_ENV === 'production') {
    const secret = process.env.JWT_SECRET || '';
    const weakSecrets = ['dev_jwt_secret', 'griet2026', 'use_a_long_random_secret', 'secret', 'password', 'change_me'];
    if (secret.length < 32 || weakSecrets.includes(secret.toLowerCase())) {
      throw new Error('JWT_SECRET must be at least 32 characters and cryptographically strong in production.');
    }

    if (!process.env.FRONTEND_URL || process.env.FRONTEND_URL === '*') {
      throw new Error('FRONTEND_URL must be explicitly configured and not wildcard in production.');
    }
  }
}

validateEnv();

module.exports = {
  port: Number(process.env.PORT || 5000),
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  grietFacultySourceUrl: process.env.GRIET_FACULTY_SOURCE_URL || 'https://www.griet.ac.in/images/Staff%20List%20for%20Website.pdf',
};

