"""Apply an authenticated AURA viewport region to the user's Spotify window."""

import argparse
import ctypes as ct
from ctypes import wintypes as wt
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import os
from pathlib import Path
import secrets
import socket
import sys
import time
from urllib import error, request


HOST = "127.0.0.1"
ORIGIN = "https://xpui.app.spotify.com"
LEASE_SECONDS = 2.8
MAX_BODY_BYTES = 12_288
LAYOUT = "/layout/v1"
APPDATA = Path(os.environ["APPDATA"])
MODULE = APPDATA / "spicetify/Extensions/node_modules/aura-native"
CONFIG = MODULE / "bridge-config.mjs"
SPOTIFY = APPDATA / "Spotify/Spotify.exe"
EXPORT = "export default "
DWMWA_SYSTEMBACKDROP_TYPE = 38
DWMSBT_NONE = 1


def config_path(prepare=False):
    if prepare and not CONFIG.exists():
        if not MODULE.is_dir():
            raise ValueError("Instale o módulo aura-native na pasta do Spicetify primeiro.")
        with socket.socket() as candidate:
            candidate.bind((HOST, 0))
            config = {"port": candidate.getsockname()[1], "token": secrets.token_hex(32)}
        try:
            with CONFIG.open("x", encoding="utf-8") as target:
                target.write(EXPORT + json.dumps(config) + ";\n")
        except FileExistsError:
            pass
    contents = CONFIG.read_text(encoding="utf-8").strip()
    if not contents.startswith(EXPORT) or not contents.endswith(";"):
        raise ValueError("Configuração local do recorte inválida.")
    config = json.loads(contents[len(EXPORT):-1])
    if not isinstance(config, dict) or set(config) != {"port", "token"}:
        raise ValueError("Configuração local do recorte inválida.")
    port, token = config["port"], config["token"]
    if type(port) is not int or not 1024 <= port <= 65535 or not isinstance(token, str) or len(token) != 64:
        raise ValueError("Configuração local do recorte inválida.")
    if any(letter not in "0123456789abcdef" for letter in token):
        raise ValueError("Chave local do recorte inválida.")
    return port, token


def read_polygons(data):
    if not isinstance(data, dict) or set(data) != {"polygons"}:
        raise ValueError("Formato do layout inválido.")
    polygons = data["polygons"]
    if polygons is None:
        return None
    if not isinstance(polygons, list) or not 3 <= len(polygons) <= 13:
        raise ValueError("Quantidade de regiões inválida.")
    for polygon in polygons:
        if not isinstance(polygon, list) or not 3 <= len(polygon) <= 24:
            raise ValueError("Formato da região inválido.")
        if not all(isinstance(point, list) and len(point) == 2 and
                   all(type(axis) is int and 0 <= axis <= 10_000 for axis in point)
                   for point in polygon):
            raise ValueError("Coordenadas da região inválidas.")
    return polygons


