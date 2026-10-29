# genten — 漢方総合アプリ（やまもと皮膚科・漢方クリニック）

診察中に院長が漢方方剤の原典（条文・出典・構成・方意）を3秒で引くための参照アプリに、証ナビ・脈診ナビ・副作用ナビを
1枚の HTML にまとめたもの。下部タブは **原典｜証ナビ｜脈診｜副作用** の4つ。
担当は `shinsatsu-dev` エージェント（`~/.claude/agents/shinsatsu-dev.md`）。

## ファイル構成

| パス | 役割 | 公開 |
|---|---|---|
| `entries/<方剤名>.md` | 方剤ごとのデータ。**1方剤＝1ファイル** | リポジトリには入る（下の注意） |
| `entries/_template.md` | 新しい方剤を足すときの雛形。`_` で始まるファイルは build で読まない | 同上 |
| `template.html` | 外枠（header・下部タブ4つ・表示の明るさの切替）。`__MODULES_CSS__` `__MODULES_HEAD__` `__MODULES_HTML__` `__MODULES_JS__` `__GENTEN_DATA__` の置き場所に build が中身を入れる | 同上 |
| `modules/common/` | 共通部品：`store.js`（データ・保存・表示の明るさ）、`linkify.js`（方剤名→原典へのリンク）、`subtabs.js`（ヘッダー内のサブタブ）、`router.js`（ハッシュの切替。最後に入る）、`base.css`・`dark.css` | 同上 |
| `modules/genten/` | 原典タブ（一覧・詳細） | 同上 |
| `modules/shou/` | 証ナビタブ。`data.js` は17テーマの所見・判定・方剤詳細・患者説明（院長の自作）と注意文（PMDA 添付文書に合わせたもの。出典の確かめは `sources/shou-citations.md`） | 同上 |
| `modules/fuku/` | 副作用タブ（生薬別・併用チェック・甘草リスク・経過観察）。出典の確かめは `sources/fukusayou-citations.md` | 同上 |
| `modules/myaku/` | 脈診タブの**公開版**（2026-10-30 から）：判定・二十八脈・各脈の解説。`data.js` の文は院長確認済みの `sources/koten/myaku28-draft.md`（古典の翻刻から書き直したもの）からだけ取る。判定の仕組み（重み）は手元版と同じ。書籍の表は入れない。翻刻に根拠のない相兼脈（弦滑数）は入れない | 同上 |
| `modules-local/` | 手元版だけに入るモジュール。いまは `modules-local/myaku/`（脈診の書籍版。書籍の表を含む。手元版ではこちらが `modules/myaku/` の代わりに入る） | **非公開**（`.gitignore` 済み。コミットしない） |
| `build.py` | `entries/*.md`（と `private/*.md`）を読み、モジュールを組み立てて `genten.html` と `genten-local.html` を出力する | リポジトリに入る |
| `formulas.py` | build が使う共通の方剤データ（構成・量・生薬の寄せ方・方剤名の表記ゆれ）と、`data/ekisu.tsv` の検査。結果は `sources/pmda-check.md`（社員に渡す PMDA 確認リスト）にも出る | 同上 |
| `data/ekisu.tsv` | エキス剤の構成と生薬量（1日量中の g）。**原典・証ナビ・副作用の構成の表示はここから出す**（院長決定 2026-10-29。entries の `## 構成` はこの表の表記に合わせる）。ツムラの添付文書（PMDA）を正とし、クリニックの社員が確認・記入する。空欄＝「量 要確認」。記憶や他アプリの数字で埋めない。併用チェックの甘草合計などはここから計算する | 公開してよい |
| `genten.html` | **公開するのはこれだけ**（GitHub Pages：`https://yatsu3-crypto.github.io/genten/genten.html`） | 公開 |
| `genten-local.html` | 手元版（`private/` の見出しと脈診の本体を含む）。build が毎回作り直す | **非公開**（`.gitignore` 済み。コミット・アップロード・共有しない） |
| `private/` | 方剤ごとの非公開の md（独自の git あり・リモートなし）。統合の作業では変更しない | **非公開** |
| `sources/` | 書籍・資料の原本・抜き書き、出典の確かめの表、旧URLの転送ページ（`sources/redirect/`）。**公開しない** | **非公開**（`.gitignore` 済み。コミットしない） |

## 作業の流れ

1. `cp entries/_template.md entries/<方剤名>.md` で新しい方剤を作る（ファイル名は方剤名そのまま。例：`entries/葛根湯.md`）。
   量は `data/ekisu.tsv` にも行を足す（社員が PMDA で確認して記入。空欄のままでもよい）。
2. frontmatter（名前・読み・ツムラ番号・出典）と本文の各見出しを埋める。
3. `python3 build.py` で `genten.html` と `genten-local.html` を作り直す（方剤が0件でも動く）。検査の出力（構成と量の表の食い違い・量の空欄）を読む。
4. 表示を確認する：`~/.claude/skills/washi-design/scripts/iphone-shot.sh genten.html 390 1200`。
   タブを指定するときはハッシュを付ける（`genten.html#/genten/葛根湯`、`#/shou/bempi/rx`、`#/myaku`、`#/fuku/check`。旧形式 `#葛根湯` も動く）。
   脈診は公開版を `genten.html#/myaku/judge`、書籍版を `genten-local.html#/myaku/judge` で確認する。
