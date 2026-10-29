"""共通の方剤データ（formulas・nameIndex・herbIndex）と data/ekisu.tsv の読み書き・検査。build.py から使う。

- 生薬の一覧は entries の「## 構成」から取る（表記はそのまま＝raw）。集計用の名前（canon）は HERB_CANON で寄せる。
- 量（g）は data/ekisu.tsv から取る。ekisu.tsv はツムラの添付文書（PMDA）を正とし、クリニックの社員が確認・記入する。
- ekisu.tsv が無いときだけ、entries の「## 出典」の PMDA 行に書かれた量を解析して初期値を作る（上書きはしない）。
  量が取れない生薬は空欄＝「要確認」。記憶や他アプリ（副作用ナビ・証ナビ）の数字は使わない。
"""
import re
import sys

# ---- 院長の決定（Q5：生薬の同一視） ----
# 括弧書き（附子（ブシ末）・附子（加工ブシ）・大棗（要確認）・蒼朮（白朮））は外してから寄せる。
HERB_CANON = {"桂枝": "桂皮", "橘皮": "陳皮", "炙甘草": "甘草", "無水芒硝": "芒硝"}
# 別の生薬として記録し、メーカー差として注記するもの（同じにしない）
SEPARATE = {
    "浜防風": "防風とは別の生薬として記録（院長決定 Q5・メーカー差）",
    "樸樕": "桜皮とは別の生薬として記録（院長決定 Q5・メーカー差）",
    "和羌活": "羌活とは別の生薬として記録（院長決定 Q5・メーカー差）",
}
# 注意生薬（集計用の名前）。併用チェックの早見に使う
KEY_HERBS = ["甘草", "麻黄", "大黄", "附子", "黄芩", "山梔子", "芒硝"]

# ---- 方剤名の表記ゆれ（他アプリの表記 → entries の id）。別名にあるものは別名から自動で入る ----
NAME_VARIANTS = {"加味逍遥散": "加味逍遙散", "防己黄耆湯": "防已黄耆湯", "竹茹温胆湯": "竹筎温胆湯", "附子理中湯": "附子人参湯"}

# ---- 方剤ごとの注記（ekisu.tsv のその方剤の1行目に入れる） ----
FORMULA_NOTES = {
    "女神散": "原典には大黄あり（ツムラは大黄なし）",
}
# 設計案3章：証ナビと entries の構成の食い違い（PMDA で要確認。ここでは直さない＝院長決定 Q15）
DISCREPANCIES = [
    ("十味敗毒湯", "樸樕", "証ナビは桜皮、entries（ツムラ6）は樸樕"),
    ("清上防風湯", "浜防風", "証ナビは防風、entries（ツムラ58）は浜防風"),
    ("二朮湯", "和羌活", "証ナビは羌活、entries（ツムラ88）は和羌活"),
    ("参蘇飲", "木香", "証ナビは木香あり、entries（ツムラ66）は木香なし"),
    ("啓脾湯", "蒼朮", "証ナビは白朮、entries（ツムラ128）は蒼朮"),
    ("滋陰降火湯", "蒼朮", "証ナビは白朮、entries（ツムラ93）は蒼朮"),
]

