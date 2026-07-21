const { randomUUID } = require('node:crypto');

function createFakeSupabase() {
  const state = {
    usersByEmail: new Map(),
    sessionsByAccessToken: new Map(),
    sessionsByRefreshToken: new Map(),
    signOutCalls: 0,
  };

  function issueSession(user) {
    const session = {
      access_token: `access-${randomUUID()}`,
      refresh_token: `refresh-${randomUUID()}`,
      token_type: 'bearer',
      expires_in: 3600,
      user,
    };
    state.sessionsByAccessToken.set(session.access_token, session);
    state.sessionsByRefreshToken.set(session.refresh_token, session);
    return session;
  }

  const auth = {
    async signUp({ email, password }) {
      if (!email || !password) {
        return { data: { user: null, session: null }, error: { message: 'Signup requires a valid password', status: 400 } };
      }
      if (state.usersByEmail.has(email)) {
        return { data: { user: null, session: null }, error: { message: 'User already registered', status: 422 } };
      }
      const user = {
        id: randomUUID(),
        email,
        created_at: new Date().toISOString(),
        app_metadata: { provider: 'email' },
        user_metadata: {},
      };
      state.usersByEmail.set(email, { user, password });
      return { data: { user, session: null }, error: null };
    },

    async signInWithPassword({ email, password }) {
      const record = state.usersByEmail.get(email);
      if (!record || record.password !== password) {
        return {
          data: { user: null, session: null },
          error: { message: 'Invalid login credentials', status: 400 },
        };
      }
      const session = issueSession(record.user);
      return { data: { user: record.user, session }, error: null };
    },

    async getUser(token) {
      const session = state.sessionsByAccessToken.get(token);
      if (!session) {
        return { data: { user: null }, error: { message: 'invalid JWT', status: 401 } };
      }
      return { data: { user: session.user }, error: null };
    },

    async signOut() {
      state.signOutCalls += 1;
      return { error: null };
    },

    async refreshSession({ refresh_token: refreshToken }) {
      const session = state.sessionsByRefreshToken.get(refreshToken);
      if (!session) {
        return { data: { user: null, session: null }, error: { message: 'Invalid Refresh Token', status: 400 } };
      }
      state.sessionsByRefreshToken.delete(refreshToken);
      const next = issueSession(session.user);
      return { data: { user: session.user, session: next }, error: null };
    },
  };

  return { auth, state };
}

module.exports = { createFakeSupabase };
