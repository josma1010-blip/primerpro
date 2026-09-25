/**
 * Netlify Function: Login del panel admin
 * POST /api/admin-login  (vía redirect desde /api/admin/login es más complejo)
 * Usamos: POST /.netlify/functions/admin-login
 */
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { username, password } = JSON.parse(event.body || '{}');
    const ADMIN_USER = process.env.ADMIN_USER || 'admin';
    const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';

    if (username === ADMIN_USER && password === ADMIN_PASS) {
      // Token simple (en producción usa JWT)
      const token = 'adm_' + Buffer.from(`${username}:${Date.now()}`).toString('base64');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ token, user: username })
      };
    }

    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Usuario o contraseña incorrectos' })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