# ---- PMDA 行の解析用：添付文書のカタカナ名 → 構成欄の漢字名 ----
# 生薬名の読みの対応で、量ではない。初期値を作るときだけ使う（院長報告済み：記憶による対応表）。
KATA = {
    "ジオウ": "地黄", "サンシュユ": "山茱萸", "サンヤク": "山薬", "タクシャ": "沢瀉", "ブクリョウ": "茯苓",
    "ボタンピ": "牡丹皮", "ケイヒ": "桂皮", "ケイシ": "桂枝", "ブシ末": "附子", "ブシ": "附子", "加工ブシ": "附子",
    "加工ブシ末": "附子", "カンゾウ": "甘草", "シャクヤク": "芍薬", "ダイオウ": "大黄", "トウニン": "桃仁",
    "キキョウ": "桔梗", "セッコウ": "石膏", "コウイ": "膠飴", "マオウ": "麻黄", "オウゴン": "黄芩",
    "サンシシ": "山梔子", "オウバク": "黄柏", "オウギ": "黄耆", "カンキョウ": "乾姜", "ショウキョウ": "生姜",
    "生ショウキョウ": "生姜", "ソウジュツ": "蒼朮", "ビャクジュツ": "白朮", "ニンジン": "人参", "サンショウ": "山椒",
    "タイソウ": "大棗", "トウキ": "当帰", "センキュウ": "川芎", "チョレイ": "猪苓", "サイコ": "柴胡",
    "ハンゲ": "半夏", "キジツ": "枳実", "ビンロウジ": "檳榔子", "コウボク": "厚朴", "キッピ": "橘皮",
    "ソヨウ": "蘇葉", "モッコウ": "木香", "ゴシュユ": "呉茱萸", "無水ボウショウ": "無水芒硝",
}
MAKERS = [("コタロー", "小太郎漢方製薬"), ("小太郎", "小太郎漢方製薬"), ("〔東洋〕", "東洋薬行"), ("東洋薬行", "東洋薬行"),
          ("三和", "三和生薬"), ("クラシエ", "クラシエ"), ("オースギ", "大杉製薬"), ("大杉", "大杉製薬"),
          ("太虎", "太虎精堂製薬")]

TSV_HEADER = ["ツムラ番号", "方剤名", "生薬名", "量(g)", "製剤", "量の出所", "PMDA確認", "URL", "注記"]
# 量の出所がこれのときは、量が書いてあっても使わない（院長の判断待ち。アプリでは量未確認として扱う）
PENDING_SOURCE = "保留"
TSV_INTRO = [
    "# 漢方総合アプリ：エキス剤の生薬量（1日量中の g）。PMDA の医療用医薬品添付文書を正とする（ツムラの製剤を基本とし、ツムラに無い方剤は他社）。",
    "# 1行＝方剤の生薬1つ。生薬名は entries の「## 構成」と同じ表記にする（違うと build が検査で知らせる）。",
    "# 量(g)：空欄＝要確認（アプリでは合計に入れない）。記憶や他アプリの数字で埋めない。",
    "# 製剤：量を取った添付文書のメーカー。アプリの画面にも出す。",
    "# 量の出所：entries＝entries の出典欄の PMDA 行から転記した値／PMDA＝添付文書から転記した値／保留＝添付文書の値はあるが院長の判断待ち（アプリでは量未確認として扱い、合計に入れない）。",
    "# PMDA確認：PMDA の添付文書で確かめた日と、その添付文書の改訂年月・版。URL：その添付文書の PMDA のページ。",
    "# 列はタブ区切り。# で始まる行は読まない。",
]

NAME = r"[一-龥々ァ-ヶー]+"
NUM = r"\d+(?:\.\d+)?"
REJECT_UNIT = "両銭分匁枚個升合味年月版件日"


def base_name(raw):
    return re.sub(r"（[^）]*）", "", raw).strip()


def canon_name(raw):
    b = base_name(raw)
    return HERB_CANON.get(b, b)


def herbs_of(entry):
    """構成欄の生薬名（raw）の並び。"""
    text = entry["本文"].get("構成", "")
    return [x.strip() for x in re.split(r"[・、\n]", text) if x.strip()]


def is_tsumura(entry):
    return entry["ツムラ番号"].isdigit()


def norm_herb(n):
    n = re.sub(r"^(日局|局外生規)", "", n)
    if n in KATA:
        return KATA[n]
    if n.endswith("末") and n[:-1] in KATA:
        return KATA[n[:-1]]
    return n


def pmda_lines(entry):
    lines = [l for l in entry["本文"].get("出典", "").split("\n") if "PMDA" in l and "未確認" not in l]
    if is_tsumura(entry):
        lines = [l for l in lines if "ツムラ" in l]
    return lines


def makers_in(text):
    out = []
    for key, name in MAKERS:
        if key in text and name not in out:
            out.append(name)
    return out


