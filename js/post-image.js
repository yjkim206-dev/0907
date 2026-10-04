(() => {
  const id = new URLSearchParams(location.search).get('id');
  const body = document.querySelector('.article-body');
  if (!id || !body) return;
  const API_URL = 'https://script.google.com/macros/s/AKfycbx3dN5zMqLWiKi_gvRD1riWlL3JdCHIsTgG-WYeXFC5RjMuOyEcXcLkI-G8sN2jx5RR/exec';
  const displayImageUrl = url => {
    const value = String(url || '');
    const driveId = value.match(/^https:\/\/drive\.google\.com\/[^?]+\?(?:[^#]*&)?id=([^&#]+)/);
    return driveId ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(driveId[1])}&sz=w1600` : value;
  };
  fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'post_get', id, token: localStorage.getItem('blog_member_auth_token') }) })
    .then(response => response.json())
    .then(result => {
      if (!result.ok || !result.post.imageUrl) return;
      const image = document.createElement('img'); image.className = 'article-image'; image.src = displayImageUrl(result.post.imageUrl); image.alt = result.post.title || '게시글 대표 사진'; image.loading = 'eager'; image.referrerPolicy = 'no-referrer'; body.before(image);
    }).catch(() => {});
})();
