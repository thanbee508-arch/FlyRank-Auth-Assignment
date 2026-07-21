const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { createApp } = require('../src/app');
const { createSupabaseClient } = require('../src/supabase');
const { startEmulatedSupabase } = require('./emulatedSupabase');

const EMAIL = 'sdk-test@example.com';
const PASSWORD = 'password123';

let emulator;
let app;

before(async () => {
  emulator = await startEmulatedSupabase();
  const supabase = createSupabaseClient({
    SUPABASE_URL: emulator.url,
    SUPABASE_KEY: 'emulated-anon-key',
  });
  app = createApp(supabase);
});

after(async () => {
  await emulator.close();
});

beforeEach(() => {
  emulator.state.usersByEmail.clear();
  emulator.state.sessionsByAccessToken.clear();
  emulator.state.sessionsByRefreshToken.clear();
  emulator.state.logoutCalls = 0;
});

async function signupAndLogin() {
  await request(app).post('/auth/signup').send({ email: EMAIL, password: PASSWORD });
  const res = await request(app).post('/auth/login').send({ email: EMAIL, password: PASSWORD });
  return res.body;
}

describe('real supabase-js SDK against an emulated Supabase Auth server', () => {
  it('signup returns 201 with the user Supabase created', async () => {
    const res = await request(app).post('/auth/signup').send({ email: EMAIL, password: PASSWORD });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.email, EMAIL);
    assert.ok(res.body.user.id);
  });

  it('signup with no password returns 400', async () => {
    const res = await request(app).post('/auth/signup').send({ email: EMAIL });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, { error: 'Email and password are required' });
  });

  it('duplicate signup surfaces the Supabase error status and message', async () => {
    await request(app).post('/auth/signup').send({ email: EMAIL, password: PASSWORD });
    const res = await request(app).post('/auth/signup').send({ email: EMAIL, password: PASSWORD });
    assert.equal(res.status, 422);
    assert.equal(res.body.error, 'User already registered');
  });

  it('login returns 200 with access and refresh tokens issued by Supabase', async () => {
    const body = await signupAndLogin();
    assert.equal(typeof body.access_token, 'string');
    assert.equal(typeof body.refresh_token, 'string');
    assert.equal(body.token_type, 'bearer');
    assert.equal(body.expires_in, 3600);
    assert.equal(body.user.email, EMAIL);
  });

  it('login with wrong credentials returns 401 with the exact error body', async () => {
    await request(app).post('/auth/signup').send({ email: EMAIL, password: PASSWORD });
    const res = await request(app).post('/auth/login').send({ email: EMAIL, password: 'wrong' });
    assert.equal(res.status, 401);
    assert.deepEqual(res.body, { error: 'Invalid login credentials' });
  });

  it('profile without a token returns 401 before any Supabase call', async () => {
    const res = await request(app).get('/protected/profile');
    assert.equal(res.status, 401);
    assert.deepEqual(res.body, { error: 'Access token required' });
  });

  it('profile with a valid token returns 200 after SDK verification', async () => {
    const { access_token: token } = await signupAndLogin();
    const res = await request(app).get('/protected/profile').set('Authorization', `Bearer ${token}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.email, EMAIL);
    assert.deepEqual(Object.keys(res.body).sort(), ['created_at', 'email', 'id']);
  });

  it('profile with a tampered token returns 401', async () => {
    const { access_token: token } = await signupAndLogin();
    const tampered = `${token}x`;
    const res = await request(app).get('/protected/profile').set('Authorization', `Bearer ${tampered}`);
    assert.equal(res.status, 401);
    assert.deepEqual(res.body, { error: 'Invalid or expired token' });
  });

  it('dashboard reuses the same guard through the real SDK', async () => {
    const { access_token: token } = await signupAndLogin();
    const ok = await request(app).get('/protected/dashboard').set('Authorization', `Bearer ${token}`);
    assert.equal(ok.status, 200);
    const bad = await request(app).get('/protected/dashboard').set('Authorization', 'Bearer forged');
    assert.equal(bad.status, 401);
  });

  it('logout with a valid token returns 204', async () => {
    const { access_token: token } = await signupAndLogin();
    const res = await request(app).post('/auth/logout').set('Authorization', `Bearer ${token}`);
    assert.equal(res.status, 204);
  });

  it('refresh exchanges a Supabase refresh token for a working access token', async () => {
    const { refresh_token: refreshToken } = await signupAndLogin();
    const res = await request(app).post('/auth/refresh').send({ refresh_token: refreshToken });
    assert.equal(res.status, 200);
    assert.equal(typeof res.body.access_token, 'string');
    const profile = await request(app)
      .get('/protected/profile')
      .set('Authorization', `Bearer ${res.body.access_token}`);
    assert.equal(profile.status, 200);
  });

  it('refresh with an invalid token returns 401', async () => {
    const res = await request(app).post('/auth/refresh').send({ refresh_token: 'expired-or-bogus' });
    assert.equal(res.status, 401);
    assert.deepEqual(res.body, { error: 'Invalid or expired refresh token' });
  });
});
