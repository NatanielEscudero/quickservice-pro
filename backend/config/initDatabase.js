const mysql = require('mysql2');
require('dotenv').config();

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

console.log('🔧 Inicializando base de datos...');

connection.query('CREATE DATABASE IF NOT EXISTS quickservice_db', (err) => {
  if (err) {
    console.error('❌ Error creando base de datos:', err);
    process.exit(1);
  }
  
  console.log('✅ Base de datos creada/existe');
  
  // Usar la base de datos
  connection.query('USE quickservice_db', (err) => {
    if (err) {
      console.error('❌ Error usando base de datos:', err);
      process.exit(1);
    }

    // Crear tabla de usuarios
    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255),
        role ENUM('client', 'worker', 'admin') NOT NULL,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
        avatar_url TEXT,
        is_verified BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `;

    // Crear tabla de trabajadores
    const createWorkersTable = `
      CREATE TABLE IF NOT EXISTS workers (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT,
        profession VARCHAR(100) NOT NULL,
        description TEXT,
        experience_years INT DEFAULT 0,
        hourly_rate DECIMAL(10,2),
        immediate_service BOOLEAN DEFAULT false,
        availability ENUM('available', 'busy', 'offline') DEFAULT 'available',
        rating DECIMAL(3,2) DEFAULT 0,
        total_ratings INT DEFAULT 0,
        completed_services INT DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user (user_id)
      )
    `;

    // Crear tabla de categorías
    const createCategoriesTable = `
      CREATE TABLE IF NOT EXISTS categories (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        icon VARCHAR(50),
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const tables = [
      { name: 'users', sql: createUsersTable },
      { name: 'workers', sql: createWorkersTable },
      { name: 'categories', sql: createCategoriesTable }
    ];

    let completed = 0;
    
    tables.forEach(({ name, sql }) => {
      connection.query(sql, (err) => {
        if (err) {
          console.error(`❌ Error creando tabla ${name}:`, err);
          process.exit(1);
        }
        
        console.log(`✅ Tabla ${name} creada/existe`);
        completed++;
        
        if (completed === tables.length) {
          // Insertar datos iniciales
          insertInitialData();
        }
      });
    });
  });
});

function insertInitialData() {
  // Insertar categorías por defecto
  const categories = [
    { name: 'Plomería', icon: '🔧', description: 'Reparaciones e instalaciones de tuberías' },
    { name: 'Electricidad', icon: '⚡', description: 'Instalaciones y reparaciones eléctricas' },
    { name: 'Carpintería', icon: '🔨', description: 'Trabajos en madera y muebles' },
    { name: 'Pintura', icon: '🎨', description: 'Pintura residencial y comercial' },
    { name: 'Jardinería', icon: '🌿', description: 'Mantenimiento de jardines y áreas verdes' },
    { name: 'Limpieza', icon: '🧹', description: 'Servicios de limpieza residencial' },
    { name: 'Mudanzas', icon: '📦', description: 'Servicios de mudanza y transporte' },
    { name: 'Tecnología', icon: '💻', description: 'Reparación de equipos tecnológicos' }
  ];

  categories.forEach(category => {
    connection.query(
      'INSERT IGNORE INTO categories (name, icon, description) VALUES (?, ?, ?)',
      [category.name, category.icon, category.description]
    );
  });

  console.log('📊 Datos iniciales insertados');
  console.log('🎉 Base de datos inicializada correctamente!');
  connection.end();
}