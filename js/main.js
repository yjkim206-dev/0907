const API_URL = 'https://script.google.com/macros/s/AKfycbylJ2p8X84gtnM_rnX_2tSXDYBIvJh957I5-pnLzE3Yc1N63vHRNKfscWIUw3AYVJ2t/exec';
const TOKEN_KEY = 'blog_auth_token';
let currentUser = null;
let isAdmin = false;

const nav = document.querySelector('.site-nav');
const menu = document.querySelector('.menu-toggle');
if (menu && nav) menu.addEventListener('click', () => { const open = nav.classList.toggle('is-open'); menu.setAttribute('aria-expanded', String(open)); });

function showMessage(form, message, error = false) { const el = form?.querySelector('.form-message'); if (el) { el.textContent = message; el.style.color = error ? '#c0392b' : ''; } }
function clearAuth() { currentUser = null; isAdmin = false; localStorage.removeItem(TOKEN_KEY); localStorage.removeItem('blog_user'); }
async function api(payload) { const response = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) }); if (!response.ok) throw new Error('Server error'); return response.json(); }
async function requiredApi(payload) { const result = await api(payload); if (!result.ok) throw new Error(result.message || 'Request failed'); return result; }
function dateText(value) { return value ? new Date(value).toLocaleDateString('ko-KR') : '-'; }
function visitorId() { let id = localStorage.getItem('blog_visitor_id'); if (!id) { id = `${Date.now()}-${Math.random().toString(36).slice(2)}`; localStorage.setItem('blog_visitor_id', id); } return id; }

async function refreshAuth() { const token = localStorage.getItem(TOKEN_KEY); if (!token) return null; try { const result = await api({ action: 'me', token }); if (!result.ok) { clearAuth(); return null; } currentUser = result.user; return currentUser; } catch { clearAuth(); return null; } }
async function checkAdmin() { if (!currentUser) return false; try { await requiredApi({ action: 'admin_dashboard', token: localStorage.getItem(TOKEN_KEY) }); isAdmin = true; return true; } catch { isAdmin = false; return false; } }

function setupNavigation() {
  if (!nav) return;
  document.querySelectorAll('[data-admin-link]').forEach(link => link.remove());
  const admin = document.createElement('a'); admin.dataset.adminLink = 'true'; admin.className = 'admin-nav-link'; admin.textContent = isAdmin ? 'Admin logout' : 'Admin login';
  if (isAdmin) { admin.href = '#admin-logout'; admin.onclick = async event => { event.preventDefault(); try { await api({ action: 'logout', token: localStorage.getItem(TOKEN_KEY) }); } finally { clearAuth(); location.href = 'index.html'; } }; } else admin.href = 'admin-login.html';
  document.querySelector('.header-inner')?.insertBefore(admin, nav);
  const login = nav.querySelector('a[href="login.html"]');
  if (currentUser && login) { login.textContent = 'Logout'; login.href = '#logout'; login.onclick = async event => { event.preventDefault(); try { await api({ action: 'logout', token: localStorage.getItem(TOKEN_KEY) }); } finally { clearAuth(); location.href = 'index.html'; } }; }
}

function setupAuthForm() {
  const form = document.querySelector('form[data-auth-mode]'); if (!form) return;
  const signup = form.dataset.authMode === 'signup';
  form.addEventListener('submit', async event => { event.preventDefault(); const data = new FormData(form); const button = form.querySelector('button[type="submit"]'); if (signup && data.get('password') !== data.get('passwordConfirm')) return showMessage(form, 'Passwords do not match.', true); button.disabled = true; try { const result = await requiredApi({ action: signup ? 'signup' : 'login', name: data.get('name'), email: data.get('email'), password: data.get('password') }); localStorage.setItem(TOKEN_KEY, result.token); localStorage.setItem('blog_user', JSON.stringify(result.user)); currentUser = result.user; showMessage(form, result.message || 'Done'); setTimeout(() => { location.href = new URLSearchParams(location.search).get('next') || 'profile.html'; }, 350); } catch (error) { showMessage(form, error.message, true); } finally { button.disabled = false; } });
}

function setupAdminLogin() { const form = document.querySelector('form[data-admin-auth]'); if (!form) return; form.addEventListener('submit', async event => { event.preventDefault(); const data = new FormData(form); const button = form.querySelector('button[type="submit"]'); button.disabled = true; try { const result = await requiredApi({ action: 'login', email: data.get('email'), password: data.get('password') }); await requiredApi({ action: 'admin_dashboard', token: result.token }); localStorage.setItem(TOKEN_KEY, result.token); localStorage.setItem('blog_user', JSON.stringify(result.user)); location.href = 'admin.html'; } catch (error) { showMessage(form, error.message || 'Admin account required.', true); } finally { button.disabled = false; } }); }

