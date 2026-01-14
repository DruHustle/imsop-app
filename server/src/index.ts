import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/authRoutes.js'; // Ensure .js extension if using ES Modules
import operationsRoutes from './routes/operationsRoutes.js';
import telemetryRoutes from './routes/telemetryRoutes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// 1. CORS Configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || 'http://localhost:5173',
  credentials: true
}));

app.use(express.json());

// 2. API Routes
app.use('/api/auth', authRoutes);
app.use('/api/operations', operationsRoutes);
app.use('/api/telemetry', telemetryRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 3. Static File Serving (Production)
if (process.env.NODE_ENV === 'production') {
  // Path to your frontend build folder (usually 'dist' or 'build')
  const distPath = path.resolve(__dirname, '../dist'); 
  app.use(express.static(distPath));

  // Handle SPA routing: serve index.html for any unknown non-API routes
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

// 4. Port Binding for Render
// Use Render's provided port or fallback to 3001 for local dev
const port = process.env.PORT || 3001;

// Binding to '0.0.0.0' is required for many cloud environments
app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});