// Gera o site final em dist/: copia as páginas feitas à mão (index, empresas,
// ativar), gera o blog e as páginas de conteúdo a partir de conteudo/*.md,
// monta sitemap.xml e 404.html e troca __CSSVER__/__JSVER__ pelo hash do
// conteúdo (cache-busting; ver nginx.conf, /assets/ é immutable).
//
// Sem dependências: roda com `node build.mjs` local ou no Dockerfile.
//
// Formato dos .md: front matter simples (chave: valor) entre linhas `---`:
//   title, description, date (AAAA-MM-DD), updated (opcional), image
//   (caminho em /assets/images), imageAlt, category (só blog)
// Uma seção "## Perguntas frequentes" com "### pergunta" + parágrafos vira
// FAQPage no JSON-LD automaticamente.
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SITE = 'https://kivak.app';
const OUT = 'dist';

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'blog'), { recursive: true });

// ─── Markdown mínimo ──────────────────────────────────────────────
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inline(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[(.+?)\]\((.+?)\)/g, (_, t, href) => {
      const ext = /^https?:/.test(href) && !href.startsWith(SITE);
      return `<a href="${href}"${ext ? ' rel="noopener" target="_blank"' : ''}>${t}</a>`;
    });
}

const slugify = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

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

// ─── Template ─────────────────────────────────────────────────────
const LOGO = readFileSync('index.html', 'utf8').match(/<svg viewBox="0 0 728 170"[\s\S]*?<\/svg>/)[0];

const dataBR = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const jsonld = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
const abs = (p) => (p.startsWith('http') ? p : SITE + p);

function layout({ title, description, path, image, type = 'website', schema = [], main }) {
  const url = SITE + path;
  const img = abs(image || '/assets/images/hero-trilheiro.jpg');
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <link rel="canonical" href="${url}" />
  <meta property="og:type" content="${type}" />
  <meta property="og:site_name" content="KIVAK" />
  <meta property="og:locale" content="pt_BR" />
  <meta property="og:url" content="${url}" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:image" content="${img}" />
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="alternate" type="application/rss+xml" title="Blog KIVAK" href="${SITE}/blog/feed.xml" />
  <link rel="icon" href="/assets/images/favicon.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/assets/css/site.css?v=__CSSVER__" />
  ${schema.map(jsonld).join('\n  ')}
</head>
<body>

<nav class="site-nav solid always-solid">
  <a class="nav-logo" href="/" aria-label="KIVAK, página inicial">
    ${LOGO}
  </a>
  <ul class="nav-links">
    <li><a href="/app-de-trilha">Trilha</a></li>
    <li><a href="/app-de-camping">Camping</a></li>
    <li><a href="/blog/"${path.startsWith('/blog') ? ' class="active"' : ''}>Blog</a></li>
    <li><a href="/empresas">Empresas</a></li>
  </ul>
  <div class="nav-right">
    <a class="btn btn-primary btn-sm" href="/#baixar">Baixar o app</a>
  </div>
</nav>

${main}

${FOOTER}

<script src="/assets/js/site.js?v=__JSVER__"></script>
</body>
</html>
`;
}

const FOOTER_LOGO = readFileSync('index.html', 'utf8').match(/<footer>[\s\S]*?(<svg[\s\S]*?<\/svg>)/)[1];
const FOOTER = `<footer>
  <div class="container">
    <div class="footer-grid footer-grid-4">
      <div class="footer-brand">
        ${FOOTER_LOGO}
        <p>App de trilha e camping: rede social de aventura feita no Brasil, pra trilha brasileira.</p>
      </div>
      <div class="footer-col">
        <h5>KIVAK</h5>
        <a href="/#recursos">Recursos</a>
        <a href="/#comunidades">Comunidades</a>
        <a href="/#baixar">Baixar o app</a>
      </div>
      <div class="footer-col">
        <h5>Guias</h5>
        <a href="/app-de-trilha">App de trilha</a>
        <a href="/app-de-camping">App de camping</a>
        <a href="/alternativas">Alternativas</a>
        <a href="/blog/">Blog</a>
      </div>
      <div class="footer-col">
        <h5>Negócios</h5>
        <a href="/empresas">Anuncie no KIVAK</a>
      </div>
    </div>
    <div class="footer-bottom">
      <span>© ${new Date().getFullYear()} KIVAK. Todos os direitos reservados.</span>
      <span>Feito para quem sai de casa no fim de semana.</span>
    </div>
  </div>
</footer>`;

const CTA = `<aside class="post-cta">
  <h3>Grave sua próxima trilha no KIVAK</h3>
  <p>GPS de verdade, campings avaliados por quem dormiu lá e comunidades que organizam a saída. Feito no Brasil.</p>
  <a class="btn btn-primary" href="/#baixar">Quero acesso ao app →</a>
</aside>`;

const ORG = { '@type': 'Organization', '@id': `${SITE}/#org`, name: 'KIVAK', url: SITE, logo: `${SITE}/assets/images/favicon.png` };
const crumbs = (list) => ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: list.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: SITE + path })),
});
const faqSchema = (items) => items && ({
  '@context': 'https://schema.org', '@type': 'FAQPage',
  mainEntity: items.map((f) => ({ '@type': 'Question', name: f.pergunta, acceptedAnswer: { '@type': 'Answer', text: f.resposta } })),
});
const breadcrumbHtml = (list) => `<nav class="breadcrumb" aria-label="Você está em">${list
  .map(([name, path], i) => (i < list.length - 1 ? `<a href="${path}">${esc(name)}</a>` : `<span>${esc(name)}</span>`))
  .join(' <span aria-hidden="true">›</span> ')}</nav>`;

