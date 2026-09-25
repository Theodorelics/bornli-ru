# BORNLI.ru

Static Russian BORNLI landing published with GitHub Pages at `https://bornli.ru/`.

The editable source is in the private `Theodorelics/forma-landing` repository, `new-landing` branch, `bornli/` directory. This repository contains only the public static export. The contact form submits to the existing Yandex Cloud endpoint. The AI examples run in offline demo mode on Pages; server-side AI is not hosted here.

To update the site, copy shared static assets from `bornli/`, excluding `.vercel/`, `api/`, `eu/`, package files, `vercel.json`, and the English script. Publish the Russian `bornli/ru/index.html` as the root `index.html`; likewise copy Russian privacy, consent, prototypes, and agents to the root paths. Keep the old `/ru/` HTML files as redirects to the root and preserve `CNAME` and `.nojekyll`.

## SEO checks

Editorial pages are built by `bornli/seo/seo.py` in the private source repository. The export includes published pages only, with a shared template and sitemap. Internal research, raw metrics, drafts and reports stay private.

`python3 .github/scripts/seo_audit.py --site .` checks sitemap pages, metadata, indexability, structured data, internal links and crawl paths. The `SEO health` workflow runs this on pushes and pull requests, plus a public-site check daily at 06:20 UTC. Use `--live` to check production manually. This is an HTML and availability check, not a measurement of field Core Web Vitals or successful lead delivery.
