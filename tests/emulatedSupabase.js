const express = require('express');
const { randomUUID } = require('node:crypto');

function createEmulatedSupabase() {
  const state = {
    usersByEmail: new Map(),
    sessionsByAccessToken: new Map(),
    sessionsByRefreshToken: new Map(),
    logoutCalls: 0,
  };

  function issueSession(user) {
    const session = {
      access_token: `emu-access-${randomUUID()}`,
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: `emu-refresh-${randomUUID()}`,
      user,
    };
    state.sessionsByAccessToken.set(session.access_token, session);
    state.sessionsByRefreshToken.set(session.refresh_token, session);
    return session;
  }

  const app = express();
  app.use(express.json());

  app.get('/auth/v1/health', (req, res) => {
    res.status(200).json({ version: 'emulated', name: 'GoTrue', description: 'Emulated Supabase Auth for offline verification' });
  });

  app.post('/auth/v1/signup', (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ code: 400, error_code: 'validation_failed', msg: 'Signup requires a valid password' });
    }
    if (state.usersByEmail.has(email)) {
      return res.status(422).json({ code: 422, error_code: 'user_already_exists', msg: 'User already registered' });
    }
    const now = new Date().toISOString();
    const user = {
      id: randomUUID(),
      aud: 'authenticated',
      role: 'authenticated',
      email,
      email_confirmed_at: now,
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: {},
      created_at: now,
      updated_at: now,
    };
    state.usersByEmail.set(email, { user, password });
    const session = issueSession(user);
    res.status(200).json(session);
  });

  app.post('/auth/v1/token', (req, res) => {
    const grantType = req.query.grant_type;
    if (grantType === 'password') {
      const { email, password } = req.body || {};
      const record = state.usersByEmail.get(email);
      if (!record || record.password !== password) {
        return res.status(400).json({ code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
      }
      return res.status(200).json(issueSession(record.user));
    }
    if (grantType === 'refresh_token') {
      const { refresh_token: refreshToken } = req.body || {};
      const session = state.sessionsByRefreshToken.get(refreshToken);
      if (!session) {
        return res.status(400).json({ code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token: Refresh Token Not Found' });
      }
      state.sessionsByRefreshToken.delete(refreshToken);
      return res.status(200).json(issueSession(session.user));
    }
    res.status(400).json({ code: 400, error_code: 'unsupported_grant_type', msg: 'Unsupported grant type' });
  });

  app.get('/auth/v1/user', (req, res) => {
    const header = req.get('authorization') || '';
    const token = header.replace(/^Bearer\s+/i, '');
    const session = state.sessionsByAccessToken.get(token);
    if (!session) {
      return res.status(403).json({ code: 403, error_code: 'bad_jwt', msg: 'invalid JWT: unable to parse or verify signature' });
    }
    res.status(200).json(session.user);
  });

  app.post('/auth/v1/logout', (req, res) => {
    state.logoutCalls += 1;
    res.status(204).send();
  });

  return { app, state };
}

function startEmulatedSupabase(port = 0) {
  const { app, state } = createEmulatedSupabase();
  return new Promise((resolve) => {
    const server = app.listen(port, '127.0.0.1', () => {
      resolve({
        url: `http://127.0.0.1:${server.address().port}`,
        state,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

if (require.main === module) {
  const port = Number.parseInt(process.env.EMULATOR_PORT || '54321', 10);
  startEmulatedSupabase(port).then(({ url }) => {
    console.log(`Emulated Supabase Auth listening at ${url}`);
  });
}

module.exports = { createEmulatedSupabase, startEmulatedSupabase };
