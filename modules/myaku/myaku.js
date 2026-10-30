/* ===== 脈診モジュール（公開版。2026-10-30 院長決定で公開版に組み込み） =====
   - 判定の計算は手元版（modules-local/myaku/myaku.js）と同じ（重み・相兼脈・複合脈の推定・八綱の振り分けは変えていない）。
   - 文は data.js（院長確認済みの書き直し版 sources/koten/myaku28-draft.md から作ったもの）だけを使う。書籍の表は使わない。
   - 手元版との違い（文の出どころをそろえたため）：
     1. 相兼脈は説明と出典を myaku28-draft.md から。翻刻に根拠のない組み合わせ（弦滑数）は無い。
     2. 注意の札は、myaku28-draft.md に文があるもの（散・疾・革）と、調律異常で心電図を勧める札（アプリの補足）だけ。
     3. 治法・参考処方（アプリ側の補足・書籍外。2026-10-30 院長確認）は、病態名とあわせて手元版と同じ文を出す（安全装置の語句一覧の元から外してある）。
        文が無い欄は出さない。札「参考処方・書籍外」と説明文（各脈の解説タブの下）は旧 脈診ナビと同じ。
        病態の「鑑別」の行、部位の臓腑・上中下の割り当て、「脈診の要点」のタブは無い（書籍由来のため）。代わりに「各脈の解説」のタブ。
   - 所見はメモリの中だけ（保存しない）。画面の状態（サブタブ）は genten.myaku.tab.v1（subtabModule が保存）。
     旧 "myakushin.tab" は新しいキーが空のときだけ写す（judge・list のみ）。旧キーは消さない。所見の旧キー myakushin.v1 は読まない。 */
(function(){
var D = MYAKU_DATA;
var PULSES = D.PULSES, DETAIL = D.DETAIL, SYN = D.SYN, R = D.R, fixedForce = D.fixedForce, COMBOS = D.COMBOS, IMPLY = D.IMPLY,
    GROUPS = D.GROUPS, POSCELLS = D.POSCELLS, ALERT = D.ALERT, EXAMPLE = D.EXAMPLE;
var SUBS = ["judge", "list", "kaisetsu"];

/* 原典に無い方剤（エキス剤なし／一般用。院長決定）。リンクにせず小札を付ける（手元版と同じ） */
var NO_EXT = ["参苓白朮散", "銀翹散"];
function rxHTML(f){
  var h = linkify(f);
  NO_EXT.forEach(function(n){ h = h.split(n).join(n + '<span class="unreg">エキス剤なし／一般用</span>'); });
  return h;
}
/* 「要確認」を札にする（文はエスケープ済みのもの） */
function flags(s){ return String(s).replace(/要確認/g, '<span class="flag">要確認</span>'); }
function txt(s){ return flags(esc(s)); }

(function(){
  if (store.get("myaku", "tab")) return;
  var t = null;
  try { t = localStorage.getItem("myakushin.tab"); } catch (e){}
  if (SUBS.indexOf(t) !== -1) store.set("myaku", "tab", t);
})();

function blank(){ return {pos:null,rate:null,force:null,width:null,tension:null,len:null,flow:null,rhythm:null,comp:null,cells:[]}; }
var S = blank();
var el = function(id){ return document.getElementById(id); };

/* ===== 入力UI ===== */
function renderInputs(){
  var h = "";
  for (const g of GROUPS){
    h += `<div class="my-grp"><div class="lab">${g.lab}</div><div class="my-chips">`;
    for (const [v, s] of g.opts){
      h += `<button type="button" class="my-chip" data-k="${g.k}" data-v="${v}" aria-pressed="${S[g.k] === v}">${v}${s ? `<small>${s}</small>` : ""}</button>`;
    }
    h += `</div></div>`;
  }
  h += `<div class="my-grp"><div class="lab">部位<br><span style="font-size:10px">（任意）</span></div><div class="my-pos"><span></span><span class="h">寸</span><span class="h">関</span><span class="h">尺</span>`;
  for (const side of ["L", "R"]){
    h += `<span class="h">${side === "L" ? "左" : "右"}</span>`;
    for (const z of ["寸", "関", "尺"]){
      const id = side + z, cell = POSCELLS.find(c => c[0] === id);
      h += `<button type="button" class="my-chip" data-cell="${id}" aria-pressed="${S.cells.includes(id)}">${cell[1]}</button>`;
    }
  }
  h += `</div></div>`;
  el("myInputs").innerHTML = h;
  el("myExnote").textContent = S._ex ? "例：沈・有力・渋・左関を入れてあります" : "";
}
el("myInputs").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.cell){ const c = b.dataset.cell; S.cells = S.cells.includes(c) ? S.cells.filter(x => x !== c) : [...S.cells, c]; }
  else { const k = b.dataset.k, v = b.dataset.v; S[k] = S[k] === v ? null : v; }
  S._ex = false; renderInputs(); renderResult();
});
el("myReset").onclick = () => { S = blank(); renderInputs(); renderResult(); };
el("myExample").onclick = () => { S = Object.assign(blank(), JSON.parse(JSON.stringify(EXAMPLE)), {_ex:true}); renderInputs(); renderResult(); };

