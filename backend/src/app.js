const express = require('express');
const cors = require('cors');
const { frontendUrl } = require('./config/env');
const securityHeaders = require('./middleware/securityHeaders');
const requestLogger = require('./middleware/requestLogger');
const healthRoutes = require('./routes/health.routes');
const publicRoutes = require('./routes/public.routes');
const authRoutes = require('./routes/auth.routes');
const crRoutes = require('./routes/cr.routes');
const adminRoutes = require('./routes/admin.routes');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.disable('x-powered-by');

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use(securityHeaders);

const allowedOrigins = (frontendUrl || '').split(',').map((url) => url.trim());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || (process.env.NODE_ENV !== 'production' && /^http:\/\/localhost(:\d+)?$/.test(origin))) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));
app.use(requestLogger);
app.use('/api', healthRoutes);
app.use('/api', publicRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/cr', crRoutes);
app.use('/api/admin', adminRoutes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
