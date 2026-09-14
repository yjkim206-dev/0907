const USERS_SHEET = 'Users';
const SESSIONS_SHEET = 'Sessions';
const SESSION_DAYS = 7;
const POSTS_SHEET = 'Posts';

// 최초 1회 실행: 회원·세션 시트와 비밀번호 해싱용 비밀값을 생성합니다.
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  createSheet_(ss, USERS_SHEET, ['id', 'name', 'email', 'passwordHash', 'salt', 'createdAt']);
  createSheet_(ss, SESSIONS_SHEET, ['token', 'userId', 'expiresAt', 'createdAt']);
  createSheet_(ss, POSTS_SHEET, ['id', 'userId', 'title', 'content', 'category', 'createdAt', 'updatedAt']);

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
    if (data.action === 'post_list') return listPosts_();
    if (data.action === 'post_get') return getPost_(data.id);
    if (data.action === 'post_update') return updatePost_(data);
    if (data.action === 'post_delete') return deletePost_(data);
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
  if (password.length < 8) return json_({ ok: false, message: '비밀번호는 8자 이상이어야 합니다.' });

  const users = sheet_(USERS_SHEET);
  const rows = users.getDataRange().getValues();
  if (rows.slice(1).some(row => String(row[2]).toLowerCase() === email)) {
    return json_({ ok: false, message: '이미 가입된 이메일입니다.' });
  }

  const id = Utilities.getUuid();
  const salt = Utilities.getUuid();
  users.appendRow([id, name, email, hash_(password, salt), salt, new Date().toISOString()]);

  return json_({ ok: true, message: '회원가입이 완료되었습니다.', token: createSession_(id), user: { id, name, email } });
}

function login_(data) {
  const email = String(data.email || '').trim().toLowerCase();
  const password = String(data.password || '');
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

function createPost_(data) {
  const session = validSession_(data.token);
  if (!session) return json_({ ok: false, message: '로그인이 필요합니다.' });
  const title = String(data.title || '').trim();
  const content = String(data.content || '').trim();
  const category = String(data.category || 'Note').trim();
  if (!title || !content) return json_({ ok: false, message: '제목과 내용을 입력하세요.' });
  const now = new Date().toISOString();
  const post = { id: Utilities.getUuid(), userId: session.userId, title, content, category, createdAt: now, updatedAt: now };
  sheet_(POSTS_SHEET).appendRow([post.id, post.userId, post.title, post.content, post.category, post.createdAt, post.updatedAt]);
  return json_({ ok: true, post });
}

function postFromRow_(row) {
  return { id: row[0], userId: row[1], title: row[2], content: row[3], category: row[4], createdAt: row[5], updatedAt: row[6] };
}

function listPosts_() {
  const rows = sheet_(POSTS_SHEET).getDataRange().getValues();
  const posts = rows.slice(1).map(postFromRow_).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return json_({ ok: true, posts });
}

function getPost_(id) {
  const rows = sheet_(POSTS_SHEET).getDataRange().getValues();
  const row = rows.slice(1).find(item => String(item[0]) === String(id));
  return row ? json_({ ok: true, post: postFromRow_(row) }) : json_({ ok: false, message: '게시글을 찾을 수 없습니다.' });
}

function updatePost_(data) {
  const session = validSession_(data.token);
  if (!session) return json_({ ok: false, message: '로그인이 필요합니다.' });
  const sheet = sheet_(POSTS_SHEET); const rows = sheet.getDataRange().getValues();
  const index = rows.findIndex(row => String(row[0]) === String(data.id));
  if (index < 1) return json_({ ok: false, message: '게시글을 찾을 수 없습니다.' });
  if (String(rows[index][1]) !== String(session.userId)) return json_({ ok: false, message: '수정 권한이 없습니다.' });
  const title = String(data.title || '').trim(); const content = String(data.content || '').trim();
  if (!title || !content) return json_({ ok: false, message: '제목과 내용을 입력하세요.' });
  sheet.getRange(index + 1, 3, 1, 5).setValues([[title, content, String(data.category || 'Note').trim(), rows[index][5], new Date().toISOString()]]);
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
  createSheet_(ss, POSTS_SHEET, ['id', 'userId', 'title', 'content', 'category', 'createdAt', 'updatedAt']);

  const properties = PropertiesService.getScriptProperties();
  if (!properties.getProperty('PASSWORD_PEPPER')) {
    properties.setProperty('PASSWORD_PEPPER', Utilities.getUuid() + Utilities.getUuid());
  }
}

function createSheet_(ss, name, headers) {
  if (ss.getSheetByName(name)) return;
  const sheet = ss.insertSheet(name);
  sheet.appendRow(headers);
  sheet.setFrozenRows(1);
}

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
