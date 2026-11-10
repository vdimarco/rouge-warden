#!/usr/bin/env python3
"""Build public/corridor/index.html from the standalone Corridor page.

Usage: python3 scripts/import-corridor.py /path/to/afterglow-corridor/index.html

The Corridor is one self-contained file made for its own address. This turns
it into the arcade's default view: same-site game links, the arcade's own
head tags, and a control that goes back to the All Games list.
"""
import os
import sys

HEAD_OLD = "    <title>Corridor — Cottage Arcade</title>\n"
HEAD_NEW = """    <title>Cottage Arcade</title>
    <link rel="canonical" href="https://arcade.uptick.systems/">
    <link rel="icon" href="/icons/favicon.svg" type="image/svg+xml">
    <link rel="icon" href="/icons/favicon-32.png" sizes="32x32" type="image/png">
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
    <meta name="description" content="Walk the Cottage Arcade hall and play any of its games. Free in your browser.">
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://arcade.uptick.systems/">
    <meta property="og:title" content="Cottage Arcade">
    <meta property="og:description" content="Walk the Cottage Arcade hall and play any of its games. Free in your browser.">
    <meta property="og:image" content="https://arcade.uptick.systems/og.jpg">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:image" content="https://arcade.uptick.systems/og.jpg">
    <style>
      a.cr-btn { display: inline-flex; align-items: center; text-decoration: none; white-space: nowrap; }
      #classic-pill { display: none; }
      /* the top bar has no room on a phone: there the control joins the category strip */
      @media (max-width: 760px) { #classic-link { display: none; } #classic-pill { display: inline-flex; } }
    </style>
"""
MARK_OLD = '<a class="cr-mark" href="https://arcade.uptick.systems/"'
MARK_NEW = '<a class="cr-mark" href="/"'
NAV_OLD = '            <button type="button" class="cr-btn" id="index-btn"'
NAV_NEW = '            <a class="cr-btn" id="classic-link" href="/?view=classic" aria-label="All games: the arcade as a list">All games</a>\n' + NAV_OLD
TAIL_OLD = "  </body>\n"
TAIL_NEW = """    <script>
      /* after the page has built its category strip */
      addEventListener('load', () => {
        const a = document.createElement('a');
        a.id = 'classic-pill';
        a.className = 'cr-btn cr-cat-btn';
        a.href = '/?view=classic';
        a.textContent = 'All games';
        document.getElementById('cats').appendChild(a);
      });
    </script>
  </body>
"""
URL_OLD = 'url: "https://arcade.uptick.systems/'
URL_NEW = 'url: "/'


def swap(page, old, new, count=1):
    found = page.count(old)
    if count is not None and found != count or not found:
        sys.exit(f"expected {count or 'some'} of {old!r}, found {found}")
    return page.replace(old, new)


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    with open(sys.argv[1], encoding="utf-8") as f:
        page = f.read()
    page = swap(page, HEAD_OLD, HEAD_NEW)
    page = swap(page, MARK_OLD, MARK_NEW)
    page = swap(page, NAV_OLD, NAV_NEW)
    page = swap(page, URL_OLD, URL_NEW, None)
    page = swap(page, TAIL_OLD, TAIL_NEW)
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "corridor", "index.html")
    with open(out, "w", encoding="utf-8") as f:
        f.write(page)
    print(f"wrote {os.path.normpath(out)}: {page.count(URL_NEW)} game links, {len(page.encode())} bytes")


if __name__ == "__main__":
    main()
