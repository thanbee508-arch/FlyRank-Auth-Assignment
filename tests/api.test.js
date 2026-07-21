const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { createApp } = require('../src/app');
const { createFakeSupabase } = require('./fakeSupabase');

const EMAIL = 'alice@example.com';
const PASSWORD = 'password123';

let supabase;
let app;

beforeEach(() => {
  supabase = createFakeSupabase();
  app = createApp(supabase);
});

function signup(body = { email: EMAIL, password: PASSWORD }) {
  return request(app).post('/auth/signup').send(body);
}

function login(body = { email: EMAIL, password: PASSWORD }) {
  return request(app).post('/auth/login').send(body);
}

describe('POST /auth/signup', () => {
  it('creates a user and returns 201 with the user object', async () => {
    const res = await signup();
    assert.equal(res.status, 201);
    assert.equal(res.body.user.email, EMAIL);
    assert.ok(res.body.user.id);
  });

  it('returns 400 when password is missing', async () => {
    const res = await signup({ email: EMAIL });
    assert.equal(res.status, 400);
    assert.equal(typeof res.body.error, 'string');
  });

  it('returns 400 when email is missing', async () => {
    const res = await signup({ password: PASSWORD });
    assert.equal(res.status, 400);
    assert.equal(typeof res.body.error, 'string');
  });

  it('surfaces the Supabase error for a duplicate signup', async () => {
    await signup();
    const res = await signup();
    assert.equal(res.status, 422);
    assert.equal(typeof res.body.error, 'string');
  });
});

describe('GET /public/info', () => {
  it('is open to everyone', async () => {
    const res = await request(app).get('/public/info');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { message: 'Welcome stranger! This info is public.' });
  });
});

describe('GET /protected/profile without a token', () => {
  it('returns 401 when the Authorization header is missing', async () => {
    const res = await request(app).get('/protected/profile');
    assert.equal(res.status, 401);
    assert.deepEqual(res.body, { error: 'Access token required' });
  });

  it('returns 401 when the Authorization header is malformed', async () => {
    const res = await request(app).get('/protected/profile').set('Authorization', 'some-raw-token');
    assert.equal(res.status, 401);
    assert.deepEqual(res.body, { error: 'Access token required' });
  });

  it('returns 401 when the Bearer scheme has no token', async () => {
    const res = await request(app).get('/protected/profile').set('Authorization', 'Bearer');
    assert.equal(res.status, 401);
    assert.deepEqual(res.body, { error: 'Access token required' });
  });
});

