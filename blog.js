/* ============================================
   SHALAM WELLNESS — blog.js
   Public Blog Listing & Full Post Viewer
   Supports live Cloudflare R2 Worker API + Local Preview Mode
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  const CFG = window.SHALAM_BLOG_CONFIG || { API_BASE_URL: '' };
  const LOCAL_POSTS_KEY = 'sw_blog_posts_v1';

  // Mobile nav toggle
  const navToggle = document.getElementById('navToggle');
  const navOverlay = document.getElementById('navOverlay');
  if (navToggle) {
    navToggle.addEventListener('click', () => {
      document.body.classList.toggle('nav-open');
      navToggle.classList.toggle('active');
    });
  }
  if (navOverlay) {
    navOverlay.addEventListener('click', () => {
      document.body.classList.remove('nav-open');
      navToggle && navToggle.classList.remove('active');
    });
  }

  // Starter sample posts (only shown in Local Preview Mode when no posts exist yet)
  const SEED_POSTS = [
    {
      id: 'seed-1',
      slug: 'understanding-unhealed-childhood-wounds',
      title: 'Understanding Unhealed Childhood Wounds & How They Show Up Today',
      category: 'Trauma & Healing',
      author: 'Clare Wamaitha',
      coverImage: 'image/Clare-photo-1.jpeg',
      excerpt: 'Experiences from our earliest years often shape how we respond to stress, conflict, and intimacy in adulthood. Here is how to recognize the patterns and begin healing gently.',
      content: `<p>Many adults find themselves reacting strongly to certain situations — feeling suddenly overwhelmed, shut down, or deeply hurt — and wondering why the reaction feels so much bigger than the moment itself.</p>
<h3>Why Past Experiences Resurface</h3>
<p>When painful experiences from childhood or earlier chapters of life go unprocessed, our nervous system holds onto them as protective alerts. Even years later, a tone of voice, a feeling of being overlooked, or a conflict at work can activate old emotional memories.</p>
<blockquote>Healing is a journey, not a destination, and you don't need to walk it alone.</blockquote>
<h3>Gentle First Steps Toward Healing</h3>
<ul>
  <li><strong>Notice without judgment:</strong> Pause and name what you are feeling before criticizing yourself for the reaction.</li>
  <li><strong>Separate then from now:</strong> Remind yourself that you are safe in the present and have more choices today than you did back then.</li>
  <li><strong>Seek a safe therapeutic space:</strong> Working with a licensed counselling psychologist helps you unpack these roots at a pace that feels grounded and manageable.</li>
</ul>
<p>You don't have to have it all figured out — you just have to be willing to begin.</p>`,
      createdAt: '2026-04-12T09:00:00.000Z'
    },
    {
      id: 'seed-2',
      slug: 'what-to-expect-in-your-first-therapy-session',
      title: 'What to Expect in Your First Therapy Session',
      category: 'Mental Wellness',
      author: 'Clare Wamaitha',
      coverImage: 'image/Clare-photo-2.jpeg',
      excerpt: 'Thinking about starting therapy but unsure what actually happens in the first session? Here is a reassuring walk-through of what your first conversation looks like.',
      content: `<p>Deciding to book your first therapy session takes real courage. It is completely normal to feel a mix of relief, nervousness, or uncertainty about what to say.</p>
<h3>A Safe, No-Pressure Conversation</h3>
<p>Your first session is not an exam and you don't need to prepare a perfect script. Together, we talk gently about what brought you in, what has been weighing on you, and what you hope to gain from our work together.</p>
<h3>Confidentiality &amp; Pace</h3>
<p>Everything you share is held in strict confidence in accordance with the Counsellors and Psychologists Board (CPB) of Kenya. You set the pace — we only explore what you feel ready to share.</p>
<p>Whether you choose an online session or an in-person visit in Nairobi, your first session is simply a safe place to start.</p>`,
      createdAt: '2026-04-05T09:00:00.000Z'
    }
  ];

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
  }

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString('en-KE', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (_) {
      return iso || '';
    }
  }

  function estimateReadTime(html) {
    const text = String(html || '').replace(/<[^>]+>/g, ' ').trim();
    const words = text ? text.split(/\s+/).length : 0;
    const mins = Math.max(1, Math.ceil(words / 200));
    return `${mins} min read`;
  }

  function resolveImageUrl(src) {
    if (!src) return 'image/Clare-photo-1.jpeg';
    if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) return src;
    if (CFG.API_BASE_URL && src.startsWith('/media/')) return `${CFG.API_BASE_URL}${src}`;
    return src;
  }

  async function loadPosts() {
    if (CFG.API_BASE_URL) {
      try {
        const res = await fetch(`${CFG.API_BASE_URL}/api/posts`);
        if (res.ok) {
          const data = await res.json();
          return Array.isArray(data.posts) ? data.posts : [];
        }
      } catch (err) {
        console.error('Failed to load posts from API:', err);
      }
      return [];
    }

    // Local Preview Mode
    try {
      const raw = localStorage.getItem(LOCAL_POSTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    localStorage.setItem(LOCAL_POSTS_KEY, JSON.stringify(SEED_POSTS));
    return SEED_POSTS;
  }

  // ===== BLOG LISTING PAGE =====
  const blogGrid = document.getElementById('blogGrid');
  if (blogGrid) {
    const blogEmpty = document.getElementById('blogEmpty');
    const blogSort = document.getElementById('blogSort');
    const blogSearch = document.getElementById('blogSearch');
    const catButtons = document.querySelectorAll('.cat-pill');

    let allPosts = [];
    let selectedCategory = 'all';

    function renderList() {
      const query = (blogSearch.value || '').trim().toLowerCase();
      const sortOrder = blogSort.value;

      let filtered = allPosts.filter(p => {
        const matchCat = selectedCategory === 'all' || (p.category || '').toLowerCase() === selectedCategory.toLowerCase();
        const matchQuery = !query ||
          (p.title || '').toLowerCase().includes(query) ||
          (p.excerpt || '').toLowerCase().includes(query) ||
          (p.category || '').toLowerCase().includes(query);
        return matchCat && matchQuery;
      });

      filtered.sort((a, b) => {
        const da = new Date(a.createdAt || 0).getTime();
        const db = new Date(b.createdAt || 0).getTime();
        return sortOrder === 'oldest' ? da - db : db - da;
      });

      if (filtered.length === 0) {
        blogGrid.innerHTML = '';
        blogEmpty.hidden = false;
        return;
      }

      blogEmpty.hidden = true;
      blogGrid.innerHTML = filtered.map(post => {
        const href = `post.html?slug=${encodeURIComponent(post.slug || post.id)}`;
        const img = resolveImageUrl(post.coverImage);
        return `
          <article class="blog-card">
            <a href="${href}" class="blog-card-img-wrap">
              <img src="${escapeHtml(img)}" alt="${escapeHtml(post.title)}" loading="lazy"/>
              <span class="blog-card-cat">${escapeHtml(post.category || 'Wellness')}</span>
            </a>
            <div class="blog-card-body">
              <div class="blog-card-meta">
                <span>${escapeHtml(formatDate(post.createdAt))}</span>
                <span>·</span>
                <span>${escapeHtml(estimateReadTime(post.content))}</span>
              </div>
              <h2 class="blog-card-title"><a href="${href}">${escapeHtml(post.title)}</a></h2>
              <p class="blog-card-excerpt">${escapeHtml(post.excerpt || '')}</p>
              <a href="${href}" class="blog-read-more">Read More →</a>
            </div>
          </article>
        `;
      }).join('');
    }

    catButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        catButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedCategory = btn.dataset.category;
        renderList();
      });
    });

    blogSort.addEventListener('change', renderList);
    blogSearch.addEventListener('input', renderList);

    loadPosts().then(posts => {
      allPosts = posts;
      renderList();
    });
  }

  // ===== SINGLE POST PAGE =====
  const postContentArea = document.getElementById('postContentArea');
  if (postContentArea) {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('slug') || params.get('id');

    loadPosts().then(posts => {
      const post = posts.find(p => (p.slug === slug || p.id === slug));
      if (!post) {
        postContentArea.innerHTML = `
          <div class="blog-empty">
            <h3>Article not found</h3>
            <p>This article may have been moved or removed.</p>
            <p style="margin-top:16px;"><a href="blog.html" class="btn btn-primary">Browse All Articles</a></p>
          </div>
        `;
        return;
      }

      document.title = `${post.title} — Shalam Wellness`;
      const img = resolveImageUrl(post.coverImage);
      const pageUrl = encodeURIComponent(window.location.href);
      const shareText = encodeURIComponent(`${post.title} — Shalam Wellness`);

      // Dynamic SEO metadata + BlogPosting JSON-LD
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc && post.excerpt) metaDesc.setAttribute('content', post.excerpt);
      let canon = document.querySelector('link[rel="canonical"]');
      if (!canon) {
        canon = document.createElement('link');
        canon.rel = 'canonical';
        document.head.appendChild(canon);
      }
      canon.href = `https://www.shalamwellness.co.ke/post.html?slug=${encodeURIComponent(post.slug || post.id)}`;

      const ld = document.createElement('script');
      ld.type = 'application/ld+json';
      ld.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: post.title,
        description: post.excerpt || '',
        image: img.startsWith('http') ? img : `https://www.shalamwellness.co.ke/${img.replace(/^\//, '')}`,
        datePublished: post.createdAt || undefined,
        dateModified: post.updatedAt || post.createdAt || undefined,
        author: { '@type': 'Person', name: post.author || 'Clare Wamaitha', url: 'https://www.shalamwellness.co.ke/about.html' },
        publisher: {
          '@type': 'Organization',
          name: 'Shalam Wellness',
          logo: { '@type': 'ImageObject', url: 'https://www.shalamwellness.co.ke/image/logo-web.png' }
        },
        mainEntityOfPage: canon.href
      });
      document.head.appendChild(ld);

      postContentArea.innerHTML = `
        <header class="post-header">
          <span class="post-category-badge">${escapeHtml(post.category || 'Mental Wellness')}</span>
          <h1 class="post-title">${escapeHtml(post.title)}</h1>
          <div class="post-meta-bar">
            <span>By <strong>${escapeHtml(post.author || 'Clare Wamaitha')}</strong></span>
            <span>·</span>
            <span>${escapeHtml(formatDate(post.createdAt))}</span>
            <span>·</span>
            <span>${escapeHtml(estimateReadTime(post.content))}</span>
          </div>
        </header>

        <div class="post-cover-wrap">
          <img src="${escapeHtml(img)}" alt="${escapeHtml(post.title)}"/>
        </div>

        <div class="post-content">${post.content || ''}</div>

        <div class="post-share-bar">
          <span style="font-size:14px;color:#64748b;">Found this helpful? Share it:</span>
          <div class="post-share-btns">
            <a class="share-btn" href="https://wa.me/?text=${shareText}%20${pageUrl}" target="_blank">WhatsApp</a>
            <button type="button" class="share-btn" id="copyPostLinkBtn">Copy Link</button>
          </div>
        </div>

        <div class="post-cta-box">
          <h3>Ready to take the first step?</h3>
          <p>You don't have to have it all figured out, you just have to be willing to begin. Your first session is a safe place to start.</p>
          <a href="book.html" class="btn btn-white">Book a Session →</a>
        </div>
      `;

      const copyBtn = document.getElementById('copyPostLinkBtn');
      if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(window.location.href);
            copyBtn.textContent = '✓ Link Copied';
            setTimeout(() => { copyBtn.textContent = 'Copy Link'; }, 2000);
          } catch (_) {}
        });
      }
    });
  }
});
