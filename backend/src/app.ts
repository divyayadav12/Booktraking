import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { ENV } from './config/env';
import apiRoutes from './routes';
import { errorHandler } from './middleware/errorHandler';
import { sendOrderEmail } from './services/email.service';

const app = express();

// Security and utility middleware
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl) and local dev origins
      if (!origin || origin === ENV.CORS_ORIGIN || origin.startsWith('http://localhost:')) {
        callback(null, true);
      } else {
        callback(null, true); // Permissive in dev, can restrict in production
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (ENV.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'FAST DISPATCH PRO',
  });
});

// Email Config Diagnostic Route (temporary - for debugging)
app.get('/api/test-email', async (req, res) => {
  const config = {
    EMAIL_ENABLED: ENV.EMAIL_ENABLED,
    SMTP_HOST: ENV.SMTP_HOST || 'NOT SET',
    SMTP_PORT: ENV.SMTP_PORT,
    SMTP_USER: ENV.SMTP_USER ? ENV.SMTP_USER : 'NOT SET',
    SMTP_FROM: ENV.SMTP_FROM || 'NOT SET',
    SMTP_PASS: ENV.SMTP_PASS ? `SET (${ENV.SMTP_PASS.length} chars)` : 'NOT SET',
  };

  const to = (req.query.to as string) || ENV.SMTP_USER;
  if (!to) {
    return res.json({ config, error: 'Add ?to=youremail@gmail.com in URL to send test email' });
  }

  try {
    const result = await sendOrderEmail(
      { name: 'Test Student', email: to, trackingId: 'TEST-001', orderCode: 'TEST-001' },
      [{ bookCode: 'TEST-BK', bookName: 'Test Book', requiredQuantity: 1, dispatchedQuantity: 0 }]
    );
    return res.json({ config, emailResult: result });
  } catch (err: any) {
    return res.json({ config, emailError: err.message });
  }
});

// API Routes
app.use('/api', apiRoutes);

// 404 Route Handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API route ${req.originalUrl} not found`,
    code: 'ROUTE_NOT_FOUND',
  });
});

// Central Error Handler
app.use(errorHandler);

export default app;
