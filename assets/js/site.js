const API_BASE = 'https://api.kivak.app/api/v2';

// ─── NAV: sólido ao rolar ───────────────────────────────────────
const nav = document.querySelector('.site-nav');
if (nav) {
  const onScroll = () => nav.classList.toggle('solid', window.scrollY > 40);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

// ─── ANIMAÇÃO DE ENTRADA AO ROLAR ───────────────────────────────
const observer = new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('visible'); });
}, { threshold: 0.12 });
document.querySelectorAll('.fade-in').forEach((el) => observer.observe(el));

// ─── FORMULÁRIO DE ACESSO ANTECIPADO ────────────────────────────
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

    msg.className = 'form-msg';
    msg.textContent = '';

    if (!plataforma) {
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
        body: JSON.stringify({ nome, email, plataforma: plataforma.value }),
      });
      if (!res.ok) throw new Error('erro');

      msg.textContent = plataforma.value === 'ios'
        ? 'Cadastrado! O KIVAK ainda não está na App Store — avisamos assim que sair.'
        : 'Cadastrado! Fique de olho no seu e-mail: avisamos assim que seu acesso for liberado.';
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
