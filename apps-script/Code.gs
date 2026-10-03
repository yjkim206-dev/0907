const USERS_SHEET = 'Users';
const SESSIONS_SHEET = 'Sessions';
const SESSION_DAYS = 7;
const POSTS_SHEET = 'Posts';
const SUBSCRIBERS_SHEET = 'Subscribers';
const COMMENTS_SHEET = 'Comments';
const REACTIONS_SHEET = 'PostReactions';
const ADMIN_EMAIL_PROPERTY = 'ADMIN_EMAIL';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 최초 1회 실행: 회원·세션 시트와 비밀번호 해싱용 비밀값을 생성합니다.
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  createSheet_(ss, USERS_SHEET, ['id', 'name', 'email', 'passwordHash', 'salt', 'createdAt']);
  createSheet_(ss, SESSIONS_SHEET, ['token', 'userId', 'expiresAt', 'createdAt']);
  createSheet_(ss, POSTS_SHEET, ['id', 'userId', 'title', 'content', 'category', 'createdAt', 'updatedAt', 'visibility', 'viewCount', 'likeCount', 'dislikeCount']);
  ensurePostVisibilityColumn_();
  createSheet_(ss, SUBSCRIBERS_SHEET, ['email', 'createdAt']);
  createSheet_(ss, COMMENTS_SHEET, ['id', 'postId', 'userId', 'content', 'createdAt', 'visibility']);
  createSheet_(ss, REACTIONS_SHEET, ['id', 'postId', 'userId', 'value', 'createdAt']);

  const properties = PropertiesService.getScriptProperties();
  if (!properties.getProperty('PASSWORD_PEPPER')) {
    properties.setProperty('PASSWORD_PEPPER', Utilities.getUuid() + Utilities.getUuid());
  }
}

function doGet() {
  ensureSetup_();
  return json_({ ok: true, message: 'Authentication API is running.' });
}

function doPost(e) {
  try {
    ensureSetup_();
    const data = JSON.parse(e.postData.contents || '{}');
    if (data.action === 'signup') return signup_(data);
    if (data.action === 'login') return login_(data);
    if (data.action === 'me') return getUser_(data.token);
    if (data.action === 'logout') return logout_(data.token);
    if (data.action === 'post_create') return createPost_(data);
    if (data.action === 'post_list') return listPosts_(data.token);
    if (data.action === 'post_get') return getPost_(data.id, data.token);
    if (data.action === 'post_view') return viewPost_(data.id);
    if (data.action === 'post_reaction') return reactPost_(data);
    if (data.action === 'post_update') return updatePost_(data);
    if (data.action === 'post_delete') return deletePost_(data);
    if (data.action === 'subscribe') return subscribe_(data);
    if (data.action === 'comment_list') return listComments_(data.postId);
    if (data.action === 'comment_create') return createComment_(data);
    if (data.action === 'comment_delete') return deleteComment_(data);
    if (data.action === 'admin_bootstrap') return bootstrapAdmin_(data);
    if (data.action === 'admin_dashboard') return adminDashboard_(data.token);
    if (data.action === 'admin_post_delete') return adminDeletePost_(data.token, data.id);
    if (data.action === 'admin_comment_delete') return adminDeleteComment_(data.token, data.id);
    if (data.action === 'admin_comment_visibility') return adminSetCommentVisibility_(data.token, data.id, data.visibility);
    if (data.action === 'admin_post_visibility') return adminSetPostVisibility_(data.token, data.id, data.visibility);
    return json_({ ok: false, message: '잘못된 요청입니다.' });
  } catch (error) {
    return json_({ ok: false, message: error.message });
  }
}

