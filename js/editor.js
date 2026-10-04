(() => {
  const API_URL = 'https://script.google.com/macros/s/AKfycbylJ2p8X84gtnM_rnX_2tSXDYBIvJh957I5-pnLzE3Yc1N63vHRNKfscWIUw3AYVJ2t/exec';
  const token = localStorage.getItem('blog_member_auth_token');
  const form = document.querySelector('[data-editor-form]');
  if (!form) return;
  const message = form.querySelector('.form-message');
  const preview = document.querySelector('[data-post-preview]');
  const params = new URLSearchParams(location.search);
  const editId = params.get('edit');
  const request = async payload => {
    const response = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.message || '요청을 처리하지 못했습니다.');
    return result;
  };
  const show = (text, error = false) => { message.textContent = text; message.style.color = error ? '#c0392b' : ''; };
  const drawPreview = () => {
    preview.querySelector('.post-preview-meta').textContent = form.category.value.trim() || '카테고리';
    preview.querySelector('.post-preview-title').textContent = form.title.value.trim() || '제목 미리보기';
    preview.querySelector('.post-preview-content').textContent = form.content.value.trim() || '내용 미리보기';
    preview.hidden = false;
    preview.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const initialize = async () => {
    if (!token) { location.replace(`login.html?next=${encodeURIComponent(location.pathname.split('/').pop() + location.search)}`); return; }
    try {
      const me = await request({ action: 'me', token });
      if (!editId) return;
      const result = await request({ action: 'post_get', id: editId, token });
      if (String(result.post.userId) !== String(me.user.id)) throw new Error('작성자만 글을 수정할 수 있습니다.');
      form.category.value = result.post.category || '';
      form.title.value = result.post.title || '';
      form.content.value = result.post.content || '';
      document.querySelector('[data-editor-kicker]').textContent = 'EDIT POST';
      document.querySelector('[data-editor-title]').textContent = '글 수정';
      document.querySelector('[data-submit-label]').textContent = '수정 저장';
    } catch (error) { show(error.message, true); form.querySelectorAll('input, textarea, button').forEach(el => { el.disabled = true; }); }
  };
  form.querySelector('[data-preview-toggle]').addEventListener('click', drawPreview);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      const payload = { action: editId ? 'post_update' : 'post_create', token, category: form.category.value, title: form.title.value, content: form.content.value };
      if (editId) payload.id = editId;
      const result = await request(payload);
      show(editId ? '게시글을 수정했습니다.' : '게시글을 발행했습니다.');
      setTimeout(() => { location.href = editId ? `post-detail.html?id=${encodeURIComponent(editId)}` : `post-detail.html?id=${encodeURIComponent(result.post.id)}`; }, 350);
    } catch (error) { show(error.message, true); } finally { submit.disabled = false; }
  });
  initialize();
})();
