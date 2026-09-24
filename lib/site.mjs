// Template compartilhado entre build.mjs (páginas estáticas, gerado no build)
// e blog-server.mjs (blog, renderizado a cada pedido a partir da API).
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const SITE = 'https://kivak.app';
export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const slugify = (s) => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Aceita AAAA-MM-DD ou ISO completo. */
const paraData = (v) => new Date(/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T12:00:00Z` : v);
export const dataBR = (v) => paraData(v).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' });
export const dataISO = (v) => paraData(v).toISOString().slice(0, 10);

export const jsonld = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
export const abs = (p) => (/^https?:/.test(p) ? p : SITE + p);

/** Hash do conteúdo de site.css/site.js (cache-busting; /assets/ é immutable no nginx). */
export function versoes() {
  const hash = (f) => createHash('sha256').update(readFileSync(join(RAIZ, f))).digest('hex').slice(0, 10);
  return { CSSVER: hash('assets/css/site.css'), JSVER: hash('assets/js/site.js') };
}
export const aplicarVersoes = (html, v) => html.replaceAll('__CSSVER__', v.CSSVER).replaceAll('__JSVER__', v.JSVER);

const INDEX = readFileSync(join(RAIZ, 'index.html'), 'utf8');
const LOGO = INDEX.match(/<svg viewBox="0 0 728 170"[\s\S]*?<\/svg>/)[0];
const FOOTER_LOGO = INDEX.match(/<footer>[\s\S]*?(<svg[\s\S]*?<\/svg>)/)[1];

export const ORG = { '@type': 'Organization', '@id': `${SITE}/#org`, name: 'KIVAK', url: SITE, logo: `${SITE}/assets/images/favicon.png` };

export const crumbs = (list) => ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: list.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: SITE + path })),
});

export const faqSchema = (items) => items && items.length && ({
  '@context': 'https://schema.org', '@type': 'FAQPage',
  mainEntity: items.map((f) => ({ '@type': 'Question', name: f.pergunta, acceptedAnswer: { '@type': 'Answer', text: f.resposta } })),
});

export const breadcrumbHtml = (list) => `<nav class="breadcrumb" aria-label="Você está em">${list
  .map(([name, path], i) => (i < list.length - 1 ? `<a href="${path}">${esc(name)}</a>` : `<span>${esc(name)}</span>`))
  .join(' <span aria-hidden="true">›</span> ')}</nav>`;

export const CTA = `<aside class="post-cta">
  <h3>Grave sua próxima trilha no KIVAK</h3>
  <p>GPS de verdade, campings avaliados por quem dormiu lá e comunidades que organizam a saída. Feito no Brasil.</p>
  <a class="btn btn-primary" href="/#baixar">Quero acesso ao app →</a>
</aside>`;

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

