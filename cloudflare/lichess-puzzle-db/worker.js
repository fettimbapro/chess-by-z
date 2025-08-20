export default {
  async fetch(request, env) {
    const ORIGIN = "https://fettimbapro.github.io";

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": ORIGIN,
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { "Access-Control-Allow-Origin": ORIGIN },
      });
    }

    const headers = {
      "Access-Control-Allow-Origin": ORIGIN,
      "Content-Type": "application/json",
    };

    try {
      const { sql, params } = await request.json();
      if (!sql) {
        return new Response(
          JSON.stringify({ ok: false, error: "Missing sql" }),
          { status: 400, headers },
        );
      }

      let stmt = env.DB.prepare(sql);
      if (Array.isArray(params) && params.length) stmt = stmt.bind(...params);
      const { results } = await stmt.all();

      return new Response(JSON.stringify({ ok: true, results }), {
        headers,
      });
    } catch (err) {
      return new Response(JSON.stringify({ ok: false, error: String(err) }), {
        status: 500,
        headers,
      });
    }
  },
};
