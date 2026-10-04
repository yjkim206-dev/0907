(() => {
  const token = localStorage.getItem('blog_member_auth_token');
  const id = new URLSearchParams(location.search).get('id');
  const footer = document.querySelector('.article-footer');
  if (!token || !id || !footer) return;
  const API_URL = 'https://script.google.com/macros/s/AKfycbzW1q_cZcIh8IPG0-wAlzG6Mpz8EnqCCMsmdkPTyG02Z2q66Ky0c7sRbZAl3gODIiVN/exec';
  const request = async payload => { const response = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) }); return response.json(); };
  Promise.all([request({ action: 'me', token }), request({ action: 'post_get', id, token })]).then(([me, post]) => {
    if (!me.ok || !post.ok || String(me.user.id) !== String(post.post.userId)) return;
    const edit = document.createElement('a'); edit.className = 'button secondary-btn post-edit-button'; edit.href = `write.html?edit=${encodeURIComponent(id)}`; edit.textContent = '글 수정'; footer.appendChild(edit);
  }).catch(() => {});
})();