/* ===== 判定（計算は手元版と同じ） ===== */
function selectedPulses(){
  const list = [];
  for (const k of ["pos","rate","width","tension","len","flow","rhythm","comp"]) if (S[k]) list.push(S[k]);
  return list;
}
function fkey(p){ if (fixedForce[p]) return "y"; return S.force === "有力" ? "y" : S.force === "無力" ? "n" : "u"; }
function addTo(score, why, obj, reason){
  for (const [id, w] of Object.entries(obj)){ if (!w) continue; score[id] = (score[id] || 0) + w; (why[id] = why[id] || []).push(reason); }
}
function judge(){
  const ps = selectedPulses(), score = {}, why = {};
  for (const p of ps){
    const r = R[p]; if (!r) continue;
    const k = fkey(p); const obj = r[k] || r.y || {};
    const row = PULSES.find(x => x.p === p);
    const col = fixedForce[p] ? (row.k || row.j) : (k === "y" ? row.j : k === "n" ? row.k : [row.j, row.k].filter(Boolean).join("／"));
    addTo(score, why, obj, `${p}脈${fixedForce[p] ? "" : (k === "y" ? "（有力）" : k === "n" ? "（無力）" : "")}：${col || "—"}`);
  }
  const combos = COMBOS.filter(c => c.req.every(r => ps.includes(r)));
  for (const c of combos){
    const k = fkey(c.req[0]); const add = c.add.y || c.add.n || c.add.u ? (c.add[k] || c.add.u || {}) : c.add;
    addTo(score, why, add, `相兼脈 ${c.nm}`);
  }
  const ranked = Object.entries(score).sort((a, b) => b[1] - a[1]);
  return {ps, score, why, ranked, combos};
}
function hakko(ps){
  let hr = "—", kn = "—", kj = "—";
  if (S.pos === "浮") hr = S.force === "無力" ? "表？" : "表"; else if (S.pos === "沈" || S.pos === "伏") hr = "裏";
  if (["濡","散","芤","革"].includes(S.comp) && hr === "—") hr = "（浮）";
  if (["弱","微","牢"].includes(S.comp) && hr === "—") hr = "裏";
  const cold = ["遅","緊","結"].some(p => ps.includes(p)), hot = ["数","疾","促","洪"].some(p => ps.includes(p));
  kn = cold && hot ? "寒熱錯雑？" : cold ? "寒" : hot ? "熱" : "—";
  const f = S.force || (["濡","弱","散","微","芤","革"].includes(S.comp) ? "無力" : ["動","牢"].includes(S.comp) ? "有力" : null);
  kj = f === "有力" ? "実" : f === "無力" ? "虚" : "—";
  return {hr, kn, kj};
}
/* 注意の札：出す条件は手元版と同じ。文は data.js の ALERT（myaku28-draft.md にあるもの）だけ */
function alerts(ps){
  const a = [];
  for (const p of ["散", "疾", "革"]) if (ps.includes(p) && ALERT[p]) a.push(ALERT[p]);
  if (ps.some(p => ["促","結","代"].includes(p))) a.push("調律異常あり。現代医学的な不整脈の評価（心電図）も併せて行ってください。");
  return a;
}
function missingDims(){
  const missing = []; if (!S.force) missing.push("脈力（有力／無力）");
  if (!S.rate && !["促","結"].includes(S.rhythm)) missing.push("至数");
  if (!S.flow) missing.push("滑・渋");
  return missing;
}
function renderResult(){
  const out = el("myResult");
  const {ps, why, ranked, combos} = judge();
  const sel = [...ps]; if (S.force) sel.splice(1, 0, S.force);
  if (!sel.length){ out.innerHTML = `<div class="my-panel my-muted">上の所見をタップすると、病態の候補が出ます。たとえば「沈」＋「有力」で裏実、さらに「渋」で瘀血が上がります。</div>`; return; }
  const hk = hakko(ps);
  let h = `<h2>判定</h2>`;
  h += `<div class="my-panel" style="display:grid;gap:10px"><div class="my-summary">${sel.map(p => `<span class="my-tag r">${p}</span>`).join("")}${S.cells.map(c => `<span class="my-tag">${POSCELLS.find(x => x[0] === c)[1]}</span>`).join("")}</div>
  <div class="my-hakko"><div class="my-hk"><div class="t">表裏</div><div class="v">${hk.hr}</div></div><div class="my-hk"><div class="t">寒熱</div><div class="v">${hk.kn}</div></div><div class="my-hk"><div class="t">虚実</div><div class="v">${hk.kj}</div></div></div></div>`;
  for (const a of alerts(ps)) h += `<div class="my-alert">${txt(a)}</div>`;

  for (const im of IMPLY){ if (!S.comp && im.test(S)) h += `<div class="my-panel" style="font-size:14px">この組み合わせは <b style="color:var(--shu)">${im.p}脈</b> に相当します。${im.also ? `<span class="my-muted">${txt(im.also)}</span>` : ""} <button type="button" class="my-btn" data-addcomp="${im.p}" style="margin-left:4px">${im.p}脈として判定</button></div>`; }

  if (combos.length){
    h += `<h2>相兼脈</h2>`;
    for (const c of combos){
      h += `<div class="my-combo"><div class="nm">${c.nm}</div><p style="margin:4px 0">${txt(c.text)}</p><div class="my-muted" style="font-size:12px">出典：${txt(c.src)}</div></div>`;
    }
  }

  if (ranked.length){
    const max = ranked[0][1];
    h += `<h2>考えられる病態</h2><div class="my-cand">`;
    ranked.slice(0, 6).forEach(([id, sc], i) => {
      const s = SYN[id];
      h += `<div class="my-c ${i === 0 ? "top" : ""}"><div class="hd"><span class="nm">${s.n}</span><span class="sc">${sc}点</span></div>
      <div class="my-bar"><i style="width:${Math.round(sc / max * 100)}%"></i></div>
      <ul class="my-why">${why[id].filter(Boolean).map(w => `<li>${txt(w)}</li>`).join("")}</ul>
      ${s.rx || s.f ? `<div class="my-rx">${s.rx ? `<b>${s.rx}</b>　` : ""}${s.f ? rxHTML(s.f) : ""}<span class="ext">参考処方・書籍外</span></div>` : ""}</div>`;
    });
    h += `</div>`;
    const missing = missingDims();
    if (missing.length) h += `<p class="my-muted">まだ選んでいない所見：${missing.join("、")}。加えると候補が絞れます。</p>`;
  }

  h += `<h2>各脈の意義（一覧表より）</h2><div class="my-panel my-single">`;
  for (const p of ps){
    const r = PULSES.find(x => x.p === p); if (!r) continue;
    h += `<div><span class="p">${p}脈</span><span>${txt(r.f)}<br><span class="my-tag g" style="font-size:11px">実</span> ${txt(r.j || "—")}　<span class="my-tag k" style="font-size:11px">虚</span> ${txt(r.k || "—")}${r.n ? `<br><span class="my-muted">備考：${txt(r.n)}</span>` : ""}<br><span class="my-muted" style="font-size:12px">出典：${txt(r.src)}</span></span></div>`;
  }
  if (S.force){ const r = PULSES.find(x => x.p === (S.force === "有力" ? "実" : "虚")); h += `<div><span class="p">${r.p}脈</span><span>${txt(r.f)}：${txt(r.j || r.k)}（${txt(r.n)}）</span></div>`; }
  h += `</div>`;

  if (S.cells.length){
    h += `<h2>部位</h2><div class="my-panel my-single"><div><span class="p">部位</span><span>${S.cells.map(c => POSCELLS.find(y => y[0] === c)[1]).join("・")}</span></div>`;
    h += `<p class="my-muted" style="margin:4px 0 0">寸・関・尺ごとの病は「各脈の解説」の各脈の「主な病」を見る。</p></div>`;
  }
  h += `<p class="my-muted">脈だけからの候補です。最終判断は望・聞・問診と合わせて行ってください。</p>`;
  out.innerHTML = h;
}
el("myResult").addEventListener("click", e => {
  const b = e.target.closest("[data-addcomp]"); if (!b) return;
  S.comp = b.dataset.addcomp; S._ex = false; renderInputs(); renderResult();
});

