const API_URL = 'https://script.google.com/macros/s/AKfycbxJjy--ozSWz_5lCg3ocz2IKjYVMepr0xp0rpR1nNDfWxQD-aTYktT4Vcn3QluFzo0q/exec';
const nav = document.querySelector('.site-nav');
const menu = document.querySelector('.menu-toggle');
if (menu && nav) menu.addEventListener('click', () => { const open = nav.classList.toggle('is-open'); menu.setAttribute('aria-expanded', String(open)); });

function showMessage(form, message, error = false) { const target = form.querySelector('.form-message'); if (!target) return; target.textContent = message; target.style.color = error ? '#c0392b' : ''; }
async function callAuthApi(payload) { const response = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) }); return response.json(); }

function setupAuthForm() {
  const form = document.querySelector('.auth-card form');
  if (!form) return;
  const isSignup = location.pathname.endsWith('signup.html');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const fields = new FormData(form);
    const payload = { action: isSignup ? 'signup' : 'login', email: fields.get('email') || form.querySelector('input[type="email"]')?.value, password: fields.get('password') || form.querySelector('input[type="password"]')?.value };
    if (isSignup) payload.name = fields.get('name') || form.querySelector('input[type="text"]')?.value;
    const button = form.querySelector('button[type="submit"], button:not([type])');
    if (button) button.disabled = true;
    showMessage(form, '처리 중입니다...');
    try {
      const result = await callAuthApi(payload);
      if (!result.ok) { showMessage(form, result.message || '요청을 처리하지 못했습니다.', true); return; }
      localStorage.setItem('blog_auth_token', result.token);
      localStorage.setItem('blog_user', JSON.stringify(result.user));
      showMessage(form, result.message);
      setTimeout(() => { location.href = 'profile.html'; }, 500);
    } catch (error) { showMessage(form, '서버에 연결할 수 없습니다. 잠시 후 다시 시도하세요.', true); }
    finally { if (button) button.disabled = false; }
  });
}

document.querySelectorAll('form:not(.auth-card form)').forEach((form) => form.addEventListener('submit', (event) => { event.preventDefault(); const message = form.querySelector('.form-message'); if (message) message.textContent = form.dataset.message || '처리되었습니다.'; }));
setupAuthForm();
