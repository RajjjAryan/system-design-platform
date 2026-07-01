import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';

const root = process.cwd();
const dist = join(root, 'dist');
const client = join(dist, 'client');
const server = join(dist, 'server');
const openai = join(dist, '.openai');

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function copyFile(src, dest) {
  ensureDir(dirname(dest));
  copyFileSync(src, dest);
}

function copyDir(src, dest) {
  for (const entry of readdirSync(src)) {
    const from = join(src, entry);
    const to = join(dest, entry);
    if (statSync(from).isDirectory()) copyDir(from, to);
    else copyFile(from, to);
  }
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else out.push(path);
  }
  return out;
}

rmSync(dist, { recursive: true, force: true });
ensureDir(client);
ensureDir(server);
ensureDir(openai);

copyDir(join(root, 'public'), client);
copyFile(join(root, 'SystemDesign Studio Platform', 'sds-data.js'), join(client, 'sds-data.js'));
copyFile(join(root, 'SystemDesign Studio Platform', 'sds-knowledge.js'), join(client, 'sds-knowledge.js'));
copyFile(join(root, '.openai', 'hosting.json'), join(openai, 'hosting.json'));

const assetEntries = walk(client).map((file) => {
  const urlPath = '/' + relative(client, file).split('\\').join('/');
  const body = readFileSync(file, 'utf8');
  const contentType = contentTypes[extname(file)] || 'application/octet-stream';
  return [urlPath, { body, contentType }];
});

const worker = `const assets = new Map(${JSON.stringify(assetEntries, null, 2)});

function responseFor(pathname) {
  const path = pathname === '/' ? '/index.html' : pathname;
  const asset = assets.get(path) || assets.get('/index.html');
  const headers = {
    'content-type': asset.contentType,
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'cache-control': asset.contentType.includes('text/html')
      ? 'no-cache'
      : 'public, max-age=31536000, immutable',
  };
  return new Response(asset.body, { headers });
}

export default {
  async fetch(request) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405 });
    }
    const url = new URL(request.url);
    return responseFor(url.pathname);
  },
};
`;

writeFileSync(join(server, 'index.js'), worker);
console.log('Built dist/client and dist/server/index.js');