/* カルテ用コピー（クリップボードへ。保存はしない） */
function chartText(){
  const {ps, ranked, combos} = judge(); const hk = hakko(ps);
  const sel = [...ps]; if (S.force) sel.splice(1, 0, S.force);
  const cells = S.cells.map(c => POSCELLS.find(x => x[0] === c)[1]);
  let t = `脈：${sel.join("・") || "—"}`; if (cells.length) t += `（${cells.join("・")}）`;
  if (combos.length) t += `／${combos.map(c => c.nm).join("・")}`;
  t += `｜八綱：${hk.hr}・${hk.kn}・${hk.kj}`;
  if (ranked.length) t += `｜候補：${ranked.slice(0, 3).map(([id]) => SYN[id].n.replace(/（.*?）/, "")).join("、")}`;
  return t;
}
function toast(m){ const t = el("myToast"); t.textContent = m; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => t.hidden = true, 1800); }
el("myCopy").onclick = () => {
  const text = chartText();
  const fallback = () => { let ta = el("myCopytxt"); if (!ta){ ta = document.createElement("textarea"); ta.id = "myCopytxt"; ta.rows = 3; el("myResult").prepend(ta); } ta.value = text; ta.focus(); ta.select(); toast("選択しました。長押しでコピーしてください"); };
  try { navigator.clipboard.writeText(text).then(() => toast("コピーしました：" + text.slice(0, 24) + "…"), fallback); } catch (e){ fallback(); }
};

