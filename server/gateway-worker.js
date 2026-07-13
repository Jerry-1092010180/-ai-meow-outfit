/**
 * AI喵搭 API Gateway — Cloudflare Worker
 * 公网入口 → 转发到 Tailscale 内网 AIGC → 回传结果
 *
 * 部署: npx wrangler deploy server/gateway-worker.js
 * 配置: wrangler secret put AIGC_BASE_URL
 *       wrangler secret put API_KEY
 */

// AIGC Tailscale IP (set via `wrangler secret put AIGC_BASE_URL`)
const AIGC_BASE = AIGC_BASE_URL || 'http://100.114.7.5:8765';
const API_SECRET = API_KEY || 'dev-key-change-me';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Health check
    if (path === '/api/avatar/health') {
      try {
        const res = await fetch(`${AIGC_BASE}/health`);
        return new Response(await res.text(), {
          status: res.status,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      } catch {
        return Response.json({ status: 'unreachable' }, {
          status: 502,
          headers: { 'Access-Control-Allow-Origin': '*' }
        });
      }
    }

    // Reconstruct
    if (path === '/api/avatar/reconstruct' && request.method === 'POST') {
      const body = await request.json();
      const res = await fetch(`${AIGC_BASE}/reconstruct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      // Rewrite model_url to use the gateway path
      if (data.model_url?.startsWith('/models/')) {
        const filename = data.model_url.split('/').pop();
        data.cdn_url = `${url.origin}/api/avatar/models/${filename}`;
      }

      return Response.json(data, {
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
    }

    // Serve GLB models
    if (path.startsWith('/api/avatar/models/')) {
      const filename = path.split('/').pop();
      const res = await fetch(`${AIGC_BASE}/models/${filename}`);
      if (!res.ok) {
        return new Response('Model not found', { status: 404 });
      }
      const headers = new Headers(res.headers);
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Cache-Control', 'public, max-age=86400');
      return new Response(res.body, { status: 200, headers });
    }

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      });
    }

    return new Response('Not Found', { status: 404 });
  }
};
