# sitetest-github-pages-v2

A clean, responsive portfolio site for GitHub Pages (no build step). Uses Tailwind via CDN, with projects loaded from `projects.json`.

## Quick start

1. **Create a new repo** on GitHub (e.g., `sitetest-github-pages-v2`). Keep it **Public**.
2. Click **Settings → Pages** and set:
   - **Source**: Deploy from a branch
   - **Branch**: `main` (root)
3. On your machine:
   ```bash
   git clone https://github.com/<your-username>/sitetest-github-pages-v2.git
   cd sitetest-github-pages-v2
   # drop these files in
   git add .
   git commit -m "Initialize new portfolio site"
   git push origin main
   ```
4. Visit: `https://<your-username>.github.io/sitetest-github-pages-v2/`

Or, if you want this to be your root user site (`<username>.github.io`), name the repo **`<username>.github.io`** and push these files to `main`.

## Customize

- **Branding**: Update title/description in `<head>` of `index.html`.
- **Links**: Replace social links and email in the footer.
- **Projects**: Edit `projects.json` (images under `assets/img/`).
- **Contact form**: Replace `https://formspree.io/f/your-id` with your Formspree endpoint.
- **Images**: Swap out `assets/img/*.jpg` and `favicon.svg`.

## Notes

- This site is fully static; no build required.
- Lighthouse-friendly: mobile-first, fast, semantic headings, sitemap & robots included.
- If you later want a blog, add Markdown-to-HTML with Jekyll (GitHub Pages supports it) or link to a separate platform.
