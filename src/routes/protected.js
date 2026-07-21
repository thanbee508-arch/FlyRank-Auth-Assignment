const express = require('express');

function extractBearerToken(req) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (!token || scheme.toLowerCase() !== 'bearer') {
    return null;
  }
  return token;
}

function createProtectedRouter() {
  const router = express.Router();

  router.get('/profile', (req, res) => {
    const token = extractBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }
    res.status(200).json({ message: 'Token received. Verification comes in Stage 3.' });
  });

  return router;
}

module.exports = { createProtectedRouter, extractBearerToken };