async function setupAdminPage() { const page = document.querySelector('.admin-page'); if (!page) return; if (!isAdmin) { location.replace('admin-login.html'); return; } try { const data = await requiredApi({ action: 'admin_dashboard', token: localStorage.getItem(TOKEN_KEY) }); page.querySelector('.admin-content').hidden = false; page.querySelector('#admin-user-count').textContent = data.stats.users; page.querySelector('#admin-post-count').textContent = data.stats.posts; page.querySelector('#admin-comment-count').textContent = data.stats.comments; const cell = (row, value) => { const td = document.createElement('td'); td.textContent = value || '-'; row.appendChild(td); }; const users = page.querySelector('#admin-users'); data.users.forEach(item => { const row = document.createElement('tr'); cell(row, item.name); cell(row, item.email); cell(row, dateText(item.createdAt)); users.appendChild(row); }); const posts = page.querySelector('#admin-posts'); data.posts.forEach(item => { const row = document.createElement('tr'); cell(row, item.title); cell(row, item.authorName); cell(row, item.category); cell(row, dateText(item.createdAt)); cell(row, item.visibility === 'private' ? 'Private' : 'Public'); const td = document.createElement('td'); const button = document.createElement('button'); button.className = 'admin-action'; button.textContent = item.visibility === 'private' ? 'Publish' : 'Hide'; button.onclick = async () => { await requiredApi({ action: 'admin_post_visibility', token: localStorage.getItem(TOKEN_KEY), id: item.id, visibility: item.visibility === 'private' ? 'public' : 'private' }); location.reload(); }; td.appendChild(button); row.appendChild(td); posts.appendChild(row); }); const comments = page.querySelector('#admin-comments'); data.comments.forEach(item => { const row = document.createElement('tr'); cell(row, item.content); cell(row, item.authorName); cell(row, item.postTitle); cell(row, dateText(item.createdAt)); const td = document.createElement('td'); const button = document.createElement('button'); button.className = 'admin-action'; button.textContent = item.visibility === 'private' ? 'Publish' : 'Hide'; button.onclick = async () => { await requiredApi({ action: 'admin_comment_visibility', token: localStorage.getItem(TOKEN_KEY), id: item.id, visibility: item.visibility === 'private' ? 'public' : 'private' }); location.reload(); }; td.appendChild(button); row.appendChild(td); comments.appendChild(row); }); } catch { clearAuth(); location.replace('admin-login.html'); } }

async function refreshAdminMetrics() {
  const page = document.querySelector('.admin-page'); if (!page || !isAdmin) return;
  try {
    const data = await requiredApi({ action: 'admin_dashboard', token: localStorage.getItem(TOKEN_KEY) });
    const cell = (row, value) => { const td = document.createElement('td'); td.textContent = value ?? '-'; row.appendChild(td); };
    const posts = page.querySelector('#admin-posts'); posts.replaceChildren();
    data.posts.forEach(item => { const row = document.createElement('tr'); cell(row, item.title); cell(row, item.authorName); cell(row, item.viewCount || 0); cell(row, item.likeCount || 0); cell(row, item.dislikeCount || 0); cell(row, item.visibility === 'private' ? 'Private' : 'Public'); const td = document.createElement('td'); const button = document.createElement('button'); button.className = 'admin-action'; button.textContent = item.visibility === 'private' ? 'Publish' : 'Hide'; button.onclick = async () => { await requiredApi({ action: 'admin_post_visibility', token: localStorage.getItem(TOKEN_KEY), id: item.id, visibility: item.visibility === 'private' ? 'public' : 'private' }); refreshAdminMetrics(); }; td.appendChild(button); row.appendChild(td); posts.appendChild(row); });
    const comments = page.querySelector('#admin-comments'); comments.replaceChildren();
    data.comments.forEach(item => { const row = document.createElement('tr'); cell(row, item.content); cell(row, item.authorName); cell(row, item.postTitle); cell(row, item.visibility === 'private' ? 'Private' : 'Public'); const td = document.createElement('td'); const button = document.createElement('button'); button.className = 'admin-action'; button.textContent = item.visibility === 'private' ? 'Publish' : 'Hide'; button.onclick = async () => { await requiredApi({ action: 'admin_comment_visibility', token: localStorage.getItem(TOKEN_KEY), id: item.id, visibility: item.visibility === 'private' ? 'public' : 'private' }); refreshAdminMetrics(); }; td.appendChild(button); row.appendChild(td); comments.appendChild(row); });
  } catch { clearAuth(); location.replace('admin-login.html'); }
}