export function layout({ title, description, path, image, type = 'website', schema = [], main, noindex = false }) {
  const url = SITE + path;
  const img = abs(image || '/assets/images/hero-trilheiro.jpg');
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  ${noindex ? '<meta name="robots" content="noindex" />' : ''}
  <link rel="canonical" href="${url}" />
  <meta property="og:type" content="${type}" />
  <meta property="og:site_name" content="KIVAK" />
  <meta property="og:locale" content="pt_BR" />
  <meta property="og:url" content="${url}" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:image" content="${esc(img)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="alternate" type="application/rss+xml" title="Blog KIVAK" href="${SITE}/blog/feed.xml" />
  <link rel="icon" href="/assets/images/favicon.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/assets/css/site.css?v=__CSSVER__" />
  ${schema.filter(Boolean).map(jsonld).join('\n  ')}
</head>
<body>

<nav class="site-nav solid always-solid">
  <a class="nav-logo" href="/" aria-label="KIVAK, página inicial">
    ${LOGO}
  </a>
  <div class="nav-menu" id="menu-principal">
    <ul class="nav-links">
      <li><a href="/app-de-trilha">Trilha</a></li>
      <li><a href="/app-de-camping">Camping</a></li>
      <li><a href="/blog/"${path.startsWith('/blog') ? ' class="active"' : ''}>Blog</a></li>
      <li><a href="/empresas">Empresas</a></li>
    </ul>
    <div class="nav-right">
      <a class="btn btn-ghost-light btn-sm" href="https://platform.kivak.app/entrar">Entrar</a>
      <a class="btn btn-primary btn-sm" href="/#baixar">Baixar o app</a>
    </div>
  </div>
  <a class="nav-entrar" href="https://platform.kivak.app/entrar">Entrar</a>
  <button class="nav-burger" type="button" aria-label="Abrir menu" aria-expanded="false" aria-controls="menu-principal">
    <span></span><span></span><span></span>
  </button>
</nav>

${main}

${FOOTER}

<script src="/assets/js/site.js?v=__JSVER__"></script>
</body>
</html>
`;
}

export function pagina404() {
  return layout({
    title: 'Página não encontrada | KIVAK',
    description: 'Essa trilha não existe (ou mudou de lugar).',
    path: '/404',
    noindex: true,
    main: `<main class="page-main"><section><div class="container center wrap-narrow">
    <h1 class="title">Essa trilha não existe.</h1>
    <p class="sub center">A página que você procurou não está aqui, mas o resto do mapa continua no lugar.</p>
    <p style="margin-top:28px"><a class="btn btn-primary" href="/">Voltar pro início</a> <a class="btn" href="/blog/">Ler o blog</a></p>
  </div></section></main>`,
  });
}

export function sitemapXml(urls) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${esc(SITE + u.path)}</loc>${u.lastmod ? `<lastmod>${dataISO(u.lastmod)}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`;
}

// ─── Blog ─────────────────────────────────────────────────────────

const CAPA_PADRAO = '/assets/images/trilha-montanha.jpg';

export const cardPost = (p) => `<a class="post-card" href="/blog/${esc(p.slug)}">
  <div class="post-card-img"><img src="${esc(p.capaUrl || CAPA_PADRAO)}" alt="${esc(p.capaAlt || '')}" loading="lazy" /></div>
  <div class="post-card-body">
    <span class="post-meta">${esc(p.categoria || 'Guia')} · ${p.minutosLeitura || 1} min de leitura</span>
    <h3>${esc(p.titulo)}</h3>
    <p>${esc(p.resumo)}</p>
  </div>
</a>`;

export const gradePosts = (posts) => `<div class="post-grid">${posts.map(cardPost).join('\n')}</div>`;

// Mesmas regras de src/lib/blogConteudo.ts na API: se algo passar de lá por
// engano, aqui ainda não vira HTML ativo.
const hrefSeguro = (h) => (typeof h === 'string' && /^(https?:\/\/|\/(?!\/)|#|mailto:)/i.test(h.trim()) ? h.trim() : null);
const srcSeguro = (s) => (typeof s === 'string' && /^https:\/\//.test(s) ? s : null);
const idYoutube = (url) => (typeof url === 'string' ? url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/)?.[1] ?? null : null);

export function textoDe(n) {
  if (!n) return '';
  if (n.type === 'text') return n.text ?? '';
  return (n.content ?? []).map(textoDe).join(n.type === 'paragraph' || n.type === 'heading' ? '' : ' ');
}

function inlineHtml(n) {
  if (n.type === 'hardBreak') return '<br />';
  if (n.type !== 'text') return '';
  let html = esc(n.text);
  let link = null;
  for (const m of n.marks ?? []) {
    if (m.type === 'bold') html = `<strong>${html}</strong>`;
    else if (m.type === 'italic') html = `<em>${html}</em>`;
    else if (m.type === 'underline') html = `<u>${html}</u>`;
    else if (m.type === 'strike') html = `<s>${html}</s>`;
    else if (m.type === 'link') link = hrefSeguro(m.attrs?.href);
  }
  if (link) {
    const externo = /^https?:/.test(link) && !link.startsWith(SITE);
    html = `<a href="${esc(link)}"${externo ? ' rel="noopener" target="_blank"' : ''}>${html}</a>`;
  }
  return html;
}

function blocoHtml(n) {
  const filhos = () => (n.content ?? []).map(blocoHtml).join('');
  switch (n.type) {
    case 'text': case 'hardBreak': return inlineHtml(n);
    case 'paragraph': {
      const inner = filhos();
      return inner.trim() ? `<p>${inner}</p>` : '';
    }
    case 'heading': {
      const nivel = n.attrs?.level === 3 ? 3 : 2;
      return `<h${nivel} id="${slugify(textoDe(n))}">${filhos()}</h${nivel}>`;
    }
    case 'bulletList': return `<ul>${filhos()}</ul>`;
    case 'orderedList': {
      const start = Number.isInteger(n.attrs?.start) && n.attrs.start > 1 ? ` start="${n.attrs.start}"` : '';
      return `<ol${start}>${filhos()}</ol>`;
    }
    case 'listItem': return `<li>${filhos()}</li>`;
    case 'blockquote': return `<blockquote>${filhos()}</blockquote>`;
    case 'horizontalRule': return '<hr />';
    case 'image': {
      const src = srcSeguro(n.attrs?.src);
      if (!src) return '';
      const legenda = n.attrs?.title ? `<figcaption>${esc(n.attrs.title)}</figcaption>` : '';
      return `<figure><img src="${esc(src)}" alt="${esc(n.attrs?.alt || '')}" loading="lazy" />${legenda}</figure>`;
    }
    case 'video': {
      const src = srcSeguro(n.attrs?.src);
      return src ? `<figure><video src="${esc(src)}" controls preload="metadata" playsinline></video></figure>` : '';
    }
    case 'youtube': {
      const id = idYoutube(n.attrs?.src);
      return id ? `<div class="video-embed"><iframe src="https://www.youtube-nocookie.com/embed/${id}" title="Vídeo do YouTube" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>` : '';
    }
    default: return '';
  }
}

export const conteudoHtml = (doc) => (doc?.content ?? []).map(blocoHtml).join('\n');

/** Seção H2 "Perguntas frequentes": cada H3 é uma pergunta, o que vem até o próximo H3/H2 é a resposta. */
export function faqDoConteudo(doc) {
  const blocos = doc?.content ?? [];
  const inicio = blocos.findIndex((b) => b.type === 'heading' && b.attrs?.level !== 3 && /^perguntas frequentes/i.test(textoDe(b).trim()));
  if (inicio < 0) return null;
  const itens = [];
  for (const b of blocos.slice(inicio + 1)) {
    if (b.type === 'heading' && b.attrs?.level !== 3) break;
    if (b.type === 'heading') itens.push({ pergunta: textoDe(b).trim(), resposta: '' });
    else if (itens.length) itens[itens.length - 1].resposta = `${itens[itens.length - 1].resposta} ${textoDe(b)}`.trim();
  }
  return itens.filter((i) => i.pergunta && i.resposta);
}

export function paginaPost(post, relacionados) {
  const path = `/blog/${post.slug}`;
  const trail = [['Início', '/'], ['Blog', '/blog/'], [post.titulo, path]];
  const main = `<main class="page-main">
  <article class="container wrap-prose prose post">
    ${breadcrumbHtml(trail)}
    <span class="post-meta">${esc(post.categoria || 'Guia')} · ${dataBR(post.publicadoEm)} · ${post.minutosLeitura || 1} min de leitura</span>
    <h1>${esc(post.titulo)}</h1>
    <p class="lede">${esc(post.resumo)}</p>
    ${post.capaUrl ? `<img class="post-cover" src="${esc(post.capaUrl)}" alt="${esc(post.capaAlt || '')}" />` : ''}
${conteudoHtml(post.conteudo)}
    ${CTA}
  </article>
  ${relacionados.length ? `<section class="bg-gray section-tight"><div class="container">
    <h2 class="title">Continue lendo</h2>
    ${gradePosts(relacionados)}
  </div></section>` : ''}
</main>`;
  return layout({
    title: `${post.titulo} | Blog KIVAK`, description: post.resumo, path, image: post.capaUrl, type: 'article',
    schema: [
      {
        '@context': 'https://schema.org', '@type': 'BlogPosting', headline: post.titulo, description: post.resumo,
        image: abs(post.capaUrl || '/assets/images/hero-trilheiro.jpg'), datePublished: post.publicadoEm,
        dateModified: post.updatedAt, inLanguage: 'pt-BR', mainEntityOfPage: SITE + path,
        author: { '@type': 'Organization', name: 'Equipe KIVAK', url: SITE }, publisher: ORG,
      },
      crumbs(trail),
      faqSchema(faqDoConteudo(post.conteudo)),
    ],
    main,
  });
}

export function paginaBlog(posts) {
  const trail = [['Início', '/'], ['Blog', '/blog/']];
  return layout({
    title: 'Blog KIVAK | Trilha, camping e aventura no Brasil',
    description: 'Guias práticos de camping e trilha: o que levar, como escolher camping, como gravar trilha com GPS e muito mais, escritos por quem vai pro mato.',
    path: '/blog/',
    schema: [
      { '@context': 'https://schema.org', '@type': 'Blog', name: 'Blog KIVAK', url: `${SITE}/blog/`, publisher: ORG, inLanguage: 'pt-BR' },
      crumbs(trail),
    ],
    main: `<main class="page-main">
  <section class="section-tight"><div class="container">
    ${breadcrumbHtml(trail)}
    <h1 class="title">Blog KIVAK</h1>
    <p class="sub">Guias práticos de trilha e camping, escritos por quem vai pro mato no fim de semana.</p>
    ${posts.length ? gradePosts(posts) : '<p class="sub" style="margin-top:32px">Os primeiros artigos estão chegando.</p>'}
  </div></section>
</main>`,
  });
}

export function feedXml(posts) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>Blog KIVAK</title><link>${SITE}/blog/</link><language>pt-BR</language>
<description>Guias de trilha e camping no Brasil.</description>
${posts.map((p) => `<item><title>${esc(p.titulo)}</title><link>${SITE}/blog/${esc(p.slug)}</link><guid>${SITE}/blog/${esc(p.slug)}</guid><pubDate>${paraData(p.publicadoEm).toUTCString()}</pubDate><description>${esc(p.resumo)}</description></item>`).join('\n')}
</channel></rss>
`;
}
