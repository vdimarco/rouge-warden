"""A small local web server for the game pages.

It listens on 127.0.0.1 only, in a daemon thread, for as long as Hermes runs.
It serves each map's page and takes one kind of write: a finished run, sent by
the page to /api/results, so the agent can read the player's times.
"""

from __future__ import annotations

import html
import json
import threading
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Optional
from urllib.parse import unquote, urlparse

from . import game

MAX_BODY = 8 * 1024
CSP = ("default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; "
       "connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'")

_server: Optional[ThreadingHTTPServer] = None
_thread: Optional[threading.Thread] = None
_lock = threading.Lock()


class _Handler(BaseHTTPRequestHandler):
    server_version = "HometownArcade/1.0"

    def log_message(self, fmt, *args):  # keep Hermes's terminal quiet
        return

    def _host_ok(self) -> bool:
        """Refuse requests whose Host is not this server (DNS rebinding)."""
        port = self.server.server_address[1]
        host = (self.headers.get("Host") or "").lower()
        return host in (f"127.0.0.1:{port}", f"localhost:{port}")

    def _send(self, status: int, body: bytes, ctype: str) -> None:
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Content-Security-Policy", CSP)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _json(self, status: int, data) -> None:
        self._send(status, json.dumps(data).encode("utf-8"), "application/json; charset=utf-8")

    def do_HEAD(self):  # noqa: N802
        self.do_GET()

    def do_GET(self):  # noqa: N802
        if not self._host_ok():
            return self._json(HTTPStatus.FORBIDDEN, {"error": "wrong host"})
        path = unquote(urlparse(self.path).path)
        if path in ("/", "/index.html"):
            return self._send(HTTPStatus.OK, _index().encode("utf-8"), "text/html; charset=utf-8")
        if path == "/favicon.ico":
            return self._send(HTTPStatus.NO_CONTENT, b"", "image/x-icon")
        parts = [p for p in path.split("/") if p]
        if len(parts) == 2 and parts[0] == "m" and path.endswith("/"):
            try:
                page = game.render_page(parts[1], results_url="/api/results")
            except game.GameError as exc:
                return self._json(HTTPStatus.NOT_FOUND, {"error": str(exc)})
            return self._send(HTTPStatus.OK, page.encode("utf-8"), "text/html; charset=utf-8")
        if len(parts) == 2 and parts[0] == "m":
            self.send_response(HTTPStatus.MOVED_PERMANENTLY)
            self.send_header("Location", f"/m/{parts[1]}/")
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        return self._json(HTTPStatus.NOT_FOUND, {"error": "not found"})

    def do_POST(self):  # noqa: N802
        if not self._host_ok():
            return self._json(HTTPStatus.FORBIDDEN, {"error": "wrong host"})
        if urlparse(self.path).path != "/api/results":
            return self._json(HTTPStatus.NOT_FOUND, {"error": "not found"})
        if (self.headers.get("Content-Type") or "").split(";")[0].strip() != "application/json":
            return self._json(HTTPStatus.UNSUPPORTED_MEDIA_TYPE, {"error": "send application/json"})
        try:
            length = int(self.headers.get("Content-Length") or "0")
        except ValueError:
            length = -1
        if length < 0 or length > MAX_BODY:
            return self._json(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, {"error": "result too large"})
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            row = game.record_result(payload)
        except (ValueError, game.GameError) as exc:
            return self._json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})
        return self._json(HTTPStatus.OK, {"ok": True, "saved": row})


def _index() -> str:
    rows = []
    for m in game.list_maps():
        rows.append(f'<li><a href="/m/{html.escape(m["map_id"])}/">{html.escape(m["title"] or m["map_id"])}</a>'
                    f' <small>{m["missions"]} missions · {m["runs"]} runs</small></li>')
    body = "\n".join(rows) or "<li>No maps yet. Ask Hermes to build one.</li>"
    return ("<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'>"
            "<title>Hometown Arcade</title><style>body{font:16px system-ui;background:#0d0f14;color:#f4efe6;"
            "max-width:640px;margin:40px auto;padding:0 16px}a{color:#ff8a3d}li{margin:10px 0}small{color:#b9b2a6}</style>"
            f"<h1>Hometown Arcade</h1><ul>{body}</ul>")


def start(port: int = 0) -> int:
    """Start the server once and return its port. Later calls return the same port."""
    global _server, _thread
    with _lock:
        if _server is not None:
            return _server.server_address[1]
        try:
            srv = ThreadingHTTPServer(("127.0.0.1", int(port)), _Handler)
        except OSError:
            if not port:
                raise
            srv = ThreadingHTTPServer(("127.0.0.1", 0), _Handler)  # the chosen port is busy
        srv.daemon_threads = True
        _server = srv
        _thread = threading.Thread(target=srv.serve_forever, name="hometown-arcade-http", daemon=True)
        _thread.start()
        return srv.server_address[1]


def url_for(map_id: str, port: int, mission_id: str = "") -> str:
    tail = f"#mission={mission_id}" if mission_id else ""
    return f"http://127.0.0.1:{port}/m/{map_id}/{tail}"


def running_port() -> Optional[int]:
    return _server.server_address[1] if _server is not None else None


def stop() -> None:
    global _server, _thread
    with _lock:
        if _server is not None:
            _server.shutdown()
            _server.server_close()
        _server = None
        _thread = None
