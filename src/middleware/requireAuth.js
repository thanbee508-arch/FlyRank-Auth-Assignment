function extractBearerToken(req) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (!token || scheme.toLowerCase() !== 'bearer') {
    return null;
  }
  return token;
}

function createRequireAuth(supabase) {
  return async function requireAuth(req, res, next) {
    try {
      const token = extractBearerToken(req);
      if (!token) {
        return res.status(401).json({ error: 'Access token required' });
      }
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data || !data.user) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
      req.user = data.user;
      req.token = token;
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { createRequireAuth, extractBearerToken };
