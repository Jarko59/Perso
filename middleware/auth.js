'use strict';

const jwt = require('jsonwebtoken');
const { query } = require('../database/db');

async function requireAuth(req, res, next) {
  const token = req.cookies?.token || req.headers?.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non authentifié' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    
    // Fetch user from DB to get the latest role/status
    const result = await query('SELECT id, username, email, role FROM users WHERE id = $1', [payload.id]);
    if (result.rowCount === 0) return res.status(401).json({ error: 'Utilisateur non trouvé' });
    
    req.user = result.rows[0];
    next();
  } catch (err) {
    res.clearCookie('token');
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}

async function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    }
    next();
  });
}

module.exports = { requireAuth, requireAdmin };
