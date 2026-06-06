import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

import apiRouter from './infrastructure/http/routes/index.js';

const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

app.use(express.json());

// Roteador API v1
app.use('/api/v1', apiRouter);

// Rota de Healthcheck
app.get('/health', (req, res) => {
  res.json({
    status: 'up',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

export default app;