class Windows:
    def __init__(self):
        self.user = ct.WinDLL("user32", use_last_error=True)
        self.gdi = ct.WinDLL("gdi32", use_last_error=True)
        self.kernel = ct.WinDLL("kernel32", use_last_error=True)
        self.dwm = ct.WinDLL("dwmapi")
        self.enum_callback = ct.WINFUNCTYPE(wt.BOOL, wt.HWND, wt.LPARAM)
        signatures = (
            (self.user.EnumWindows, wt.BOOL, (self.enum_callback, wt.LPARAM)),
            (self.user.GetWindow, wt.HWND, (wt.HWND, wt.UINT)),
            (self.user.IsWindowVisible, wt.BOOL, (wt.HWND,)),
            (self.user.IsIconic, wt.BOOL, (wt.HWND,)),
            (self.user.GetWindowThreadProcessId, wt.DWORD, (wt.HWND, ct.POINTER(wt.DWORD))),
            (self.user.GetClassNameW, ct.c_int, (wt.HWND, wt.LPWSTR, ct.c_int)),
            (self.user.GetClientRect, wt.BOOL, (wt.HWND, ct.POINTER(wt.RECT))),
            (self.user.GetWindowRect, wt.BOOL, (wt.HWND, ct.POINTER(wt.RECT))),
            (self.user.ClientToScreen, wt.BOOL, (wt.HWND, ct.POINTER(wt.POINT))),
            (self.user.GetWindowRgn, ct.c_int, (wt.HWND, wt.HRGN)),
            (self.user.SetWindowRgn, ct.c_int, (wt.HWND, wt.HRGN, wt.BOOL)),
            (self.user.SetProcessDpiAwarenessContext, wt.BOOL, (ct.c_void_p,)),
            (self.dwm.DwmGetWindowAttribute, ct.c_long, (wt.HWND, wt.DWORD, ct.c_void_p, wt.DWORD)),
            (self.dwm.DwmSetWindowAttribute, ct.c_long, (wt.HWND, wt.DWORD, ct.c_void_p, wt.DWORD)),
            (self.gdi.CreateRectRgn, wt.HRGN, (ct.c_int,) * 4),
            (self.gdi.CreatePolyPolygonRgn, wt.HRGN, (ct.POINTER(wt.POINT), ct.POINTER(ct.c_int), ct.c_int, ct.c_int)),
            (self.gdi.DeleteObject, wt.BOOL, (wt.HGDIOBJ,)),
            (self.kernel.OpenProcess, wt.HANDLE, (wt.DWORD, wt.BOOL, wt.DWORD)),
            (self.kernel.QueryFullProcessImageNameW, wt.BOOL, (wt.HANDLE, wt.DWORD, wt.LPWSTR, ct.POINTER(wt.DWORD))),
            (self.kernel.CloseHandle, wt.BOOL, (wt.HANDLE,)),
        )
        for function, result, arguments in signatures:
            function.restype = result
            function.argtypes = arguments
        self.user.SetProcessDpiAwarenessContext(ct.c_void_p(-4))
        self.spotify = os.path.normcase(str(SPOTIFY.resolve()))

    def process_id(self, window):
        pid = wt.DWORD()
        self.user.GetWindowThreadProcessId(window, ct.byref(pid))
        return pid.value

    def spotify_process(self, pid):
        process = self.kernel.OpenProcess(0x1000, False, pid)
        if not process:
            return False
        try:
            image = ct.create_unicode_buffer(1024)
            length = wt.DWORD(len(image))
            return bool(self.kernel.QueryFullProcessImageNameW(process, 0, image, ct.byref(length))) and (
                os.path.normcase(image.value) == self.spotify
            )
        finally:
            self.kernel.CloseHandle(process)

    def window(self):
        candidates = []

        @self.enum_callback
        def collect(window, _):
            if not self.user.IsWindowVisible(window) or self.user.IsIconic(window) or self.user.GetWindow(window, 4):
                return True
            name = ct.create_unicode_buffer(80)
            self.user.GetClassNameW(window, name, len(name))
            if not name.value.startswith("Chrome_WidgetWin_"):
                return True
            geometry = self.geometry(window)
            if geometry and geometry[0] >= 800 and geometry[1] >= 400:
                pid = self.process_id(window)
                if self.spotify_process(pid):
                    candidates.append((window, pid))
            return True

        self.user.EnumWindows(collect, 0)
        return candidates[0] if len(candidates) == 1 else None

    def geometry(self, window):
        frame = wt.RECT()
        client = wt.RECT()
        origin = wt.POINT()
        if not (self.user.GetWindowRect(window, ct.byref(frame)) and
                self.user.GetClientRect(window, ct.byref(client)) and
                self.user.ClientToScreen(window, ct.byref(origin))):
            return None
        return client.right, client.bottom, origin.x - frame.left, origin.y - frame.top

    def backdrop(self, window):
        value = wt.DWORD()
        result = self.dwm.DwmGetWindowAttribute(
            window, DWMWA_SYSTEMBACKDROP_TYPE, ct.byref(value), ct.sizeof(value),
        )
        return value.value if result == 0 else None

    def set_backdrop(self, window, value):
        setting = wt.DWORD(value)
        return self.dwm.DwmSetWindowAttribute(
            window, DWMWA_SYSTEMBACKDROP_TYPE, ct.byref(setting), ct.sizeof(setting),
        ) == 0


class Region:
    def __init__(self, windows):
        self.windows = windows
        self.window = None
        self.original = None
        self.original_backdrop = None
        self.last = None
        self.expires = 0.0

    def restore(self):
        if not self.window:
            return True
        hwnd, pid = self.window
        if self.windows.process_id(hwnd) == pid:
            if self.original_backdrop is not None:
                if not self.windows.set_backdrop(hwnd, self.original_backdrop):
                    return False
                self.original_backdrop = None
            if self.last is not None:
                if not self.windows.user.SetWindowRgn(hwnd, self.original, True):
                    return False
            elif self.original:
                self.windows.gdi.DeleteObject(self.original)
        elif self.original:
            self.windows.gdi.DeleteObject(self.original)
        self.window = self.original = self.original_backdrop = self.last = None
        self.expires = 0.0
        return True

    def apply(self, polygons):
        if polygons is None:
            return self.restore()
        if self.window and self.windows.process_id(self.window[0]) == self.window[1] and not self.windows.user.IsIconic(self.window[0]):
            window = self.window
        else:
            window = self.windows.window()
        if not window:
            self.restore()
            return False
        hwnd = window[0]
        geometry = self.windows.geometry(hwnd)
        if not geometry:
            return False
        signature = (geometry, polygons)
        if window != self.window:
            if not self.restore():
                return False
            original = self.windows.gdi.CreateRectRgn(0, 0, 0, 0)
            if original and not self.windows.user.GetWindowRgn(hwnd, original):
                self.windows.gdi.DeleteObject(original)
                original = None
            self.window, self.original = window, original

        # Mica can paint the uncovered pixels even when Win32 hit testing already passes through.
        backdrop = self.windows.backdrop(hwnd)
        if backdrop is not None and backdrop != DWMSBT_NONE:
            if not self.windows.set_backdrop(hwnd, DWMSBT_NONE):
                self.restore()
                return False
            self.original_backdrop = backdrop
        if signature == self.last:
            self.expires = time.monotonic() + LEASE_SECONDS
            return True

        width, height, x, y = geometry
        lengths = (ct.c_int * len(polygons))(*(len(polygon) for polygon in polygons))
        points = (wt.POINT * sum(lengths))(*(
            wt.POINT(x + round(px * width / 10_000), y + round(py * height / 10_000))
            for polygon in polygons for px, py in polygon
        ))
        handle = self.windows.gdi.CreatePolyPolygonRgn(points, lengths, len(polygons), 2)
        if not handle:
            self.restore()
            return False
        if not self.windows.user.SetWindowRgn(hwnd, handle, True):
            self.windows.gdi.DeleteObject(handle)
            self.restore()
            return False
        self.last = signature
        self.expires = time.monotonic() + LEASE_SECONDS
        return True


