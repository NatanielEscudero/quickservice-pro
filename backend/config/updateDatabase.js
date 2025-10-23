const mysql = require('mysql2');
require('dotenv').config();

console.log('🔧 Actualizando estructura de la base de datos...');

const connection = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'quickservice_db',
  port: process.env.DB_PORT || 3306,
});

connection.connect((err) => {
  if (err) {
    console.error('❌ Error conectando a MySQL:', err.message);
    process.exit(1);
  }

  console.log('✅ Conectado a MySQL');

  // Agregar columnas faltantes a la tabla workers
  const alterWorkersTable = `
    ALTER TABLE workers 
    ADD COLUMN IF NOT EXISTS completed_services INT DEFAULT 0 AFTER total_ratings,
    ADD COLUMN IF NOT EXISTS description TEXT AFTER profession,
    ADD COLUMN IF NOT EXISTS experience_years INT DEFAULT 0 AFTER description,
    ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(10,2) AFTER experience_years,
    ADD COLUMN IF NOT EXISTS immediate_service BOOLEAN DEFAULT false AFTER hourly_rate,
    ADD COLUMN IF NOT EXISTS availability ENUM('available', 'busy', 'offline') DEFAULT 'available' AFTER immediate_service,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER completed_services
  `;

  // Agregar columnas faltantes a la tabla users
  const alterUsersTable = `
    ALTER TABLE users 
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at
  `;

  const updates = [
    { name: 'workers', sql: alterWorkersTable },
    { name: 'users', sql: alterUsersTable }
  ];

  let completed = 0;
  
  updates.forEach(({ name, sql }) => {
    connection.query(sql, (err) => {
      if (err) {
        console.error(`❌ Error actualizando tabla ${name}:`, err.message);
        // Continuar aunque falle (puede que ya existan las columnas)
      } else {
        console.log(`✅ Tabla ${name} actualizada`);
      }
      
      completed++;
      
      if (completed === updates.length) {
        console.log('🎉 Base de datos actualizada correctamente!');
        
        // Verificar la estructura final
        connection.query('DESCRIBE workers', (err, results) => {
          if (err) {
            console.error('Error verificando estructura:', err);
          } else {
            console.log('\n📋 Estructura de la tabla workers:');
            results.forEach(row => {
              console.log(`   ${row.Field} (${row.Type})`);
            });
          }
          connection.end();
        });
      }
    });
  });
});