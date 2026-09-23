// Serviço do blog de kivak.app: o nginx do site encaminha pra cá /blog/*,
// /sitemap.xml e a home (/), e o resto continua estático. Os posts vêm da API
// (escritos no painel admin), então publicar no painel não exige deploy.
//
// Cache em memória de 60s por recurso. Se a API cair, continua servindo a
// última resposta boa; sem nada em cache, responde 503 (e o nginx cai pra
// versão estática no caso da home e do sitemap).
//
// Sem dependências: `node blog-server.mjs` (precisa do dist/ do build.mjs).
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  RAIZ, versoes, aplicarVersoes, paginaBlog, paginaPost, pagina404, feedXml, sitemapXml, gradePosts,
} from './lib/site.mjs';

const API = (process.env.API_URL || 'https://api.kivak.app/api/v2').replace(/\/$/, '');
const PORTA = Number(process.env.PORT || 3002);
const TTL = 60_000;
const TIMEOUT = 5_000;

const V = versoes();
const HOME = readFileSync(join(RAIZ, 'dist', 'index.html'), 'utf8');
const ROTAS_ESTATICAS = JSON.parse(readFileSync(join(RAIZ, 'dist', 'rotas-estaticas.json'), 'utf8'));
const HTML_404 = aplicarVersoes(pagina404(), V);

class ApiIndisponivel extends Error {}

const cache = new Map(); // chave → { valor, expira }

/** GET na API com cache; `null` quando a API responde 404. */
async function daApi(caminho) {
  const item = cache.get(caminho);
  if (item && item.expira > Date.now()) return item.valor;
  try {
    const res = await fetch(API + caminho, { signal: AbortSignal.timeout(TIMEOUT), headers: { accept: 'application/json' } });
    if (res.status !== 200 && res.status !== 404) throw new Error(`API respondeu ${res.status}`);
    const valor = res.status === 404 ? null : await res.json();
    cache.set(caminho, { valor, expira: Date.now() + TTL });
    if (cache.size > 2000) cache.delete(cache.keys().next().value);
    return valor;
  } catch (e) {
    if (item) return item.valor; // API fora: serve a última versão boa
    console.error(`[blog] ${caminho}: ${e.message}`);
    throw new ApiIndisponivel();
  }
}

const listaPosts = async () => (await daApi('/blog/posts'))?.posts ?? [];

function enviar(res, status, tipo, corpo, maxAge = 60) {
  res.writeHead(status, {
    'Content-Type': `${tipo}; charset=utf-8`,
    'Cache-Control': status === 200 ? `public, max-age=${maxAge}` : 'no-store',
  });
  res.end(res.req.method === 'HEAD' ? undefined : corpo);
}
const html = (res, status, corpo) => enviar(res, status, 'text/html', aplicarVersoes(corpo, V));

async function rotear(req, res) {
  const url = new URL(req.url, 'http://local');
  const p = url.pathname;

  if (p === '/') {
    const recentes = (await listaPosts()).slice(0, 3);
    return html(res, 200, recentes.length ? HOME.replace('<!--BLOG_RECENTES-->', gradePosts(recentes)) : HOME);
  }
  if (p === '/blog') {
    res.writeHead(301, { Location: '/blog/' });
    return res.end();
  }
  if (p === '/blog/') return html(res, 200, paginaBlog(await listaPosts()));
  if (p === '/blog/feed.xml') return enviar(res, 200, 'application/rss+xml', feedXml(await listaPosts()), 600);
  if (p === '/sitemap.xml') {
    const posts = await listaPosts();
    const urls = [
      ...ROTAS_ESTATICAS,
      { path: '/blog/', lastmod: posts[0]?.updatedAt ?? null },
      ...posts.map((post) => ({ path: `/blog/${post.slug}`, lastmod: post.updatedAt })),
    ];
    return enviar(res, 200, 'application/xml', sitemapXml(urls), 600);
  }

  const m = p.match(/^\/blog\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/);
  if (m) {
    if (p.endsWith('/')) {
      res.writeHead(301, { Location: `/blog/${m[1]}` });
      return res.end();
    }
    const dados = await daApi(`/blog/posts/${m[1]}`);
    if (!dados?.post) return html(res, 404, HTML_404);
    const relacionados = (await listaPosts().catch(() => [])).filter((o) => o.slug !== dados.post.slug).slice(0, 3);
    return html(res, 200, paginaPost(dados.post, relacionados));
  }

  return html(res, 404, HTML_404);
}

createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    return res.end();
  }
  try {
    await rotear(req, res);
  } catch (e) {
    if (!(e instanceof ApiIndisponivel)) console.error('[blog]', e);
    if (!res.headersSent) {
      res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '30', 'Cache-Control': 'no-store' });
      res.end('Blog temporariamente indisponível. Tente de novo em instantes.');
    }
  }
}).listen(PORTA, () => console.log(`[blog] ouvindo na porta ${PORTA}, API ${API}`));
