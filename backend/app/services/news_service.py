"""Agrega noticias cripto desde feeds RSS públicos (sin API key)."""
import asyncio
import re
import time
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
from datetime import datetime

import httpx

FEEDS = [
    {"name": "CoinDesk",         "url": "https://www.coindesk.com/arc/outboundfeeds/rss/"},
    {"name": "Cointelegraph",    "url": "https://cointelegraph.com/rss"},
    {"name": "Decrypt",          "url": "https://decrypt.co/feed"},
    {"name": "The Block",        "url": "https://www.theblock.co/rss.xml"},
    {"name": "Bitcoin Magazine", "url": "https://bitcoinmagazine.com/feed"},
]

_NS   = {"atom": "http://www.w3.org/2005/Atom"}
_TAGS = re.compile(r"<[^>]+>")

_cache: dict            = {"data": [], "ts": 0.0}
_translation_cache: dict[str, str] = {}   # title_en -> title_es (persiste entre refreshes)
CACHE_TTL = 300  # 5 min

_MYMEMORY = "https://api.mymemory.translated.net/get"
_BAD_RESP  = ("MYMEMORY WARNING", "QUERY LENGTH LIMIT", "INVALID LANGPAIR")


# ── Helpers de parseo ─────────────────────────────────────────────────────────

def _clean(text: str, maxlen: int = 300) -> str:
    return _TAGS.sub("", text).strip()[:maxlen]


def _parse_ts(raw: str) -> float | None:
    if not raw:
        return None
    try:
        return parsedate_to_datetime(raw).timestamp()
    except Exception:
        pass
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).timestamp()
    except Exception:
        return None


def _parse_rss(xml_text: str, source: str) -> list[dict]:
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return []

    items = []

    # ── RSS 2.0 ──────────────────────────────────────────────────────────────
    for item in root.findall(".//item"):
        title = _clean(item.findtext("title", ""))
        url   = (item.findtext("link") or
                 item.findtext("{http://www.w3.org/2005/Atom}link") or "").strip()
        desc  = _clean(item.findtext("description", ""))
        ts    = _parse_ts(item.findtext("pubDate", ""))
        if not url:
            link_el = item.find("link")
            if link_el is not None and link_el.text:
                url = link_el.text.strip()
        if title and url:
            items.append({"title": title, "url": url, "description": desc,
                          "source": source, "published_at": ts})

    # ── Atom ──────────────────────────────────────────────────────────────────
    if not items:
        for entry in root.findall("atom:entry", _NS):
            title = _clean(entry.findtext("atom:title", "", _NS))
            link  = entry.find("atom:link", _NS)
            url   = (link.get("href", "") if link is not None else "").strip()
            desc  = _clean(entry.findtext("atom:summary", "", _NS) or
                           entry.findtext("atom:content", "", _NS) or "")
            ts    = _parse_ts(entry.findtext("atom:updated", "", _NS) or
                              entry.findtext("atom:published", "", _NS) or "")
            if title and url:
                items.append({"title": title, "url": url, "description": desc,
                              "source": source, "published_at": ts})

    return items


# ── Traducción con MyMemory ───────────────────────────────────────────────────

async def _translate_one(client: httpx.AsyncClient, sem: asyncio.Semaphore,
                         title: str) -> str:
    """Traduce un título EN→ES vía MyMemory (gratuito, sin API key)."""
    async with sem:
        try:
            r = await client.get(
                _MYMEMORY,
                params={"q": title[:500], "langpair": "en|es"},
                timeout=6,
            )
            data = r.json()
            translated = data.get("responseData", {}).get("translatedText", "") or ""
            if translated and not any(w in translated for w in _BAD_RESP):
                return translated
        except Exception:
            pass
    return title  # fallback: título original


async def _translate_new(items: list[dict]) -> None:
    """Rellena _translation_cache solo con los títulos aún no traducidos."""
    pending = [it["title"] for it in items if it["title"] not in _translation_cache]
    if not pending:
        return

    sem = asyncio.Semaphore(5)   # máx 5 peticiones simultáneas a MyMemory
    async with httpx.AsyncClient() as client:
        translations = await asyncio.gather(
            *[_translate_one(client, sem, t) for t in pending],
            return_exceptions=False,
        )

    for title, trans in zip(pending, translations):
        _translation_cache[title] = trans if isinstance(trans, str) else title


# ── Fetch de feeds ────────────────────────────────────────────────────────────

async def _fetch(client: httpx.AsyncClient, feed: dict) -> list[dict]:
    try:
        r = await client.get(
            feed["url"], timeout=8, follow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 CryptoApp/2.0 RSS Reader"},
        )
        r.raise_for_status()
        return _parse_rss(r.text, feed["name"])
    except Exception:
        return []


# ── API pública ───────────────────────────────────────────────────────────────

async def get_news(limit: int = 60) -> list[dict]:
    now = time.time()
    if now - _cache["ts"] < CACHE_TTL and _cache["data"]:
        return _cache["data"][:limit]

    # 1. Obtener feeds RSS
    async with httpx.AsyncClient() as client:
        results = await asyncio.gather(*[_fetch(client, f) for f in FEEDS])

    merged = [item for sublist in results for item in sublist]
    merged.sort(key=lambda x: x.get("published_at") or 0, reverse=True)

    # 2. Traducir títulos nuevos (los ya cacheados se reutilizan)
    await _translate_new(merged)

    # 3. Enriquecer cada ítem con title_es y title_original
    for item in merged:
        item["title_original"] = item["title"]
        item["title_es"]       = _translation_cache.get(item["title"], item["title"])

    _cache["data"] = merged
    _cache["ts"]   = now
    return merged[:limit]


def get_sources() -> list[str]:
    return [f["name"] for f in FEEDS]
