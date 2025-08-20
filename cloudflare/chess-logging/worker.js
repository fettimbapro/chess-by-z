/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run "npm run dev" in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run "npm run deploy" to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export default {
  async fetch(request, env) {
    if (request.method === "POST") {
      const data = await request.json();
      await env.LOGS.put(Date.now().toString(), JSON.stringify(data));
      return new Response("ok", { status: 200 });
    }
    return new Response("not found", { status: 404 });
  },
};

