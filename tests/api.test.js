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
