(() => {
  const API_URL = 'https://script.google.com/macros/s/AKfycbzW1q_cZcIh8IPG0-wAlzG6Mpz8EnqCCMsmdkPTyG02Z2q66Ky0c7sRbZAl3gODIiVN/exec';
  const token = localStorage.getItem('blog_member_auth_token');
  const form = document.querySelector('[data-editor-form]');
  if (!form) return;
  const message = form.querySelector('.form-message');
  const preview = document.querySelector('[data-post-preview]');
  const imageInput = form.querySelector('[data-image-input]');
  const params = new URLSearchParams(location.search);
  const editId = params.get('edit');
  let existingImageUrl = '';
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
    const image = preview.querySelector('[data-preview-image]');
    const file = imageInput.files[0];
    image.src = file ? URL.createObjectURL(file) : existingImageUrl;
    image.hidden = !image.src;
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
      existingImageUrl = result.post.imageUrl || '';
      document.querySelector('[data-editor-kicker]').textContent = 'EDIT POST';
      document.querySelector('[data-editor-title]').textContent = '글 수정';
      document.querySelector('[data-submit-label]').textContent = '수정 저장';
    } catch (error) { show(error.message, true); form.querySelectorAll('input, textarea, button').forEach(el => { el.disabled = true; }); }
  };
  form.querySelector('[data-preview-toggle]').addEventListener('click', drawPreview);
  const fileDataUrl = file => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('이미지를 읽을 수 없습니다.')); reader.readAsDataURL(file); });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      let imageUrl = existingImageUrl;
      const file = imageInput.files[0];
      if (file) {
        if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error('JPG, PNG, GIF, WEBP 형식의 5MB 이하 이미지만 올릴 수 있습니다.');
        show('사진을 업로드하는 중입니다.');
        const upload = await request({ action: 'image_upload', token, dataUrl: await fileDataUrl(file) });
        imageUrl = upload.imageUrl;
      }
      const payload = { action: editId ? 'post_update' : 'post_create', token, category: form.category.value, title: form.title.value, content: form.content.value, imageUrl };
      if (editId) payload.id = editId;
      const result = await request(payload);
      show(editId ? '게시글을 수정했습니다.' : '게시글을 발행했습니다.');
      setTimeout(() => { location.href = editId ? `post-detail.html?id=${encodeURIComponent(editId)}` : `post-detail.html?id=${encodeURIComponent(result.post.id)}`; }, 350);
    } catch (error) { show(error.message, true); } finally { submit.disabled = false; }
  });
  initialize();
})();
