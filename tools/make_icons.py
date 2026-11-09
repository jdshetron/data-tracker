"""Draw the app icons (icons/icon-192.png, icons/icon-512.png) with the standard library only.

The design matches icons/icon.svg: a screen outline with a play triangle and a stand.
Run once: python tools/make_icons.py
"""

import struct
import zlib
from pathlib import Path

BG = (0x12, 0x11, 0x10)
FG = (0xF0, 0xB4, 0x29)


def pixel(x, y):
    """Colour at (x, y) in a 64x64 design space (floats)."""
    # screen outline: rect 10..54 x 16..46, stroke 4
    outer = 8 <= x <= 56 and 14 <= y <= 48
    inner = 12 <= x <= 52 and 18 <= y <= 44
    if outer and not inner:
        return FG
    # play triangle: (28,24) (40,31) (28,38)
    if 28 <= x <= 40 and abs(y - 31) <= (40 - x) * 7 / 12:
        return FG
    # stand
    if 20 <= x <= 44 and 50 <= y <= 54:
        return FG
    return BG


def png(size):
    rows = []
    for py in range(size):
        row = bytearray([0])
        for px in range(size):
            row += bytes(pixel((px + .5) * 64 / size, (py + .5) * 64 / size))
        rows.append(bytes(row))
    raw = zlib.compress(b"".join(rows), 9)

    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", raw) + chunk(b"IEND", b""))


if __name__ == "__main__":
    out = Path(__file__).resolve().parents[1] / "icons"
    for size in (192, 512):
        (out / f"icon-{size}.png").write_bytes(png(size))
        print(f"wrote icons/icon-{size}.png")
