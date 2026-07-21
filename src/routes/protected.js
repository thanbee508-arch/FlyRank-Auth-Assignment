const express = require('express');

function extractBearerToken(req) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (!token || scheme.toLowerCase() !== 'bearer') {
    return null;
  }
  return token;
}

function createProtectedRouter(supabase) {
  const router = express.Router();

  router.get('/profile', async (req, res, next) => {
    try {
      const token = extractBearerToken(req);
      if (!token) {
        return res.status(401).json({ error: 'Access token required' });
      }
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data || !data.user) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
      res.status(200).json({
        id: data.user.id,
        email: data.user.email,
        created_at: data.user.created_at,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { createProtectedRouter, extractBearerToken };
