/* ===== 証ナビのテーマ（テーマ名と方剤の並び） =====
   SHOU_MODS（data.js）の label と formulas から作る。方剤名は原典の id に直す（加味逍遥散→加味逍遙散 など。NAME_INDEX）。
   副作用タブの併用チェックで「テーマで絞り込む」に使う（fuku.js は shou より後に読み込まれる）。 */
var SHOU_TOPICS = Object.keys(SHOU_MODS).map(function(k){
  return {id: k, label: SHOU_MODS[k].label, formulas: SHOU_MODS[k].formulas.map(function(n){ return NAME_INDEX[n] || n; })};
});
