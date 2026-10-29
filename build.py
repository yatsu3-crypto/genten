#!/usr/bin/env python3
"""entries/*.md と private/*.md を読み、データを template.html に埋め込んで出力する。

使い方: python3 build.py
- genten.html（公開用）は entries/ だけから作る。
- genten-local.html（手元用）は entries/ に private/<方剤名>.md の同じ見出しの内容を足して作る。
- 公開用には private/ に中身がある見出しの名前だけを渡す（画面で「手元版のみ」と出すため）。中身は入れない。
- private/ と genten-local.html はリポジトリに入れない（.gitignore 済み）。
- `_` で始まるファイル（_template.md など）は読まない。方剤が0件でも出力する。

画面の組み立て（漢方総合アプリ）:
- template.html は外枠（header・下部タブ）。各タブの中身は modules/<名前>/ にある。
  - *.css → __MODULES_CSS__、head.html → __MODULES_HEAD__、view.html → __MODULES_HTML__、*.js → __MODULES_JS__
  - 共通部品 modules/common/ は決まった順で先に入れる（router.js だけは最後）。
- 公開用で modules/<名前>/placeholder.html があれば、view.html の代わりにそれを入れる（脈診＝「手元版のみ」）。
- 手元用で modules-local/<名前>/ があれば、そのモジュールは丸ごとそちらを使う（modules-local/ は .gitignore 済み）。

共通の方剤データ（2日目。中身は formulas.py）:
- DATA に formulas（方剤ごとの構成と量）・nameIndex（方剤名の表記ゆれ→id）・herbIndex（生薬→方剤）を足す。
- 量は data/ekisu.tsv から取る。無いときだけ entries の PMDA 行から初期値を作る（上書きしない）。
- 検査結果（構成と表の名前の食い違い・量の空欄・証ナビとの食い違い）を表示し、sources/ があれば
  sources/pmda-check.md（社員に渡す PMDA 確認リスト。非公開）にも書き出す。
"""
import datetime
import json
import pathlib
import sys

import formulas as fm

ROOT = pathlib.Path(__file__).resolve().parent
ENTRIES = ROOT / "entries"
PRIVATE = ROOT / "private"
TEMPLATE = ROOT / "template.html"
OUT_PUBLIC = ROOT / "genten.html"
OUT_LOCAL = ROOT / "genten-local.html"
MODULES = ROOT / "modules"
MODULES_LOCAL = ROOT / "modules-local"
EKISU = ROOT / "data" / "ekisu.tsv"
PMDA_CHECK = ROOT / "sources" / "pmda-check.md"

# 下部タブの順。template.html の .apptab と同じ並び
MODULE_ORDER = ["genten", "shou", "myaku", "fuku"]
COMMON_CSS = ["base.css", "dark.css"]
COMMON_JS_FIRST = ["store.js", "linkify.js", "subtabs.js"]
COMMON_JS_LAST = ["router.js"]
SLOTS = ["__MODULES_CSS__", "__MODULES_HEAD__", "__MODULES_HTML__", "__MODULES_JS__", "__GENTEN_DATA__"]

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


def fail(msg):
    print("エラー: " + msg + " 何も出力していません。", file=sys.stderr)
    sys.exit(1)


def read(path):
    return path.read_text(encoding="utf-8").rstrip("\n") if path.is_file() else ""


def module_dir(name, edition):
    local = MODULES_LOCAL / name
    if edition == "local" and local.is_dir():
        return local
    return MODULES / name


def assemble(edition):
    """modules/ を読み、template.html の差し込み場所ごとの文字列を返す。"""
    common = MODULES / "common"
    css = [read(common / f) for f in COMMON_CSS]
    js = [read(common / f) for f in COMMON_JS_FIRST]
    head, html = [], []
    for name in MODULE_ORDER:
        d = module_dir(name, edition)
        if not d.is_dir():
            fail("modules/%s/ がありません。" % name)
        view = d / "view.html"
        if edition == "public" and (d / "placeholder.html").is_file():
            view = d / "placeholder.html"
        css += [read(p) for p in sorted(d.glob("*.css"))]
        js += [read(p) for p in sorted(d.glob("*.js"))]
        head.append('<div class="mhead" data-mod="%s">%s</div>' % (name, read(d / "head.html")))
        html.append('<section class="mod" data-mod="%s" id="m-%s">\n%s\n</section>' % (name, name, read(view)))
    js += [read(common / f) for f in COMMON_JS_LAST]
    parts = {
        "__MODULES_CSS__": "\n".join(c for c in css if c),
        "__MODULES_HEAD__": "\n  ".join(head),
        "__MODULES_HTML__": "\n".join(html),
        "__MODULES_JS__": "\n".join(j for j in js if j),
    }
    for k in ("__MODULES_CSS__", "__MODULES_JS__"):
        if "</script" in parts[k].lower() or "</style" in parts[k].lower():
            fail("modules/ の CSS・JS に </script> か </style> が含まれています。")
    return parts


