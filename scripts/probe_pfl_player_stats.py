#!/usr/bin/env python3
"""Probe the official PFL club statistics table structure."""
from __future__ import annotations

import html
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data/audits/pfl_stats_probe.json"
URL = "https://pfl.uz/en/club/14/statistics"


def strip_tags(value: str) -> str:
    value = re.sub(r"<script\b[^>]*>.*?</script>", "", value, flags=re.I | re.S)
    value = re.sub(r"<style\b[^>]*>.*?</style>", "", value, flags=re.I | re.S)
    value = re.sub(r"<[^>]+>", " ", value)
    return re.sub(r"\s+", " ", html.unescape(value)).strip()


def attrs(tag: str) -> dict[str, str]:
    out = {}
    for key, q1, v1, q2, v2, v3 in re.findall(
        r"""([\w:-]+)\s*=\s*(?:(["'])(.*?)\2|([^\s>]+))""",
        tag,
        flags=re.S,
    ):
        value = v1 if q1 else (v2 or v3)
        out[key.lower()] = html.unescape(value or "")
    return out


def main():
    req = Request(
        URL,
        headers={
            "User-Agent": "UzStatPFLProbe/1.0 (+https://github.com/creativka1/uzb_scoute)",
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "en-US,en;q=0.9",
        },
    )
    with urlopen(req, timeout=30) as response:
        source = response.read().decode("utf-8", errors="replace")

    table_match = re.search(r"<table\b.*?</table>", source, flags=re.I | re.S)
    if not table_match:
        raise RuntimeError("No statistics table found on official PFL page")
    table = table_match.group(0)

    head_match = re.search(r"<thead\b.*?</thead>", table, flags=re.I | re.S)
    header_html = head_match.group(0) if head_match else ""
    header_cells = re.findall(r"<th\b.*?</th>", header_html, flags=re.I | re.S)

    headers = []
    for cell in header_cells:
        images = []
        for img in re.findall(r"<img\b[^>]*>", cell, flags=re.I):
            a = attrs(img)
            images.append({
                "src": a.get("src"),
                "alt": a.get("alt"),
                "title": a.get("title"),
            })
        headers.append({
            "text": strip_tags(cell),
            "images": images,
            "html": cell[:1200],
        })

    body_match = re.search(r"<tbody\b.*?</tbody>", table, flags=re.I | re.S)
    body = body_match.group(0) if body_match else table
    rows = []
    for row in re.findall(r"<tr\b.*?</tr>", body, flags=re.I | re.S)[:5]:
        cells = re.findall(r"<t[dh]\b.*?</t[dh]>", row, flags=re.I | re.S)
        rows.append([strip_tags(cell) for cell in cells])

    relevant_scripts = []
    for block in re.findall(r"<script\b[^>]*>.*?</script>", source, flags=re.I | re.S):
        low = block.lower()
        if "stat" in low or "club" in low or "player" in low:
            relevant_scripts.append(block[:5000])
            if len(relevant_scripts) >= 5:
                break

    payload = {
        "status": "success",
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "url": URL,
        "headers": headers,
        "rows": rows,
        "tableText": strip_tags(table)[:10000],
        "relevantScripts": relevant_scripts,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"headers": headers, "rows": rows[:2]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
