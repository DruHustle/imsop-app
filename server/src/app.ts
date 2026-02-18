import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes';
import operationsRoutes from './routes/operationsRoutes';
import telemetryRoutes from './routes/telemetryRoutes';

const app = express();

app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/operations', operationsRoutes);
app.use('/api/telemetry', telemetryRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

export default app;