def parse_line(line, bases):
    """PMDA 行1本から {構成の生薬名(括弧なし): g}・構成にない名前・同じ生薬で値が割れたもの を返す。"""
    s = line.replace("（g）", "g").replace("(g)", "g")
    s = re.sub(NUM + r"\s*g\s*中", "", s)
    s = re.sub(r"エキス\s*" + NUM + r"\s*g", "", s)
    s = re.sub(r"1日量\s*" + NUM + r"\s*g", "", s)
    s = re.sub(r"（[^（）0-9]*）", "", s)   # 数字を含まない括弧書き（生姜（生ショウキョウ）など）を外す
    got, unknown, clash = {}, [], []

    def put(n, g):
        h = norm_herb(n)
        if h not in bases:
            if h not in unknown:
                unknown.append(h)
            return
        if h in got and got[h] != g:
            clash.append(h)
        got[h] = g

    # 「A・B・C の5味で各3.0g」
    for m in re.finditer(r"((?:%s・)+%s)\s*の\s*(\d+)\s*味で各\s*(%s)\s*g" % (NAME, NAME, NUM), s):
        names = m.group(1).split("・")
        if len(names) == int(m.group(2)):
            for n in names:
                put(n, float(m.group(3)))
    s = re.sub(r"((?:%s・)+%s)\s*の\s*(\d+)\s*味で各\s*(%s)\s*g" % (NAME, NAME, NUM), "、", s)
    # 「A・B 各3.0g」（小数か g が付くものだけ）
    for m in re.finditer(r"((?:%s・)*%s)\s*各\s*(%s)\s*(g?)" % (NAME, NAME, NUM), s):
        if "." in m.group(2) or m.group(3):
            for n in m.group(1).split("・"):
                put(n, float(m.group(2)))
    s = re.sub(r"((?:%s・)*%s)\s*各\s*(%s)\s*(g?)" % (NAME, NAME, NUM), "、", s)
    # 「他の6味は各3.0g」は後で（構成の残りがちょうどその数のときだけ）
    rest = re.search(r"他の\s*(\d+)\s*味は各\s*(%s)\s*g" % NUM, s)
    s = re.sub(r"他の\s*\d+\s*味は各\s*%s\s*g" % NUM, "、", s)
    # 「A5.0・B4.0g」「A5.0g・B4.0g」：小数か、自分か「・」で続く並びの最後に g が付くものだけ
    items = list(re.finditer(r"(%s)\s*(%s)" % (NAME, NUM), s))
    chains, cur = [], []
    for it in items:
        if cur and re.fullmatch(r"\s*g?\s*・\s*", s[cur[-1].end():it.start()]):
            cur.append(it)
        else:
            if cur:
                chains.append(cur)
            cur = [it]
    if cur:
        chains.append(cur)
    for ch in chains:
        after_last = s[ch[-1].end():].lstrip()
        if after_last[:1] in REJECT_UNIT and after_last[:1]:
            continue
        chain_g = after_last.startswith("g")
        for it in ch:
            after = s[it.end():].lstrip()
            if after[:1] and after[:1] in REJECT_UNIT:
                continue
            if "." in it.group(2) or after.startswith("g") or chain_g:
                put(it.group(1), float(it.group(2)))
    if rest:
        left = [b for b in bases if b not in got]
        if len(left) == int(rest.group(1)):
            for b in left:
                got[b] = float(rest.group(2))
    return got, unknown, clash


