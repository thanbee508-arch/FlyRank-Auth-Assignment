const express = require('express');

function createAuthRouter(supabase) {
  const router = express.Router();

  router.post('/signup', async (req, res, next) => {
    try {
      const { email, password } = req.body || {};
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        return res.status(error.status || 400).json({ error: error.message });
      }
      return res.status(201).json({ user: data.user });
    } catch (err) {
      next(err);
    }
  });

  router.post('/login', async (req, res, next) => {
    try {
      const { email, password } = req.body || {};
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data || !data.session) {
        return res.status(401).json({ error: 'Invalid login credentials' });
      }
      return res.status(200).json({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        token_type: data.session.token_type,
        expires_in: data.session.expires_in,
        user: data.user,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { createAuthRouter };