const leitura = (body) => Math.max(1, Math.round(body.split(/\s+/).length / 200));
const sitemap = [
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
    ].filter(Boolean),
    main,
  }));
  sitemap.push({ path, lastmod: meta.updated || meta.date });
}

// ─── Blog (conteudo/blog/*.md → /blog/<slug>) ──────────────────────
const posts = readdirSync('conteudo/blog').filter((f) => f.endsWith('.md')).map((f) => {
  const { meta, body } = parse(join('conteudo/blog', f));
  if (!meta.date) throw new Error(`${f}: falta "date"`);
  return { slug: f.replace(/\.md$/, ''), meta, body };
}).sort((a, b) => (a.meta.date < b.meta.date ? 1 : a.meta.date > b.meta.date ? -1 : a.slug.localeCompare(b.slug)));

const card = (p) => `<a class="post-card" href="/blog/${p.slug}">
  <div class="post-card-img"><img src="${p.meta.image || '/assets/images/trilha-montanha.jpg'}" alt="${esc(p.meta.imageAlt || '')}" loading="lazy" /></div>
  <div class="post-card-body">
    <span class="post-meta">${esc(p.meta.category || 'Guia')} · ${leitura(p.body)} min de leitura</span>
    <h3>${esc(p.meta.title)}</h3>
    <p>${esc(p.meta.description)}</p>
  </div>
</a>`;

for (const p of posts) {
  const path = `/blog/${p.slug}`;
  const trail = [['Início', '/'], ['Blog', '/blog/'], [p.meta.title, path]];
  const relacionados = posts.filter((o) => o !== p).slice(0, 3);
  const main = `<main class="page-main">
  <article class="container wrap-prose prose post">
    ${breadcrumbHtml(trail)}
    <span class="post-meta">${esc(p.meta.category || 'Guia')} · ${dataBR(p.meta.updated || p.meta.date)} · ${leitura(p.body)} min de leitura</span>
    <h1>${inline(p.meta.title)}</h1>
    <p class="lede">${inline(p.meta.description)}</p>
    ${p.meta.image ? `<img class="post-cover" src="${p.meta.image}" alt="${esc(p.meta.imageAlt || '')}" />` : ''}
${markdown(p.body)}
    ${CTA}
  </article>
  ${relacionados.length ? `<section class="bg-gray section-tight"><div class="container">
    <h2 class="title">Continue lendo</h2>
    <div class="post-grid">${relacionados.map(card).join('\n')}</div>
  </div></section>` : ''}
</main>`;
  writeFileSync(join(OUT, 'blog', `${p.slug}.html`), layout({
    title: `${p.meta.title} | Blog KIVAK`, description: p.meta.description, path, image: p.meta.image, type: 'article',
    schema: [
      {
        '@context': 'https://schema.org', '@type': 'BlogPosting', headline: p.meta.title, description: p.meta.description,
        image: abs(p.meta.image || '/assets/images/hero-trilheiro.jpg'), datePublished: p.meta.date,
        dateModified: p.meta.updated || p.meta.date, inLanguage: 'pt-BR', mainEntityOfPage: SITE + path,
        author: { '@type': 'Organization', name: 'Equipe KIVAK', url: SITE }, publisher: ORG,
      },
      crumbs(trail), faqSchema(faq(p.body)),
    ].filter(Boolean),
    main,
  }));
  sitemap.push({ path, lastmod: p.meta.updated || p.meta.date });
}

