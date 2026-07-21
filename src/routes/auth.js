const express = require('express');

function createAuthRouter(supabase, requireAuth, options = {}) {
  const router = express.Router();
  const maxAttempts = options.loginMaxAttempts ?? Number.parseInt(process.env.LOGIN_MAX_ATTEMPTS || '5', 10);
  const windowMs = options.loginWindowMs ?? Number.parseInt(process.env.LOGIN_WINDOW_MS || '900000', 10);
  const failedLogins = new Map();

  function isRateLimited(key) {
    const entry = failedLogins.get(key);
    if (!entry) {
      return false;
    }
    if (Date.now() - entry.firstFailureAt > windowMs) {
      failedLogins.delete(key);
      return false;
    }
    return entry.count >= maxAttempts;
  }

  function recordFailure(key) {
    const now = Date.now();
    const entry = failedLogins.get(key);
    if (!entry || now - entry.firstFailureAt > windowMs) {
      failedLogins.set(key, { count: 1, firstFailureAt: now });
      return;
    }
    entry.count += 1;
  }

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

  router.post('/logout', requireAuth, async (req, res, next) => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error && error.name !== 'AuthSessionMissingError') {
        return res.status(error.status || 500).json({ error: error.message });
      }
      return res.status(204).send();
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
      const key = `${req.ip}|${email}`;
      if (isRateLimited(key)) {
        return res.status(429).json({ error: 'Too many failed login attempts. Try again later.' });
      }
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data || !data.session) {
        recordFailure(key);
        return res.status(401).json({ error: 'Invalid login credentials' });
      }
      failedLogins.delete(key);
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

  router.post('/refresh', async (req, res, next) => {
    try {
      const { refresh_token: refreshToken } = req.body || {};
      if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token is required' });
      }
      const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
      if (error || !data || !data.session) {
        return res.status(401).json({ error: 'Invalid or expired refresh token' });
      }
      return res.status(200).json({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        token_type: data.session.token_type,
        expires_in: data.session.expires_in,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { createAuthRouter };
