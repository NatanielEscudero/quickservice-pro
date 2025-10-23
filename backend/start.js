const { testConnection } = require('./config/database');
const server = require('./server');

async function startServer() {
  console.log('🔧 Iniciando QuickService Pro Backend...');
  
  // Verificar conexión a la base de datos
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.error('❌ No se pudo conectar a la base de datos. Saliendo...');
    process.exit(1);
  }

  console.log('✅ Backend iniciado correctamente');
}

startServer();