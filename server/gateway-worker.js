/**
 * AI喵搭 Avatar Gateway
 * Browser -> Worker -> Workers VPC -> private AIGC -> R2/CDN
 */

const MAX_REQUEST_BYTES = 8 * 1024 * 1024;
const MODEL_NAME = /^[a-zA-Z0-9._-]+\.glb$/;
const HEAD_JOB_NAME = /^head-[0-9]{10}-[a-f0-9]{12}$/;
const HEAD_ASSET_NAME = /^[a-zA-Z0-9._-]+\.(glb|png|jpg|jpeg|mp4|json|zip|gz|zst)$/i;

function isAllowedOrigin(origin, env) {
  if (!origin) return true;
  if (origin === env.ALLOWED_ORIGIN) return true;
  if (origin === 'https://ai-meow-outfit.pages.dev') return true;
  if (origin.endsWith('.ai-meow-outfit.pages.dev')) return true;
  return origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:');
}

function corsHeaders(origin, env) {
  return {
    'Access-Control-Allow-Origin': isAllowedOrigin(origin, env) && origin ? origin : 'https://ai-meow-outfit.pages.dev',
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function json(data, status, origin, env) {
  return Response.json(data, { status, headers: corsHeaders(origin, env) });
}

async function fetchAigc(env, path, init) {
  const request = new Request(`http://avatar.internal${path}`, init);
  if (env.AIGC_PRIVATE?.fetch) return env.AIGC_PRIVATE.fetch(request);
  if (env.AIGC_BASE_URL) return fetch(`${env.AIGC_BASE_URL}${path}`, init);
  throw new Error('AIGC upstream binding is not configured');
}

async function storeGeneratedModel(env, modelPath, metadata) {
  if (!env.AVATAR_MODELS || !modelPath?.startsWith('/models/')) return null;
  const filename = modelPath.split('/').pop();
  if (!filename || !MODEL_NAME.test(filename)) return null;
  const modelResponse = await fetchAigc(env, `/models/${filename}`);
  if (!modelResponse.ok || !modelResponse.body) throw new Error(`Generated model fetch failed: ${modelResponse.status}`);
  await env.AVATAR_MODELS.put(filename, modelResponse.body, {
    httpMetadata: { contentType: 'model/gltf-binary', cacheControl: 'public, max-age=31536000, immutable' },
    customMetadata: { jobId: metadata.job_id || '', method: metadata.method || '' },
  });
  return filename;
}

async function serveModel(env, filename, origin, request, ctx) {
  if (!MODEL_NAME.test(filename)) return json({ error: 'invalid_model_name' }, 400, origin, env);

  const stored = await env.AVATAR_MODELS?.get(filename);
  if (stored) {
    const headers = new Headers(corsHeaders(origin, env));
    stored.writeHttpMetadata(headers);
    headers.set('ETag', stored.httpEtag);
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    return new Response(request.method === 'HEAD' ? null : stored.body, { headers });
  }

  const cache = caches.default;
  const cacheKey = new Request(request.url, { method: 'GET' });
  const cached = await cache.match(cacheKey);
  if (cached) return request.method === 'HEAD' ? new Response(null, cached) : cached;

  const upstream = await fetchAigc(env, `/models/${filename}`);
  if (!upstream.ok) return json({ error: 'model_not_found' }, upstream.status, origin, env);
  const headers = new Headers(corsHeaders(origin, env));
  headers.set('Content-Type', 'model/gltf-binary');
  headers.set('Cache-Control', 'public, max-age=86400');
  if (request.method === 'HEAD') return new Response(null, { status: 200, headers });
  const response = new Response(upstream.body, { status: 200, headers });
  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

function contentTypeForHeadAsset(filename) {
  const extension = filename.split('.').pop()?.toLowerCase();
  return {
    glb: 'model/gltf-binary',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    mp4: 'video/mp4',
    json: 'application/json',
    zip: 'application/zip',
    gz: 'application/gzip',
    zst: 'application/zstd',
  }[extension] || 'application/octet-stream';
}

function publicHeadAssetUrl(origin, upstreamPath) {
  if (!upstreamPath?.startsWith('/head-assets/')) return upstreamPath;
  return `${origin}/api/avatar${upstreamPath}`;
}

function rewriteHeadJobResult(data, origin) {
  if (!data?.result) return data;
  for (const key of ['meshUrl', 'neuralFieldUrl', 'canonicalTextureUrl', 'previewUrl', 'reportUrl', 'animeReferenceUrl']) {
    data.result[key] = publicHeadAssetUrl(origin, data.result[key]);
  }
  return data;
}

async function serveHeadAsset(env, jobId, filename, origin, request, ctx) {
  if (!HEAD_JOB_NAME.test(jobId) || !HEAD_ASSET_NAME.test(filename)) {
    return json({ error: 'invalid_head_asset_name' }, 400, origin, env);
  }
  const key = `heads/${jobId}/${filename}`;
  const stored = await env.AVATAR_MODELS?.get(key);
  if (stored) {
    const headers = new Headers(corsHeaders(origin, env));
    stored.writeHttpMetadata(headers);
    headers.set('ETag', stored.httpEtag);
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    return new Response(request.method === 'HEAD' ? null : stored.body, { headers });
  }

  const cache = caches.default;
  const cacheKey = new Request(request.url, { method: 'GET' });
  const cached = await cache.match(cacheKey);
  if (cached) return request.method === 'HEAD' ? new Response(null, cached) : cached;

  const upstream = await fetchAigc(env, `/head-assets/${jobId}/${filename}`);
  if (!upstream.ok || !upstream.body) return json({ error: 'head_asset_not_found' }, upstream.status, origin, env);
  const contentType = contentTypeForHeadAsset(filename);
  const headers = new Headers(corsHeaders(origin, env));
  headers.set('Content-Type', contentType);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  if (request.method === 'HEAD') return new Response(null, { status: 200, headers });

  const response = new Response(upstream.body, { status: 200, headers });
  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  if (env.AVATAR_MODELS) {
    ctx.waitUntil(env.AVATAR_MODELS.put(key, response.clone().body, {
      httpMetadata: { contentType, cacheControl: 'public, max-age=31536000, immutable' },
      customMetadata: { jobId, assetType: filename.split('.').pop() || '' },
    }));
  }
  return response;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      if (!isAllowedOrigin(origin, env)) return json({ error: 'origin_not_allowed' }, 403, origin, env);
      return new Response(null, { status: 204, headers: corsHeaders(origin, env) });
    }
    if (!isAllowedOrigin(origin, env)) return json({ error: 'origin_not_allowed' }, 403, origin, env);

    try {
      if (url.pathname === '/api/avatar/health' && request.method === 'GET') {
        const started = Date.now();
        const upstream = await fetchAigc(env, '/health');
        const data = await upstream.json();
        return json({ gateway: 'ok', upstream: data, latency_ms: Date.now() - started }, upstream.status, origin, env);
      }

      if (url.pathname === '/api/avatar/reconstruct' && request.method === 'POST') {
        const contentLength = Number(request.headers.get('Content-Length') || 0);
        if (contentLength > MAX_REQUEST_BYTES) return json({ error: 'request_too_large' }, 413, origin, env);

        const body = await request.text();
        if (new TextEncoder().encode(body).byteLength > MAX_REQUEST_BYTES) return json({ error: 'request_too_large' }, 413, origin, env);
        console.log('[Gateway] Reconstruct Started', body.length);
        const upstream = await fetchAigc(env, '/reconstruct', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        });
        const data = await upstream.json();
        if (!upstream.ok) return json(data, upstream.status, origin, env);

        const modelName = data.model_url?.startsWith('/models/') ? data.model_url.split('/').pop() : null;
        const storedName = await storeGeneratedModel(env, data.model_url, data);
        const filename = storedName || (modelName && MODEL_NAME.test(modelName) ? modelName : null);
        if (filename) data.cdn_url = `${url.origin}/api/avatar/models/${filename}`;
        console.log('[Gateway] Reconstruct Complete', data.job_id, filename || 'upstream-only');
        return json(data, 200, origin, env);
      }

      if (url.pathname === '/api/avatar/stylized-head/jobs' && request.method === 'POST') {
        const contentLength = Number(request.headers.get('Content-Length') || 0);
        if (contentLength > MAX_REQUEST_BYTES) return json({ error: 'request_too_large' }, 413, origin, env);
        const body = await request.text();
        if (new TextEncoder().encode(body).byteLength > MAX_REQUEST_BYTES) return json({ error: 'request_too_large' }, 413, origin, env);
        const upstream = await fetchAigc(env, '/stylized-head/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        });
        const data = await upstream.json();
        return json(data, upstream.status, origin, env);
      }

      const headJobMatch = url.pathname.match(/^\/api\/avatar\/stylized-head\/jobs\/(head-[0-9]{10}-[a-f0-9]{12})$/);
      if (headJobMatch && request.method === 'GET') {
        const upstream = await fetchAigc(env, `/stylized-head/jobs/${headJobMatch[1]}`);
        const data = await upstream.json();
        return json(rewriteHeadJobResult(data, url.origin), upstream.status, origin, env);
      }

      const headAssetMatch = url.pathname.match(/^\/api\/avatar\/head-assets\/(head-[0-9]{10}-[a-f0-9]{12})\/([^/]+)$/);
      if (headAssetMatch && (request.method === 'GET' || request.method === 'HEAD')) {
        return serveHeadAsset(env, headAssetMatch[1], headAssetMatch[2], origin, request, ctx);
      }

      if (url.pathname.startsWith('/api/avatar/models/') && (request.method === 'GET' || request.method === 'HEAD')) {
        const filename = url.pathname.split('/').pop() || '';
        return serveModel(env, filename, origin, request, ctx);
      }

      return json({ error: 'not_found' }, 404, origin, env);
    } catch (error) {
      console.error('[Gateway] Request FAILED', error instanceof Error ? error.message : String(error));
      return json({ error: 'upstream_unavailable' }, 502, origin, env);
    }
  },
};
