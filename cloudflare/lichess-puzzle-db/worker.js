export default {
  async fetch(request, env) {
    const ORIGIN = 'https://fettimbapro.github.io';

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': ORIGIN,
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    if (request.method !== 'GET' && request.method !== 'POST') {
      return new Response('Method Not Allowed', {
        status: 405,
        headers: { 'Access-Control-Allow-Origin': ORIGIN },
      });
    }

    try {
      // One random row from `puzzles`
      const { results } = await env.DB
        .prepare('SELECT * FROM puzzles ORDER BY RANDOM() LIMIT 1')
        .all();

      if (!results || results.length === 0) {
        return new Response(JSON.stringify({ ok: false, error: 'No rows in puzzles' }), {
          status: 404,
          headers: {
            'Access-Control-Allow-Origin': ORIGIN,
            'Content-Type': 'application/json',
          },
        });
      }

      return new Response(JSON.stringify({ ok: true, row: results[0] }), {
        headers: {
          'Access-Control-Allow-Origin': ORIGIN,
          'Content-Type': 'application/json',
        },
      });
    } catch (err) {
      return new Response(JSON.stringify({ ok: false, error: String(err) }), {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': ORIGIN,
          'Content-Type': 'application/json',
        },
      });
    }
  },
};

