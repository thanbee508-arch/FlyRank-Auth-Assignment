const express = require('express');
const { createAuthRouter } = require('./routes/auth');
const { publicRouter } = require('./routes/public');
const { createProtectedRouter } = require('./routes/protected');
const { createRequireAuth } = require('./middleware/requireAuth');

function createApp(supabase) {
  const app = express();
  app.use(express.json());

  const requireAuth = createRequireAuth(supabase);

  app.use('/auth', createAuthRouter(supabase, requireAuth));
  app.use('/public', publicRouter);
  app.use('/protected', createProtectedRouter(requireAuth));

  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Request body must be valid JSON' });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

module.exports = { createApp };
