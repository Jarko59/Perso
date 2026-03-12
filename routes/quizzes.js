const express = require('express');
const router = express.Router();
const { query } = require('../database/db');
const { requireAuth } = require('../middleware/auth');

// Get quiz questions for a course
router.get('/:courseId', requireAuth, async (req, res) => {
  try {
    const courseRes = await query('SELECT id, title FROM courses WHERE id = $1', [req.params.courseId]);
    if (courseRes.rowCount === 0) return res.status(404).json({ error: 'Cours non trouvé' });

    const questionsRes = await query(`
      SELECT id, question, option_a, option_b, option_c, option_d, explanation
      FROM quiz_questions
      WHERE course_id = $1
      ORDER BY id ASC
    `, [req.params.courseId]);

    res.json({
      course: courseRes.rows[0],
      questions: questionsRes.rows
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la récupération du quiz' });
  }
});

// Submit quiz answers
router.post('/:courseId/submit', requireAuth, async (req, res) => {
  const { answers } = req.body; // { questionId: 'a', ... }
  const courseId = req.params.courseId;

  try {
    const questionsRes = await query('SELECT * FROM quiz_questions WHERE course_id = $1', [courseId]);
    const questions = questionsRes.rows;

    let score = 0;
    const details = questions.map(q => {
      const userAnswer = answers[q.id];
      const isCorrect = userAnswer === q.correct_option;
      if (isCorrect) score++;
      return {
        questionId: q.id,
        question: q.question,
        isCorrect,
        userAnswer,
        correct: q.correct_option,
        explanation: q.explanation,
        options: { a: q.option_a, b: q.option_b, c: q.option_c, d: q.option_d }
      };
    });

    const total = questions.length;
    const passed = (score / total) >= 0.7; // 70% to pass
    let xpEarned = 0;

    if (passed) {
      // Check if already passed to avoid double XP
      const historyRes = await query('SELECT 1 FROM quiz_results WHERE user_id = $1 AND course_id = $2 AND passed = TRUE', [req.user.id, courseId]);
      if (historyRes.rowCount === 0) {
        xpEarned = 50; // Bonus for first time passing
        await query('UPDATE users SET xp = xp + $1 WHERE id = $2', [xpEarned, req.user.id]);
      }
    }

    // Save result
    await query(
      'INSERT INTO quiz_results (user_id, course_id, score, total, passed) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, courseId, score, total, passed]
    );

    res.json({ score, total, passed, xpEarned, details });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la soumission du quiz' });
  }
});

// Get quiz history for user
router.get('/:courseId/history', requireAuth, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM quiz_results WHERE user_id = $1 AND course_id = $2 ORDER BY taken_at DESC',
      [req.user.id, req.params.courseId]
    );
    res.json({ history: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Erreur historique' });
  }
});

module.exports = router;
