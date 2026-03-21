const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { query } = require('../database/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { spawnInstance, stopInstance } = require('../services/docker');

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
      SELECT m.id, m.course_id, m.title, m.content, m.order_index, m.xp_reward, 
      (m.flag_hash IS NOT NULL) as has_flag, m.flag_xp, m.docker_image,
      EXISTS(SELECT 1 FROM user_progress up WHERE up.user_id = $1 AND up.module_id = m.id) as completed,
      EXISTS(SELECT 1 FROM user_flags uf WHERE uf.user_id = $1 AND uf.module_id = m.id) as flag_solved
      FROM modules m
      WHERE m.course_id = $2
      ORDER BY m.order_index ASC
    `, [req.user.id, req.params.id]);

    const activeRes = await query('SELECT module_id, port, expires_at FROM active_instances WHERE user_id = $1', [req.user.id]);
    const activeMap = {};
    activeRes.rows.forEach(r => activeMap[r.module_id] = r);

    modulesRes.rows.forEach(m => {
      m.active_instance = activeMap[m.id] || null;
    });

    res.json({
      course: courseRes.rows[0],
      modules: modulesRes.rows
    });
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

// Submit a Flag (CTF)
router.post('/:courseId/modules/:moduleId/flag', requireAuth, async (req, res) => {
  const { flag } = req.body;
  const moduleId = req.params.moduleId;

  if (!flag) return res.status(400).json({ error: 'Flag manquant' });

  try {
    // Determine if flag is correct
    const modRes = await query('SELECT flag_hash, flag_xp FROM modules WHERE id = $1', [moduleId]);
    if (modRes.rowCount === 0) return res.status(404).json({ error: 'Module non trouvé' });
    
    const { flag_hash, flag_xp } = modRes.rows[0];
    if (!flag_hash) return res.status(400).json({ error: 'Ce module ne contient pas de challenge CTF' });

    // Hash submitted flag and compare
    const submittedHash = crypto.createHash('sha256').update(flag.trim()).digest('hex');
    if (submittedHash !== flag_hash) {
      return res.status(400).json({ error: 'Flag incorrect ! Réessayez.' });
    }

    // Check if already solved
    const checkRes = await query('SELECT 1 FROM user_flags WHERE user_id = $1 AND module_id = $2', [req.user.id, moduleId]);
    if (checkRes.rowCount > 0) return res.json({ message: 'Flag déjà validé', xp_earned: 0 });

    // Record solution & reward XP
    await query('INSERT INTO user_flags (user_id, module_id) VALUES ($1, $2)', [req.user.id, moduleId]);
    await query('UPDATE users SET xp = xp + $1 WHERE id = $2', [flag_xp, req.user.id]);

    res.json({ message: 'Flag validé ! Félicitations !', xp_earned: flag_xp });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la validation du flag' });
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

// Appended Sandboxing Endpoints
// Spawn an instance
router.post('/:courseId/modules/:moduleId/spawn', requireAuth, async (req, res) => {
  const { moduleId } = req.params;
  const userId = req.user.id;

  try {
    const modRes = await query('SELECT docker_image FROM modules WHERE id = $1', [moduleId]);
    if (modRes.rowCount === 0) return res.status(404).json({ error: 'Module introuvable' });
    const image = modRes.rows[0].docker_image;
    if (!image) return res.status(400).json({ error: 'Ce module nécessite aucune machine cible.' });

    const activeRes = await query('SELECT id, port, expires_at FROM active_instances WHERE user_id = $1 LIMIT 1', [userId]);
    if (activeRes.rowCount > 0) {
      if (new Date(activeRes.rows[0].expires_at) > new Date()) {
        return res.status(400).json({ error: 'Vous avez déjà une machine active pour un autre module. Veuillez l\'éteindre d\'abord.' });
      }
      await query('DELETE FROM active_instances WHERE user_id = $1', [userId]);
    }

    const container = await spawnInstance(image, `u${userId}`);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 heure

    await query(`
      INSERT INTO active_instances (user_id, module_id, container_id, port, expires_at)
      VALUES ($1, $2, $3, $4, $5)
    `, [userId, moduleId, container.id, container.port, expiresAt]);

    res.json({ message: 'Machine démarrée !', port: container.port, expires_at: expiresAt });
  } catch (error) {
    res.status(500).json({ error: 'Impossible de démarrer la machine Docker (Vérifiez le service Docker de votre serveur).' });
  }
});

// Stop an instance
router.post('/:courseId/modules/:moduleId/stop', requireAuth, async (req, res) => {
  const userId = req.user.id;
  try {
    const active = await query('SELECT container_id FROM active_instances WHERE user_id = $1', [userId]);
    if (active.rowCount > 0) {
      await stopInstance(active.rows[0].container_id);
      await query('DELETE FROM active_instances WHERE user_id = $1', [userId]);
      res.json({ message: 'Machine arrêtée avec succès.' });
    } else {
      res.json({ message: 'Aucune machine active trouvée.' });
    }
  } catch (e) {
    res.status(500).json({ error: 'Erreur lors de l\'arrêt de la machine.' });
  }
});

module.exports = router;
