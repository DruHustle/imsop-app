import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import operationsRoutes from './routes/operationsRoutes';
import telemetryRoutes from './routes/telemetryRoutes';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/operations', operationsRoutes);
app.use('/api/telemetry', telemetryRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

