/* ============================================
   SHALAM WELLNESS — Blog Studio PWA (admin.js)
   Works with Cloudflare R2 Worker API + Local Preview Mode
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  const CFG = window.SHALAM_BLOG_CONFIG || { API_BASE_URL: '' };
  const IS_LIVE = Boolean(CFG.API_BASE_URL);
  const TOKEN_KEY = 'sw_admin_token_v1';
  const USER_KEY = 'sw_admin_user_v1';
  const LOCAL_USERS_KEY = 'sw_blog_users_v1';
  const LOCAL_POSTS_KEY = 'sw_blog_posts_v1';

  // Register Service Worker for PWA installability
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/blog-admin/sw.js', { scope: '/blog-admin/' }).catch(() => {});
  }

  // PWA Install prompt handling (visible immediately on mobile & desktop unless already installed)
  let deferredPrompt = null;
  const pwaInstallBar = document.getElementById('pwaInstallBar');
  const pwaInstallText = document.getElementById('pwaInstallText');
  const installPwaBtn = document.getElementById('installPwaBtn');
  const dismissPwaBtn = document.getElementById('dismissPwaBtn');

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);

  if (isStandalone && pwaInstallBar) {
    pwaInstallBar.hidden = true;
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (pwaInstallBar) pwaInstallBar.hidden = false;
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    if (pwaInstallBar) pwaInstallBar.hidden = true;
  });

  if (installPwaBtn) {
    installPwaBtn.addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice && choice.outcome === 'accepted') {
          deferredPrompt = null;
          pwaInstallBar.hidden = true;
        }
      } else if (isIos) {
        if (pwaInstallText) {
          pwaInstallText.innerHTML = 'On iPhone/iPad: tap the <strong>Share (⎋)</strong> button at the bottom of Safari, then tap <strong>Add to Home Screen</strong>.';
        }
        installPwaBtn.textContent = 'Got it';
      } else {
        if (pwaInstallText) {
          pwaInstallText.innerHTML = 'Tap your browser menu (<strong>⋮</strong>) and select <strong>Install app</strong> or <strong>Add to Home screen</strong>.';
        }
        installPwaBtn.textContent = 'Got it';
      }
    });
  }
  if (dismissPwaBtn) {
    dismissPwaBtn.addEventListener('click', () => { pwaInstallBar.hidden = true; });
  }

  // Elements
  const authScreen = document.getElementById('authScreen');
  const dashboard = document.getElementById('dashboard');
  const modeBadge = document.getElementById('modeBadge');
  const inviteCodeField = document.getElementById('inviteCodeField');
  const authTabs = document.querySelectorAll('.auth-tab');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const loginError = document.getElementById('loginError');
  const registerError = document.getElementById('registerError');
  const dashUserLabel = document.getElementById('dashUserLabel');
  const logoutBtn = document.getElementById('logoutBtn');

  const tabEditor = document.getElementById('tabEditor');
  const tabPosts = document.getElementById('tabPosts');
  const editorView = document.getElementById('editorView');
  const postsView = document.getElementById('postsView');
  const postCount = document.getElementById('postCount');
  const adminPostsList = document.getElementById('adminPostsList');

  const postForm = document.getElementById('postForm');
  const editingPostId = document.getElementById('editingPostId');
  const editorHeading = document.getElementById('editorHeading');
  const cancelEditBtn = document.getElementById('cancelEditBtn');
  const uploadZone = document.getElementById('uploadZone');
  const coverFileInput = document.getElementById('coverFileInput');
  const uploadPlaceholder = document.getElementById('uploadPlaceholder');
  const uploadPreview = document.getElementById('uploadPreview');
  const coverPreviewImg = document.getElementById('coverPreviewImg');
  const changeImgBtn = document.getElementById('changeImgBtn');
  const postTitle = document.getElementById('postTitle');
  const postCategory = document.getElementById('postCategory');
  const postExcerpt = document.getElementById('postExcerpt');
  const postEditor = document.getElementById('postEditor');
  const publishStatus = document.getElementById('publishStatus');
  const publishBtn = document.getElementById('publishBtn');

  let selectedFile = null;
  let currentCoverUrl = '';
  let cachedPosts = [];

  if (modeBadge) {
    modeBadge.textContent = IS_LIVE
      ? '☁️ Connected to Cloudflare R2 Storage'
      : '🧪 Local Preview Mode (connect Cloudflare Worker in blog-config.js to go live)';
  }
  if (!IS_LIVE && inviteCodeField) {
    // In local preview mode, invite code is optional
    inviteCodeField.querySelector('label').textContent = 'Admin Setup Code (optional in local preview)';
  }

  // Auth tabs
  authTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      authTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const isLogin = tab.dataset.tab === 'login';
      loginForm.hidden = !isLogin;
      registerForm.hidden = isLogin;
      loginError.hidden = true;
      registerError.hidden = true;
    });
  });

  // Helper: slugify
  function slugify(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || `post-${Date.now()}`;
  }

  function stripHtml(html) {
    return String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
  }

  function resolvePreviewImg(src) {
    if (!src) return '../image/Clare-photo-1.jpeg';
    if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) return src;
    if (IS_LIVE && src.startsWith('/media/')) return `${CFG.API_BASE_URL}${src}`;
    if (src.startsWith('image/')) return `../${src}`;
    return src;
  }

  function getAuthToken() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function getCurrentUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch (_) { return null; }
  }

  function setSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  // Local Preview Auth Helpers
  function getLocalUsers() {
    try { return JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || '[]'); } catch (_) { return []; }
  }

  function getLocalPosts() {
    try { return JSON.parse(localStorage.getItem(LOCAL_POSTS_KEY) || '[]'); } catch (_) { return []; }
  }

  function saveLocalPosts(posts) {
    localStorage.setItem(LOCAL_POSTS_KEY, JSON.stringify(posts));
  }

  // Register
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    registerError.hidden = true;
    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim().toLowerCase();
    const password = document.getElementById('regPassword').value;
    const inviteCode = document.getElementById('regInviteCode').value.trim();

    if (!name || !email || password.length < 6) {
      registerError.textContent = 'Please fill in your name, email, and a password of at least 6 characters.';
      registerError.hidden = false;
      return;
    }

    const btn = document.getElementById('registerSubmitBtn');
    btn.disabled = true;
    btn.textContent = 'Creating account...';

    try {
      if (IS_LIVE) {
        const res = await fetch(`${CFG.API_BASE_URL}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password, inviteCode })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not create account.');
        setSession(data.token, data.user);
      } else {
        const users = getLocalUsers();
        if (users.some(u => u.email === email)) {
          throw new Error('An account with this email already exists. Please sign in.');
        }
        const user = { id: `u-${Date.now()}`, name, email, password };
        users.push(user);
        localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
        setSession(`local-token-${Date.now()}`, { name, email });
      }
      enterDashboard();
    } catch (err) {
      registerError.textContent = err.message;
      registerError.hidden = false;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Create Admin Account';
    }
  });

  // Login
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.hidden = true;
    const email = document.getElementById('loginEmail').value.trim().toLowerCase();
    const password = document.getElementById('loginPassword').value;

    const btn = document.getElementById('loginSubmitBtn');
    btn.disabled = true;
    btn.textContent = 'Signing in...';

    try {
      if (IS_LIVE) {
        const res = await fetch(`${CFG.API_BASE_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Invalid email or password.');
        setSession(data.token, data.user);
      } else {
        const users = getLocalUsers();
        const found = users.find(u => u.email === email && u.password === password);
        if (!found) throw new Error('Invalid email or password. If this is your first time, tap "Create Account".');
        setSession(`local-token-${Date.now()}`, { name: found.name, email: found.email });
      }
      enterDashboard();
    } catch (err) {
      loginError.textContent = err.message;
      loginError.hidden = false;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
  });

  logoutBtn.addEventListener('click', () => {
    clearSession();
    dashboard.hidden = true;
    authScreen.hidden = false;
  });

  // Dashboard views
  function switchView(view) {
    const isEditor = view === 'editor';
    tabEditor.classList.toggle('active', isEditor);
    tabPosts.classList.toggle('active', !isEditor);
    editorView.hidden = !isEditor;
    postsView.hidden = isEditor;
    if (!isEditor) refreshPosts();
  }

  tabEditor.addEventListener('click', () => switchView('editor'));
  tabPosts.addEventListener('click', () => switchView('posts'));
  document.getElementById('newPostFromListBtn').addEventListener('click', () => {
    resetEditor();
    switchView('editor');
  });

  // Toolbar commands
  document.querySelectorAll('.editor-toolbar button').forEach(btn => {
    btn.addEventListener('click', () => {
      const cmd = btn.dataset.cmd;
      const val = btn.dataset.val || null;
      postEditor.focus();
      document.execCommand(cmd, false, val);
    });
  });

  // Cover image picker
  function showPreview(src) {
    coverPreviewImg.src = src;
    uploadPlaceholder.hidden = true;
    uploadPreview.hidden = false;
  }

  function resetImagePicker() {
    selectedFile = null;
    currentCoverUrl = '';
    coverFileInput.value = '';
    coverPreviewImg.src = '';
    uploadPlaceholder.hidden = false;
    uploadPreview.hidden = true;
  }

  function handleFileSelected(file) {
    if (!file || !file.type.startsWith('image/')) return;
    selectedFile = file;
    const reader = new FileReader();
    reader.onload = (ev) => showPreview(ev.target.result);
    reader.readAsDataURL(file);
  }

  uploadZone.addEventListener('click', (e) => {
    if (e.target === changeImgBtn) return;
    coverFileInput.click();
  });
  changeImgBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    coverFileInput.click();
  });
  coverFileInput.addEventListener('change', () => {
    if (coverFileInput.files && coverFileInput.files[0]) {
      handleFileSelected(coverFileInput.files[0]);
    }
  });
  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('dragover');
  });
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  });

  // Compress image slightly for local preview mode so localStorage doesn't overflow
  function fileToCompressedDataUrl(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const maxW = 1000;
          const scale = Math.min(1, maxW / img.width);
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function uploadCoverImage(file) {
    if (IS_LIVE) {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${CFG.API_BASE_URL}/api/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getAuthToken()}` },
        body: fd
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Image upload to Cloudflare R2 failed.');
      return data.url;
    }
    return await fileToCompressedDataUrl(file);
  }

  function showStatus(msg, type) {
    publishStatus.textContent = msg;
    publishStatus.className = `form-status ${type}`;
    publishStatus.hidden = false;
  }

  function resetEditor() {
    editingPostId.value = '';
    postForm.reset();
    postEditor.innerHTML = '';
    resetImagePicker();
    editorHeading.textContent = 'Create a New Blog Post';
    publishBtn.textContent = 'Publish Post to Blog';
    cancelEditBtn.hidden = true;
    publishStatus.hidden = true;
  }

  cancelEditBtn.addEventListener('click', resetEditor);

  // Publish or Update Post
  postForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    publishStatus.hidden = true;

    const title = postTitle.value.trim();
    const category = postCategory.value;
    const contentHtml = postEditor.innerHTML.trim();
    const plainText = stripHtml(contentHtml);

    if (!title || !plainText) {
      showStatus('Please enter a title and write your article content before publishing.', 'error');
      return;
    }

    const excerpt = postExcerpt.value.trim() || (plainText.length > 165 ? plainText.slice(0, 162) + '...' : plainText);
    const user = getCurrentUser();
    const author = (user && user.name) || CFG.DEFAULT_AUTHOR || 'Clare Wamaitha';

    publishBtn.disabled = true;
    publishBtn.textContent = editingPostId.value ? 'Saving changes...' : 'Uploading & Publishing...';

    try {
      let coverImage = currentCoverUrl;
      if (selectedFile) {
        coverImage = await uploadCoverImage(selectedFile);
      }

      const payload = {
        title,
        category,
        excerpt,
        content: contentHtml,
        coverImage: coverImage || 'image/Clare-photo-1.jpeg',
        author
      };

      if (IS_LIVE) {
        const isEdit = Boolean(editingPostId.value);
        const url = isEdit
          ? `${CFG.API_BASE_URL}/api/posts/${encodeURIComponent(editingPostId.value)}`
          : `${CFG.API_BASE_URL}/api/posts`;
        const res = await fetch(url, {
          method: isEdit ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getAuthToken()}`
          },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to publish post.');
      } else {
        const posts = getLocalPosts();
        if (editingPostId.value) {
          const idx = posts.findIndex(p => p.id === editingPostId.value);
          if (idx !== -1) {
            posts[idx] = { ...posts[idx], ...payload, updatedAt: new Date().toISOString() };
          }
        } else {
          posts.unshift({
            id: `post-${Date.now()}`,
            slug: `${slugify(title)}-${Date.now().toString().slice(-4)}`,
            ...payload,
            createdAt: new Date().toISOString()
          });
        }
        saveLocalPosts(posts);
      }

      const wasEdit = Boolean(editingPostId.value);
      resetEditor();
      showStatus(wasEdit ? '✓ Article updated successfully!' : '✓ Published! Your article is now live on the Blog page.', 'success');
      await refreshPosts();
    } catch (err) {
      showStatus(err.message || 'Something went wrong while publishing.', 'error');
    } finally {
      publishBtn.disabled = false;
      publishBtn.textContent = editingPostId.value ? 'Save Changes' : 'Publish Post to Blog';
    }
  });

  // Load & Render Posts List
  async function refreshPosts() {
    if (IS_LIVE) {
      try {
        const res = await fetch(`${CFG.API_BASE_URL}/api/posts`);
        const data = await res.json();
        cachedPosts = Array.isArray(data.posts) ? data.posts : [];
      } catch (_) {
        cachedPosts = [];
      }
    } else {
      cachedPosts = getLocalPosts();
    }

    postCount.textContent = String(cachedPosts.length);

    if (cachedPosts.length === 0) {
      adminPostsList.innerHTML = `<p style="color:#64748b;text-align:center;padding:32px 0;">No articles published yet. Tap "Write Post" to create your first one!</p>`;
      return;
    }

    adminPostsList.innerHTML = cachedPosts.map(p => `
      <div class="admin-post-row">
        <img class="admin-post-thumb" src="${escapeHtml(resolvePreviewImg(p.coverImage))}" alt=""/>
        <div class="admin-post-info">
          <h4>${escapeHtml(p.title)}</h4>
          <div class="admin-post-meta">${escapeHtml(p.category || 'Wellness')} · ${new Date(p.createdAt).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' })}</div>
        </div>
        <div class="admin-post-actions">
          <button type="button" class="btn-edit" data-id="${escapeHtml(p.id)}">Edit</button>
          <button type="button" class="btn-delete" data-id="${escapeHtml(p.id)}">Delete</button>
        </div>
      </div>
    `).join('');

    adminPostsList.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const post = cachedPosts.find(p => p.id === btn.dataset.id);
        if (!post) return;
        editingPostId.value = post.id;
        postTitle.value = post.title || '';
        postCategory.value = post.category || 'Mental Wellness';
        postExcerpt.value = post.excerpt || '';
        postEditor.innerHTML = post.content || '';
        currentCoverUrl = post.coverImage || '';
        selectedFile = null;
        if (currentCoverUrl) showPreview(resolvePreviewImg(currentCoverUrl));
        editorHeading.textContent = 'Edit Blog Post';
        publishBtn.textContent = 'Save Changes';
        cancelEditBtn.hidden = false;
        publishStatus.hidden = true;
        switchView('editor');
      });
    });

    adminPostsList.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to delete this article?')) return;
        const id = btn.dataset.id;
        if (IS_LIVE) {
          await fetch(`${CFG.API_BASE_URL}/api/posts/${encodeURIComponent(id)}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${getAuthToken()}` }
          });
        } else {
          saveLocalPosts(getLocalPosts().filter(p => p.id !== id));
        }
        refreshPosts();
      });
    });
  }

  function enterDashboard() {
    const user = getCurrentUser();
    dashUserLabel.textContent = user ? `${user.name} (${user.email})` : 'Signed in';
    authScreen.hidden = true;
    dashboard.hidden = false;
    refreshPosts();
  }

  // Auto-restore login session
  if (getAuthToken() && getCurrentUser()) {
    enterDashboard();
  }
});
