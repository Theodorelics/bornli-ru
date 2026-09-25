"""Dependency-free checks shared by local publishing and the public CI workflow."""
import argparse
import json
import re
import ssl
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit
from urllib.request import Request, urlopen
from urllib.robotparser import RobotFileParser
import xml.etree.ElementTree as ET

ORIGIN = "https://bornli.ru"


class Document(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=True)
        self.tags, self.ids, self.title = [], set(), ""
        self._title = False
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        self.tags.append((tag, a))
        if a.get("id"):
            self.ids.add(a["id"])
        if tag == "title":
            self._title = True

    def handle_endtag(self, tag):
        if tag == "title":
            self._title = False

    def handle_data(self, value):
        if self._title:
            self.title += value

    def attrs(self, tag):
        return [a for t, a in self.tags if t == tag]


def local_file(root, path):
    relative = unquote(path).lstrip("/")
    if ".." in Path(relative).parts:
        raise ValueError("Path traversal")
    p = Path(root) / relative
    return p / "index.html" if path.endswith("/") or not p.suffix else p


def fetch(url):
    request = Request(url, headers={"User-Agent": "BORNLI-SEO-Health/1.0"})
    context = ssl.create_default_context()
    # python.org macOS installs may have no default CA bundle. Use the OS bundle,
    # keeping full certificate and hostname verification enabled.
    if sys.platform == "darwin" and not ssl.get_default_verify_paths().cafile and Path("/etc/ssl/cert.pem").exists():
        context.load_verify_locations("/etc/ssl/cert.pem")
    with urlopen(request, timeout=25, context=context) as response:
        return response.read(), response.geturl(), response.headers


def audit(site=None, live=False):
    errors, warnings, cache = [], [], {}

    def read(path):
        if path not in cache:
            if live:
                data, final, headers = fetch(ORIGIN + path)
                if final != ORIGIN + path:
                    warnings.append(f"Redirect: {path} → {final}")
                if "noindex" in headers.get("X-Robots-Tag", "").lower():
                    errors.append(f"{path}: X-Robots-Tag noindex")
            else:
                data = local_file(site, path).read_bytes()
            cache[path] = data
        return cache[path]

    try:
        sitemap = ET.fromstring(read("/sitemap.xml"))
        urls = [n.text for n in sitemap.findall("{*}url/{*}loc")]
        robots = read("/robots.txt").decode()
    except Exception as exc:
        return {"ok": False, "pages": 0, "errors": [f"Sitemap/robots unavailable: {type(exc).__name__}"], "warnings": []}
    rp = RobotFileParser()
    rp.parse(robots.splitlines())
    if ORIGIN + "/sitemap.xml" not in robots:
        errors.append("robots.txt has no canonical sitemap")
    if len(urls) != len(set(urls)):
        errors.append("Duplicate sitemap URL")
    titles, graph = {}, {}
    for url in urls:
        if not url or not url.startswith(ORIGIN + "/") or urlsplit(url).netloc != "bornli.ru":
            errors.append(f"Unexpected sitemap origin: {url}")
            continue
        path = urlsplit(url).path
        if not rp.can_fetch("Googlebot", url) or not rp.can_fetch("YandexBot", url):
            errors.append(f"{path}: blocked by robots.txt")
        try:
            raw = read(path).decode("utf-8")
            doc = Document(raw)
        except Exception as exc:
            errors.append(f"{path}: unavailable ({type(exc).__name__})")
            continue
        graph[path] = set()
        canonical = [a.get("href") for a in doc.attrs("link") if a.get("rel") == "canonical"]
        if canonical != [url]:
            errors.append(f"{path}: canonical must equal {url}")
        if not doc.title.strip() or len(doc.attrs("h1")) != 1:
            errors.append(f"{path}: requires title and exactly one H1")
        if doc.title in titles:
            errors.append(f"Duplicate title: {path}, {titles[doc.title]}")
        titles[doc.title] = path
        if not any(a.get("name") == "description" and a.get("content", "").strip() for a in doc.attrs("meta")):
            errors.append(f"{path}: missing description")
        if any(a.get("name", "").lower() in ("robots", "googlebot", "yandex") and "noindex" in a.get("content", "").lower() for a in doc.attrs("meta")):
            errors.append(f"{path}: noindex in sitemap")
        if not any(a.get("name") == "viewport" for a in doc.attrs("meta")):
            errors.append(f"{path}: missing viewport")
        if not any(a.get("rel") == "icon" for a in doc.attrs("link")):
            errors.append(f"{path}: missing favicon")
        if "analytics.20260924.js" not in raw or "analytics-consent" not in doc.ids:
            errors.append(f"{path}: missing consent-based analytics")
        schemas = re.findall(r'<script[^>]+type=[\"\']application/ld\+json[\"\'][^>]*>(.*?)</script>', raw, re.S)
        if not schemas:
            errors.append(f"{path}: missing structured data")
        for schema in schemas:
            try:
                json.loads(schema)
            except ValueError:
                errors.append(f"{path}: invalid JSON-LD")
        for a in doc.attrs("img"):
            if "alt" not in a:
                warnings.append(f"{path}: image without alt: {a.get('src')}")
            if path.startswith(("/mvp-", "/guides/")) and (not a.get("width") or not a.get("height")):
                errors.append(f"{path}: image dimensions required")
        for tag, a in doc.tags:
            ref = a.get("href") if tag in ("a", "link", "use") else a.get("src") if tag in ("img", "script", "source", "video") else None
            if not ref or ref.startswith(("mailto:", "tel:", "data:", "javascript:")):
                continue
            target = urlsplit(urljoin(url, ref))
            if target.netloc != "bornli.ru":
                continue
            target_path = target.path or "/"
            if tag == "a":
                graph[path].add(target_path)
            try:
                # Live checks fetch pages and small essentials, not large video assets.
                is_html = target_path.endswith(("/", ".html"))
                if not live or is_html or tag in ("script", "link"):
                    data = read(target_path)
                    if target.fragment and (is_html or target_path == path):
                        target_doc = Document(data.decode("utf-8"))
                        if unquote(target.fragment) not in target_doc.ids:
                            errors.append(f"{path}: broken fragment {ref}")
                if not live and tag == "img" and path.startswith(("/mvp-", "/guides/")) and len(read(target_path)) > 600_000:
                    errors.append(f"{path}: image exceeds 600 KB: {ref}")
            except Exception as exc:
                errors.append(f"{path}: broken local reference {ref} ({type(exc).__name__})")
    reachable, pending = set(), ["/"]
    while pending:
        p = pending.pop()
        if p not in reachable:
            reachable.add(p)
            pending.extend(graph.get(p, set()) - reachable)
    for url in urls:
        if url and urlsplit(url).path not in reachable:
            errors.append(f"Orphan page: {url}")
    return {"ok": not errors, "pages": len(urls), "errors": sorted(set(errors)), "warnings": sorted(set(warnings))}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", type=Path, default=Path("."))
    parser.add_argument("--live", action="store_true")
    args = parser.parse_args()
    result = audit(args.site, args.live)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    raise SystemExit(0 if result["ok"] else 1)
