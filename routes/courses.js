const express = require('express');
const router = express.Router();
const { query } = require('../database/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// List courses with progress
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await query(`
      SELECT c.*, cat.name as category_name, cat.icon as category_icon, cat.color as category_color,
      (SELECT COUNT(*) FROM modules m WHERE m.course_id = c.id) as total_modules,
      (SELECT COUNT(*) FROM user_progress up WHERE up.user_id = $1 AND up.course_id = c.id) as completed_modules,
      EXISTS(SELECT 1 FROM bookmarks b WHERE b.user_id = $1 AND b.course_id = c.id) as bookmarked
      FROM courses c
      JOIN categories cat ON c.category_id = cat.id
      WHERE c.published = TRUE
      ORDER BY c.created_at DESC
    `, [req.user.id]);

    res.json({ courses: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la récupération des cours' });
  }
});

// Get course detail + modules
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const courseRes = await query(`
      SELECT c.*, cat.name as category_name, cat.icon as category_icon
      FROM courses c
      JOIN categories cat ON c.category_id = cat.id
      WHERE c.id = $1
    `, [req.params.id]);

    if (courseRes.rowCount === 0) return res.status(404).json({ error: 'Cours non trouvé' });

    const modulesRes = await query(`
      SELECT m.*, 
      EXISTS(SELECT 1 FROM user_progress up WHERE up.user_id = $1 AND up.module_id = m.id) as completed
      FROM modules m
      WHERE m.course_id = $2
      ORDER BY m.order_index ASC
    `, [req.user.id, req.params.id]);

    res.json({ course: courseRes.rows[0], modules: modulesRes.rows });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la récupération du cours' });
  }
});

// Mark module as complete
router.post('/:id/progress', requireAuth, async (req, res) => {
  const { moduleId } = req.body;
  const courseId = req.params.id;

  try {
    // Check if already completed
    const checkRes = await query('SELECT 1 FROM user_progress WHERE user_id = $1 AND module_id = $2', [req.user.id, moduleId]);
    if (checkRes.rowCount > 0) return res.json({ message: 'Déjà complété' });

    // Record progress
    await query('INSERT INTO user_progress (user_id, course_id, module_id) VALUES ($1, $2, $3)', [req.user.id, courseId, moduleId]);

    // Reward XP
    const modRes = await query('SELECT xp_reward FROM modules WHERE id = $1', [moduleId]);
    const xp = modRes.rows[0].xp_reward || 10;
    await query('UPDATE users SET xp = xp + $1 WHERE id = $2', [xp, req.user.id]);

    res.json({ message: 'Module complété', xp_earned: xp });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la progression' });
  }
});

// Toggle bookmark
router.post('/:id/bookmark', requireAuth, async (req, res) => {
  const courseId = req.params.id;
  try {
    const checkRes = await query('SELECT id FROM bookmarks WHERE user_id = $1 AND course_id = $2', [req.user.id, courseId]);
    if (checkRes.rowCount > 0) {
      await query('DELETE FROM bookmarks WHERE user_id = $1 AND course_id = $2', [req.user.id, courseId]);
      res.json({ bookmarked: false });
    } else {
      await query('INSERT INTO bookmarks (user_id, course_id) VALUES ($1, $2)', [req.user.id, courseId]);
      res.json({ bookmarked: true });
    }
  } catch (err) {
    res.status(500).json({ error: 'Erreur favoris' });
  }
});

// Admin: Create course
router.post('/', requireAdmin, async (req, res) => {
  const { title, slug, description, category_id, difficulty, xp_reward, duration_min, icon, banner_color } = req.body;
  try {
    const result = await query(
      'INSERT INTO courses (title, slug, description, category_id, difficulty, xp_reward, duration_min, icon, banner_color) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id',
      [title, slug, description, category_id, difficulty, xp_reward, duration_min, icon, banner_color]
    );
    res.status(201).json({ message: 'Cours créé', id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: 'Erreur création cours' });
  }
});

// Admin: Update course
router.put('/:id', requireAdmin, async (req, res) => {
  const { published } = req.body;
  try {
    await query('UPDATE courses SET published = $1 WHERE id = $2', [published, req.params.id]);
    res.json({ message: 'Cours mis à jour' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur mise à jour' });
  }
});

// Admin: Delete course
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await query('DELETE FROM courses WHERE id = $1', [req.params.id]);
    res.json({ message: 'Cours supprimé' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur suppression' });
  }
});

module.exports = router;
