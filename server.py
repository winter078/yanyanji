#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""小手机本地服务：静态页面 + 用户自带 Key 的搜索/小红书代理。

启动：python server.py
搜索 Key、小红书 Key 都由用户在页面填写；服务端只转发，不读取共享 Key。
"""

import gzip
import json
import os
import re
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
ENV_PATH = BASE_DIR / ".env"
USAGE_PATH = BASE_DIR / "data" / "search_usage.json"

TAVILY_URL = "https://api.tavily.com/search"
VOLC_TTS_URL = "https://openspeech.bytedance.com/api/v3/tts/create"
XHS_PUBLIC_URL = os.environ.get("MOMO_XHS_PUBLIC_URL", "https://momo-phone.pages.dev/api/xhs")
MONTHLY_LIMIT = int(os.environ.get("SEARCH_MONTHLY_LIMIT", "900"))
DAILY_LIMIT = int(os.environ.get("SEARCH_DAILY_LIMIT", "10"))
CACHE_TTL_SECONDS = int(os.environ.get("SEARCH_CACHE_TTL", "3600"))

_usage_lock = threading.Lock()
_cache_lock = threading.Lock()
_search_cache = {}


def load_env():
    if not ENV_PATH.exists():
        return
    with open(ENV_PATH, "r", encoding="utf-8-sig") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def get_api_key():
    load_env()
    return os.environ.get("TAVILY_API_KEY", "").strip()


def today_key():
    return datetime.now().strftime("%Y-%m-%d")


def month_key():
    return datetime.now().strftime("%Y-%m")


def load_usage():
    default = {"month": month_key(), "total": 0, "ips": {}}
    try:
        if USAGE_PATH.exists():
            with open(USAGE_PATH, "r", encoding="utf-8-sig") as f:
                data = json.load(f)
            if isinstance(data, dict):
                data.setdefault("month", month_key())
                data.setdefault("total", 0)
                data.setdefault("ips", {})
                return data
    except Exception:
        pass
    return default


def save_usage(data):
    try:
        USAGE_PATH.parent.mkdir(parents=True, exist_ok=True)
        tmp = USAGE_PATH.with_suffix(".tmp")
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        tmp.replace(USAGE_PATH)
    except Exception:
        pass


def normalize_usage(data):
    if data.get("month") != month_key():
        data["month"] = month_key()
        data["total"] = 0
        data["ips"] = {}
    return data


def check_and_reserve(client_ip):
    """检查额度并预占一次；成功返回 (ok, reason, snapshot)。"""
    with _usage_lock:
        data = normalize_usage(load_usage())
        total = int(data.get("total", 0) or 0)
        if total >= MONTHLY_LIMIT:
            return False, "month_limit", {"total": total, "limit": MONTHLY_LIMIT}
        ip_data = data.get("ips", {}).get(client_ip) or {}
        if ip_data.get("day") != today_key():
            ip_data = {"day": today_key(), "count": 0}
        if int(ip_data.get("count", 0) or 0) >= DAILY_LIMIT:
            return False, "daily_limit", {"total": total, "limit": DAILY_LIMIT, "ip_count": ip_data.get("count", 0)}
        return True, "", {"total": total, "limit": MONTHLY_LIMIT}


def commit_usage(client_ip):
    with _usage_lock:
        data = normalize_usage(load_usage())
        data["total"] = int(data.get("total", 0) or 0) + 1
        ip_data = data.get("ips", {}).get(client_ip) or {}
        if ip_data.get("day") != today_key():
            ip_data = {"day": today_key(), "count": 0}
        ip_data["count"] = int(ip_data.get("count", 0) or 0) + 1
        data.setdefault("ips", {})[client_ip] = ip_data
        save_usage(data)


def usage_snapshot():
    with _usage_lock:
        data = normalize_usage(load_usage())
        return {
            "month": data.get("month"),
            "total": int(data.get("total", 0) or 0),
            "monthly_limit": MONTHLY_LIMIT,
            "daily_limit": DAILY_LIMIT,
        }


def cache_get(query):
    key = query.strip().lower()
    with _cache_lock:
        item = _search_cache.get(key)
        if not item:
            return None
        if item["expires"] < time.time():
            _search_cache.pop(key, None)
            return None
        return item["value"]


def cache_set(query, value):
    key = query.strip().lower()
    with _cache_lock:
        _search_cache[key] = {"expires": time.time() + CACHE_TTL_SECONDS, "value": value}
        # 简单防止内存无限增长
        if len(_search_cache) > 300:
            oldest = sorted(_search_cache.items(), key=lambda kv: kv[1]["expires"])[:50]
            for k, _ in oldest:
                _search_cache.pop(k, None)


def tavily_search(query, api_key=None):
    key = str(api_key or "").strip()
    if not key:
        raise RuntimeError("missing_key")
    payload = json.dumps({
        "query": query,
        "search_depth": "basic",
        "max_results": 5,
        "include_answer": False,
        "include_raw_content": False,
    }).encode("utf-8")
    last_error = None
    for attempt in range(2):
        req = urllib.request.Request(
            TAVILY_URL,
            data=payload,
            headers={
                "Authorization": "Bearer " + key,
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=25) as resp:
                raw = resp.read().decode("utf-8", errors="replace")
                return json.loads(raw)
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")[:200]
            last_error = RuntimeError("tavily_http_%s: %s" % (e.code, body))
            if e.code < 500 or attempt == 1:
                raise last_error
        except Exception as e:
            last_error = RuntimeError("tavily_error: %s" % e)
            if attempt == 1:
                raise last_error
        time.sleep(0.6)
    raise last_error or RuntimeError("tavily_error: unknown")


def trim_results(data, query):
    results = []
    for item in (data.get("results") or [])[:5]:
        content = str(item.get("content") or "").strip()
        results.append({
            "title": str(item.get("title") or "").strip()[:160],
            "url": str(item.get("url") or "").strip(),
            "content": content[:700],
            "score": item.get("score"),
        })
    return {"query": query, "results": results}


XHS_ALLOWED_HOSTS = {"www.xiaohongshu.com", "xiaohongshu.com", "xhslink.com", "www.xhslink.com"}
XHS_HEADERS = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9",
}


def _decode_json_string(raw):
    try:
        return json.loads('"' + raw + '"')
    except Exception:
        return raw


def _grab_json_string(source, key):
    match = re.search(r'"' + re.escape(key) + r'":"((?:[^"\\]|\\.)*)"', source)
    return _decode_json_string(match.group(1)).strip() if match else ""


def _extract_json_object_after(source, key):
    marker = '"' + key + '":'
    idx = source.find(marker)
    if idx < 0:
        return ""
    start = source.find("{", idx + len(marker))
    if start < 0:
        return ""
    depth = 0
    in_string = False
    escaped = False
    for pos in range(start, len(source)):
        ch = source[pos]
        if in_string:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == '"':
                in_string = False
            continue
        if ch == '"':
            in_string = True
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return source[start:pos + 1]
    return ""


def _safe_int(value, default=0):
    try:
        return int(value)
    except Exception:
        return default


def _parse_xhs_comments(source):
    raw = _extract_json_object_after(source, "commentData")
    if not raw:
        return [], 0
    try:
        data = json.loads(raw)
    except Exception:
        try:
            data = json.loads(re.sub(r"\bundefined\b", "null", raw))
        except Exception:
            return [], 0
    comments = []
    for item in (data.get("comments") or [])[:20]:
        if not isinstance(item, dict):
            continue
        content = str(item.get("content") or "").strip()
        if not content:
            continue
        user = item.get("user") or {}
        replies = []
        for sub in (item.get("subComments") or [])[:3]:
            if not isinstance(sub, dict):
                continue
            sub_content = str(sub.get("content") or "").strip()
            if not sub_content:
                continue
            sub_user = sub.get("user") or {}
            replies.append({
                "author": str(sub_user.get("nickname") or "").strip()[:80],
                "content": sub_content[:600],
            })
        comments.append({
            "author": str(user.get("nickname") or "").strip()[:80],
            "content": content[:800],
            "likes": _safe_int(item.get("likeCount") or item.get("likeViewCount")),
            "replies": replies,
        })
    return comments, _safe_int(data.get("commentCount"), len(comments))


def parse_xhs_note(html):
    marker = html.find("__INITIAL_STATE__=")
    source = html[marker:] if marker >= 0 else html
    title = _grab_json_string(source, "title")
    desc = _grab_json_string(source, "desc")
    author = _grab_json_string(source, "nickName") or _grab_json_string(source, "nickname")
    images = []
    for match in re.finditer(r'"url":"((?:[^"\\]|\\.)*!h5_1080jpg)"', source):
        url = _decode_json_string(match.group(1))
        if url and url not in images:
            images.append(url)
        if len(images) >= 12:
            break
    comments, comment_count = _parse_xhs_comments(source)
    if not title and not desc:
        return None
    return {
        "title": title[:300],
        "author": author[:120],
        "desc": desc[:5000],
        "images": images,
        "comments": comments,
        "commentCount": comment_count,
    }



def fetch_xhs_note(url):
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in ("http", "https") or parsed.hostname not in XHS_ALLOWED_HOSTS:
        raise RuntimeError("bad_url")
    req = urllib.request.Request(url, headers=XHS_HEADERS, method="GET")
    with urllib.request.urlopen(req, timeout=20) as resp:
        html = resp.read().decode("utf-8", errors="replace")
        final_url = resp.geturl()
    if not html or len(html) < 1000:
        raise RuntimeError("empty_page")
    note = parse_xhs_note(html)
    if not note:
        raise RuntimeError("note_not_parsed")
    note["ok"] = True
    note["url"] = final_url or url
    return note


def _xhs_cache_get(url):
    now = time.time()
    with _XHS_NOTE_LOCK:
        item = _XHS_NOTE_CACHE.get(url)
        if not item:
            return None
        if now - item.get("at", 0) > _XHS_CACHE_TTL:
            _XHS_NOTE_CACHE.pop(url, None)
            return None
        return item.get("note")


def _xhs_cache_put(url, note):
    with _XHS_NOTE_LOCK:
        if len(_XHS_NOTE_CACHE) >= 20:
            _XHS_NOTE_CACHE.clear()
        _XHS_NOTE_CACHE[url] = {"at": time.time(), "note": note}


_OCR_ENGINE = None
_OCR_LOCK = threading.Lock()
_OCR_TEXT_CACHE = {}
_OCR_TEXT_LOCK = threading.Lock()
_XHS_NOTE_CACHE = {}
_XHS_NOTE_LOCK = threading.Lock()
_XHS_CACHE_TTL = 600


def _get_ocr_engine():
    global _OCR_ENGINE
    if _OCR_ENGINE is not None:
        return _OCR_ENGINE
    with _OCR_LOCK:
        if _OCR_ENGINE is not None:
            return _OCR_ENGINE
        vendor = BASE_DIR / "ocr_vendor"
        if vendor.is_dir() and str(vendor) not in sys.path:
            sys.path.insert(0, str(vendor))
        from rapidocr_onnxruntime import RapidOCR
        _OCR_ENGINE = RapidOCR()
        return _OCR_ENGINE


def _ocr_image_url(url):
    with _OCR_TEXT_LOCK:
        cached = _OCR_TEXT_CACHE.get(url)
    if cached is not None:
        return cached
    req = urllib.request.Request(url, headers={
        "User-Agent": XHS_HEADERS["User-Agent"],
        "Referer": "https://www.xiaohongshu.com/",
        "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    })
    with urllib.request.urlopen(req, timeout=20) as resp:
        data = resp.read()
    tmp_path = ""
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp:
            tmp.write(data)
            tmp_path = tmp.name
        engine = _get_ocr_engine()
        result, _ = engine(tmp_path)
        lines = []
        for item in (result or []):
            text = str(item[1] if len(item) > 1 else "").strip()
            if text:
                lines.append(text)
        text = "\n".join(lines)
        with _OCR_TEXT_LOCK:
            if len(_OCR_TEXT_CACHE) >= 120:
                _OCR_TEXT_CACHE.clear()
            _OCR_TEXT_CACHE[url] = text
        return text
    finally:
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except Exception:
                pass


def _ocr_job(args):
    index, image_url = args
    try:
        return index, _ocr_image_url(image_url)
    except Exception:
        return index, ""


def enrich_xhs_note(note):
    images = note.get("images") or []
    note["imageTexts"] = []
    note["imageTextError"] = ""
    if not images:
        return note
    try:
        _get_ocr_engine()
    except Exception as exc:
        note["imageTextError"] = "ocr_unavailable:" + str(exc)[:100]
        return note
    started = time.time()
    image_items = list(enumerate(images[:9], 1))
    results = []
    errors = []
    try:
        with ThreadPoolExecutor(max_workers=4) as pool:
            for index, text in pool.map(_ocr_job, image_items):
                if text:
                    results.append({"index": index, "text": text[:900]})
    except Exception as exc:
        errors.append(str(exc)[:100])
    results.sort(key=lambda item: item["index"])
    note["imageTexts"] = results
    if errors:
        note["imageTextError"] = "ocr_image_failed:" + errors[0]
    print("[ocr] %d images in %.2fs" % (len(image_items), time.time() - started))
    return note



def _qweather_get(host, path, params):
    """请求和风天气（用户自带 Key + 专属 Host，本地代转发，避免前端 CORS 和 Key 暴露）。"""
    url = "https://" + host + path + "?" + urllib.parse.urlencode(params)
    last_error = None
    for attempt in range(2):
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "MomoPhone/1.0",
                "Accept": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                raw = resp.read()
                encoding = (resp.headers.get("Content-Encoding") or "").lower()
                if encoding == "gzip" or raw[:2] == b"\x1f\x8b":
                    raw = gzip.decompress(raw)
                return json.loads(raw.decode("utf-8"))
        except urllib.error.HTTPError:
            raise
        except Exception as exc:
            last_error = exc
            time.sleep(0.6)
    raise last_error


def _qweather_lookup_city(host, key, city):
    data = _qweather_get(host, "/geo/v2/city/lookup", {
        "location": city, "number": 1, "lang": "zh", "key": key,
    })
    if str(data.get("code")) != "200":
        raise RuntimeError("geo_" + str(data.get("code")))
    locations = data.get("location") or []
    if not locations:
        raise RuntimeError("city_not_found")
    return locations[0]


class Handler(SimpleHTTPRequestHandler):
    server_version = "MomoPhone/1.0"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BASE_DIR), **kwargs)

    def log_message(self, fmt, *args):
        # 不打印请求体或 Key
        print("[server] " + (fmt % args))

    def _send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()
        self.wfile.write(body)
        try:
            self.wfile.flush()
        except Exception:
            pass

    def _read_json(self):
        length = int(self.headers.get("Content-Length", "0") or 0)
        if length <= 0 or length > 1024 * 64:
            return None
        raw = self.rfile.read(length)
        try:
            return json.loads(raw.decode("utf-8"))
        except Exception:
            return None

    def _client_ip(self):
        forwarded = self.headers.get("X-Forwarded-For", "")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return self.client_address[0] if self.client_address else "unknown"

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()

    def do_GET(self):
        path_only = self.path.split("?")[0]
        # 搜索后台模式下，误打开 3010 页面会跳到原来的 3000 小手机，避免看起来像“数据丢了”。
        if os.environ.get("SEARCH_API_ONLY") == "1" and path_only in ("/", "/index.html"):
            self.send_response(302)
            self.send_header("Location", "http://127.0.0.1:3000/index.html")
            self.end_headers()
            return
        if path_only == "/api/weather":
            self._handle_weather()
            return
        if path_only == "/api/search/status":
            payload = usage_snapshot()
            payload["enabled"] = False
            payload["requires_user_key"] = True
            payload["service"] = "tavily"
            self._send_json(200, payload)
            return
        super().do_GET()

    def _handle_weather(self):
        """用户自带 Key 的和风天气查询：先查城市 ID，再取实况 + 未来三天。"""
        query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)

        def pick(name, default=""):
            return str((query.get(name) or [default])[0]).strip()

        host = re.sub(r"^https?://", "", pick("host")).strip("/")
        key = pick("key")
        city = pick("city", "厦门")
        if not key:
            self._send_json(400, {"ok": False, "error": "missing_key"})
            return
        if not host or len(host) > 80 or not re.match(r"^[A-Za-z0-9.\-]+$", host):
            self._send_json(400, {"ok": False, "error": "bad_host"})
            return
        if len(city) > 24:
            self._send_json(400, {"ok": False, "error": "bad_city"})
            return
        try:
            location = _qweather_lookup_city(host, key, city)
            now = _qweather_get(host, "/v7/weather/now", {
                "location": location.get("id"), "key": key, "lang": "zh",
            })
            daily = _qweather_get(host, "/v7/weather/3d", {
                "location": location.get("id"), "key": key, "lang": "zh",
            })
        except urllib.error.HTTPError as exc:
            self._send_json(200, {"ok": False, "error": "http_%s" % exc.code})
            return
        except RuntimeError as exc:
            self._send_json(200, {"ok": False, "error": str(exc)[:80]})
            return
        except Exception as exc:
            self._send_json(200, {
                "ok": False,
                "error": "network",
                "detail": (type(exc).__name__ + ": " + str(exc))[:160],
            })
            return
        if str(now.get("code")) != "200":
            self._send_json(200, {"ok": False, "error": "api_" + str(now.get("code"))})
            return
        current = now.get("now") or {}
        days = []
        for day in (daily.get("daily") or [])[:3]:
            days.append({
                "date": day.get("fxDate"),
                "max": day.get("tempMax"),
                "min": day.get("tempMin"),
                "day": day.get("textDay"),
                "night": day.get("textNight"),
                "precip": day.get("precip"),
            })
        self._send_json(200, {
            "ok": True,
            "city": location.get("name"),
            "province": location.get("adm1"),
            "now": {
                "temp": current.get("temp"),
                "text": current.get("text"),
                "humidity": current.get("humidity"),
                "windDir": current.get("windDir"),
                "windScale": current.get("windScale"),
                "obsTime": current.get("obsTime"),
            },
            "daily": days,
        })

    def do_POST(self):
        path_only = self.path.split("?")[0]
        if path_only == "/api/tts/volc":
            body = self._read_json() or {}
            api_key = str(body.get("apiKey") or "").strip()
            voice = str(body.get("voice") or "").strip()[:160]
            text = str(body.get("text") or "").strip()[:3000]
            speed = float(body.get("speed") or 1)
            if not api_key or not voice or not text:
                self._send_json(400, {"error": "missing_key_voice_or_text"})
                return
            speech_rate = max(-50, min(100, int(round((speed - 1) * 100))))
            payload = json.dumps({
                "model": "seed-audio-1.0",
                "text_prompt": text,
                "references": [{"speaker": voice}],
                "audio_config": {
                    "format": "mp3",
                    "sample_rate": 44100,
                    "speech_rate": speech_rate,
                    "loudness_rate": 0,
                    "pitch_rate": 0,
                },
                "watermark": {},
            }, ensure_ascii=False).encode("utf-8")
            req = urllib.request.Request(
                VOLC_TTS_URL,
                data=payload,
                headers={
                    "Content-Type": "application/json",
                    "X-Api-Key": api_key,
                    "X-Api-Request-Id": str(int(time.time() * 1000)),
                },
                method="POST",
            )
            try:
                with urllib.request.urlopen(req, timeout=60) as resp:
                    status = resp.status
                    raw = resp.read()
            except urllib.error.HTTPError as e:
                status = e.code
                raw = e.read()
            except Exception as e:
                self._send_json(504, {"error": "volc_tts_failed", "detail": str(e)[:180]})
                return
            try:
                data = json.loads(raw.decode("utf-8"))
            except Exception:
                data = {"error": "volc_tts_bad_response", "detail": raw[:180].decode("utf-8", "replace")}
            self._send_json(status, data)
            return
        if path_only == "/api/xhs":
            body = self._read_json() or {}
            url = str(body.get("url") or "").strip()
            if len(url) < 8 or len(url) > 1200:
                self._send_json(400, {"error": "bad_url"})
                return
            # 本地不再直抓小红书，也不跑本地 OCR：只把用户自己的 Key 转发到公网 BYOK 接口。
            api_key = str(body.get("api_key") or self.headers.get("x-api-key") or "").strip()
            payload = {"url": url, "api_key": api_key, "ocr": bool(body.get("ocr", True))}
            req = urllib.request.Request(
                XHS_PUBLIC_URL,
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
                    "Accept-Language": "zh-CN,zh;q=0.9",
                },
                method="POST",
            )
            try:
                with urllib.request.urlopen(req, timeout=120) as resp:
                    status = resp.status
                    raw = resp.read()
            except urllib.error.HTTPError as e:
                status = e.code
                raw = e.read()
            except Exception as e:
                self._send_json(502, {"error": "xhs_proxy_failed", "detail": str(e)[:160]})
                return
            try:
                data = json.loads(raw.decode("utf-8"))
            except Exception:
                data = {"error": "xhs_proxy_bad_response", "detail": raw[:160].decode("utf-8", "replace")}
            self._send_json(status, data)
            return
        if path_only == "/api/shutdown":
            # 仅允许本机启动脚本关闭后台，避免网页随便结束服务。
            if self.headers.get("X-Momo-Shutdown") != "local":
                self._send_json(403, {"error": "forbidden"})
                return
            self._send_json(200, {"ok": True})
            threading.Thread(target=self.server.shutdown, daemon=True).start()
            return
        if path_only != "/api/search":
            self._send_json(404, {"error": "not_found"})
            return
        body = self._read_json() or {}
        query = str(body.get("query") or "").strip()
        api_key = str(body.get("api_key") or "").strip()
        if len(query) < 1 or len(query) > 500:
            self._send_json(400, {"error": "bad_query"})
            return
        # 搜索 Key 由每个用户在页面里自己填写，服务端不再使用共享 Key。
        if not api_key:
            self._send_json(503, {"error": "missing_key"})
            return

        cached = cache_get(query)
        if cached is not None:
            self._send_json(200, dict(cached, cached=True))
            return

        try:
            data = tavily_search(query, api_key)
        except RuntimeError as e:
            self._send_json(502, {"error": "search_failed", "detail": str(e)[:160]})
            return

        result = trim_results(data, query)
        cache_set(query, result)
        self._send_json(200, dict(result, cached=False))

    def translate_path(self, path):
        resolved = super().translate_path(path)
        # 不通过静态文件服务暴露 .env / .git / 备份文件
        rel = os.path.relpath(resolved, str(BASE_DIR)).replace("\\", "/")
        parts = rel.split("/")
        if any(p in (".env", ".env.example", ".git") for p in parts):
            return str(BASE_DIR / "__not_found__")
        if rel.endswith((".bak", ".bak_stage1", ".tmp")):
            return str(BASE_DIR / "__not_found__")
        return resolved


def main():
    load_env()
    preferred = int(os.environ.get("PORT", "3000"))
    candidates = [preferred, 3100, 3010, 8080]
    if os.environ.get("FIXED_PORT") == "1":
        candidates = [preferred]
    candidates = list(dict.fromkeys(candidates))
    server = None
    for port in candidates:
        try:
            server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
            break
        except OSError as e:
            print("[server] 端口 %s 不可用：%s" % (port, e))
    if server is None:
        raise RuntimeError("没有可用端口")
    if not get_api_key():
        print("[server] 提示：搜索 Key 改为由用户在页面里填写，不再读取共享 Key")
    actual_port = server.server_address[1]
    print("[server] http://127.0.0.1:%s/index.html" % actual_port)
    if os.environ.get("SEARCH_API_ONLY") == "1":
        print("[server] 搜索后台已启动：请回到原来的 3000 小手机页面刷新；不要打开这个地址。")

    def _warm_ocr():
        try:
            _get_ocr_engine()
            print("[ocr] engine ready")
        except Exception as exc:
            print("[ocr] engine unavailable: %s" % str(exc)[:120])

    # 本地小红书直读已停用，不再预热 OCR，避免启动时加载 ocr_vendor。
    # threading.Thread(target=_warm_ocr, daemon=True).start()
    server.serve_forever()


if __name__ == "__main__":
    main()