5. 公開版に手元版の中身が入っていないことを確かめる（下の「公開版の安全装置」）。
6. コミット・push は院長の確認を得てから。`git add -A` は使わず、ファイルを個別に指定する。

## データのルール

- **医学的内容を創作しない。** 条文・出典・構成生薬・用量は `sources/` の資料から転記したものだけを書く。
- 資料にない項目は空欄のままにする。空欄はアプリ上で「要確認」と表示される。推測・記憶で埋めない。記憶で補った箇所があれば必ず院長に報告する。
- 本文の見出しは `## 条文` `## 出典` `## 構成` `## 方意` `## 諸家の論` `## 院長メモ` の6つで固定。見出し名を変えると build が読めない。
- **書籍由来の「諸家の論」は院長の要約のみ書く。** 書籍の文章をそのまま写さない（`entries/` はリポジトリに入り、GitHub 上で誰でも読める）。原文の抜き書きは `sources/` に置く。
- 院長メモもアプリ上に表示され公開される。公開したくないメモは `sources/` 側に書く。
- 証ナビ・副作用の注意文は、PMDA 添付文書（欄番号と版）か、実際に開いて確かめた文献を出典にする。出典の無い文は書かない。
  添付文書に無い飲み方の工夫などは「臨床上の工夫（分類：院長）」の札を付けて、本文とは別の行にする。
- **書籍の表を転記したもの（脈診の書籍版の表など）は `modules-local/` にだけ置く。** `modules/` に入れると公開される。
  公開版の脈診の文は `sources/koten/myaku28-draft.md` から取る（書籍の表から写さない）。

## 公開版の安全装置

- build は、手元版にしか無い語句（`modules-local/*/data.js` の文字列と、脈診の目印の語句）が `genten.html` に1つでも入っていたら、
  どちらのファイルも書かずにエラーで止める。`private/` の中身は公開版には見出しの名前しか入れない。
  `entries/` に旧方式の非公開の印（`非公開 -->`）が残っていても止まる。
- 安全装置から外す語句は `build.py` の `LOCAL_ONLY_EXCLUDE` に語句単位で書く。古典の翻刻（`sources/koten/`）に同じ表現があるものだけで、
  ファイルと箇所を `sources/koten/` の除外語一覧に記録してから足す（2026-10-30 時点で除外なし）。翻刻に無い語句が掛かったら、公開版の文を書き直す。
- 念のための確かめ（0件が正しい。除外していない語句：書籍のページ番号・書籍版にしか無い語）：
  `grep -c -e "p.102" -e "p.104" -e "葱管" -e "如軽刀刮竹" -e "元気離散" -e "舎脈従症" /Users/atsushiyamamoto/genten/genten.html`
  （「如盤走珠」などを `LOCAL_ONLY_EXCLUDE` に入れたら、その語句はこの確かめから外す）
- 手元版専用の語句（107語。`modules-local/*/data.js` の10字以上の文字列と目印の語句）がすべて公開版に無いことは、build の
  「安全装置：手元版だけの語句 N 件は公開用に入っていません」の行で確かめる。どの語句が掛かったかは build のエラーに例が3つ出る。
- `git -C ~/genten status --short --untracked-files=all` に `private/`・`modules-local/`・`genten-local.html`・`sources/` が出ないこと。

## 技術ルール

- 単一HTML・オフラインで動作。外部依存は Google Fonts のみ。見た目は washi-design スキル（`~/.claude/skills/washi-design/SKILL.md`）に従う。明るい／暗い表示の両方で確認する。
- 390px 幅基準、375〜430px で崩れないこと。タップ領域 44px 以上、入力欄 16px 以上。
- 印刷（A4）：ヘッダー・下部タブ・ボタンは `@media print` で隠す。原典の詳細・副作用のカード・証ナビの方剤詳細が紙に収まること。
- localStorage を使う場合のキーは `genten.<モジュール>.<項目>.v1`（モジュールは `common`・`genten`・`shou`・`myaku`・`fuku`。例：`genten.common.theme.v1`、`genten.fuku.tab.v1`）。読み書きは `modules/common/store.js` の `store` を通し、保存してよい項目は `STORE_ALLOWED` に足してから使う。
- 保存してよいのは画面の状態（タブ・表示の明るさなど）だけ。患者情報は一切扱わない・保存しない。所見・リスク因子・選んだ処方の組み合わせもメモリのみで保存しない。
  旧アプリのキー（`kampoNavi.mod`・`fk_tab`・`myakushin.tab`）は、新しいキーが空のときだけ画面の状態として写す。`fk_sel`・`fk_risk`・`myakushin.v1` は写さない。旧キーは消さない。
- `genten.html`・`genten-local.html` は手で直さない（build で上書きされる）。画面を直すときは `template.html` か `modules/`（脈診の本体は `modules-local/`）を、データを直すときは `entries/` か `data/ekisu.tsv` を直す。