async function setupWrite() { const form = document.querySelector('.editor-wrap form'); if (!form) return; if (!currentUser) { location.replace('login.html?next=write.html'); return; } form.addEventListener('submit', async event => { event.preventDefault(); const data = new FormData(form); try { await requiredApi({ action: 'post_create', token: localStorage.getItem(TOKEN_KEY), title: data.get('title'), content: data.get('content'), category: data.get('category') }); showMessage(form, 'Post published.'); setTimeout(() => { location.href = 'profile.html'; }, 400); } catch (error) { showMessage(form, error.message, true); } }); }

async function setupDetail() { const article = document.querySelector('.article'); if (!article) return; const id = new URLSearchParams(location.search).get('id'); if (!id) return; try { const result = await requiredApi({ action: 'post_get', id, token: localStorage.getItem(TOKEN_KEY) }); const post = result.post; article.querySelector('h1').textContent = post.title; article.querySelector('.article-body').textContent = post.content; const view = await api({ action: 'post_view', id, visitorId: visitorId() }); article.querySelector('.article-meta').textContent = `${post.authorName || ''} · Views ${view.viewCount ?? post.viewCount ?? 0}`; const stats = document.createElement('div'); stats.className = 'post-reactions'; ['like', 'dislike'].forEach(value => { const button = document.createElement('button'); button.type = 'button'; button.textContent = value === 'like' ? `Like ${post.likeCount || 0}` : `Dislike ${post.dislikeCount || 0}`; button.onclick = async () => { if (!currentUser) return location.href = `login.html?next=post-detail.html?id=${encodeURIComponent(id)}`; const data = await requiredApi({ action: 'post_reaction', token: localStorage.getItem(TOKEN_KEY), id, value }); button.textContent = value === 'like' ? `Like ${data.likeCount}` : `Dislike ${data.dislikeCount}`; }; stats.appendChild(button); }); article.querySelector('.article-body').after(stats); setupComments(id); } catch (error) { article.querySelector('h1').textContent = error.message; } }

async function setupComments(postId) { const section = document.querySelector('#comments'); if (!section) return; const list = section.querySelector('.comment-list'); const draw = comments => { list.replaceChildren(); comments.forEach(comment => { const item = document.createElement('article'); item.className = 'comment'; item.textContent = `${comment.name}: ${comment.content}`; if (currentUser && String(currentUser.id) === String(comment.userId)) { const button = document.createElement('button'); button.textContent = 'Delete'; button.onclick = async () => { await requiredApi({ action: 'comment_delete', token: localStorage.getItem(TOKEN_KEY), id: comment.id }); setupComments(postId); }; item.appendChild(button); } list.appendChild(item); }); }; const result = await requiredApi({ action: 'comment_list', postId }); draw(result.comments); const form = section.querySelector('form'); if (form) form.onsubmit = async event => { event.preventDefault(); if (!currentUser) return location.href = `login.html?next=post-detail.html?id=${encodeURIComponent(postId)}`; try { await requiredApi({ action: 'comment_create', token: localStorage.getItem(TOKEN_KEY), postId, content: form.querySelector('textarea').value }); form.reset(); setupComments(postId); } catch (error) { showMessage(form, error.message, true); } }; }

async function setupPostAuthorActions() {
  const article = document.querySelector('.article'); const id = new URLSearchParams(location.search).get('id');
  if (!article || !id || !currentUser) return;
  try {
    const result = await requiredApi({ action: 'post_get', id, token: localStorage.getItem(TOKEN_KEY) });
    if (String(result.post.userId) !== String(currentUser.id)) return;
    const footer = article.querySelector('.article-footer') || article;
    const button = document.createElement('button'); button.type = 'button'; button.className = 'button secondary-btn'; button.textContent = 'Delete my post';
    button.onclick = async () => { if (!confirm('Delete this post?')) return; await requiredApi({ action: 'post_delete', token: localStorage.getItem(TOKEN_KEY), id }); location.href = 'profile.html'; };
    footer.appendChild(button);
  } catch { /* the server remains the final permission check */ }
}

async function bootstrap() { currentUser = await refreshAuth(); isAdmin = await checkAdmin(); setupNavigation(); setupAuthForm(); setupAdminLogin(); await setupAdminPage(); await refreshAdminMetrics(); await setupWrite(); await setupDetail(); await setupPostAuthorActions(); document.body.classList.add('app-ready'); }
bootstrap();
