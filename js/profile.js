(() => {
  const API_URL = 'https://script.google.com/macros/s/AKfycbx3dN5zMqLWiKi_gvRD1riWlL3JdCHIsTgG-WYeXFC5RjMuOyEcXcLkI-G8sN2jx5RR/exec';
  const token = localStorage.getItem('blog_member_auth_token');
  const list = document.querySelector('[data-profile-post-list]');
  if (!list) return;
  const request = async payload => {
    const response = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.message || '요청을 처리하지 못했습니다.');
    return result;
  };
  const date = value => value ? new Date(value).toLocaleDateString('ko-KR') : '';
  const empty = text => { const item = document.createElement('p'); item.className = 'empty-state'; item.textContent = text; list.replaceChildren(item); };
  const draw = posts => {
    if (!posts.length) return empty('아직 작성한 글이 없습니다. 첫 글을 작성해 보세요.');
    list.replaceChildren();
    posts.forEach(post => {
      const item = document.createElement('article'); item.className = 'list-post';
      const meta = document.createElement('div'); meta.className = 'list-date'; meta.textContent = `${date(post.createdAt)}\n${post.category || ''}`; meta.style.whiteSpace = 'pre-line';
      const body = document.createElement('div');
      const heading = document.createElement('h2'); const title = document.createElement('a'); title.href = `post-detail.html?id=${encodeURIComponent(post.id)}`; title.textContent = post.title; heading.appendChild(title);
      const excerpt = document.createElement('p'); excerpt.textContent = String(post.content || '').replace(/\s+/g, ' ').slice(0, 150);
      const actions = document.createElement('div'); actions.className = 'post-actions';
      const edit = document.createElement('a'); edit.className = 'text-link'; edit.href = `write.html?edit=${encodeURIComponent(post.id)}`; edit.textContent = '수정';
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'profile-delete'; remove.textContent = '삭제'; remove.onclick = async () => { if (!confirm('이 게시글을 삭제할까요?')) return; try { await request({ action: 'post_delete', token, id: post.id }); item.remove(); const count = Number(document.querySelector('[data-profile-post-count]').textContent) - 1; document.querySelector('[data-profile-post-count]').textContent = Math.max(0, count); if (!list.children.length) empty('아직 작성한 글이 없습니다. 첫 글을 작성해 보세요.'); } catch (error) { alert(error.message); } };
      actions.append(edit, remove); body.append(heading, excerpt, actions); item.append(meta, body); list.appendChild(item);
    });
  };
  const load = async () => {
    if (!token) { location.replace('login.html?next=profile.html'); return; }
    try {
      const [me, data] = await Promise.all([request({ action: 'me', token }), request({ action: 'post_list', token })]);
      const posts = (data.posts || []).filter(post => String(post.userId) === String(me.user.id));
      document.querySelector('[data-user-name]').textContent = me.user.name;
      document.querySelector('[data-user-email]').textContent = me.user.email;
      document.querySelector('[data-profile-initial]').textContent = String(me.user.name || 'U').slice(0, 1).toUpperCase();
      document.querySelector('[data-profile-post-count]').textContent = posts.length;
      draw(posts);
    } catch { location.replace('login.html?next=profile.html'); }
  };
  const passwordForm = document.querySelector('[data-password-form]');
  passwordForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const fields = new FormData(passwordForm);
    const note = passwordForm.querySelector('.form-message');
    if (fields.get('newPassword') !== fields.get('confirmPassword')) { note.textContent = '새 비밀번호가 일치하지 않습니다.'; note.style.color = '#c0392b'; return; }
    const button = passwordForm.querySelector('button'); button.disabled = true;
    try { const result = await request({ action: 'password_change', token, currentPassword: fields.get('currentPassword'), newPassword: fields.get('newPassword') }); note.textContent = result.message; note.style.color = ''; passwordForm.reset(); }
    catch (error) { note.textContent = error.message; note.style.color = '#c0392b'; }
    finally { button.disabled = false; }
  });
  load();
})();