def parse_entry(entry):
    """entries から量の初期値を取り出す。返り値 {g:{base:g}, maker, notes:[...], unknown:[...]}"""
    raws = herbs_of(entry)
    bases = [base_name(r) for r in raws]
    lines = pmda_lines(entry)
    parsed = []
    for l in lines:
        got, unknown, clash = parse_line(l, bases)
        if got or clash:
            parsed.append((l, got, unknown, clash))
    notes, g, unknown = [], {}, []
    if is_tsumura(entry):
        maker = "ツムラ"
        for l, got, unk, clash in parsed:
            for k, v in got.items():
                if k in g and g[k] != v:
                    clash.append(k)
                g.setdefault(k, v)
            unknown += [u for u in unk if u not in unknown]
            for c in clash:
                g.pop(c, None)
                notes.append("%s の量が entries の中で割れている（要確認）" % c)
    else:
        found = []
        for l in lines:
            found += [m for m in makers_in(l) if m not in found]
        notes.append("ツムラの医療用製剤なし（entries）")
        if len(parsed) == 1:
            l, got, unk, clash = parsed[0]
            ms = makers_in(l)
            maker = "／".join(ms or found)
            g = {k: v for k, v in got.items() if k not in clash}
            unknown = unk
            if maker:
                notes.append("量は %s の添付文書（entries に記載）" % maker)
        else:
            maker = "／".join(found)
            if len(parsed) > 1:
                notes.append("量の書かれた製剤が entries に%d つある（%s）。どれを載せるか要確認" % (len(parsed), maker))
    if unknown:
        notes.append("PMDA 行にあり構成欄にない名前：" + "・".join(unknown))
    # PMDA と書かれていない「添付文書」の量は転記しない（PMDA 照合済みのものだけを初期値にする）。あることだけ知らせる
    other = [l for l in entry["本文"].get("出典", "").split("\n")
             if "添付文書" in l and "PMDA" not in l and re.search(NUM + r"\s*g", l)]
    if other and not g:
        ms = makers_in(" ".join(other))
        if not maker:
            maker = "／".join(ms)
        notes.append("entries に%s添付文書の量の記載あり（PMDA と書かれていないため転記していない）" % (ms[0] + "の" if ms else ""))
    return {"g": g, "maker": maker, "notes": notes, "unknown": unknown}


def fmt_g(v):
    return "" if v is None else ("%g" % v if v != int(v) else "%.1f" % v)


def init_rows(entries):
    """entries から ekisu.tsv の初期の行を作る（ツムラ番号順。ツムラ以外は後ろに読み順）。"""
    order = sorted(entries, key=lambda e: (0, int(e["ツムラ番号"]), "") if is_tsumura(e) else (1, 0, e["読み"] or e["名前"]))
    rows = []
    for e in order:
        p = parse_entry(e)
        fnotes = ([FORMULA_NOTES[e["file"]]] if e["file"] in FORMULA_NOTES else []) + p["notes"]
        fnotes += ["証ナビとの違い：%s（PMDA で要確認）" % d for f, h, d in DISCREPANCIES if f == e["file"]]
        for i, raw in enumerate(herbs_of(e)):
            b = base_name(raw)
            g = p["g"].get(b)
            note = list(fnotes) if i == 0 else []
            if b in SEPARATE:
                note.append(SEPARATE[b])
            if HERB_CANON.get(b):
                note.append("集計では%sとして数える（院長決定 Q5）" % HERB_CANON[b])
            rows.append([e["ツムラ番号"] if is_tsumura(e) else "", e["file"], raw, fmt_g(g), p["maker"],
                         "entries" if g is not None else "", "", "", "。".join(note)])
    return rows


