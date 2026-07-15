const GATEWAY_ORIGIN = 'https://avatar-gateway.jerry1092010180.workers.dev';

export async function onRequest({ request }) {
  const incomingUrl = new URL(request.url);
  const upstreamUrl = new URL(incomingUrl.pathname + incomingUrl.search, GATEWAY_ORIGIN);
  const upstream = await fetch(new Request(upstreamUrl, request));

  if (request.method === 'POST' && incomingUrl.pathname === '/api/avatar/reconstruct' && upstream.ok) {
    const contentType = upstream.headers.get('Content-Type') || '';
    if (contentType.includes('application/json')) {
      const data = await upstream.json();
      if (data.cdn_url) {
        const modelPath = new URL(data.cdn_url).pathname;
        data.cdn_url = `${incomingUrl.origin}${modelPath}`;
      }
      return Response.json(data, { status: upstream.status, headers: upstream.headers });
    }
  }

  return upstream;
}
