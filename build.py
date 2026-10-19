#!/usr/bin/env python3
"""entries/*.md を読み、データを template.html に埋め込んで genten.html を出力する。

使い方: python3 build.py
- `_` で始まるファイル（_template.md など）は読まない。
- 方剤が0件でも genten.html を出力する。
"""
import datetime
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent
ENTRIES = ROOT / "entries"
TEMPLATE = ROOT / "template.html"
OUT = ROOT / "genten.html"

META_KEYS = ["名前", "読み", "ツムラ番号", "出典"]
SECTIONS = ["条文", "出典", "構成", "方意", "諸家の論", "院長メモ"]


def parse(path):
    text = path.read_text(encoding="utf-8").replace("\r\n", "\n")
    meta, body = {}, text
    if text.startswith("---\n"):
        end = text.find("\n---", 4)
        if end != -1:
            for line in text[4:end].split("\n"):
                if ":" in line:
                    k, v = line.split(":", 1)
                    meta[k.strip()] = v.strip()
            body = text[end + 4:]
    sections, current, buf = {}, None, []
    for line in body.split("\n"):
        if line.startswith("## "):
            if current is not None:
                sections[current] = "\n".join(buf).strip()
            current, buf = line[3:].strip(), []
        elif current is not None:
            buf.append(line)
    if current is not None:
        sections[current] = "\n".join(buf).strip()

    unknown = [k for k in sections if k not in SECTIONS]
    if unknown:
        print("警告: %s に未知の見出しがあります（表示されません）: %s" % (path.name, "、".join(unknown)), file=sys.stderr)
    entry = {"file": path.stem}
    for k in META_KEYS:
        entry[k] = meta.get(k, "")
    if not entry["名前"]:
        entry["名前"] = path.stem
    entry["本文"] = {k: sections.get(k, "") for k in SECTIONS}
    return entry


def sort_key(e):
    num = e["ツムラ番号"]
    return (0, int(num), e["読み"]) if num.isdigit() else (1, 0, e["読み"] or e["名前"])


def main():
    files = sorted(p for p in ENTRIES.glob("*.md") if not p.name.startswith("_")) if ENTRIES.is_dir() else []
    entries = sorted((parse(p) for p in files), key=sort_key)
    data = {
        "built": datetime.date.today().isoformat(),
        "sections": SECTIONS,
        "entries": entries,
    }
    # </script> で埋め込みが途切れないようにする
    payload = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    html = TEMPLATE.read_text(encoding="utf-8").replace("__GENTEN_DATA__", payload)
    OUT.write_text(html, encoding="utf-8")
    print("genten.html を出力しました（方剤 %d 件）" % len(entries))


if __name__ == "__main__":
    main()
