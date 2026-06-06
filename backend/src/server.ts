import { Server } from 'socket.io';
import app from './app.js';

const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port http://localhost:${PORT}`);
});

// Inicialização do WebSocket (Socket.io)
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

// Armazenar no app express para acesso em controllers
app.set('io', io);

io.on('connection', (socket) => {
  const tenantId = socket.handshake.query.tenantId;
  
  if (tenantId) {
    socket.join(`tenant:${tenantId}`);
    console.log(`🔌 Cliente conectado e associado à sala: tenant:${tenantId}`);
  }

  socket.on('disconnect', () => {
    console.log('🔌 Cliente desconectado');
  });
});

// Tratamento de desligamento gracioso (graceful shutdown)
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});