def write(out, edition, entries, shared):
    data = {
        "built": datetime.date.today().isoformat(),
        "edition": edition,
        "schema": 2,
        "sections": SECTIONS,
        "entries": entries,
    }
    data.update(shared)
    template = TEMPLATE.read_text(encoding="utf-8")
    for s in SLOTS:
        if template.count(s) != 1:
            fail("template.html に %s がちょうど1つありません。" % s)
    # </script> で埋め込みが途切れないようにする
    payload = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    parts = assemble(edition)
    parts["__GENTEN_DATA__"] = payload
    # 差し込み場所を template の前から順に1回ずつ置き換える（差し込んだ中身はもう一度は探さない）
    result, rest = [], template
    for s in sorted(SLOTS, key=template.index):
        i = rest.index(s)
        result += [rest[:i], parts[s]]
        rest = rest[i + len(s):]
    result.append(rest)
    out.write_text("".join(result), encoding="utf-8")
    print("%s を出力しました（方剤 %d 件）" % (out.name, len(entries)))


def main():
    entries = sorted((parse(p) for p in md_files(ENTRIES)), key=sort_key)
    private = {p.stem: read_md(p)[1] for p in md_files(PRIVATE)}
    orphans = sorted(set(private) - {e["file"] for e in entries})
    if orphans:
        print("警告: entries/ に対応する方剤がない private/ のファイルは読みません: %s"
              % "、".join(n + ".md" for n in orphans), file=sys.stderr)
    shared = formula_data(entries)
    for out, edition in [(OUT_PUBLIC, "public"), (OUT_LOCAL, "local")]:
        write(out, edition, [with_private(e, private.get(e["file"], {}), edition) for e in entries], shared)


def formula_data(entries):
    """共通の方剤データを作り、検査結果を出す。formulas は entries（公開部分）と ekisu.tsv だけから作る。"""
    if not EKISU.is_file():
        fm.write_tsv(EKISU, fm.init_rows(entries))
        print("%s が無かったので、entries の PMDA 行から初期値を作りました" % EKISU.relative_to(ROOT))
    try:
        tsv = fm.read_tsv(EKISU)
    except ValueError as err:
        fail(str(err) + "。")
    formulas, name_index, herb_index, checks = fm.build_data(entries, tsv)
    lines = fm.report(checks, formulas, EKISU)
    print("\n".join(["", "==== 方剤データの検査 ===="] + lines + [""]))
    if PMDA_CHECK.parent.is_dir():
        PMDA_CHECK.write_text(pmda_check_md(lines), encoding="utf-8")
        print("%s に PMDA 確認リストを書き出しました（非公開）" % PMDA_CHECK.relative_to(ROOT))
    return {"formulas": formulas, "nameIndex": name_index, "herbIndex": herb_index}


def pmda_check_md(lines):
    head = [
        "# PMDA 確認リスト（漢方総合アプリ・エキス剤の生薬量）",
        "",
        "作成 %s（build.py が毎回作り直す。このファイルを直接直さない）。非公開（sources/）。" % datetime.date.today().isoformat(),
        "",
        "## これまでの経過",
        "",
        "- 2026-10-29：全147方剤の PMDA 添付文書を確かめた。量が空欄だった46方剤は添付文書から転記（`量の出所`＝PMDA）、",
        "  entries から取っていた101方剤は添付文書と照合して食い違い0件。全行の `PMDA確認` に確かめた日と版、`URL` に添付文書のページを書いた。",
        "- 添付文書のカタカナ名 → 構成の漢字名は、2日目の読み替え表に加え、再照合した方剤の「並びの位置と量の一致」と「方剤内の消去法」で決めた（記憶は使っていない）。",
        "  これで決まらなかった名前の量は空欄のまま（下の (2) の「院長確認待ち」）。",
        "- 附子人参湯は三和の「附子理中湯エキス細粒」の量を `量の出所`＝保留 で入れてある。院長が決めるまでアプリでは量未確認として扱う。",
        "",
        "## 表を直すときの決まり",
        "",
        "1. `data/ekisu.tsv` を表計算ソフト（タブ区切り）で開く。1行＝方剤の生薬1つ、ツムラ番号順。",
        "2. 量は PMDA の医療用医薬品の添付文書（ツムラの製剤を基本とする）の組成欄「1日量中の生薬量（g）」から書く。",
        "3. 書いた行・確かめた行の `PMDA確認` に、確かめた日と添付文書の改訂年月・版を、`URL` に添付文書のページを書く。",
        "4. PMDA と違う数字・違う生薬があったら、表は PMDA に合わせて直し、`量の出所` を `PMDA` にし、`注記` に何が違ったかを書く。",
        "   entries（原典の本文）は直さない。違いは院長に報告する。",
        "5. ツムラの製剤が無い方剤は、どの製剤の量を載せるか院長に確認してから書く。`製剤` のメーカー名はアプリの画面に出る。",
        "6. 生薬名は entries の「構成」と同じ表記にする（例：附子（ブシ末））。添付文書のカタカナ名では書かない。",
        "7. 分からない量は空欄のままにする（空欄はアプリで「量 要確認」と出て、甘草の合計には入らない）。",
        "8. 附子人参湯の扱いを院長が決めたら、`量の出所` の「保留」を「PMDA」に直す（そのときから合計に入る）。",
        "",
        "## いまの状態",
        "",
    ]
    return "\n".join(head + lines) + "\n"


if __name__ == "__main__":
    main()