def write_tsv(path, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    out = TSV_INTRO + ["\t".join(TSV_HEADER)] + ["\t".join(c.replace("\t", " ") for c in r) for r in rows]
    path.write_text("\n".join(out) + "\n", encoding="utf-8")


def read_tsv(path):
    """ekisu.tsv を読む。返り値 {方剤名: [ {生薬名, g, 製剤, 量の出所, PMDA確認, 注記, ツムラ番号} ]}（ファイルの並び順）"""
    data, header = {}, None
    for no, line in enumerate(path.read_text(encoding="utf-8").split("\n"), 1):
        if not line.strip() or line.startswith("#"):
            continue
        cells = line.split("\t")
        if header is None:
            if cells != TSV_HEADER:
                raise ValueError("%s の見出し行が違います（%d 行目）。期待：%s" % (path.name, no, " / ".join(TSV_HEADER)))
            header = cells
            continue
        cells += [""] * (len(TSV_HEADER) - len(cells))
        r = dict(zip(TSV_HEADER, [c.strip() for c in cells]))
        g = None
        if r["量(g)"]:
            try:
                g = float(r["量(g)"])
            except ValueError:
                raise ValueError("%s の %d 行目：量(g) が数字ではありません（%s）" % (path.name, no, r["量(g)"]))
        # 保留の行は、量が書いてあっても未確認として扱う
        r["pending"] = r["量の出所"] == PENDING_SOURCE
        r["g"] = None if r["pending"] else g
        data.setdefault(r["方剤名"], []).append(r)
    if header is None:
        raise ValueError("%s に見出し行がありません" % path.name)
    return data


def build_data(entries, tsv):
    """formulas・nameIndex・herbIndex と検査結果を返す。"""
    formulas, herb_index = {}, {}
    checks = {"mismatch": [], "blank": [], "disc": [], "differ": [], "orphan": [], "number": [], "unchecked": [], "keyblank": []}
    for e in entries:
        fid = e["file"]
        raws = herbs_of(e)
        rows = tsv.get(fid, [])
        by_name = {}
        for r in rows:
            by_name.setdefault(r["生薬名"], r)
        tsv_names = [r["生薬名"] for r in rows]
        if sorted(tsv_names) != sorted(raws):
            checks["mismatch"].append((e, [n for n in raws if n not in tsv_names], [n for n in tsv_names if n not in raws], not rows))
        nums = {r["ツムラ番号"] for r in rows}
        want = e["ツムラ番号"] if is_tsumura(e) else ""
        if rows and nums != {want}:
            checks["number"].append((e, sorted(nums)))
        herbs = []
        for raw in raws:
            r = by_name.get(raw)
            herbs.append({"raw": raw, "canon": canon_name(raw), "g": r["g"] if r else None})
        have = [h for h in herbs if h["g"] is not None]
        status = "full" if herbs and len(have) == len(herbs) else ("partial" if have else "none")
        if status != "full":
            wait = [x for r in rows for x in r["注記"].split("。") if "院長確認待ち" in x and "対応が資料" in x]
            checks["blank"].append((e, status, [h["raw"] for h in herbs if h["g"] is None], wait))
        parsed = parse_entry(e)["g"]
        for h in herbs:
            pv = parsed.get(base_name(h["raw"]))
            if pv is not None and h["g"] is not None and abs(pv - h["g"]) > 1e-9:
                checks["differ"].append((e, h["raw"], pv, h["g"]))
        key = {}
        for h in herbs:
            if h["canon"] in KEY_HERBS:
                prev = key.get(h["canon"], 0)
                key[h["canon"]] = None if (prev is None or h["g"] is None) else round(prev + h["g"], 3)
        makers = sorted({r["製剤"] for r in rows if r["製剤"]})
        checked = sorted({r["PMDA確認"] for r in rows if r["PMDA確認"]})
        urls = sorted({r["URL"] for r in rows if r["URL"]})
        pending = any(r["pending"] for r in rows)
        if rows and any(not r["PMDA確認"] for r in rows):
            checks["unchecked"].append(e)
        nullkey = [k for k, v in key.items() if v is None]
        if nullkey:
            checks["keyblank"].append((e, nullkey, pending))
        formulas[fid] = {
            "id": fid, "name": e["名前"], "yomi": e["読み"], "tsumura": e["ツムラ番号"] if is_tsumura(e) else "",
            "aliases": [a for a in e["別名"].split("・") if a.strip()],
            "maker": "／".join(makers) or None,
            "herbs": herbs, "doseStatus": status,
            "pmda": "／".join(checked),
            "url": urls[0] if len(urls) == 1 else "",
            "pending": pending,
            # 同じ方剤名で量の違う別の製剤（院長決定2：表には多いほうを載せ、こちらは注記）
            "other": next((m.group(1) for r in rows for m in [re.search(r"ほかの製剤：(.+?)。警告", r["注記"])] if m), ""),
            "key": key,
        }
        for c in sorted({h["canon"] for h in herbs}):
            herb_index.setdefault(c, []).append(fid)
    ids = {e["file"] for e in entries}
    checks["orphan"] = sorted(set(tsv) - ids)
    for f, h, d in DISCREPANCIES:
        if f in formulas:
            hs = [x for x in formulas[f]["herbs"] if base_name(x["raw"]) == h]
            checks["disc"].append((f, h, d, hs[0]["g"] if hs else None, bool(hs)))
    name_index = {}
    for e in entries:
        for n in [e["名前"], e["file"]] + [a.strip() for a in e["別名"].split("・")]:
            if n and n not in name_index:
                name_index[n] = e["file"]
    for k, v in NAME_VARIANTS.items():
        if v not in ids:
            print("警告: 表記ゆれ表の %s → %s の行き先が entries にありません" % (k, v), file=sys.stderr)
            continue
        name_index.setdefault(k, v)
    return formulas, name_index, herb_index, checks


def report(checks, formulas, tsv_path):
    """検査結果を文字列の行で返す（端末表示と sources/pmda-check.md の両方に使う）。"""
    total = len(formulas)
    st = {"full": 0, "partial": 0, "none": 0}
    for f in formulas.values():
        st[f["doseStatus"]] += 1
    L = []
    L.append("方剤 %d 件：量が全部あるもの %d・一部だけ %d・空欄 %d" % (total, st["full"], st["partial"], st["none"]))
    L.append("")
    L.append("## (1) 構成の生薬名と %s の生薬名が合わない方剤（%d 件）" % (tsv_path.name, len(checks["mismatch"])))
    for e, only_e, only_t, missing in checks["mismatch"]:
        if missing:
            L.append("- %s：%s に行がない" % (e["file"], tsv_path.name))
        else:
            L.append("- %s：構成にだけある＝%s／表にだけある＝%s" % (e["file"], "・".join(only_e) or "なし", "・".join(only_t) or "なし"))
    for n in checks["orphan"]:
        L.append("- %s：表にあるが entries に方剤がない" % n)
    for e, nums in checks["number"]:
        L.append("- %s：ツムラ番号が entries（%s）と表（%s）で違う" % (e["file"], e["ツムラ番号"] or "なし", "・".join(nums) or "空欄"))
    if not (checks["mismatch"] or checks["orphan"] or checks["number"]):
        L.append("- なし")
    L.append("")
    L.append("## (2) 量が空欄の方剤（%d 件。ツムラ番号順）" % len(checks["blank"]))
    for e, status, blank, wait in checks["blank"]:
        num = ("ツムラ%s" % e["ツムラ番号"]) if is_tsumura(e) else "ツムラ製剤なし"
        pend = formulas[e["file"]]["pending"]
        L.append("- [%s] %s（%s）：%s" % (num, e["file"], "保留＝院長の判断待ち。量未確認として扱う" if pend
                                         else ("一部空欄" if status == "partial" else "全部空欄"), "・".join(blank)))
        for w in wait:
            L.append("  - " + w)
    L.append("")
    L.append("## (2-2) 注意生薬（%s）の量が未確認の方剤（%d 件。併用チェックで「量未確認」と出る）" % ("・".join(KEY_HERBS), len(checks["keyblank"])))
    for e, nullkey, pend in checks["keyblank"]:
        L.append("- %s：%s%s" % (e["file"], "・".join(nullkey), "（保留）" if pend else ""))
    if not checks["keyblank"]:
        L.append("- なし")
    L.append("")
    L.append("## (2-3) PMDA確認 が空欄の行がある方剤（%d 件）" % len(checks["unchecked"]))
    for e in checks["unchecked"]:
        L.append("- %s" % e["file"])
    if not checks["unchecked"]:
        L.append("- なし")
    L.append("")
    L.append("## (3) 証ナビと entries の構成の食い違い（設計案3章。証ナビ側の扱いは4日目）")
    for f, h, d, g, has in checks["disc"]:
        now = ("いまの表：%s %s g" % (h, fmt_g(g)) if g is not None else "いまの表：%s 量空欄" % h) if has else "いまの構成に%sは無い" % h
        chk = formulas[f]["pmda"] if f in formulas else ""
        L.append("- %s：%s。%s。%s" % (f, d, now, ("PMDA 確認 %s：添付文書は entries の構成と同じ" % chk) if chk else "PMDA 未確認"))
    L.append("")
    L.append("## (4) entries の PMDA 行と %s で量が違うもの（%d 件）" % (tsv_path.name, len(checks["differ"])))
    for e, raw, pv, tv in checks["differ"]:
        L.append("- %s %s：entries %s g／表 %s g" % (e["file"], raw, fmt_g(pv), fmt_g(tv)))
    if not checks["differ"]:
        L.append("- なし")
    return L
