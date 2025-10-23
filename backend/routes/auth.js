const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { promisePool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Registro de usuario
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, role, phone, profession } = req.body;

    // Validaciones básicas
    if (!email || !password || !name || !role) {
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    // Verificar si el usuario ya existe
    const [existingUsers] = await promisePool.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({ error: 'El usuario ya existe' });
    }

    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(password, 12);

    // Iniciar transacción
    const connection = await promisePool.getConnection();
    await connection.beginTransaction();

    try {
      // Insertar usuario
      const [userResult] = await connection.execute(
        'INSERT INTO users (email, password, name, role, phone) VALUES (?, ?, ?, ?, ?)',
        [email, hashedPassword, name, role, phone]
      );

      const userId = userResult.insertId;

      // Si es trabajador, insertar en tabla workers
      if (role === 'worker' && profession) {
        await connection.execute(
          'INSERT INTO workers (user_id, profession) VALUES (?, ?)',
          [userId, profession]
        );
      }

      // Generar token JWT
      const token = jwt.sign(
        { 
          userId, 
          email, 
          role,
          name 
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
      );

      await connection.commit();

      res.status(201).json({
        message: 'Usuario registrado exitosamente',
        token,
        user: {
          id: userId,
          email,
          name,
          role,
          phone,
          profession: role === 'worker' ? profession : null
        }
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Login de usuario
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }

    // Buscar usuario con información del worker si existe
    const [users] = await promisePool.execute(`
      SELECT u.*, w.profession, w.rating, w.completed_services 
      FROM users u 
      LEFT JOIN workers w ON u.id = w.user_id 
      WHERE u.email = ?
    `, [email]);

    if (users.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const user = users[0];

    // Verificar contraseña
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Generar token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        role: user.role,
        name: user.name
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    // Preparar respuesta del usuario (sin password)
    const userResponse = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      phone: user.phone,
      avatar_url: user.avatar_url,
      is_verified: user.is_verified,
      profession: user.profession,
      rating: user.rating,
      completed_services: user.completed_services
    };

    res.json({
      message: 'Login exitoso',
      token,
      user: userResponse
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Verificar token
router.get('/verify', authenticateToken, (req, res) => {
  res.json({ 
    valid: true, 
    user: req.user 
  });
});

module.exports = router;