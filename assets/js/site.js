const API_BASE = 'https://api.kivak.app/api/v2';

// ─── NAV: sólido ao rolar ───────────────────────────────────────
const nav = document.querySelector('.site-nav');
// Páginas sem hero (blog, conteúdo) marcam a nav como always-solid.
if (nav && !nav.classList.contains('always-solid')) {
  const onScroll = () => nav.classList.toggle('solid', window.scrollY > 40);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

// ─── ANIMAÇÃO DE ENTRADA AO ROLAR ───────────────────────────────
const observer = new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('visible'); });
}, { threshold: 0.12 });
document.querySelectorAll('.fade-in').forEach((el) => observer.observe(el));

// ─── FORMULÁRIO DE ACESSO ANTECIPADO (app e/ou empresa) ─────────
// Um mesmo form pode ou não ter seletor de plataforma (Android/iOS) —
// a página Empresas não tem, porque não se aplica a anunciante.
const form = document.getElementById('form-acesso');
if (form) {
  const options = form.querySelectorAll('.platform-option');
  options.forEach((opt) => {
    opt.addEventListener('click', () => {
      options.forEach((o) => o.classList.remove('selected'));
      opt.classList.add('selected');
      opt.querySelector('input').checked = true;
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = form.querySelector('.form-msg');
    const btn = form.querySelector('button[type="submit"]');
    const plataforma = form.querySelector('input[name="plataforma"]:checked');
    const tipoInput = form.querySelector('input[name="tipo"]');
    const tipo = tipoInput ? tipoInput.value : 'app';

    msg.className = 'form-msg';
    msg.textContent = '';

    if (options.length > 0 && !plataforma) {
      msg.textContent = 'Escolha se você usa Android ou iOS.';
      msg.className = 'form-msg err';
      return;
    }

    const nome = form.nome.value.trim();
    const email = form.email.value.trim();

    btn.disabled = true;
    const textoOriginal = btn.textContent;
    btn.innerHTML = '<span class="spinner"></span> Enviando...';

    try {
      const res = await fetch(`${API_BASE}/acesso-antecipado`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome,
          email,
          tipo,
          ...(plataforma ? { plataforma: plataforma.value } : {}),
        }),
      });
      if (!res.ok) throw new Error('erro');

      if (tipo === 'anunciante') {
        msg.textContent = 'Recebemos seu contato! Alguém do time KIVAK te retorna em breve.';
      } else {
        msg.textContent = plataforma.value === 'ios'
          ? 'Cadastrado! O KIVAK ainda não está na App Store — avisamos assim que sair.'
          : 'Cadastrado! Fique de olho no seu e-mail: avisamos assim que seu acesso for liberado.';
      }
      msg.className = 'form-msg ok';
      form.reset();
      options.forEach((o) => o.classList.remove('selected'));
    } catch {
      msg.textContent = 'Não foi possível enviar agora. Tenta de novo em instantes?';
      msg.className = 'form-msg err';
    } finally {
      btn.disabled = false;
      btn.textContent = textoOriginal;
    }
  });
}
