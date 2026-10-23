/*
 * 분석 기록 저장소 (브라우저 localStorage)
 * PDF 원본은 저장하지 않고, 추출한 숫자·수정값·주가 입력·체크리스트·메모만 저장합니다.
 */
(function (root) {
  const KEY = 'gongsi-note:records:v1';

  function readAll() {
    try {
      const raw = localStorage.getItem(KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) { return []; }
  }
  function writeAll(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); return true; }
    catch (e) { return false; }
  }
  function upsert(rec) {
    const list = readAll();
    const i = list.findIndex(r => r.id === rec.id);
    if (i >= 0) list[i] = rec; else list.unshift(rec);
    list.sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));
    return writeAll(list);
  }
  function remove(id) { return writeAll(readAll().filter(r => r.id !== id)); }
  function get(id) { return readAll().find(r => r.id === id) || null; }
  function available() {
    try { localStorage.setItem(KEY + ':t', '1'); localStorage.removeItem(KEY + ':t'); return true; } catch (e) { return false; }
  }
  root.GongsiStore = { readAll, upsert, remove, get, available };
})(typeof self !== 'undefined' ? self : this);
