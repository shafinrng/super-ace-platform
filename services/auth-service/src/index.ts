import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.routes';
import { errorHandler } from './middleware/error.middleware';

const app = express();
const PORT = process.env.AUTH_SERVICE_PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json({ limit: '10kb' }));

// Rate limiting
app.use('/api/auth', rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: 'Too many requests, please try again later.' }
}));

// Routes
app.use('/api/auth', authRoutes);

// Health check
app.get('/health', (_, res) => {
  res.json({ status: 'ok', service: 'auth-service', timestamp: new Date() });
});

// Error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`✅ Auth Service running on port ${PORT}`);
});

export default app;