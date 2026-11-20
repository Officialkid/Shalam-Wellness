/**
 * Shalam Wellness — Cloudflare Worker API backed by Cloudflare R2
 *
 * R2 Binding required: BLOG_BUCKET
 * Secrets required:
 *   - JWT_SECRET         (any long random string)
 *   - ADMIN_INVITE_CODE  (a code you give Clare when creating her account)
 */

const POSTS_KEY = 'data/posts.json';
const USERS_KEY = 'data/users.json';

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
  };
}

function json(data, status = 200, request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(request)
    }
  });
}

// === CRYPTO HELPERS (Web Crypto API — zero dependencies) ===
function toHex(buffer) {
  return [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function base64UrlEncode(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  return atob(padded);
}

async function hashPassword(password, saltHex) {
  const salt = saltHex || toHex(crypto.getRandomValues(new Uint8Array(16)));
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return { salt, hash: toHex(bits) };
}

async function signJwt(payload, secret) {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64UrlEncode(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30 }));
  const data = `${header}.${body}`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${data}.${sigB64}`;
}

async function verifyJwt(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const sigBytes = Uint8Array.from(base64UrlDecode(sig), c => c.charCodeAt(0));
    const ok = await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(`${header}.${body}`));
    if (!ok) return null;
    const payload = JSON.parse(base64UrlDecode(body));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch (_) {
    return null;
  }
}

async function requireAuth(request, env) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  return await verifyJwt(auth.slice(7), env.JWT_SECRET);
}

// === R2 JSON HELPERS ===
async function readJson(bucket, key, fallback) {
  const obj = await bucket.get(key);
  if (!obj) return fallback;
  try {
    return await obj.json();
  } catch (_) {
    return fallback;
  }
}

async function writeJson(bucket, key, data) {
  await bucket.put(key, JSON.stringify(data, null, 2), {
    httpMetadata: { contentType: 'application/json' }
  });
}

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || `post-${Date.now()}`;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // 1. SERVE IMAGES FROM R2: GET /media/<key>
      if (request.method === 'GET' && path.startsWith('/media/')) {
        const key = path.slice(1); // media/...
        const obj = await env.BLOG_BUCKET.get(key);
        if (!obj) return new Response('Not found', { status: 404, headers: corsHeaders(request) });
        const headers = new Headers(corsHeaders(request));
        obj.writeHttpMetadata(headers);
        headers.set('Cache-Control', 'public, max-age=31536000, immutable');
        return new Response(obj.body, { headers });
      }

      // 2. PUBLIC: GET /api/posts
      if (request.method === 'GET' && path === '/api/posts') {
        const posts = await readJson(env.BLOG_BUCKET, POSTS_KEY, []);
        return json({ posts }, 200, request);
      }

      // 3. AUTH: POST /api/auth/register
      if (request.method === 'POST' && path === '/api/auth/register') {
        const body = await request.json();
        const name = (body.name || '').trim();
        const email = (body.email || '').trim().toLowerCase();
        const password = body.password || '';
        const inviteCode = (body.inviteCode || '').trim();

        if (env.ADMIN_INVITE_CODE && inviteCode !== env.ADMIN_INVITE_CODE) {
          return json({ error: 'Invalid Admin Setup Code.' }, 403, request);
        }
        if (!name || !email || password.length < 6) {
          return json({ error: 'Name, email, and a password (min 6 chars) are required.' }, 400, request);
        }

        const users = await readJson(env.BLOG_BUCKET, USERS_KEY, []);
        if (users.some(u => u.email === email)) {
          return json({ error: 'An account with this email already exists.' }, 409, request);
        }

        const { salt, hash } = await hashPassword(password);
        const newUser = { id: `u-${Date.now()}`, name, email, salt, hash, createdAt: new Date().toISOString() };
        users.push(newUser);
        await writeJson(env.BLOG_BUCKET, USERS_KEY, users);

        const token = await signJwt({ sub: newUser.id, email: newUser.email, name: newUser.name }, env.JWT_SECRET);
        return json({ token, user: { id: newUser.id, name: newUser.name, email: newUser.email } }, 201, request);
      }

      // 4. AUTH: POST /api/auth/login
      if (request.method === 'POST' && path === '/api/auth/login') {
        const body = await request.json();
        const email = (body.email || '').trim().toLowerCase();
        const password = body.password || '';

        const users = await readJson(env.BLOG_BUCKET, USERS_KEY, []);
        const user = users.find(u => u.email === email);
        if (!user) return json({ error: 'Invalid email or password.' }, 401, request);

        const { hash } = await hashPassword(password, user.salt);
        if (hash !== user.hash) return json({ error: 'Invalid email or password.' }, 401, request);

        const token = await signJwt({ sub: user.id, email: user.email, name: user.name }, env.JWT_SECRET);
        return json({ token, user: { id: user.id, name: user.name, email: user.email } }, 200, request);
      }

      // 5. PROTECTED: POST /api/upload (uploads cover image to R2)
      if (request.method === 'POST' && path === '/api/upload') {
        const authUser = await requireAuth(request, env);
        if (!authUser) return json({ error: 'Unauthorized' }, 401, request);

        const formData = await request.formData();
        const file = formData.get('file');
        if (!file || typeof file === 'string') {
          return json({ error: 'No image file provided.' }, 400, request);
        }

        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
        const key = `media/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        await env.BLOG_BUCKET.put(key, file.stream(), {
          httpMetadata: { contentType: file.type || 'image/jpeg' }
        });

        const publicUrl = `${url.origin}/${key}`;
        return json({ url: publicUrl, key }, 201, request);
      }

      // 6. PROTECTED: POST /api/posts (create post)
      if (request.method === 'POST' && path === '/api/posts') {
        const authUser = await requireAuth(request, env);
        if (!authUser) return json({ error: 'Unauthorized' }, 401, request);

        const body = await request.json();
        const posts = await readJson(env.BLOG_BUCKET, POSTS_KEY, []);
        const newPost = {
          id: `post-${Date.now()}`,
          slug: `${slugify(body.title)}-${Date.now().toString().slice(-4)}`,
          title: (body.title || '').trim(),
          category: body.category || 'Mental Wellness',
          excerpt: (body.excerpt || '').trim(),
          content: body.content || '',
          coverImage: body.coverImage || '',
          author: body.author || authUser.name || 'Clare Wamaitha',
          createdAt: new Date().toISOString()
        };
        posts.unshift(newPost);
        await writeJson(env.BLOG_BUCKET, POSTS_KEY, posts);
        return json({ post: newPost }, 201, request);
      }

      // 7. PROTECTED: PUT /api/posts/:id (update post)
      if (request.method === 'PUT' && path.startsWith('/api/posts/')) {
        const authUser = await requireAuth(request, env);
        if (!authUser) return json({ error: 'Unauthorized' }, 401, request);

        const id = decodeURIComponent(path.slice('/api/posts/'.length));
        const body = await request.json();
        const posts = await readJson(env.BLOG_BUCKET, POSTS_KEY, []);
        const idx = posts.findIndex(p => p.id === id);
        if (idx === -1) return json({ error: 'Post not found.' }, 404, request);

        posts[idx] = {
          ...posts[idx],
          title: (body.title || posts[idx].title).trim(),
          category: body.category || posts[idx].category,
          excerpt: (body.excerpt || posts[idx].excerpt).trim(),
          content: body.content !== undefined ? body.content : posts[idx].content,
          coverImage: body.coverImage || posts[idx].coverImage,
          updatedAt: new Date().toISOString()
        };
        await writeJson(env.BLOG_BUCKET, POSTS_KEY, posts);
        return json({ post: posts[idx] }, 200, request);
      }

      // 8. PROTECTED: DELETE /api/posts/:id (delete post)
      if (request.method === 'DELETE' && path.startsWith('/api/posts/')) {
        const authUser = await requireAuth(request, env);
        if (!authUser) return json({ error: 'Unauthorized' }, 401, request);

        const id = decodeURIComponent(path.slice('/api/posts/'.length));
        const posts = await readJson(env.BLOG_BUCKET, POSTS_KEY, []);
        const filtered = posts.filter(p => p.id !== id);
        await writeJson(env.BLOG_BUCKET, POSTS_KEY, filtered);
        return json({ deleted: true }, 200, request);
      }

      return json({ error: 'Not found' }, 404, request);
    } catch (err) {
      return json({ error: err.message || 'Internal server error' }, 500, request);
    }
  }
};
