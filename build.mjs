// Gera a parte estática do site em dist/: copia as páginas feitas à mão
// (index, empresas, ativar), gera as páginas de conteudo/paginas/*.md, o
// 404.html e um sitemap.xml de reserva, e troca __CSSVER__/__JSVER__ pelo
// hash do conteúdo (cache-busting; ver nginx.conf, /assets/ é immutable).
//
// O blog NÃO é gerado aqui: os posts vêm da API (escritos no painel admin) e
// são renderizados a cada pedido por blog-server.mjs, que também monta o
// sitemap completo e os posts recentes da home. O sitemap e a home daqui só
// são usados se aquele serviço estiver fora do ar.
//
// Sem dependências: roda com `node build.mjs` local ou no Dockerfile.
//
// Formato dos .md: front matter simples (chave: valor) entre linhas `---`:
//   title, h1 (opcional), crumb, description, date (AAAA-MM-DD), updated
//   (opcional), image (caminho em /assets/images)
// Uma seção "## Perguntas frequentes" com "### pergunta" + parágrafos vira
// FAQPage no JSON-LD automaticamente.
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  SITE, esc, slugify, layout, pagina404, sitemapXml, breadcrumbHtml, crumbs, faqSchema, ORG, CTA,
  versoes, aplicarVersoes,
} from './lib/site.mjs';

const OUT = 'dist';
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// ─── Markdown mínimo ──────────────────────────────────────────────
function inline(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[(.+?)\]\((.+?)\)/g, (_, t, href) => {
      const ext = /^https?:/.test(href) && !href.startsWith(SITE);
      return `<a href="${href}"${ext ? ' rel="noopener" target="_blank"' : ''}>${t}</a>`;
    });
}

function markdown(src) {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let para = [];
  let list = null; // { tag, items }
  const flushPara = () => { if (para.length) html.push(`<p>${inline(para.join(' '))}</p>`); para = []; };
  const flushList = () => {
    if (list) html.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`);
    list = null;
  };
  const flush = () => { flushPara(); flushList(); };

  for (const line of lines) {
    let m;
    if (!line.trim()) { flush(); continue; }
    if (line.startsWith('<')) { flush(); html.push(line); continue; } // HTML cru passa direto
    if ((m = line.match(/^(#{2,4})\s+(.*)$/))) {
      flush();
      const n = m[1].length;
      html.push(`<h${n} id="${slugify(m[2])}">${inline(m[2])}</h${n}>`);
      continue;
    }
    if ((m = line.match(/^>\s?(.*)$/))) { flush(); html.push(`<blockquote><p>${inline(m[1])}</p></blockquote>`); continue; }
    if ((m = line.match(/^[-*]\s+(.*)$/)) || (m = line.match(/^\d+\.\s+(.*)$/))) {
      flushPara();
      const tag = /^\d/.test(line) ? 'ol' : 'ul';
      if (list && list.tag !== tag) flushList();
      if (!list) list = { tag, items: [] };
      list.items.push(m[1]);
      continue;
    }
    flushList();
    para.push(line.trim());
  }
  flush();
  return html.join('\n');
}

function parse(file) {
  const raw = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`${file}: front matter ausente`);
  const meta = {};
  for (const l of m[1].split('\n')) {
    const i = l.indexOf(':');
    if (i > 0) meta[l.slice(0, i).trim()] = l.slice(i + 1).trim();
  }
  for (const k of ['title', 'description']) if (!meta[k]) throw new Error(`${file}: falta "${k}"`);
  return { meta, body: m[2] };
}

// Extrai perguntas/respostas da seção "## Perguntas frequentes".
function faq(body) {
  const sec = body.split(/^## /m).find((s) => /^Perguntas frequentes/i.test(s));
  if (!sec) return null;
  const items = sec.split(/^### /m).slice(1).map((q) => {
    const [pergunta, ...resto] = q.trim().split('\n');
    return { pergunta: pergunta.trim(), resposta: resto.join(' ').replace(/\s+/g, ' ').replace(/\*\*|\[|\]\(.*?\)/g, '').trim() };
  });
  return items.length ? items : null;
}

// Rotas estáticas: blog-server.mjs junta com os posts pra montar o sitemap.
const rotas = [
  { path: '/', lastmod: null },
  { path: '/empresas', lastmod: null },
];

// ─── Páginas de conteúdo (conteudo/paginas/*.md → /<slug>) ─────────
for (const f of readdirSync('conteudo/paginas').filter((f) => f.endsWith('.md'))) {
  const slug = f.replace(/\.md$/, '');
  const { meta, body } = parse(join('conteudo/paginas', f));
  const path = `/${slug}`;
  const trail = [['Início', '/'], [meta.crumb || meta.title, path]];
  const main = `<main class="page-main">
  <header class="page-hero" style="background-image:url('${meta.image || '/assets/images/hero-trilheiro.jpg'}')">
    <div class="container wrap-prose">
      ${breadcrumbHtml(trail)}
      <h1>${inline(meta.h1 || meta.title)}</h1>
      <p class="lede">${inline(meta.description)}</p>
      <a class="btn btn-primary" href="/#baixar">📲 Quero acesso ao KIVAK</a>
    </div>
  </header>
  <article class="container wrap-prose prose">
${markdown(body)}
  </article>
  <div class="container wrap-prose">${CTA}</div>
</main>`;
  writeFileSync(join(OUT, `${slug}.html`), layout({
    title: meta.title, description: meta.description, path, image: meta.image,
    schema: [
      { '@context': 'https://schema.org', '@type': 'WebPage', name: meta.title, description: meta.description, url: SITE + path, publisher: ORG, inLanguage: 'pt-BR' },
      crumbs(trail), faqSchema(faq(body)),
    ],
    main,
  }));
  rotas.push({ path, lastmod: meta.updated || meta.date });
}

writeFileSync(join(OUT, '404.html'), pagina404());

// ─── Páginas feitas à mão + assets ────────────────────────────────
for (const f of ['index.html', 'empresas.html', 'ativar.html']) cpSync(f, join(OUT, f));
cpSync('assets', join(OUT, 'assets'), { recursive: true });
cpSync('robots.txt', join(OUT, 'robots.txt'));

writeFileSync(join(OUT, 'rotas-estaticas.json'), JSON.stringify(rotas, null, 2));
writeFileSync(join(OUT, 'sitemap.xml'), sitemapXml([...rotas, { path: '/blog/', lastmod: null }]));

// ─── Cache-busting ────────────────────────────────────────────────
const v = versoes();
const htmls = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
  d.isDirectory() ? (d.name === 'assets' ? [] : htmls(join(dir, d.name))) : d.name.endsWith('.html') ? [join(dir, d.name)] : []);
for (const f of htmls(OUT)) writeFileSync(f, aplicarVersoes(readFileSync(f, 'utf8'), v));

console.log(`dist/ gerado: ${rotas.length} rotas estáticas`);
