const express = require('express');
const { promisePool } = require('../config/database');

const router = express.Router();

// GET /api/categories - Obtener todas las categorías
router.get('/', async (req, res) => {
  try {
    const [categories] = await promisePool.execute(`
      SELECT id, name, icon, description 
      FROM categories 
      ORDER BY name
    `);

    res.json({ categories });
  } catch (error) {
    console.error('Error obteniendo categorías:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/categories/:id - Obtener categoría específica
router.get('/:id', async (req, res) => {
  try {
    const categoryId = req.params.id;

    const [categories] = await promisePool.execute(`
      SELECT id, name, icon, description 
      FROM categories 
      WHERE id = ?
    `, [categoryId]);

    if (categories.length === 0) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }

    res.json({ category: categories[0] });
  } catch (error) {
    console.error('Error obteniendo categoría:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;