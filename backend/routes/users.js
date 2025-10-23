const express = require('express');
const { promisePool } = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const bcrypt = require('bcrypt');

const router = express.Router();

// Middleware para verificar que el usuario accede solo a sus datos o es admin
const canAccessUser = (req, res, next) => {
  const userId = parseInt(req.params.id);
  
  if (req.user.role === 'admin' || req.user.id === userId) {
    next();
  } else {
    return res.status(403).json({ error: 'No tienes permisos para acceder a este recurso' });
  }
};

// GET /api/users/profile - Obtener perfil del usuario actual
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const [users] = await promisePool.execute(`
      SELECT 
        u.id, u.email, u.name, u.role, u.phone, u.avatar_url, 
        u.is_verified, u.created_at, u.updated_at,
        w.profession, w.description, w.experience_years, w.hourly_rate,
        w.immediate_service, w.availability, w.rating, w.total_ratings,
        w.completed_services
      FROM users u 
      LEFT JOIN workers w ON u.id = w.user_id 
      WHERE u.id = ?
    `, [req.user.id]);

    if (users.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const user = users[0];
    
    // Preparar respuesta sin información sensible
    const userResponse = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      phone: user.phone,
      avatar_url: user.avatar_url,
      is_verified: user.is_verified,
      created_at: user.created_at,
      updated_at: user.updated_at,
      profession: user.profession,
      description: user.description,
      experience_years: user.experience_years,
      hourly_rate: user.hourly_rate,
      immediate_service: user.immediate_service,
      availability: user.availability,
      rating: user.rating,
      total_ratings: user.total_ratings,
      completed_services: user.completed_services
    };

    res.json({ user: userResponse });
  } catch (error) {
    console.error('Error obteniendo perfil:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /api/users/profile - Actualizar perfil del usuario actual
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { name, phone, avatar_url, profession, description, experience_years, hourly_rate } = req.body;
    
    // Validaciones básicas
    if (!name) {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }

    const connection = await promisePool.getConnection();
    await connection.beginTransaction();

    try {
      // Actualizar datos básicos del usuario
      await connection.execute(
        'UPDATE users SET name = ?, phone = ?, avatar_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [name, phone, avatar_url, req.user.id]
      );

      // Si es trabajador, actualizar datos específicos
      if (req.user.role === 'worker') {
        // Verificar si ya existe registro en workers
        const [existingWorker] = await connection.execute(
          'SELECT id FROM workers WHERE user_id = ?',
          [req.user.id]
        );

        if (existingWorker.length > 0) {
          // Actualizar worker existente
          await connection.execute(
            `UPDATE workers 
             SET profession = ?, description = ?, experience_years = ?, hourly_rate = ?, updated_at = CURRENT_TIMESTAMP 
             WHERE user_id = ?`,
            [profession, description, experience_years, hourly_rate, req.user.id]
          );
        } else {
          // Crear nuevo registro en workers
          await connection.execute(
            `INSERT INTO workers (user_id, profession, description, experience_years, hourly_rate) 
             VALUES (?, ?, ?, ?, ?)`,
            [req.user.id, profession, description, experience_years, hourly_rate]
          );
        }
      }

      await connection.commit();

      // Obtener usuario actualizado
      const [updatedUsers] = await promisePool.execute(`
        SELECT 
          u.id, u.email, u.name, u.role, u.phone, u.avatar_url, 
          u.is_verified, u.created_at, u.updated_at,
          w.profession, w.description, w.experience_years, w.hourly_rate,
          w.immediate_service, w.availability, w.rating, w.total_ratings,
          w.completed_services
        FROM users u 
        LEFT JOIN workers w ON u.id = w.user_id 
        WHERE u.id = ?
      `, [req.user.id]);

      const updatedUser = updatedUsers[0];
      const userResponse = {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        phone: updatedUser.phone,
        avatar_url: updatedUser.avatar_url,
        is_verified: updatedUser.is_verified,
        profession: updatedUser.profession,
        description: updatedUser.description,
        experience_years: updatedUser.experience_years,
        hourly_rate: updatedUser.hourly_rate,
        availability: updatedUser.availability,
        rating: updatedUser.rating
      };

      res.json({ 
        message: 'Perfil actualizado correctamente',
        user: userResponse 
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Error actualizando perfil:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /api/users/password - Cambiar contraseña
router.put('/password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'La contraseña actual y nueva son requeridas' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
    }

    // Obtener usuario con contraseña actual
    const [users] = await promisePool.execute(
      'SELECT password FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const user = users[0];

    // Verificar contraseña actual
    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'La contraseña actual es incorrecta' });
    }

    // Hash nueva contraseña
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Actualizar contraseña
    await promisePool.execute(
      'UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [hashedPassword, req.user.id]
    );

    res.json({ message: 'Contraseña actualizada correctamente' });

  } catch (error) {
    console.error('Error cambiando contraseña:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/users/workers - Obtener lista de trabajadores (público)
router.get('/workers', async (req, res) => {
  try {
    const { profession, min_rating, available } = req.query;
    
    let query = `
      SELECT 
        u.id, u.name, u.avatar_url, u.created_at,
        w.profession, w.description, w.experience_years, w.hourly_rate,
        w.immediate_service, w.availability, w.rating, w.total_ratings,
        w.completed_services
      FROM users u 
      INNER JOIN workers w ON u.id = w.user_id 
      WHERE u.role = 'worker' AND u.is_verified = true
    `;
    
    const params = [];

    // Filtros
    if (profession) {
      query += ' AND w.profession = ?';
      params.push(profession);
    }

    if (min_rating) {
      query += ' AND w.rating >= ?';
      params.push(parseFloat(min_rating));
    }

    if (available === 'true') {
      query += ' AND w.availability = "available"';
    }

    query += ' ORDER BY w.rating DESC, w.completed_services DESC';

    const [workers] = await promisePool.execute(query, params);

    const workersResponse = workers.map(worker => ({
      id: worker.id,
      name: worker.name,
      avatar_url: worker.avatar_url,
      profession: worker.profession,
      description: worker.description,
      experience_years: worker.experience_years,
      hourly_rate: worker.hourly_rate,
      immediate_service: worker.immediate_service,
      availability: worker.availability,
      rating: worker.rating,
      total_ratings: worker.total_ratings,
      completed_services: worker.completed_services,
      member_since: worker.created_at
    }));

    res.json({ workers: workersResponse });
  } catch (error) {
    console.error('Error obteniendo trabajadores:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/users/workers/:id - Obtener perfil público de un trabajador
router.get('/workers/:id', async (req, res) => {
  try {
    const workerId = req.params.id;

    const [workers] = await promisePool.execute(`
      SELECT 
        u.id, u.name, u.avatar_url, u.created_at,
        w.profession, w.description, w.experience_years, w.hourly_rate,
        w.immediate_service, w.availability, w.rating, w.total_ratings,
        w.completed_services
      FROM users u 
      INNER JOIN workers w ON u.id = w.user_id 
      WHERE u.id = ? AND u.role = 'worker' AND u.is_verified = true
    `, [workerId]);

    if (workers.length === 0) {
      return res.status(404).json({ error: 'Trabajador no encontrado' });
    }

    const worker = workers[0];
    const workerResponse = {
      id: worker.id,
      name: worker.name,
      avatar_url: worker.avatar_url,
      profession: worker.profession,
      description: worker.description,
      experience_years: worker.experience_years,
      hourly_rate: worker.hourly_rate,
      immediate_service: worker.immediate_service,
      availability: worker.availability,
      rating: worker.rating,
      total_ratings: worker.total_ratings,
      completed_services: worker.completed_services,
      member_since: worker.created_at
    };

    res.json({ worker: workerResponse });
  } catch (error) {
    console.error('Error obteniendo trabajador:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /api/users/workers/availability - Actualizar disponibilidad (solo trabajadores)
router.put('/workers/availability', authenticateToken, requireRole(['worker']), async (req, res) => {
  try {
    const { availability } = req.body;

    if (!['available', 'busy', 'offline'].includes(availability)) {
      return res.status(400).json({ error: 'Estado de disponibilidad inválido' });
    }

    await promisePool.execute(
      'UPDATE workers SET availability = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
      [availability, req.user.id]
    );

    res.json({ 
      message: 'Disponibilidad actualizada correctamente',
      availability 
    });
  } catch (error) {
    console.error('Error actualizando disponibilidad:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /api/users/avatar - Actualizar avatar
router.put('/avatar', authenticateToken, async (req, res) => {
  try {
    const { avatar_url } = req.body;

    if (!avatar_url) {
      return res.status(400).json({ error: 'URL del avatar es requerida' });
    }

    await promisePool.execute(
      'UPDATE users SET avatar_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [avatar_url, req.user.id]
    );

    res.json({ 
      message: 'Avatar actualizado correctamente',
      avatar_url 
    });
  } catch (error) {
    console.error('Error actualizando avatar:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE /api/users/profile - Eliminar cuenta de usuario
router.delete('/profile', authenticateToken, async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'La contraseña es requerida para eliminar la cuenta' });
    }

    // Verificar contraseña
    const [users] = await promisePool.execute(
      'SELECT password FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const user = users[0];
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(400).json({ error: 'Contraseña incorrecta' });
    }

    // Eliminar usuario (las foreign keys con CASCADE eliminarán los registros relacionados)
    await promisePool.execute('DELETE FROM users WHERE id = ?', [req.user.id]);

    res.json({ message: 'Cuenta eliminada correctamente' });
  } catch (error) {
    console.error('Error eliminando cuenta:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/users/stats - Estadísticas del usuario (solo admin o propio usuario)
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    let stats;

    if (req.user.role === 'worker') {
      // Estadísticas para trabajador
      const [workerStats] = await promisePool.execute(`
        SELECT 
          COUNT(s.id) as total_services,
          SUM(s.total_cost) as total_earnings,
          AVG(s.total_cost) as average_earning,
          w.rating,
          w.completed_services
        FROM workers w
        LEFT JOIN services s ON w.user_id = s.worker_id AND s.status = 'completed'
        WHERE w.user_id = ?
        GROUP BY w.user_id
      `, [req.user.id]);

      stats = workerStats[0] || {};
    } else if (req.user.role === 'client') {
      // Estadísticas para cliente
      const [clientStats] = await promisePool.execute(`
        SELECT 
          COUNT(s.id) as total_services,
          SUM(s.total_cost) as total_spent,
          AVG(s.total_cost) as average_spent
        FROM services s
        WHERE s.client_id = ? AND s.status = 'completed'
        GROUP BY s.client_id
      `, [req.user.id]);

      stats = clientStats[0] || {};
    }

    res.json({ stats });
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;