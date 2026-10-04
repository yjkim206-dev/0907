(() => {
  const id = new URLSearchParams(location.search).get('id');
  const body = document.querySelector('.article-body');
  if (!id || !body) return;
  const API_URL = 'https://script.google.com/macros/s/AKfycbzW1q_cZcIh8IPG0-wAlzG6Mpz8EnqCCMsmdkPTyG02Z2q66Ky0c7sRbZAl3gODIiVN/exec';
  fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'post_get', id, token: localStorage.getItem('blog_member_auth_token') }) })
    .then(response => response.json())
    .then(result => {
      if (!result.ok || !result.post.imageUrl) return;
      const image = document.createElement('img'); image.className = 'article-image'; image.src = result.post.imageUrl; image.alt = result.post.title || '게시글 대표 사진'; image.loading = 'lazy'; body.before(image);
    }).catch(() => {});
})();
