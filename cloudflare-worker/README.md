# Shalam Wellness — Cloudflare R2 Blog Backend Setup

This Cloudflare Worker connects your **Cloudflare R2 Bucket** to both the public Blog (`blog.html` & `post.html`) and the private standalone Admin PWA (`blog-admin/`).

## Quick Setup (3 Minutes)

1. **Create an R2 Bucket in Cloudflare**
   - Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/) → **R2 Object Storage** → **Create Bucket**.
   - Name it `shalam-wellness-blog` (or update `bucket_name` in `wrangler.toml` to match your bucket name).

2. **Deploy the Worker**
   Open a terminal inside this `cloudflare-worker/` folder and run:
   ```bash
   npx wrangler login
   npx wrangler secret put JWT_SECRET
   # (Enter any long random string, e.g. 32+ characters)

   npx wrangler secret put ADMIN_INVITE_CODE
   # (Enter a secret setup code to give Clare when she creates her email & password, e.g. SHALAM-2026)

   npx wrangler deploy
   ```

3. **Connect the Website & Admin PWA**
   - Copy the deployed Worker URL printed by Wrangler (e.g. `https://shalam-wellness-blog-api.<your-subdomain>.workers.dev`).
   - Open `../blog-config.js` and paste it into `API_BASE_URL`:
     ```js
     window.SHALAM_BLOG_CONFIG = {
       API_BASE_URL: 'https://shalam-wellness-blog-api.<your-subdomain>.workers.dev',
       SITE_NAME: 'Shalam Wellness',
       DEFAULT_AUTHOR: 'Clare Wamaitha'
     };
     ```

4. **Share the Private Admin PWA with Clare**
   - Send Clare the direct link to `https://yourdomain.com/blog-admin/` along with the `ADMIN_INVITE_CODE`.
   - She can tap **Create Account** to set her own email & password, tap **Install App** to add it to her phone/desktop home screen, and publish articles directly to Cloudflare R2!