/* ===== 二十八脈一覧（myaku28-draft.md の一覧表） ===== */
function renderTable(q){
  q = (q || "").trim();
  let h = "";
  for (const r of PULSES){
    const hay = r.p + "脈" + r.f + r.j + r.k + r.n + r.src;
    if (q && !hay.includes(q)) continue;
    h += `<tr data-p="${r.p}"><td class="pn">${r.p}脈${r.yy ? `<br><small>${r.yy}</small>` : ""}</td><td>${txt(r.f)}</td><td>${txt(r.j || "—")}</td><td>${txt(r.k || "—")}</td><td>${txt(r.n || "")}</td><td>${txt(r.src)}</td></tr>`;
  }
  el("myTb").innerHTML = h || `<tr><td colspan="6" class="my-muted">該当なし</td></tr>`;
}
el("myQ").addEventListener("input", e => renderTable(e.target.value));
el("myTb").addEventListener("click", e => {
  const tr = e.target.closest("tr[data-p]"); if (!tr) return; const p = tr.dataset.p;
  if (p === "実" || p === "虚"){ S.force = p === "実" ? "有力" : "無力"; }
  else { const g = GROUPS.find(g => g.opts.some(o => o[0] === p)); if (g) S[g.k] = p; }
  S._ex = false; renderInputs(); renderResult();
  window.scrollTo(0, 0);
  ROUTER.replace("#/myaku/judge");
  toast(p + "脈を入れました");
});

/* ===== 各脈の解説（myaku28-draft.md の各脈の節。HTML は生成時にエスケープ済み） ===== */
el("myDetail").innerHTML = PULSES.map(r => {
  const d = DETAIL[r.p]; if (!d) return "";
  return `<div class="my-panel my-tip"><h3>${esc(d.title)}</h3>${flags(d.html)}</div>`;
}).join("");

renderInputs(); renderResult(); renderTable("");

subtabModule("myaku", {
  title: "脈診ナビ",
  sub: "脈象の組み合わせから病態を考える",
  subs: [["judge", "判定"], ["list", "二十八脈"], ["kaisetsu", "各脈の解説"]],
  fit: true,
  top: true
});
})();
