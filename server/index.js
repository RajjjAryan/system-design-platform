const asset = (body, contentType) => ({
  body,
  headers: {
    'content-type': contentType,
    'cache-control': contentType.includes('text/html')
      ? 'no-cache'
      : 'public, max-age=31536000, immutable',
  },
});

const assets = new Map([
  ['/index.html', asset('<!doctype html><title>SystemDesign Studio</title><main id="app"></main>', 'text/html; charset=utf-8')],
]);

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname === '/' ? '/index.html' : url.pathname;
    const found = assets.get(path) || assets.get('/index.html');
    return new Response(found.body, { headers: found.headers });
  },
};
