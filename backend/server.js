const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// Middleware de seguridad
app.use(helmet());

// Configurar CORS para React Native - MÁS PERMISIVO PARA DESARROLLO
app.use(cors({
  origin: '*', // En producción cambiar a dominios específicos
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000 // más permisivo en desarrollo
});
app.use(limiter);

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Conexión a la base de datos
const db = require('./config/database');

// Test database connection
db.getConnection((err, connection) => {
  if (err) {
    console.error('❌ Error conectando a la base de datos:', err);
    process.exit(1);
  }
  console.log('✅ Conectado a la base de datos MySQL');
  connection.release();
});

// Routes - IMPORTANTE: Agregar users
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users')); // ← NUEVA LÍNEA
app.use('/api/categories', require('./routes/categories'));

// Ruta de health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'QuickService Pro API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Ruta de prueba para users
app.get('/api/test-users', async (req, res) => {
  try {
    const [users] = await db.promise().execute('SELECT id, name, email FROM users LIMIT 5');
    res.json({ 
      message: 'Conexión a users funciona',
      users: users 
    });
  } catch (error) {
    res.status(500).json({ error: 'Error testeando users: ' + error.message });
  }
});

// Manejo de rutas no encontradas
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Ruta no encontrada',
    path: req.originalUrl,
    method: req.method
  });
});

// Manejo global de errores
app.use((err, req, res, next) => {
  console.error('🔥 Error:', err);
  res.status(500).json({ 
    error: 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { 
      details: err.message,
      stack: err.stack 
    })
  });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📊 Entorno: ${process.env.NODE_ENV}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
  console.log(`👥 Test users: http://localhost:${PORT}/api/test-users`);
});