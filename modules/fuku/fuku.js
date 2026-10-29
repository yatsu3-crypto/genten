/* ===== 副作用ナビモジュール（旧 fukusayou.html を移したもの） =====
   - 方剤ごとの量は共通の方剤データ DATA.formulas（data/ekisu.tsv ＝ PMDA 添付文書）から計算する。手入力の量の表は持たない。
   - 併用チェックは、旧 副作用ナビの「処方チェック」と旧 証ナビの「生薬」タブを1つにしたもの（設計案 1-2）。
   - 選んだ方剤（SELECTED）と甘草リスクのチェックはメモリの中だけで持つ（保存しない。院長決定9）。
   - 注意文の文言は旧 副作用ナビのまま。出典の確かめ（sources/fukusayou-citations.md）に従って直したところだけ変えている：
     5g の区切りと出典不明の番号［1］［2］［7］［8］を削除、2.5g の文言、HLA-B*35:01 を肝障害の項目へ、
     黄芩と間質性肺炎の文を原著に合わせて弱めた、出典を著者名・年で示して文献一覧を付けた。 */
(function(){
var FX = DATA.formulas || {};

/* ---------- 文献（確かめられたものだけ。sources/fukusayou-citations.md） ---------- */
var REFS = [
  ["Uneda 2024", "Uneda K, et al. PLoS One 2024;19(1):e0296450. doi:10.1371/journal.pone.0296450", "甘草を含む処方の割合（148処方のうち7割以上）、偽アルドステロン症のリスク因子、投与期間14日超"],
  ["厚労省マニュアル 2022", "厚生労働省「重篤副作用疾患別対応マニュアル 偽アルドステロン症」令和4年改定. https://www.pmda.go.jp/files/000245267.pdf", "甘草を含む漢方製剤は70%以上"],
  ["Yoshino 2026", "Yoshino T, Makino T. Front Pharmacol 2026;17:1840515. doi:10.3389/fphar.2026.1840515", "11β-HSD2、3-epi-グリチルレチン酸"],
  ["Oura 2024", "Oura K, et al. BMC Complement Med Ther 2024;24:121", "漢方薬による間質性肺炎・黄芩"],
  ["Nakamura 2023", "Nakamura R, et al. Hepatol Res 2023;53(5):440-449. doi:10.1111/hepr.13874", "HLA-B*35:01 と漢方薬による肝障害（抄録で確認）"],
  ["Hoshi 2024", "Hoshi A, et al. Drug Discov Ther 2024;18(6):325-335", "肝障害のモニタリング（抄録で確認）"],
  ["地野 2020", "地野ほか. 日本東洋医学雑誌 2020;71(3):262-267", "甘草2.5g、肝障害のモニタリング"],
  ["PMDA 添付文書", "ツムラ芍薬甘草湯エキス顆粒（医療用）2023年12月改訂 https://www.pmda.go.jp/PmdaSearch/iyakuDetail/460026_5200067D1049_1_16 ／ クラシエ甘草湯エキス細粒 2023年10月改訂 https://www.pmda.go.jp/PmdaSearch/iyakuDetail/252468_5200018C1031_2_01", "禁忌欄の3項目（アルドステロン症・ミオパチー・低カリウム血症）"]
];
function ref(){ return Array.prototype.map.call(arguments, function(k){ return '<span class="ref">' + esc(k) + '</span>'; }).join(""); }

/* ---------- 生薬別データ ---------- */
var HERBS = [
 {key:"ka",herb:"甘草",ae:"偽アルドステロン症",type:"d",c:"var(--fk-ka)",
  mech:"グリチルリチンの代謝物が腎尿細管の11β-HSD2を阻害し、低カリウム血症・代謝性アルカローシス・高血圧をきたす。保険適用148処方のうち7割以上に甘草が含まれ、複数処方の併用で過量となりやすい。" + ref("Yoshino 2026", "Uneda 2024"),
  risk:["女性","70歳以上の高齢者","低体重（<50kg）","利尿薬併用","高血圧","認知症","1日の甘草量が多い","投与期間14日超"],
  riskRef:ref("Uneda 2024"),
  sx:["脱力感・四肢のだるさ","浮腫","血圧上昇","（重症）低K性ミオパチー"],
  todo:["血清K値・血圧を定期測定（特に投与開始後早期と長期投与時）","甘草含有処方の重複を避ける","低K・脱力感・浮腫などの自覚症状を事前に説明","発症時は速やかに減量・中止し、K補充"],
  ex:["芍薬甘草湯","甘麦大棗湯","小青竜湯","人参湯","柴苓湯","補中益気湯"]},
 {key:"ou",herb:"黄芩",ae:"間質性肺炎",type:"i",c:"var(--fk-ou)",
  mech:"小柴胡湯・柴苓湯などの柴胡剤（黄芩・柴胡を含む）で薬剤性間質性肺疾患（DIILD）が報告されており、黄芩の関与が指摘されている。発症は投与開始後早期が多い（発症までの日数の中央値は約1か月）。" + ref("Oura 2024"),
  risk:["投与開始後1〜2か月"],
  sx:["空咳","労作時息切れ","発熱"],
  todo:["最初の1〜2か月は空咳・息切れ・発熱を毎回確認","疑えば速やかに胸部画像検査・呼吸器内科へ紹介し中止"],
  ex:["小柴胡湯","柴苓湯","防風通聖散","黄連解毒湯","荊芥連翹湯","半夏瀉心湯"]},
 {key:"ou",herb:"黄芩",ae:"肝障害",type:"i",c:"var(--fk-ou)",
  mech:"",
  risk:["HLA-B*35:01保有（漢方薬DILIリスク約9.6倍、非曝露DILI比で13.6倍）" + ref("Nakamura 2023")],
  sx:["倦怠感・黄疸"],
  todo:["黄芩含有方剤（防風通聖散など）投与中は肝機能モニタリング" + ref("Hoshi 2024", "地野 2020")],
  ex:["小柴胡湯","柴苓湯","防風通聖散","黄連解毒湯","荊芥連翹湯","半夏瀉心湯"]},
 {key:"ma",herb:"麻黄",ae:"交感神経刺激症状",type:"d",c:"var(--fk-ma)",
  mech:"エフェドリン類による交感神経刺激。",
  risk:["心疾患","高血圧","前立腺肥大"],
  sx:["動悸","不眠","排尿障害"],
  todo:["上記疾患では慎重投与","症状出現時は減量・中止"],
  ex:["葛根湯","麻黄湯","小青竜湯","越婢加朮湯","麻黄附子細辛湯"]},
 {key:"bu",herb:"附子",ae:"アコニチン中毒様症状",type:"d",c:"var(--fk-bu)",
  mech:"過量投与でアコニチン中毒様症状。",
  risk:["過量投与"],
  sx:["口唇のしびれ","動悸","悪心"],
  todo:["規定用量の遵守","初期症状出現時は中止"],
  ex:["真武湯","麻黄附子細辛湯","牛車腎気丸","桂枝加朮附湯"]},
 {key:"dai",herb:"大黄",ae:"下痢",type:"d",c:"var(--fk-dai)",
  mech:"瀉下作用。",
  risk:["瀉下作用が強く出やすい体質"],
  sx:["下痢","腹痛"],
  todo:["強く出る場合は減量で対応"],
  ex:["大黄甘草湯","麻子仁丸","防風通聖散","茵蔯蒿湯","桃核承気湯"]},
 {key:"san",herb:"山梔子",ae:"腸間膜静脈硬化症",type:"d",c:"var(--fk-san)",
  mech:"長期投与（数年単位）で報告が増加。",
  risk:["数年単位の長期投与"],
  sx:["持続する腹痛","下痢","便秘"],
  todo:["消化器症状が持続すれば大腸内視鏡で評価","中止を検討"],
  ex:["加味逍遙散","黄連解毒湯","温清飲","茵蔯蒿湯","荊芥連翹湯"]},
 {key:"rash",herb:"全般",ae:"薬疹",type:"i",c:"var(--fk-all)",
  mech:"特異体質性（アレルギー性）の副作用。",
  risk:["過去の漢方薬・生薬での薬疹歴"],
  sx:["発疹","瘙痒"],
  todo:["出現時は中止","原因方剤・生薬を記録し再投与を避ける"],
  ex:[]}
];

/* 注意生薬：集計用の名前（DATA.formulas[*].key）→ 旧副作用ナビの記号 */
var MK = [["甘草","ka","甘"],["黄芩","ou","芩"],["麻黄","ma","麻"],["附子","bu","附"],["大黄","dai","大"],["山梔子","san","梔"],["芒硝","bo","硝"]];
function fmtG(v){ return (Math.round(v * 100) / 100).toString(); }
function fname(f){ return FX[f] ? FX[f].name : f; }
function maker(f){ return FX[f] && FX[f].maker ? FX[f].maker : ""; }
function nonTsumura(f){ var m = maker(f); return m && m !== "ツムラ"; }

/* ---------- 生薬カード ---------- */
function li(a){ return a.map(function(x){ return "<li>" + x + "</li>"; }).join(""); }
$("#fkCards").innerHTML = HERBS.map(function(h){
  return '<details class="fk-card" style="--c:' + h.c + '">' +
    '<summary><span class="herb">' + h.herb + '</span><span class="ae">' + h.ae + '</span>' +
    '<span class="tag ' + h.type + '">' + (h.type === "d" ? "用量依存" : "特異体質") + '</span></summary>' +
    '<div class="body">' + (h.mech ? "<p>" + h.mech + "</p>" : "") +
    '<h3>リスク因子</h3><ul>' + li(h.risk) + '</ul>' + (h.riskRef ? "<p>" + h.riskRef + "</p>" : "") +
    '<h3>症状</h3><div class="fk-chips">' + h.sx.map(function(x){ return '<span class="fk-chip">' + x + '</span>'; }).join("") + '</div>' +
    '<h3>対策</h3><ul>' + li(h.todo) + '</ul>' +
    (h.ex.length ? '<h3>主な含有処方</h3><div class="fk-chips">' + h.ex.map(function(x){ return '<span class="fk-chip">' + linkify(x) + '</span>'; }).join("") + '</div>' : "") +
    '</div></details>';
}).join("");
$("#fkRefs").innerHTML = '<summary>文献（' + REFS.length + '）</summary><ol>' +
  REFS.map(function(r){ return "<li><b>" + esc(r[0]) + "</b>　" + esc(r[1]) + "<br>" + esc(r[2]) + "</li>"; }).join("") + "</ol>" +
  "<p>出典が確かめられなかった数字・引用番号は削った（甘草5g の区切りなど）。</p>";

/* ---------- 併用チェック ---------- */
var IDS = Object.keys(FX).sort(function(a, b){
  var x = FX[a], y = FX[b], nx = x.tsumura ? +x.tsumura : 9999, ny = y.tsumura ? +y.tsumura : 9999;
  return nx - ny || (x.yomi || x.name).localeCompare(y.yomi || y.name, "ja");
});
var IDX = {};
IDS.forEach(function(f){ var x = FX[f]; IDX[f] = norm([x.name, x.id, x.yomi, x.tsumura].concat(x.aliases || []).join(" ")); });
var TOPICS = typeof SHOU_TOPICS !== "undefined" ? SHOU_TOPICS : [];
var topic = "";   /* 画面の状態（メモリのみ） */

$("#fkTopics").innerHTML = '<button type="button" data-t="" class="on">すべて</button>' +
  TOPICS.map(function(t){ return '<button type="button" data-t="' + esc(t.id) + '">' + esc(t.label) + '</button>'; }).join("");
$("#fkTopics").addEventListener("click", function(ev){
  var b = ev.target.closest("button"); if (!b) return;
  topic = b.dataset.t;
  $$("#fkTopics button").forEach(function(x){ x.classList.toggle("on", x === b); });
  drawList();
});

function marks(f){
  var k = FX[f].key || {};
  return MK.filter(function(m){ return m[0] in k; }).map(function(m){ return '<span class="mini m-' + m[1] + '">' + m[2] + '</span>'; }).join("");
}
function kaText(f){
  var k = FX[f].key || {};
  if (!("甘草" in k)) return "";
  var mk = nonTsumura(f) ? '<span class="mk">' + esc(maker(f)) + '</span>' : "";
  return k["甘草"] === null ? '<span class="unk">甘草 量未確認</span>' + mk : "甘草 " + fmtG(k["甘草"]) + "g" + mk;
}
function drawList(){
  var q = norm($("#fkQ").value);
  var pool = topic ? (TOPICS.filter(function(t){ return t.id === topic; })[0] || {formulas: []}).formulas : IDS;
  var rows = pool.filter(function(f){ return FX[f] && (!q || IDX[f].indexOf(q) !== -1); });
  /* 選択中を上に（それ以外は元の並び） */
  rows = rows.filter(function(f){ return SELECTED.has(f); }).concat(rows.filter(function(f){ return !SELECTED.has(f); }));
  $("#fkList").innerHTML = rows.map(function(f){
    var on = SELECTED.has(f), x = FX[f];
    return '<div class="fk-row' + (on ? " sel" : "") + '" data-f="' + esc(f) + '" role="button" aria-pressed="' + on + '">' +
      '<span class="ck">' + (on ? "✓" : "") + '</span>' +
      '<span class="nm">' + (x.tsumura ? '<span class="num">' + esc(x.tsumura) + '</span>' : "") + '<b>' + esc(x.name) + '</b> ' + marks(f) + '</span>' +
      '<span class="g">' + kaText(f) + '</span>' +
      '<a class="go" href="' + gentenHref(f) + '" aria-label="' + esc(x.name) + ' の原典">原典›</a></div>';
  }).join("") || '<div class="fk-empty">該当なし</div>';
  $("#fkCount").textContent = SELECTED.size ? SELECTED.size + "処方を選択中" : "";
}
$("#fkList").addEventListener("click", function(ev){
  if (ev.target.closest("a")) return;   /* 「原典›」は原典へ飛ぶだけ（選択は変えない） */
  var r = ev.target.closest(".fk-row[data-f]"); if (!r) return;
  var f = r.dataset.f;
  if (SELECTED.has(f)) SELECTED.delete(f); else SELECTED.add(f);
  drawList(); drawResult();
});
$("#fkQ").addEventListener("input", drawList);
$("#fkClr").addEventListener("click", function(){ SELECTED.clear(); drawList(); drawResult(); });

/* 生薬ごとの集計：量が分かった分の合計・含む方剤・量未確認の方剤 */
function tally(picked, herb){
  var t = {sum: 0, inc: [], unk: []};
  picked.forEach(function(f){
    var k = FX[f].key || {};
    if (!(herb in k)) return;
    t.inc.push(f);
    if (k[herb] === null) t.unk.push(f); else t.sum += k[herb];
  });
  t.sum = Math.round(t.sum * 100) / 100;
  return t;
}
function names(fs){ return fs.map(function(f){ return linkify(fname(f)); }).join("・"); }
function unkNote(t){ return t.unk.length ? '　<span class="unk">量未確認 ' + t.unk.length + "件：" + names(t.unk) + "</span>" : ""; }
function amount(t){ return t.unk.length && !t.sum ? "量未確認" : fmtG(t.sum) + "g" + (t.unk.length ? "＋量未確認" : ""); }

function drawResult(){
  var out = $("#fkResult");
  var picked = IDS.filter(function(f){ return SELECTED.has(f); });
  if (!picked.length){ out.innerHTML = ""; return; }
  var h = '<div class="fk-picked"><span class="lbl">選択中</span>' + picked.map(function(f){
    return linkify(fname(f)) + (nonTsumura(f) ? '<span class="ref">' + esc(maker(f)) + "</span>" : "");
  }).join("　") + "</div>";

  /* 甘草の1日合計 */
  var ka = tally(picked, "甘草"), cls = "", msg = "";
  if (ka.sum >= 2.5){ cls = "caution"; msg = "甘草2.5g/日以上の製剤では、添付文書の禁忌欄に3項目（アルドステロン症・ミオパチー・低カリウム血症）が載る（例：ツムラ芍薬甘草湯）。" + ref("PMDA 添付文書"); }
  else if (ka.unk.length) msg = "量未確認の方剤を含むため、合計は確定しない。";
  else if (ka.sum > 0) msg = "少量でもリスク因子が重なれば発症しうる。";
  else msg = "甘草を含まない組み合わせ。";
  h += '<div class="fk-total ' + cls + '"><div class="lbl">甘草 1日合計' + (ka.unk.length ? "（量が確認できた方剤のみ）" : "") + '</div>' +
    '<div class="num">' + fmtG(ka.sum) + '<small> g</small></div>' +
    (ka.unk.length ? '<div class="unk">量未確認 ' + ka.unk.length + "件：" + ka.unk.map(function(f){ return esc(fname(f)); }).join("・") + "</div>" : "") +
    '<div class="msg">' + msg + '</div>' +
    (ka.inc.length ? '<div class="bd">' + ka.inc.map(function(f){
      var g = FX[f].key["甘草"];
      return linkify(fname(f)) + " " + (g === null ? '<span class="unk">量未確認</span>' : fmtG(g) + "g") + ' <span class="mk">' + esc(maker(f)) + "</span>";
    }).join("<br>") + "</div>" : "") + "</div>";
  if (ka.inc.length >= 2) h += '<div class="fk-alert" style="--c:var(--fk-ka)"><b>甘草含有処方の重複</b>（' + ka.inc.length + "処方）：" + names(ka.inc) + "</div>";

  /* ほかの注意生薬の重複（旧 証ナビの「n剤で重複」） */
  var dups = MK.slice(1).map(function(m){ var t = tally(picked, m[0]); t.herb = m[0]; return t; }).filter(function(t){ return t.inc.length >= 2; });
  dups.forEach(function(t){ h += '<div class="fk-dup">⚠ <b>' + t.herb + "</b> が" + t.inc.length + "剤で重複：" + names(t.inc) + "</div>"; });

  /* 生薬ごとの注意（旧 副作用ナビの文言） */
  var ALERT = {
    "黄芩": ["var(--fk-ou)", "開始1〜2か月は空咳・息切れ・発熱を確認。肝機能もモニタリング。"],
    "麻黄": ["var(--fk-ma)", "心疾患・高血圧・前立腺肥大は慎重投与。動悸・不眠・排尿障害に注意。"],
    "附子": ["var(--fk-bu)", "口唇のしびれ・動悸・悪心が出たら中止。"],
    "大黄": ["var(--fk-dai)", "下痢が強ければ減量。"],
    "山梔子": ["var(--fk-san)", "年単位の長期投与では、持続する腹痛・下痢・便秘で大腸内視鏡を考慮。"],
    "芒硝": ["var(--fk-bo)", ""]
  };
  MK.slice(1).forEach(function(m){
    var t = tally(picked, m[0]); if (!t.inc.length) return;
    var other = t.inc.filter(function(f){ return FX[f].other; }).map(function(f){ return esc(fname(f)) + "：表は多いほうの製剤の量。ほかの製剤 " + esc(FX[f].other); });
    h += '<div class="fk-alert" style="--c:' + ALERT[m[0]][0] + '"><b>' + m[0] + "</b> " + amount(t) + "（" + names(t.inc) + "）" + unkNote(t) +
      (ALERT[m[0]][1] ? "<br>" + ALERT[m[0]][1] : "") +
      (other.length ? '<span class="sub">' + other.join("<br>") + "</span>" : "") + "</div>";
  });
  out.innerHTML = h;
}

/* ---------- 甘草リスク（チェックはメモリのみ。保存しない） ---------- */
var RISK = [["女性",""],["70歳以上",""],["体重50kg未満",""],["利尿薬を併用",""],["高血圧",""],["認知症","症状の訴えが乏しく発見が遅れやすい"],
  ["甘草量が多い","甘草2.5g/日以上の製剤では、添付文書の禁忌欄に3項目が載る（例：ツムラ芍薬甘草湯）。「併用チェック」で合計を確認"],["投与期間が14日を超える",""]];
var rk = new Set();
function drawRisk(){
  $("#fkRisk").innerHTML = RISK.map(function(r, i){
    return '<label class="fk-chk"><input type="checkbox" data-i="' + i + '"' + (rk.has(i) ? " checked" : "") + '>' +
      '<span>' + r[0] + (r[1] ? "<small>" + r[1] + (i === 6 ? ref("PMDA 添付文書") : "") + "</small>" : "") + '</span></label>';
  }).join("") + '<div class="fk-btnrow"><button type="button" class="fk-btn" id="fkRclr">リセット</button></div>';
  var n = rk.size, o = $("#fkRiskOut");
  if (n === 0) o.innerHTML = "";
  else if (n <= 2) o.innerHTML = '<div class="fk-alert" style="--c:var(--matsu)"><b>該当 ' + n + '項目</b><br>開始時に症状を説明し、長期投与時にK・血圧を確認。</div>';
  else if (n <= 4) o.innerHTML = '<div class="fk-alert" style="--c:var(--kin)"><b>該当 ' + n + '項目</b><br>開始後早期にK・血圧を確認。甘草含有処方の重複は避ける。</div>';
  else o.innerHTML = '<div class="fk-alert" style="--c:var(--shu)"><b>該当 ' + n + '項目（高リスク）</b><br>甘草の少ない処方への変更を検討。投与するなら早期かつ定期的にK・血圧を測定。</div>';
}
$("#fkRisk").addEventListener("change", function(ev){
  var i = +ev.target.dataset.i;
  if (ev.target.checked) rk.add(i); else rk.delete(i);
  drawRisk();
});
$("#fkRisk").addEventListener("click", function(ev){ if (ev.target.closest("#fkRclr")){ rk.clear(); drawRisk(); } });

/* ---------- 経過観察タイムライン ---------- */
var TL = [
 ["開始時","var(--matsu)","甘草：リスク因子を確認し、低K・脱力感・浮腫を説明。重複処方がないか確認。<br>麻黄：心疾患・高血圧・前立腺肥大の有無。<br>附子：規定用量。初期症状（口唇のしびれ等）を説明。"],
 ["〜2週","var(--shu)","甘草：投与14日超からリスク上昇。早期のK・血圧測定。<br>麻黄：動悸・不眠・排尿障害。<br>大黄：下痢が強ければ減量。"],
 ["〜2か月","var(--ai)","黄芩：間質性肺炎の好発時期。毎回、空咳・労作時息切れ・発熱を確認。疑えば胸部画像・呼吸器内科へ紹介し中止。肝機能も確認。"],
 ["長期投与","var(--kin)","甘草：定期的にK・血圧を測定。<br>黄芩：肝機能の定期モニタリング。"],
 ["数年","var(--kin-d)","山梔子：腹痛・下痢・便秘が続けば大腸内視鏡で腸間膜静脈硬化症を評価し、中止を検討。"],
 ["随時","var(--usu)","薬疹：出現時は中止し、原因方剤を記録。"]
];
$("#fkTimeline").innerHTML = TL.map(function(t){
  return '<div class="st" style="--c:' + t[1] + '"><div class="when">' + t[0] + '</div><div class="what">' + t[2] + '</div></div>';
}).join("");

drawList(); drawResult(); drawRisk();

subtabModule("fuku", {
  title: "副作用ナビ",
  sub: "注意生薬と併用を確かめる",
  subs: [["herb", "生薬別"], ["check", "併用チェック"], ["risk", "甘草リスク"], ["mon", "経過観察"]],
  fit: true,
  /* ほかのタブで選択が変わっていることがあるので、表示のたびに描き直す */
  onShow: function(t){ if (t === "check"){ drawList(); drawResult(); } }
});
})();