class LocalBridge(HTTPServer):
    def __init__(self, port, token):
        self.token = token
        self.region = Region(Windows())
        self.finished = False
        super().__init__((HOST, port), Handler)
        self.timeout = .24

    def run(self):
        try:
            while not self.finished:
                self.handle_request()
                if self.region.window and time.monotonic() >= self.region.expires:
                    self.region.restore()
        finally:
            self.region.restore()


class Handler(BaseHTTPRequestHandler):
    def setup(self):
        self.request.settimeout(1.0)
        super().setup()

    def log_message(self, *_):
        pass

    def reply(self, status, body=b"", cors=False):
        self.send_response(status)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        if cors:
            self.send_header("Access-Control-Allow-Origin", ORIGIN)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
            self.send_header("Access-Control-Allow-Private-Network", "true")
        self.end_headers()
        if body:
            self.wfile.write(body)

    def valid_host(self):
        return self.headers.get("Host") == f"{HOST}:{self.server.server_port}"

    def do_OPTIONS(self):
        allowed = (self.valid_host() and self.path == LAYOUT and self.headers.get("Origin") == ORIGIN
                   and self.headers.get("Access-Control-Request-Method") == "POST")
        self.reply(204 if allowed else 403, cors=allowed)

    def do_POST(self):
        bridge = self.server
        cors = self.path == LAYOUT and self.headers.get("Origin") == ORIGIN
        local_control = self.path in {"/status/v1", "/stop/v1"} and self.headers.get("Origin") is None
        auth = self.headers.get("Authorization", "").encode("utf-8")
        if not self.valid_host() or not (cors or local_control) or not secrets.compare_digest(
            auth, ("Bearer " + bridge.token).encode("ascii")
        ):
            self.reply(403, cors=cors)
            return
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if self.headers.get_content_type() != "application/json" or not 0 < size <= MAX_BODY_BYTES:
                raise ValueError()
            data = json.loads(self.rfile.read(size))
            if cors:
                valid = bridge.region.apply(read_polygons(data))
                self.reply(204 if valid else 409, cors=True)
            elif data != {}:
                self.reply(400)
            elif self.path == "/stop/v1":
                if bridge.region.restore():
                    bridge.finished = True
                    self.reply(204)
                else:
                    self.reply(409)
            else:
                self.reply(200, json.dumps({"active": bool(bridge.region.last)}).encode("ascii"))
        except (ValueError, OSError):
            self.reply(400, cors=cors)


def control(port, token, operation):
    req = request.Request(f"http://{HOST}:{port}/{operation}/v1", b"{}", headers={
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json",
    })
    # O auxiliar só conversa com o endereço local, inclusive em máquinas com proxy.
    opener = request.build_opener(request.ProxyHandler({}))
    with opener.open(req, timeout=1.2) as response:
        print(response.read().decode("ascii") or "OK")


def main():
    parser = argparse.ArgumentParser(description="Recorte da janela do Spotify para o AURA.")
    parser.add_argument("operation", choices=("prepare", "serve", "status", "stop"))
    operation = parser.parse_args().operation
    try:
        port, token = config_path(prepare=operation == "prepare")
        if operation == "serve":
            with LocalBridge(port, token) as bridge:
                bridge.run()
        elif operation != "prepare":
            control(port, token, operation)
    except (ValueError, OSError, error.URLError) as failure:
        if operation == "stop" and isinstance(failure, error.URLError) and isinstance(failure.reason, ConnectionRefusedError):
            print("O auxiliar já está parado.")
            return 0
        if sys.stderr:
            print("AURA:", failure, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