function signup_(data) {
  const name = String(data.name || '').trim();
  const email = String(data.email || '').trim().toLowerCase();
  const password = String(data.password || '');

  if (!name || !email || !password) return json_({ ok: false, message: '모든 항목을 입력하세요.' });
  if (name.length > 40) return json_({ ok: false, message: '이름은 40자 이하로 입력하세요.' });
  if (!EMAIL_PATTERN.test(email)) return json_({ ok: false, message: '올바른 이메일 주소를 입력하세요.' });
  if (password.length < 8) return json_({ ok: false, message: '비밀번호는 8자 이상이어야 합니다.' });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const users = sheet_(USERS_SHEET);
    const rows = users.getDataRange().getValues();
    if (rows.slice(1).some(row => String(row[2]).toLowerCase() === email)) {
      return json_({ ok: false, message: '이미 가입된 이메일입니다.' });
    }

    const id = Utilities.getUuid();
    const salt = Utilities.getUuid();
    users.appendRow([id, name, email, hash_(password, salt), salt, new Date().toISOString()]);

    // 관리자 이메일이 아직 지정되지 않은 최초 설치에서는 첫 가입자를 관리자로 지정합니다.
    if (!PropertiesService.getScriptProperties().getProperty(ADMIN_EMAIL_PROPERTY)) {
      PropertiesService.getScriptProperties().setProperty(ADMIN_EMAIL_PROPERTY, email);
    }

    return json_({ ok: true, message: '회원가입이 완료되었습니다.', token: createSession_(id), user: { id, name, email } });
  } finally {
    lock.releaseLock();
  }
}

function bootstrapAdmin_(data) {
  const properties = PropertiesService.getScriptProperties();
  const setupSecret = String(properties.getProperty('ADMIN_SETUP_SECRET') || '');
  if (!setupSecret || String(data.setupSecret || '') !== setupSecret) return json_({ ok: false, message: '관리자 초기화 권한이 없습니다.' });
  const name = String(data.name || '').trim();
  const email = String(data.email || '').trim().toLowerCase();
  const password = String(data.password || '');
  if (!name || !EMAIL_PATTERN.test(email) || password.length < 8) return json_({ ok: false, message: '관리자 계정 정보를 확인하세요.' });
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const users = sheet_(USERS_SHEET); const rows = users.getDataRange().getValues();
    const index = rows.findIndex(row => String(row[2]).toLowerCase() === email);
    const salt = Utilities.getUuid(); const passwordHash = hash_(password, salt);
    if (index >= 1) users.getRange(index + 1, 2, 1, 4).setValues([[name, email, passwordHash, salt]]);
    else users.appendRow([Utilities.getUuid(), name, email, passwordHash, salt, new Date().toISOString()]);
    properties.setProperty(ADMIN_EMAIL_PROPERTY, email);
    return json_({ ok: true, message: '관리자 계정이 저장되었습니다.' });
  } finally {
    lock.releaseLock();
  }
}

