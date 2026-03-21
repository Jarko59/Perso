const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { query } = require('../database/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// Get user profile with stats
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const userRes = await query('SELECT id, username, email, role, avatar, xp, created_at FROM users WHERE id = $1', [req.user.id]);
    const user = userRes.rows[0];

    // Get stats
    const startedRes = await query('SELECT COUNT(DISTINCT course_id) as count FROM user_progress WHERE user_id = $1', [req.user.id]);
    const quizRes = await query('SELECT COUNT(*) as count FROM quiz_results WHERE user_id = $1 AND passed = TRUE', [req.user.id]);
    const bookmarkRes = await query('SELECT COUNT(*) as count FROM bookmarks WHERE user_id = $1', [req.user.id]);

    // Simple completed logic: courses where all modules are done
    const completedRes = await query(`
      SELECT COUNT(*) as count FROM (
        SELECT course_id FROM user_progress 
        WHERE user_id = $1 
        GROUP BY course_id 
        HAVING COUNT(module_id) = (SELECT COUNT(*) FROM modules m WHERE m.course_id = user_progress.course_id)
      ) as completed_courses
    `, [req.user.id]);

    // Recent activity
    const activityRes = await query(`
      SELECT 'progress' as type, c.title, c.id as course_id, c.icon, up.completed_at as last_at
      FROM user_progress up
      JOIN courses c ON up.course_id = c.id
      WHERE up.user_id = $1
      ORDER BY up.completed_at DESC
      LIMIT 10
    `, [req.user.id]);

    res.json({
      user,
      stats: {
        courses_started: parseInt(startedRes.rows[0].count),
        courses_completed: parseInt(completedRes.rows[0].count),
        quizzes_passed: parseInt(quizRes.rows[0].count),
        bookmarks: parseInt(bookmarkRes.rows[0].count)
      },
      recentActivity: activityRes.rows
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur profil' });
  }
});

// Update profile
router.put('/profile', requireAuth, async (req, res) => {
  const { username, currentPassword, newPassword } = req.body;

  try {
    if (newPassword) {
      const userRes = await query('SELECT password FROM users WHERE id = $1', [req.user.id]);
      const user = userRes.rows[0];
      if (!(await bcrypt.compare(currentPassword, user.password))) {
        return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
      }
      const hashedNew = await bcrypt.hash(newPassword, 12);
      await query('UPDATE users SET username = $1, password = $2 WHERE id = $3', [username, hashedNew, req.user.id]);
    } else {
      await query('UPDATE users SET username = $1 WHERE id = $2', [username, req.user.id]);
    }

    const updated = await query('SELECT id, username, email, role, avatar, xp FROM users WHERE id = $1', [req.user.id]);
    res.json({ message: 'Profil mis à jour', user: updated.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la mise à jour' });
  }
});

// Leaderboard
router.get('/leaderboard', requireAuth, async (req, res) => {
  try {
    const result = await query(`
      SELECT id, username, avatar, xp,
      (SELECT COUNT(*) FROM quiz_results qr WHERE qr.user_id = users.id AND qr.passed = TRUE) as quizzes_passed
      FROM users
      ORDER BY xp DESC
      LIMIT 10
    `);
    res.json({ leaderboard: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Erreur classement' });
  }
});

// Admin: Manage users
router.get('/all', requireAdmin, async (req, res) => {
  try {
    const result = await query(`
      SELECT id, username, email, role, xp, created_at,
      (SELECT COUNT(*) FROM quiz_results qr WHERE qr.user_id = users.id AND qr.passed = TRUE) as quiz_count
      FROM users
      ORDER BY created_at DESC
    `);
    res.json({ users: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Erreur admin users' });
  }
});

router.put('/:id/role', requireAdmin, async (req, res) => {
  const { role } = req.body;
  try {
    await query('UPDATE users SET role = $1 WHERE id = $2', [role, req.params.id]);
    res.json({ message: 'Rôle mis à jour' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur rôle' });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ message: 'Utilisateur supprimé' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur suppression' });
  }
});

module.exports = router;
