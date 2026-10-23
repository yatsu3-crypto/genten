#!/usr/bin/env python3
"""entries/*.md と private/*.md を読み、データを template.html に埋め込んで出力する。

使い方: python3 build.py
- genten.html（公開用）は entries/ だけから作る。
- genten-local.html（手元用）は entries/ に private/<方剤名>.md の同じ見出しの内容を足して作る。
- 公開用には private/ に中身がある見出しの名前だけを渡す（画面で「手元版のみ」と出すため）。中身は入れない。
- private/ と genten-local.html はリポジトリに入れない（.gitignore 済み）。
- `_` で始まるファイル（_template.md など）は読まない。方剤が0件でも出力する。
"""
import datetime
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent
ENTRIES = ROOT / "entries"
PRIVATE = ROOT / "private"
TEMPLATE = ROOT / "template.html"
OUT_PUBLIC = ROOT / "genten.html"
OUT_LOCAL = ROOT / "genten-local.html"

META_KEYS = ["名前", "読み", "ツムラ番号", "出典", "別名"]
SECTIONS = ["条文", "出典", "構成", "方意", "諸家の論", "院長メモ"]


def md_files(folder):
    return sorted(p for p in folder.glob("*.md") if not p.name.startswith("_")) if folder.is_dir() else []


def read_md(path):
    """frontmatter と「## 見出し」ごとの本文を返す。"""
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
        print("警告: %s/%s に未知の見出しがあります（表示されません）: %s"
              % (path.parent.name, path.name, "、".join(unknown)), file=sys.stderr)
    return meta, sections


def parse(path):
    meta, sections = read_md(path)
    # 旧方式の「非公開」印が残っていたら公開してしまうので止める
    if "非公開 -->" in path.read_text(encoding="utf-8"):
        print("エラー: entries/%s に非公開の印があります。非公開部分は private/%s に移してください。何も出力していません。"
              % (path.name, path.name), file=sys.stderr)
        sys.exit(1)
    entry = {"file": path.stem}
    for k in META_KEYS:
        entry[k] = meta.get(k, "")
    if not entry["名前"]:
        entry["名前"] = path.stem
    entry["本文"] = {k: sections.get(k, "") for k in SECTIONS}
    entry["非公開"] = []
    return entry


def with_private(entry, sections, edition):
    """「非公開」に private/ に中身がある見出し名を入れる。手元用ではその内容を公開部分の後ろに足す。
    公開用には見出し名だけを渡し、中身は渡さない。"""
    e = dict(entry, 本文=dict(entry["本文"]), 非公開=[k for k in SECTIONS if sections.get(k)])
    if edition == "local":
        for k in e["非公開"]:
            e["本文"][k] = (e["本文"][k] + "\n\n" + sections[k]).strip()
    return e


def sort_key(e):
    num = e["ツムラ番号"]
    return (0, int(num), e["読み"]) if num.isdigit() else (1, 0, e["読み"] or e["名前"])


def write(out, edition, entries):
    data = {
        "built": datetime.date.today().isoformat(),
        "edition": edition,
        "sections": SECTIONS,
        "entries": entries,
    }
    # </script> で埋め込みが途切れないようにする
    payload = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    out.write_text(TEMPLATE.read_text(encoding="utf-8").replace("__GENTEN_DATA__", payload), encoding="utf-8")
    print("%s を出力しました（方剤 %d 件）" % (out.name, len(entries)))


def main():
    entries = sorted((parse(p) for p in md_files(ENTRIES)), key=sort_key)
    private = {p.stem: read_md(p)[1] for p in md_files(PRIVATE)}
    orphans = sorted(set(private) - {e["file"] for e in entries})
    if orphans:
        print("警告: entries/ に対応する方剤がない private/ のファイルは読みません: %s"
              % "、".join(n + ".md" for n in orphans), file=sys.stderr)
    for out, edition in [(OUT_PUBLIC, "public"), (OUT_LOCAL, "local")]:
        write(out, edition, [with_private(e, private.get(e["file"], {}), edition) for e in entries])


if __name__ == "__main__":
    main()
