const express = require('express');

function createProtectedRouter(requireAuth) {
  const router = express.Router();

  router.get('/profile', requireAuth, (req, res) => {
    res.status(200).json({
      id: req.user.id,
      email: req.user.email,
      created_at: req.user.created_at,
    });
  });

  router.get('/dashboard', requireAuth, (req, res) => {
    res.status(200).json({
      message: `Welcome back, ${req.user.email}. This dashboard is for logged-in eyes only.`,
    });
  });

  router.get('/admin', requireAuth, (req, res) => {
    const role = (req.user.app_metadata && req.user.app_metadata.role) || null;
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Admin role required' });
    }
    res.status(200).json({
      message: `Welcome, admin ${req.user.email}. The control room is yours.`,
    });
  });

  return router;
}

module.exports = { createProtectedRouter };
