/* ============================================
   SHALAM WELLNESS — blog-config.js
   Shared configuration for Public Blog & Admin PWA
   ============================================
   1. Leave API_BASE_URL empty ('') to test locally in your browser
      using localStorage (Local Preview Mode).
   2. Once you deploy cloudflare-worker/worker.js to Cloudflare,
      paste your Worker URL below (no trailing slash), e.g.:
      API_BASE_URL: 'https://shalam-blog-api.your-name.workers.dev'
*/
window.SHALAM_BLOG_CONFIG = {
  API_BASE_URL: 'https://shalam-wellness-blog-api.danielmwalili1.workers.dev',
  SITE_NAME: 'Shalam Wellness',
  DEFAULT_AUTHOR: 'Clare Wamaitha'
};
