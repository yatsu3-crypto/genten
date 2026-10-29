# genten — 原典アプリ（やまもと皮膚科・漢方クリニック）

診察中に院長が漢方方剤の原典（条文・出典・構成・方意）を3秒で引くための参照アプリ。
担当は `shinsatsu-dev` エージェント（`~/.claude/agents/shinsatsu-dev.md`）。

## ファイル構成

| パス | 役割 | 公開 |
|---|---|---|
| `entries/<方剤名>.md` | 方剤ごとのデータ。**1方剤＝1ファイル** | リポジトリには入る（下の注意） |
| `entries/_template.md` | 新しい方剤を足すときの雛形。`_` で始まるファイルは build で読まない | 同上 |
| `template.html` | アプリの画面（和紙デザイン）。`__GENTEN_DATA__` などの置き場所に build がデータを入れる | 同上 |
| `build.py` | `entries/*.md` を読み、データを埋め込んで `genten.html` を出力する | 同上 |
| `data/ekisu.tsv` | エキス剤の生薬量（1日量中の g）。ツムラの添付文書（PMDA）を正とし、クリニックの社員が確認・記入する。空欄＝「量 要確認」。記憶や他アプリの数字で埋めない | 公開してよい |
| `formulas.py` | build が使う共通の方剤データ（構成・量・生薬の寄せ方・方剤名の表記ゆれ）と、`data/ekisu.tsv` の検査。結果は `sources/pmda-check.md`（社員に渡す PMDA 確認リスト）にも出る | 同上 |
| `genten.html` | **公開するのはこれだけ**（GitHub Pages：`https://yatsu3-crypto.github.io/genten/genten.html`） | 公開 |
| `sources/` | 書籍・資料の原本・抜き書き。**公開しない**（`.gitignore` 済み。コミットしない） | 非公開 |

## 作業の流れ

1. `cp entries/_template.md entries/<方剤名>.md` で新しい方剤を作る（ファイル名は方剤名そのまま。例：`entries/葛根湯.md`）。
2. frontmatter（名前・読み・ツムラ番号・出典）と本文の各見出しを埋める。
3. `python3 build.py` で `genten.html` を作り直す（方剤が0件でも動く）。
4. `~/.claude/skills/washi-design/scripts/iphone-shot.sh genten.html 390 1200` で表示を確認する。
5. コミット・push は院長の確認を得てから。

## データのルール

- **医学的内容を創作しない。** 条文・出典・構成生薬・用量は `sources/` の資料から転記したものだけを書く。
- 資料にない項目は空欄のままにする。空欄はアプリ上で「要確認」と表示される。推測・記憶で埋めない。記憶で補った箇所があれば必ず院長に報告する。
- 本文の見出しは `## 条文` `## 出典` `## 構成` `## 方意` `## 諸家の論` `## 院長メモ` の6つで固定。見出し名を変えると build が読めない。
- **書籍由来の「諸家の論」は院長の要約のみ書く。** 書籍の文章をそのまま写さない（`entries/` はリポジトリに入り、GitHub 上で誰でも読める）。原文の抜き書きは `sources/` に置く。
- 院長メモもアプリ上に表示され公開される。公開したくないメモは `sources/` 側に書く。

## 技術ルール

- 単一HTML・オフラインで動作。外部依存は Google Fonts のみ。見た目は washi-design スキル（`~/.claude/skills/washi-design/SKILL.md`）に従う。
- 390px 幅基準、375〜430px で崩れないこと。タップ領域 44px 以上、入力欄 16px 以上。
- localStorage を使う場合のキーは `genten.<モジュール>.<項目>.v1`（モジュールは `common`・`genten`・`shou`・`myaku`・`fuku`。例：`genten.common.theme.v1`、`genten.fuku.tab.v1`）。読み書きは `modules/common/store.js` の `store` を通し、保存してよい項目は `STORE_ALLOWED` に足してから使う。
- 保存してよいのは画面の状態（タブ・表示の明るさなど）だけ。患者情報は一切扱わない・保存しない。所見・リスク因子・選んだ処方の組み合わせもメモリのみで保存しない。
- `genten.html` は手で直さない（build で上書きされる）。画面を直すときは `template.html` を、データを直すときは `entries/` を直す。
