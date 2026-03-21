const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../database/db');
const { requireAuth } = require('../middleware/auth');

// Register
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Tous les champs sont requis' });
  }

  try {
    const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const userEmail = email.trim().toLowerCase();
    const role = (userEmail === adminEmail) ? 'admin' : 'user';
    
    const hashedPassword = await bcrypt.hash(password, 12);
    const result = await query(
      'INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id',
      [username, email, hashedPassword, role]
    );

    const user = result.rows[0];
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production' && req.secure,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.status(201).json({ message: 'Compte créé avec succès', user: { id: user.id, username, email } });
  } catch (err) {
    if (err.code === '23505') { // Unique violation in Postgres
      return res.status(400).json({ error: 'Nom d\'utilisateur ou email déjà utilisé' });
    }
    res.status(500).json({ error: 'Erreur lors de l\'inscription' });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    // Auto-promote to admin if email matches environment variable
    const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const userEmail = user.email.trim().toLowerCase();
    
    if (userEmail === adminEmail && user.role !== 'admin') {
      await query("UPDATE users SET role = 'admin' WHERE id = $1", [user.id]);
      user.role = 'admin';
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production' && req.secure,
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({ message: 'Connexion réussie', user: { id: user.id, username: user.username, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: 'Erreur de connexion' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Déconnexion réussie' });
});

// Get current user
router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await query('SELECT id, username, email, role, avatar, xp FROM users WHERE id = $1', [req.user.id]);
    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Emergency promotion (non-authenticated)
router.get('/force-admin', async (req, res) => {
  const { email } = req.query;
  if (!email) return res.send("Email manquant dans l'URL (ex: ?email=ton@email.com)");
  try {
    const result = await query("UPDATE users SET role = 'admin' WHERE email = $1", [email]);
    if (result.rowCount === 0) return res.send("<h1>Oups !</h1><p>Cet email n'existe pas encore dans ta base de données.</p>");
    res.send(`<h1>BRAVO !</h1><p>L'utilisateur <b>${email}</b> est maintenant Administrateur. <a href='/dashboard.html'>Retourne au Dashboard</a> et fais un refresh.</p>`);
  } catch (err) {
    res.status(500).send("Erreur lors de la promotion");
  }
});

module.exports = router;