describe('GET /protected/profile with a token', () => {
  let token;

  beforeEach(async () => {
    await signup();
    const res = await login();
    token = res.body.access_token;
  });

  it('returns 200 with the user safe metadata for a valid token', async () => {
    const res = await request(app).get('/protected/profile').set('Authorization', `Bearer ${token}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.email, EMAIL);
    assert.ok(res.body.id);
    assert.ok(res.body.created_at);
    assert.deepEqual(Object.keys(res.body).sort(), ['created_at', 'email', 'id']);
  });

  it('returns 401 for a tampered token', async () => {
    const tampered = token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a');
    const res = await request(app).get('/protected/profile').set('Authorization', `Bearer ${tampered}`);
    assert.equal(res.status, 401);
    assert.deepEqual(res.body, { error: 'Invalid or expired token' });
  });

  it('returns 401 for a made-up token', async () => {
    const res = await request(app).get('/protected/profile').set('Authorization', 'Bearer not-a-real-jwt');
    assert.equal(res.status, 401);
    assert.deepEqual(res.body, { error: 'Invalid or expired token' });
  });
});

describe('GET /protected/dashboard (same middleware, zero new auth code)', () => {
  let token;

  beforeEach(async () => {
    await signup();
    const res = await login();
    token = res.body.access_token;
  });

  it('permits a valid token with 200', async () => {
    const res = await request(app).get('/protected/dashboard').set('Authorization', `Bearer ${token}`);
    assert.equal(res.status, 200);
    assert.match(res.body.message, new RegExp(EMAIL));
  });

  it('rejects a bad token with 401', async () => {
    const res = await request(app).get('/protected/dashboard').set('Authorization', 'Bearer bogus');
    assert.equal(res.status, 401);
    assert.deepEqual(res.body, { error: 'Invalid or expired token' });
  });

  it('rejects a missing token with 401', async () => {
    const res = await request(app).get('/protected/dashboard');
    assert.equal(res.status, 401);
    assert.deepEqual(res.body, { error: 'Access token required' });
  });
});

describe('POST /auth/logout', () => {
  let token;

  beforeEach(async () => {
    await signup();
    const res = await login();
    token = res.body.access_token;
  });

  it('returns 204 and calls Supabase signOut for a valid token', async () => {
    const res = await request(app).post('/auth/logout').set('Authorization', `Bearer ${token}`);
    assert.equal(res.status, 204);
    assert.deepEqual(res.body, {});
    assert.equal(supabase.state.signOutCalls, 1);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).post('/auth/logout');
    assert.equal(res.status, 401);
    assert.deepEqual(res.body, { error: 'Access token required' });
  });

  it('returns 401 with an invalid token', async () => {
    const res = await request(app).post('/auth/logout').set('Authorization', 'Bearer bogus');
    assert.equal(res.status, 401);
    assert.deepEqual(res.body, { error: 'Invalid or expired token' });
  });
});

describe('GET /protected/admin (401 vs 403)', () => {
  let token;

  beforeEach(async () => {
    await signup();
    const res = await login();
    token = res.body.access_token;
  });

  it('returns 403 for an authenticated non-admin', async () => {
    const res = await request(app).get('/protected/admin').set('Authorization', `Bearer ${token}`);
    assert.equal(res.status, 403);
    assert.deepEqual(res.body, { error: 'Admin role required' });
  });

  it('returns 200 for an admin', async () => {
    supabase.state.usersByEmail.get(EMAIL).user.app_metadata.role = 'admin';
    const res = await request(app).get('/protected/admin').set('Authorization', `Bearer ${token}`);
    assert.equal(res.status, 200);
    assert.match(res.body.message, /admin/);
  });

  it('returns 401 for a missing token', async () => {
    const res = await request(app).get('/protected/admin');
    assert.equal(res.status, 401);
    assert.deepEqual(res.body, { error: 'Access token required' });
  });
});

describe('POST /auth/refresh', () => {
  let refreshToken;

  beforeEach(async () => {
    await signup();
    const res = await login();
    refreshToken = res.body.refresh_token;
  });

  it('exchanges a refresh token for a new access token', async () => {
    const res = await request(app).post('/auth/refresh').send({ refresh_token: refreshToken });
    assert.equal(res.status, 200);
    assert.equal(typeof res.body.access_token, 'string');
    assert.equal(typeof res.body.refresh_token, 'string');
    const profile = await request(app)
      .get('/protected/profile')
      .set('Authorization', `Bearer ${res.body.access_token}`);
    assert.equal(profile.status, 200);
  });

  it('returns 400 when the refresh token is missing', async () => {
    const res = await request(app).post('/auth/refresh').send({});
    assert.equal(res.status, 400);
    assert.equal(typeof res.body.error, 'string');
  });

  it('returns 401 for an invalid refresh token', async () => {
    const res = await request(app).post('/auth/refresh').send({ refresh_token: 'bogus' });
    assert.equal(res.status, 401);
    assert.equal(typeof res.body.error, 'string');
  });
});

describe('login rate limiting', () => {
  beforeEach(async () => {
    app = createApp(supabase, { loginMaxAttempts: 3, loginWindowMs: 60000 });
    await signup();
  });

  it('returns 429 after too many failed attempts, even with the right password', async () => {
    for (let i = 0; i < 3; i += 1) {
      const res = await login({ email: EMAIL, password: 'wrong-password' });
      assert.equal(res.status, 401);
    }
    const blocked = await login();
    assert.equal(blocked.status, 429);
    assert.deepEqual(blocked.body, { error: 'Too many failed login attempts. Try again later.' });
  });

  it('does not rate limit a different account', async () => {
    for (let i = 0; i < 3; i += 1) {
      await login({ email: EMAIL, password: 'wrong-password' });
    }
    await signup({ email: 'bob@example.com', password: PASSWORD });
    const res = await login({ email: 'bob@example.com', password: PASSWORD });
    assert.equal(res.status, 200);
  });

  it('clears the counter after a successful login', async () => {
    for (let i = 0; i < 2; i += 1) {
      await login({ email: EMAIL, password: 'wrong-password' });
    }
    const ok = await login();
    assert.equal(ok.status, 200);
    for (let i = 0; i < 2; i += 1) {
      await login({ email: EMAIL, password: 'wrong-password' });
    }
    const stillOk = await login();
    assert.equal(stillOk.status, 200);
  });
});

describe('Swagger UI', () => {
  it('serves the interactive docs at /docs', async () => {
    const res = await request(app).get('/docs/');
    assert.equal(res.status, 200);
    assert.match(res.text, /swagger-ui/);
  });

  it('publishes an OpenAPI spec with a bearer security scheme on protected routes', async () => {
    const res = await request(app).get('/openapi.json');
    assert.equal(res.status, 200);
    const scheme = res.body.components.securitySchemes.bearerAuth;
    assert.equal(scheme.type, 'http');
    assert.equal(scheme.scheme, 'bearer');
    assert.equal(scheme.bearerFormat, 'JWT');
    assert.deepEqual(res.body.paths['/protected/profile'].get.security, [{ bearerAuth: [] }]);
    assert.deepEqual(res.body.paths['/protected/dashboard'].get.security, [{ bearerAuth: [] }]);
    assert.deepEqual(res.body.paths['/auth/logout'].post.security, [{ bearerAuth: [] }]);
  });
});

describe('POST /auth/login', () => {
  beforeEach(async () => {
    await signup();
  });

  it('returns 200 with access and refresh tokens', async () => {
    const res = await login();
    assert.equal(res.status, 200);
    assert.equal(typeof res.body.access_token, 'string');
    assert.equal(typeof res.body.refresh_token, 'string');
    assert.equal(res.body.user.email, EMAIL);
  });

  it('returns 400 when fields are missing', async () => {
    const res = await login({ email: EMAIL });
    assert.equal(res.status, 400);
    assert.equal(typeof res.body.error, 'string');
  });

  it('returns 401 for wrong credentials', async () => {
    const res = await login({ email: EMAIL, password: 'wrong-password' });
    assert.equal(res.status, 401);
    assert.deepEqual(res.body, { error: 'Invalid login credentials' });
  });

  it('returns 401 for an unknown user', async () => {
    const res = await login({ email: 'nobody@example.com', password: PASSWORD });
    assert.equal(res.status, 401);
    assert.deepEqual(res.body, { error: 'Invalid login credentials' });
  });
});
