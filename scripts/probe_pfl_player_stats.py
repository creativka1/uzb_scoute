#!/usr/bin/env python3
"""Probe the rendered official PFL club statistics table structure."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data/audits/pfl_stats_probe.json"
URL = "https://pfl.uz/en/club/14/statistics"


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1600, "height": 1200}, locale="en-US")
        response = page.goto(URL, wait_until="domcontentloaded", timeout=60000)
        if response is None or response.status >= 400:
            raise RuntimeError(f"PFL statistics page unavailable: {None if response is None else response.status}")
        page.wait_for_timeout(3500)

        tables = page.locator("table")
        if tables.count() == 0:
            # Capture useful DOM diagnostics when the site changes.
            payload = {
                "status": "failed",
                "updatedAt": datetime.now(timezone.utc).isoformat(),
                "url": URL,
                "title": page.title(),
                "bodyText": page.locator("body").inner_text()[:15000],
                "htmlSample": page.content()[:30000],
            }
            OUT.parent.mkdir(parents=True, exist_ok=True)
            OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            raise RuntimeError("No rendered statistics table found on official PFL page")

        table = tables.first
        header_cells = table.locator("thead th")
        headers = []
        for i in range(header_cells.count()):
            cell = header_cells.nth(i)
            imgs = cell.locator("img")
            images = []
            for j in range(imgs.count()):
                img = imgs.nth(j)
                images.append({
                    "src": img.get_attribute("src"),
                    "alt": img.get_attribute("alt"),
                    "title": img.get_attribute("title"),
                    "ariaLabel": img.get_attribute("aria-label"),
                })
            headers.append({
                "text": cell.inner_text().strip(),
                "title": cell.get_attribute("title"),
                "ariaLabel": cell.get_attribute("aria-label"),
                "images": images,
                "html": cell.evaluate("(el) => el.outerHTML"),
            })

        body_rows = table.locator("tbody tr")
        rows = []
        row_html = []
        for i in range(min(6, body_rows.count())):
            row = body_rows.nth(i)
            cells = row.locator("td")
            rows.append([cells.nth(j).inner_text().strip() for j in range(cells.count())])
            row_html.append(row.evaluate("(el) => el.outerHTML"))

        payload = {
            "status": "success",
            "updatedAt": datetime.now(timezone.utc).isoformat(),
            "url": URL,
            "title": page.title(),
            "headers": headers,
            "rows": rows,
            "rowHtml": row_html,
            "tableHtml": table.evaluate("(el) => el.outerHTML")[:50000],
        }
        OUT.parent.mkdir(parents=True, exist_ok=True)
        OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(json.dumps({"headers": headers, "rows": rows[:2]}, ensure_ascii=False, indent=2))
        browser.close()


if __name__ == "__main__":
    main()
