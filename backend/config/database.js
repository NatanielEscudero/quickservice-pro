const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'quickservice_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true
});

// Convertir a promises para usar async/await
const promisePool = pool.promise();

// Manejar errores de conexión
pool.on('error', (err) => {
  console.error('❌ Error de base de datos:', err);
  if (err.code === 'PROTOCOL_CONNECTION_LOST') {
    console.log('Reconectando a la base de datos...');
  } else {
    throw err;
  }
});

// Función para verificar conexión
const testConnection = async () => {
  try {
    const connection = await promisePool.getConnection();
    console.log('✅ Conexión a MySQL verificada');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Error conectando a MySQL:', error.message);
    return false;
  }
};

module.exports = pool;
module.exports.promisePool = promisePool;
module.exports.testConnection = testConnection;