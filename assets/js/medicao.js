// Medição de acessos: Google Analytics 4 (números, tempo por página, origem)
// e Microsoft Clarity (gravação de sessão e mapa de calor).
//
// Nada é carregado nem enviado antes do aceite no banner (LGPD). A escolha
// fica no localStorage (não é cookie) e pode ser trocada pelo link "Cookies"
// do rodapé. ativar.html não inclui este arquivo de propósito: a URL dela
// leva o e-mail da pessoa (?email=), que não pode ir pro Google.
//
// Eventos enviados (GA4 > Relatórios > Engajamento > Eventos):
//   clique            todo clique em link ou botão (texto, destino, seção)
//   baixar_apk        clique em qualquer link pro /kivak.apk
//   ver_secao         cada seção da página que apareceu na tela (1x por seção)
//   rolagem           25, 50, 75 e 100% da página
//   tempo_engajado    15s, 30s, 60s, 2min e 5min com a aba visível
//   formulario_*      envio do formulário de acesso antecipado (via site.js)
// O tempo médio por página sai pronto em Engajamento > Páginas e telas.
(() => {
  const GA4_ID = 'G-61VF9XVHFB';
  const CLARITY_ID = 'yvl78rm5oc';
  const CHAVE = 'kivak-consentimento'; // 'aceito' | 'recusado'

  const lerEscolha = () => { try { return localStorage.getItem(CHAVE); } catch { return null; } };
  const gravarEscolha = (v) => { try { localStorage.setItem(CHAVE, v); } catch { /* aba anônima: vale só nesta visita */ } };

  let ativo = false;

  function carregarGa4() {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA4_ID);
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`;
    document.head.appendChild(s);
  }

  function carregarClarity() {
    window.clarity = window.clarity || function clarity() { (window.clarity.q = window.clarity.q || []).push(arguments); };
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.clarity.ms/tag/${CLARITY_ID}`;
    document.head.appendChild(s);
    window.clarity('consent');
  }

  function ativar() {
    if (ativo) return;
    ativo = true;
    carregarGa4();
    carregarClarity();
    iniciarObservadores();
  }

  /** Envia um evento pro GA4 (e marca a sessão no Clarity). Sem aceite, descarta. */
  function evento(nome, params = {}) {
    if (!ativo) return;
    window.gtag('event', nome, params);
    // No Clarity, eventos viram filtro de sessão ("quem baixou o APK").
    // O clique genérico fica de fora pra não poluir a lista.
    if (nome !== 'clique' && window.clarity) window.clarity('event', nome);
  }
  window.kivakEvento = evento;

  // ─── Nome legível da seção onde algo está ───────────────────────
  const limpar = (s, n = 80) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);
  function nomeSecao(el) {
    const sec = el.closest('section, header, footer, nav, aside, article');
    if (!sec) return 'pagina';
    if (sec.tagName === 'NAV') return 'menu';
    if (sec.tagName === 'FOOTER') return 'rodape';
    if (sec.id) return sec.id;
    const titulo = sec.querySelector('h1, h2, h3');
    return titulo ? limpar(titulo.textContent, 60) : sec.tagName.toLowerCase();
  }

  // ─── Cliques em links e botões ──────────────────────────────────
  document.addEventListener('click', (e) => {
    const el = e.target.closest('a, button');
    if (!el || el.closest('.cookie-banner')) return;
    const href = el.getAttribute('href') || '';
    const texto = limpar(el.textContent || el.getAttribute('aria-label'), 100);
    const secao = nomeSecao(el);
    let destino = '';
    let tipo = 'botao';
    if (el.tagName === 'A' && href) {
      const url = new URL(href, location.href);
      destino = url.origin === location.origin ? url.pathname + url.hash : url.href;
      tipo = url.origin === location.origin ? 'link_interno' : 'link_externo';
    }
    evento('clique', { texto, destino, secao, tipo });
    if (/\/kivak\.apk$/.test(destino)) evento('baixar_apk', { texto, secao });
  }, true);

  function iniciarObservadores() {
    // ─── Seções vistas ──────────────────────────────────────────
    const vistas = new Set();
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const nome = nomeSecao(en.target);
        obs.unobserve(en.target);
        if (vistas.has(nome)) return;
        vistas.add(nome);
        evento('ver_secao', { secao: nome });
      });
    // Conta quando a seção alcança o meio da tela; threshold por proporção
    // nunca dispararia em seção mais alta que a tela.
    }, { rootMargin: '0px 0px -50% 0px' });
    document.querySelectorAll('main section, main > header, body > header, body > section, article.post, .post-cta, footer')
      .forEach((el) => obs.observe(el));

    // ─── Profundidade de rolagem ────────────────────────────────
    const marcos = [25, 50, 75, 100];
    const atingidos = new Set();
    const aoRolar = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      const pct = total <= 0 ? 100 : ((window.scrollY / total) * 100);
      for (const m of marcos) {
        if (pct >= m - 1 && !atingidos.has(m)) { atingidos.add(m); evento('rolagem', { percentual: m }); }
      }
      if (atingidos.size === marcos.length) window.removeEventListener('scroll', aoRolar);
    };
    window.addEventListener('scroll', aoRolar, { passive: true });

    // ─── Tempo com a aba visível ────────────────────────────────
    const marcosTempo = [15, 30, 60, 120, 300];
    let segundos = 0;
    const relogio = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      segundos += 1;
      if (marcosTempo.includes(segundos)) evento('tempo_engajado', { segundos });
      if (segundos >= marcosTempo[marcosTempo.length - 1]) clearInterval(relogio);
    }, 1000);
  }

  // ─── Banner de consentimento ────────────────────────────────────
  function banner() {
    if (document.querySelector('.cookie-banner')) return;
    const el = document.createElement('div');
    el.className = 'cookie-banner';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Cookies');

    const p = document.createElement('p');
    p.append('Usamos cookies do Google Analytics e do Microsoft Clarity para entender como o site é usado e deixá-lo melhor. Só ativamos se você permitir. ');
    const saiba = document.createElement('a');
    saiba.href = '/privacidade#14-cookies-e-armazenamento-no-aparelho';
    saiba.textContent = 'Saiba mais';
    p.append(saiba);

    const acoes = document.createElement('div');
    acoes.className = 'cookie-acoes';
    const botao = (texto, classe, escolha) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `btn btn-sm ${classe}`;
      b.textContent = texto;
      b.addEventListener('click', () => {
        const antes = lerEscolha();
        gravarEscolha(escolha);
        el.remove();
        if (escolha === 'aceito') ativar();
        // Já tinha aceitado e agora recusou: recarrega pra tirar os scripts da página.
        else if (antes === 'aceito' || ativo) location.reload();
      });
      return b;
    };
    acoes.append(botao('Recusar', 'cookie-recusar', 'recusado'), botao('Aceitar', 'btn-primary', 'aceito'));

    el.append(p, acoes);
    document.body.appendChild(el);
  }

  // Link "Cookies" no rodapé pra rever a escolha a qualquer momento.
  document.querySelectorAll('.footer-legal').forEach((nav) => {
    const a = document.createElement('a');
    a.href = '#';
    a.textContent = 'Cookies';
    a.addEventListener('click', (e) => { e.preventDefault(); banner(); });
    nav.appendChild(a);
  });

  const escolha = lerEscolha();
  if (escolha === 'aceito') ativar();
  else if (escolha !== 'recusado') banner();
})();