function login_(data) {
  const email = String(data.email || '').trim().toLowerCase();
  const password = String(data.password || '');
  if (!EMAIL_PATTERN.test(email) || !password) return json_({ ok: false, message: '이메일과 비밀번호를 입력하세요.' });
  const rows = sheet_(USERS_SHEET).getDataRange().getValues();
  const user = rows.slice(1).find(row => String(row[2]).toLowerCase() === email);

  if (!user || hash_(password, user[4]) !== user[3]) {
    return json_({ ok: false, message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
  }

  return json_({ ok: true, message: '로그인되었습니다.', token: createSession_(user[0]), user: { id: user[0], name: user[1], email: user[2] } });
}

function getUser_(token) {
  const session = validSession_(token);
  if (!session) return json_({ ok: false, message: '로그인이 필요합니다.' });

  const rows = sheet_(USERS_SHEET).getDataRange().getValues();
  const user = rows.slice(1).find(row => String(row[0]) === String(session.userId));
  if (!user) return json_({ ok: false, message: '사용자를 찾을 수 없습니다.' });

  return json_({ ok: true, user: { id: user[0], name: user[1], email: user[2] } });
}

function logout_(token) {
  const sessions = sheet_(SESSIONS_SHEET);
  const rows = sessions.getDataRange().getValues();
  for (let i = rows.length - 1; i >= 1; i--) {
    if (String(rows[i][0]) === String(token)) sessions.deleteRow(i + 1);
  }
  return json_({ ok: true, message: '로그아웃되었습니다.' });
}

function subscribe_(data) {
  const email = String(data.email || '').trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) return json_({ ok: false, message: '올바른 이메일 주소를 입력하세요.' });
  const sheet = sheet_(SUBSCRIBERS_SHEET);
  const exists = sheet.getDataRange().getValues().slice(1).some(row => String(row[0]).toLowerCase() === email);
  if (!exists) sheet.appendRow([email, new Date().toISOString()]);
  return json_({ ok: true, message: '구독 신청이 완료되었습니다.' });
}

function createPost_(data) {
  const session = validSession_(data.token);
  if (!session) return json_({ ok: false, message: '로그인이 필요합니다.' });
  const title = String(data.title || '').trim();
  const content = String(data.content || '').trim();
  const category = String(data.category || '').trim();
  if (!title || !content || !category) return json_({ ok: false, message: '카테고리, 제목, 내용을 입력하세요.' });
  const now = new Date().toISOString();
  const post = { id: Utilities.getUuid(), userId: session.userId, title, content, category, createdAt: now, updatedAt: now, visibility: 'public' };
  sheet_(POSTS_SHEET).appendRow([post.id, post.userId, post.title, post.content, post.category, post.createdAt, post.updatedAt, post.visibility]);
  return json_({ ok: true, post });
}

function postFromRow_(row) {
  return { id: row[0], userId: row[1], title: row[2], content: row[3], category: row[4], createdAt: row[5], updatedAt: row[6], visibility: row[7] || 'public', viewCount: Number(row[8] || 0), likeCount: Number(row[9] || 0), dislikeCount: Number(row[10] || 0) };
}

function viewPost_(id) {
  const sheet = sheet_(POSTS_SHEET); const rows = sheet.getDataRange().getValues();
  const index = rows.findIndex(row => String(row[0]) === String(id));
  if (index < 1) return json_({ ok: false, message: 'Post not found.' });
  const count = Number(rows[index][8] || 0) + 1;
  sheet.getRange(index + 1, 9).setValue(count);
  return json_({ ok: true, viewCount: count });
}

function reactPost_(data) {
  const session = validSession_(data.token);
  if (!session) return json_({ ok: false, message: 'Login required.' });
  const value = String(data.value || '');
  if (!['like', 'dislike'].includes(value)) return json_({ ok: false, message: 'Invalid reaction.' });
  const sheet = sheet_(REACTIONS_SHEET); const rows = sheet.getDataRange().getValues();
  const index = rows.findIndex(row => String(row[1]) === String(data.id) && String(row[2]) === String(session.userId));
  if (index >= 1) { if (String(rows[index][3]) === value) sheet.deleteRow(index + 1); else sheet.getRange(index + 1, 4).setValue(value); }
  else sheet.appendRow([Utilities.getUuid(), data.id, session.userId, value, new Date().toISOString()]);
  const updated = sheet.getDataRange().getValues().slice(1).filter(row => String(row[1]) === String(data.id));
  const mine = updated.find(row => String(row[2]) === String(session.userId));
  return json_({ ok: true, likeCount: updated.filter(row => row[3] === 'like').length, dislikeCount: updated.filter(row => row[3] === 'dislike').length, myReaction: mine ? mine[3] : null });
}

function listPosts_(token) {
  const rows = sheet_(POSTS_SHEET).getDataRange().getValues();
  const users = sheet_(USERS_SHEET).getDataRange().getValues().slice(1);
  const namesByUserId = new Map(users.map(row => [String(row[0]), row[1]]));
  const session = validSession_(token);
  const isAdmin = Boolean(adminUser_(token));
  const posts = rows.slice(1).filter(row => String(row[7] || 'public') === 'public' || isAdmin || (session && String(row[1]) === String(session.userId))).map(row => ({ ...postFromRow_(row), authorName: namesByUserId.get(String(row[1])) || '' })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return json_({ ok: true, posts });
}

function getPost_(id, token) {
  const rows = sheet_(POSTS_SHEET).getDataRange().getValues();
  const row = rows.slice(1).find(item => String(item[0]) === String(id));
  if (!row) return json_({ ok: false, message: '게시글을 찾을 수 없습니다.' });
  const session = validSession_(token);
  if (String(row[7] || 'public') === 'private' && !adminUser_(token) && (!session || String(row[1]) !== String(session.userId))) return json_({ ok: false, message: '게시글을 찾을 수 없습니다.' });
  const user = sheet_(USERS_SHEET).getDataRange().getValues().slice(1).find(item => String(item[0]) === String(row[1]));
  return json_({ ok: true, post: { ...postFromRow_(row), authorName: user ? user[1] : '' } });
}

function updatePost_(data) {
  const session = validSession_(data.token);
  if (!session) return json_({ ok: false, message: '로그인이 필요합니다.' });
  const sheet = sheet_(POSTS_SHEET); const rows = sheet.getDataRange().getValues();
  const index = rows.findIndex(row => String(row[0]) === String(data.id));
  if (index < 1) return json_({ ok: false, message: '게시글을 찾을 수 없습니다.' });
  if (String(rows[index][1]) !== String(session.userId)) return json_({ ok: false, message: '수정 권한이 없습니다.' });
  const title = String(data.title || '').trim(); const content = String(data.content || '').trim();
  const category = String(data.category || '').trim();
  if (!title || !content || !category) return json_({ ok: false, message: '카테고리, 제목, 내용을 입력하세요.' });
  sheet.getRange(index + 1, 3, 1, 5).setValues([[title, content, category, rows[index][5], new Date().toISOString()]]);
  return json_({ ok: true, message: '게시글이 수정되었습니다.' });
}

function deletePost_(data) {
  const session = validSession_(data.token);
  if (!session) return json_({ ok: false, message: '로그인이 필요합니다.' });
  const sheet = sheet_(POSTS_SHEET); const rows = sheet.getDataRange().getValues();
  const index = rows.findIndex(row => String(row[0]) === String(data.id));
  if (index < 1) return json_({ ok: false, message: '게시글을 찾을 수 없습니다.' });
  if (String(rows[index][1]) !== String(session.userId)) return json_({ ok: false, message: '삭제 권한이 없습니다.' });
  sheet.deleteRow(index + 1);
  return json_({ ok: true, message: '게시글이 삭제되었습니다.' });
}

function listComments_(postId) {
  if (!postId) return json_({ ok: true, comments: [] });
  const rows = sheet_(COMMENTS_SHEET).getDataRange().getValues();
  const users = sheet_(USERS_SHEET).getDataRange().getValues().slice(1);
  const comments = rows.slice(1).filter(row => String(row[1]) === String(postId) && String(row[5] || 'public') === 'public').map(row => {
    const user = users.find(item => String(item[0]) === String(row[2]));
    return { id: row[0], postId: row[1], userId: row[2], name: user ? user[1] : '회원', content: row[3], createdAt: row[4] };
  });
  return json_({ ok: true, comments });
}

function createComment_(data) {
  const session = validSession_(data.token);
  if (!session) return json_({ ok: false, message: '로그인이 필요합니다.' });
  const postId = String(data.postId || '').trim();
  const content = String(data.content || '').trim();
  if (!postId || !content) return json_({ ok: false, message: '댓글 내용을 입력하세요.' });
  if (content.length > 500) return json_({ ok: false, message: '댓글은 500자 이하로 입력하세요.' });
  const postRows = sheet_(POSTS_SHEET).getDataRange().getValues();
  if (!postRows.slice(1).some(row => String(row[0]) === postId)) return json_({ ok: false, message: '게시글을 찾을 수 없습니다.' });
  const comment = { id: Utilities.getUuid(), postId, userId: session.userId, content, createdAt: new Date().toISOString() };
  sheet_(COMMENTS_SHEET).appendRow([comment.id, comment.postId, comment.userId, comment.content, comment.createdAt, 'public']);
  return json_({ ok: true, comment });
}

function deleteComment_(data) {
  const session = validSession_(data.token);
  if (!session) return json_({ ok: false, message: '로그인이 필요합니다.' });
  const sheet = sheet_(COMMENTS_SHEET); const rows = sheet.getDataRange().getValues();
  const index = rows.findIndex(row => String(row[0]) === String(data.id));
  if (index < 1) return json_({ ok: false, message: '댓글을 찾을 수 없습니다.' });
  if (String(rows[index][2]) !== String(session.userId)) return json_({ ok: false, message: '삭제 권한이 없습니다.' });
  sheet.deleteRow(index + 1);
  return json_({ ok: true, message: '댓글을 삭제했습니다.' });
}

function adminUser_(token) {
  const session = validSession_(token);
  if (!session) return null;
  const user = sheet_(USERS_SHEET).getDataRange().getValues().slice(1).find(row => String(row[0]) === String(session.userId));
  const adminEmail = String(PropertiesService.getScriptProperties().getProperty(ADMIN_EMAIL_PROPERTY) || '').trim().toLowerCase();
  return user && adminEmail && String(user[2]).toLowerCase() === adminEmail ? user : null;
}

function adminDashboard_(token) {
  if (!adminUser_(token)) return json_({ ok: false, message: '관리자 권한이 필요합니다.' });
  const users = sheet_(USERS_SHEET).getDataRange().getValues().slice(1);
  const posts = sheet_(POSTS_SHEET).getDataRange().getValues().slice(1);
  const comments = sheet_(COMMENTS_SHEET).getDataRange().getValues().slice(1);
  const userNames = new Map(users.map(row => [String(row[0]), row[1]]));
  const postTitles = new Map(posts.map(row => [String(row[0]), row[2]]));
  return json_({ ok: true,
    stats: { users: users.length, posts: posts.length, comments: comments.length },
    users: users.map(row => ({ id: row[0], name: row[1], email: row[2], createdAt: row[5] })),
    posts: posts.map(row => ({ id: row[0], title: row[2], category: row[4], createdAt: row[5], visibility: row[7] || 'public', authorName: userNames.get(String(row[1])) || '' })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    comments: comments.map(row => ({ id: row[0], postId: row[1], content: row[3], createdAt: row[4], authorName: userNames.get(String(row[2])) || '', postTitle: postTitles.get(String(row[1])) || '삭제된 게시글' })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  });
}

function adminDeletePost_(token, id) {
  if (!adminUser_(token)) return json_({ ok: false, message: '관리자 권한이 필요합니다.' });
  const posts = sheet_(POSTS_SHEET); const rows = posts.getDataRange().getValues();
  const index = rows.findIndex(row => String(row[0]) === String(id));
  if (index < 1) return json_({ ok: false, message: '게시글을 찾을 수 없습니다.' });
  posts.deleteRow(index + 1);
  const comments = sheet_(COMMENTS_SHEET); const commentRows = comments.getDataRange().getValues();
  for (let i = commentRows.length - 1; i >= 1; i--) if (String(commentRows[i][1]) === String(id)) comments.deleteRow(i + 1);
  return json_({ ok: true });
}

function adminDeleteComment_(token, id) {
  if (!adminUser_(token)) return json_({ ok: false, message: '관리자 권한이 필요합니다.' });
  const comments = sheet_(COMMENTS_SHEET); const rows = comments.getDataRange().getValues();
  const index = rows.findIndex(row => String(row[0]) === String(id));
  if (index < 1) return json_({ ok: false, message: '댓글을 찾을 수 없습니다.' });
  comments.deleteRow(index + 1);
  return json_({ ok: true });
}

function adminSetCommentVisibility_(token, id, visibility) {
  if (!adminUser_(token)) return json_({ ok: false, message: 'Admin permission required.' });
  if (!['public', 'private'].includes(visibility)) return json_({ ok: false, message: 'Invalid visibility.' });
  const comments = sheet_(COMMENTS_SHEET); const rows = comments.getDataRange().getValues();
  const index = rows.findIndex(row => String(row[0]) === String(id));
  if (index < 1) return json_({ ok: false, message: 'Comment not found.' });
  comments.getRange(index + 1, 6).setValue(visibility);
  return json_({ ok: true, visibility });
}

function adminSetPostVisibility_(token, id, visibility) {
  if (!adminUser_(token)) return json_({ ok: false, message: '관리자 권한이 필요합니다.' });
  if (!['public', 'private'].includes(visibility)) return json_({ ok: false, message: '공개 상태 값이 올바르지 않습니다.' });
  const posts = sheet_(POSTS_SHEET); const rows = posts.getDataRange().getValues();
  const index = rows.findIndex(row => String(row[0]) === String(id));
  if (index < 1) return json_({ ok: false, message: '게시글을 찾을 수 없습니다.' });
  posts.getRange(index + 1, 8).setValue(visibility);
  return json_({ ok: true, visibility });
}

function createSession_(userId) {
  const token = Utilities.getUuid() + Utilities.getUuid();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000);
  sheet_(SESSIONS_SHEET).appendRow([token, userId, expiresAt.toISOString(), new Date().toISOString()]);
  return token;
}

function validSession_(token) {
  if (!token) return null;
  const rows = sheet_(SESSIONS_SHEET).getDataRange().getValues();
  const session = rows.slice(1).find(row => String(row[0]) === String(token));
  if (!session || new Date(session[2]).getTime() < Date.now()) return null;
  return { userId: session[1] };
}

function hash_(password, salt) {
  const pepper = PropertiesService.getScriptProperties().getProperty('PASSWORD_PEPPER');
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, `${salt}:${password}:${pepper}`, Utilities.Charset.UTF_8);
  return bytes.map(byte => (byte + 256) % 256).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function sheet_(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error('필요한 시트가 생성되지 않았습니다.');
  return sheet;
}

function ensureSetup_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  createSheet_(ss, USERS_SHEET, ['id', 'name', 'email', 'passwordHash', 'salt', 'createdAt']);
  createSheet_(ss, SESSIONS_SHEET, ['token', 'userId', 'expiresAt', 'createdAt']);
  createSheet_(ss, POSTS_SHEET, ['id', 'userId', 'title', 'content', 'category', 'createdAt', 'updatedAt', 'visibility', 'viewCount', 'likeCount', 'dislikeCount']);
  ensurePostVisibilityColumn_();
  createSheet_(ss, SUBSCRIBERS_SHEET, ['email', 'createdAt']);
  createSheet_(ss, COMMENTS_SHEET, ['id', 'postId', 'userId', 'content', 'createdAt', 'visibility']);
  createSheet_(ss, REACTIONS_SHEET, ['id', 'postId', 'userId', 'value', 'createdAt']);
  ensurePostMetricsColumns_();
  ensureCommentVisibilityColumn_();

  const properties = PropertiesService.getScriptProperties();
  if (!properties.getProperty('PASSWORD_PEPPER')) {
    properties.setProperty('PASSWORD_PEPPER', Utilities.getUuid() + Utilities.getUuid());
  }

  // 기존 Users 시트가 이미 있는 경우에도 최초 사용자를 관리자 계정으로 보정합니다.
  if (!properties.getProperty(ADMIN_EMAIL_PROPERTY)) {
    const users = ss.getSheetByName(USERS_SHEET);
    if (users && users.getLastRow() > 1) {
      const firstEmail = String(users.getRange(2, 3).getValue()).trim().toLowerCase();
      if (firstEmail) properties.setProperty(ADMIN_EMAIL_PROPERTY, firstEmail);
    }
  }
}

function createSheet_(ss, name, headers) {
  if (ss.getSheetByName(name)) return;
  const sheet = ss.insertSheet(name);
  sheet.appendRow(headers);
  sheet.setFrozenRows(1);
}

function ensurePostVisibilityColumn_() {
  const sheet = sheet_(POSTS_SHEET);
  if (sheet.getLastColumn() < 8 || sheet.getRange(1, 8).getValue() !== 'visibility') sheet.getRange(1, 8).setValue('visibility');
  const rows = sheet.getLastRow();
  if (rows > 1) {
    const range = sheet.getRange(2, 8, rows - 1, 1);
    range.setValues(range.getValues().map(row => [row[0] || 'public']));
  }
}

function ensurePostMetricsColumns_() {
  const sheet = sheet_(POSTS_SHEET);
  ['visibility', 'viewCount', 'likeCount', 'dislikeCount'].forEach((header, index) => {
    const column = 8 + index;
    if (sheet.getRange(1, column).getValue() !== header) sheet.getRange(1, column).setValue(header);
  });
  if (sheet.getLastRow() > 1) {
    for (let column = 9; column <= 11; column++) {
      const range = sheet.getRange(2, column, sheet.getLastRow() - 1, 1);
      range.setValues(range.getValues().map(row => [Number(row[0] || 0)]));
    }
  }
}

function ensureCommentVisibilityColumn_() {
  const sheet = sheet_(COMMENTS_SHEET);
  if (sheet.getRange(1, 6).getValue() !== 'visibility') sheet.getRange(1, 6).setValue('visibility');
  if (sheet.getLastRow() > 1) {
    const range = sheet.getRange(2, 6, sheet.getLastRow() - 1, 1);
    range.setValues(range.getValues().map(row => [row[0] || 'public']));
  }
}

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
