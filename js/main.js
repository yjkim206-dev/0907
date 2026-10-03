const API_URL = 'https://script.google.com/macros/s/AKfycbzAovPsgZ6yED3x4OiHz0XNMyr8PbH3cZppAGbqqO_g2ffwgGkhPTb_HNAw0rj0uXvY/exec';
const TOKEN_KEY = 'blog_auth_token';
let currentUser = null;
let isAdmin = false;

const nav = document.querySelector('.site-nav');
const menu = document.querySelector('.menu-toggle');
if (menu && nav) menu.addEventListener('click', () => { const open = nav.classList.toggle('is-open'); menu.setAttribute('aria-expanded', String(open)); });

function showMessage(form, message, error = false) { const el = form?.querySelector('.form-message'); if (el) { el.textContent = message; el.style.color = error ? '#c0392b' : ''; } }
function clearAuth() { currentUser = null; isAdmin = false; localStorage.removeItem(TOKEN_KEY); localStorage.removeItem('blog_user'); }
async function api(payload) { const response = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) }); if (!response.ok) throw new Error(`서버 오류 (${response.status})`); return response.json(); }
async function requireApi(payload) { const result = await api(payload); if (!result.ok) throw new Error(result.message || '요청에 실패했습니다.'); return result; }
function dateText(value) { return value ? new Date(value).toLocaleDateString('ko-KR') : '-'; }

async function refreshAuth() {
  const token = localStorage.getItem(TOKEN_KEY); if (!token) return null;
  try { const result = await api({ action: 'me', token }); if (!result.ok) { clearAuth(); return null; } currentUser = result.user; return currentUser; }
  catch { clearAuth(); return null; }
}

async function checkAdmin() {
  if (!currentUser) return false;
  try { await requireApi({ action: 'admin_dashboard', token: localStorage.getItem(TOKEN_KEY) }); isAdmin = true; return true; }
  catch { isAdmin = false; return false; }
}

function setupNavigation() {
  if (!nav) return;
  const header = document.querySelector('.header-inner');
  document.querySelectorAll('[data-admin-link]').forEach(link => link.remove());
  const adminLink = document.createElement('a');
  adminLink.dataset.adminLink = 'true';
  adminLink.className = 'admin-nav-link';
  adminLink.textContent = isAdmin ? '관리자 로그아웃' : '관리자 로그인';
  if (isAdmin) {
    adminLink.href = '#admin-logout';
    adminLink.addEventListener('click', async event => { event.preventDefault(); try { await api({ action: 'logout', token: localStorage.getItem(TOKEN_KEY) }); } finally { clearAuth(); location.href = 'index.html'; } });
  } else { adminLink.href = 'admin-login.html'; }
  header?.insertBefore(adminLink, nav);

  const login = nav.querySelector('a[href="login.html"]');
  if (currentUser && login) {
    login.textContent = '로그아웃'; login.href = '#logout';
    login.onclick = async event => { event.preventDefault(); try { await api({ action: 'logout', token: localStorage.getItem(TOKEN_KEY) }); } finally { clearAuth(); location.href = 'index.html'; } };
  }
}

function setupAuthForm() {
  const form = document.querySelector('form[data-auth-mode]'); if (!form) return;
  const signup = form.dataset.authMode === 'signup';
  form.addEventListener('submit', async event => {
    event.preventDefault(); const data = new FormData(form); const button = form.querySelector('button[type="submit"]');
    if (signup && data.get('password') !== data.get('passwordConfirm')) return showMessage(form, '비밀번호가 일치하지 않습니다.', true);
    button.disabled = true; showMessage(form, '처리 중입니다...');
    try { const result = await requireApi({ action: signup ? 'signup' : 'login', name: data.get('name'), email: data.get('email'), password: data.get('password') }); localStorage.setItem(TOKEN_KEY, result.token); localStorage.setItem('blog_user', JSON.stringify(result.user)); currentUser = result.user; showMessage(form, result.message); const next = new URLSearchParams(location.search).get('next'); setTimeout(() => { location.href = next || 'profile.html'; }, 350); }
    catch (error) { showMessage(form, error.message, true); } finally { button.disabled = false; }
  });
}

function setupAdminLogin() {
  const form = document.querySelector('form[data-admin-auth]'); if (!form) return;
  form.addEventListener('submit', async event => {
    event.preventDefault(); const data = new FormData(form); const button = form.querySelector('button[type="submit"]'); button.disabled = true; showMessage(form, '관리자 권한을 확인하고 있습니다...');
    try { const result = await requireApi({ action: 'login', email: data.get('email'), password: data.get('password') }); const admin = await api({ action: 'admin_dashboard', token: result.token }); if (!admin.ok) throw new Error('관리자 계정만 접속할 수 있습니다.'); localStorage.setItem(TOKEN_KEY, result.token); localStorage.setItem('blog_user', JSON.stringify(result.user)); currentUser = result.user; isAdmin = true; location.href = 'admin.html'; }
    catch (error) { showMessage(form, error.message, true); } finally { button.disabled = false; }
  });
}

async function setupAdminPage() {
  const page = document.querySelector('.admin-page'); if (!page) return;
  if (!isAdmin) { location.replace('admin-login.html'); return; }
  try {
    const data = await requireApi({ action: 'admin_dashboard', token: localStorage.getItem(TOKEN_KEY) });
    page.querySelector('.admin-content').hidden = false;
    page.querySelector('#admin-user-count').textContent = data.stats.users; page.querySelector('#admin-post-count').textContent = data.stats.posts; page.querySelector('#admin-comment-count').textContent = data.stats.comments;
    const fill = (id, rows, render) => { const target = page.querySelector(id); target.replaceChildren(); rows.forEach(item => target.appendChild(render(item))); };
    const cell = (row, value) => { const td = document.createElement('td'); td.textContent = value || '-'; row.appendChild(td); };
    fill('#admin-users', data.users, user => { const row = document.createElement('tr'); cell(row, user.name); cell(row, user.email); cell(row, dateText(user.createdAt)); return row; });
    fill('#admin-posts', data.posts, post => { const row = document.createElement('tr'); cell(row, post.title); cell(row, post.authorName); cell(row, post.category); cell(row, dateText(post.createdAt)); cell(row, post.visibility === 'private' ? '비공개' : '공개'); const td = document.createElement('td'); const button = document.createElement('button'); button.className = 'admin-action'; button.textContent = post.visibility === 'private' ? '공개' : '비공개'; button.onclick = async () => { await requireApi({ action: 'admin_post_visibility', token: localStorage.getItem(TOKEN_KEY), id: post.id, visibility: post.visibility === 'private' ? 'public' : 'private' }); location.reload(); }; td.appendChild(button); row.appendChild(td); return row; });
    fill('#admin-comments', data.comments, comment => { const row = document.createElement('tr'); cell(row, comment.content); cell(row, comment.authorName); cell(row, comment.postTitle); cell(row, dateText(comment.createdAt)); return row; });
  } catch (error) { clearAuth(); location.replace('admin-login.html'); }
}

async function bootstrap() {
  currentUser = await refreshAuth();
  const adminPage = Boolean(document.querySelector('.admin-page'));
  isAdmin = await checkAdmin();
  setupNavigation(); setupAuthForm(); setupAdminLogin();
  if (adminPage) await setupAdminPage();
  document.body.classList.add('app-ready');
}

bootstrap();