writeFileSync(join(OUT, 'blog', 'index.html'), layout({
  title: 'Blog KIVAK | Trilha, camping e aventura no Brasil',
  description: 'Guias práticos de camping e trilha: o que levar, como escolher camping, como gravar trilha com GPS e muito mais, escritos por quem vai pro mato.',
  path: '/blog/',
  schema: [
    { '@context': 'https://schema.org', '@type': 'Blog', name: 'Blog KIVAK', url: `${SITE}/blog/`, publisher: ORG, inLanguage: 'pt-BR' },
    crumbs([['Início', '/'], ['Blog', '/blog/']]),
  ],
  main: `<main class="page-main">
  <section class="section-tight"><div class="container">
    ${breadcrumbHtml([['Início', '/'], ['Blog', '/blog/']])}
    <h1 class="title">Blog KIVAK</h1>
    <p class="sub">Guias práticos de trilha e camping, escritos por quem vai pro mato no fim de semana.</p>
    <div class="post-grid">${posts.map(card).join('\n')}</div>
  </div></section>
</main>`,
}));
sitemap.push({ path: '/blog/', lastmod: posts[0]?.meta.date });

// RSS
writeFileSync(join(OUT, 'blog', 'feed.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>Blog KIVAK</title><link>${SITE}/blog/</link><language>pt-BR</language>
<description>Guias de trilha e camping no Brasil.</description>
${posts.map((p) => `<item><title>${esc(p.meta.title)}</title><link>${SITE}/blog/${p.slug}</link><guid>${SITE}/blog/${p.slug}</guid><pubDate>${new Date(`${p.meta.date}T12:00:00Z`).toUTCString()}</pubDate><description>${esc(p.meta.description)}</description></item>`).join('\n')}
</channel></rss>
`);

// ─── 404 ──────────────────────────────────────────────────────────
writeFileSync(join(OUT, '404.html'), layout({
  title: 'Página não encontrada | KIVAK',
  description: 'Essa trilha não existe (ou mudou de lugar).',
  path: '/404',
  main: `<main class="page-main"><section><div class="container center wrap-narrow">
    <h1 class="title">Essa trilha não existe.</h1>
    <p class="sub center">A página que você procurou não está aqui, mas o resto do mapa continua no lugar.</p>
    <p style="margin-top:28px"><a class="btn btn-primary" href="/">Voltar pro início</a> <a class="btn" href="/blog/">Ler o blog</a></p>
  </div></section></main>`,
}).replace('<link rel="canonical"', '<meta name="robots" content="noindex" />\n  <link rel="canonical"'));

// ─── Páginas feitas à mão + assets ────────────────────────────────
const recentes = `<div class="post-grid">${posts.slice(0, 3).map(card).join('\n')}</div>`;
for (const f of ['index.html', 'empresas.html', 'ativar.html']) {
  writeFileSync(join(OUT, f), readFileSync(f, 'utf8').replace('<!--BLOG_RECENTES-->', recentes));
}
cpSync('assets', join(OUT, 'assets'), { recursive: true });
cpSync('robots.txt', join(OUT, 'robots.txt'));

writeFileSync(join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemap.map((u) => `  <url><loc>${SITE}${u.path}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`);

// ─── Cache-busting ────────────────────────────────────────────────
const hash = (f) => createHash('sha256').update(readFileSync(f)).digest('hex').slice(0, 10);
const CSSVER = hash('assets/css/site.css');
const JSVER = hash('assets/js/site.js');
const htmls = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
  d.isDirectory() ? (d.name === 'assets' ? [] : htmls(join(dir, d.name))) : d.name.endsWith('.html') ? [join(dir, d.name)] : []);
for (const f of htmls(OUT)) {
  writeFileSync(f, readFileSync(f, 'utf8').replaceAll('__CSSVER__', CSSVER).replaceAll('__JSVER__', JSVER));
}

if (!existsSync(join(OUT, 'index.html'))) throw new Error('build incompleto');
console.log(`dist/ gerado: ${posts.length} posts, ${sitemap.length} URLs no sitemap`);
