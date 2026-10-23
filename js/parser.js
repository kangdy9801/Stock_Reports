/*
 * DART 정기보고서(반기·분기·사업보고서) 텍스트에서 재무 숫자를 찾아냅니다.
 * 입력: extract.js가 만든 줄 배열. 출력: 억원 단위 숫자와, 각 숫자를 찾은 원문 줄.
 * 회사마다 계정 이름이 조금씩 달라서, 비슷한 이름 목록으로 찾습니다.
 * 자동으로 찾지 못한 값은 null이며, 화면에서 직접 입력할 수 있습니다.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DartParser = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const norm = (s) => String(s || '').replace(/[\s·ㆍ\[\]［］*※]/g, '');
  const clean = (L) => L.replace(/\((손실|이익|손익)\)/g, '');

  const NUM_RE = /^\(?-?\d[\d,]*(\.\d+)?\)?$/;
  function splitRow(line) {
    const toks = line.trim().split(/\s+/);
    const nums = [];
    let i = toks.length - 1;
    for (; i >= 0; i--) {
      const t = toks[i];
      if (t === '-' || t === '–' || t === '－') { nums.unshift(0); continue; }
      if (NUM_RE.test(t)) {
        const neg = t.startsWith('(') || t.startsWith('-');
        const v = parseFloat(t.replace(/[(),\-]/g, ''));
        if (Number.isNaN(v)) break;
        nums.unshift(neg ? -v : v);
        continue;
      }
      break;
    }
    const label = toks.slice(0, i + 1).join(' ');
    return { label, L: norm(label), nums };
  }

  const UNIT = { '원': 1e-8, '천원': 1e-5, '백만원': 1e-2, '억원': 1 };
  function findUnit(lines, from, span) {
    const text = lines.slice(from, from + span).join(' ').replace(/\s+/g, '');
    const m = text.match(/단위[:：]?(백만원|천원|억원|원)/);
    return m ? UNIT[m[1]] : null;
  }

  const isPageNoise = (s) => /dart\.fss\.or\.kr|^\f$/.test(s) || /^Page\s*\d+$/.test(s.trim());

  // 본문에 있는 표 제목을 찾습니다(목차의 같은 제목은 '단위'가 바로 뒤따르지 않으므로 건너뜀).
  function findBody(lines, re, startAt = 0) {
    for (let i = startAt; i < lines.length; i++) {
      const n = norm(lines[i]);
      if (!re.test(n)) continue;
      const near = lines.slice(i + 1, i + 9).join(' ');
      if (/단위/.test(near)) return i;
    }
    return -1;
  }

  const STMT_TITLES = [
    /^(\d-\d\.)?(연결)?재무상태표$/, /^(\d-\d\.)?(연결)?(포괄)?손익계산서$/,
    /^(\d-\d\.)?(연결)?자본변동표$/, /^(\d-\d\.)?(연결)?현금흐름표$/,
    /^\d\.(연결)?재무제표주석$/, /^\d\.(연결)?재무제표$/, /재무제표에대한주석/
  ];
  function sectionRows(lines, start, maxLen = 260) {
    const rows = [];
    for (let i = start + 1; i < Math.min(lines.length, start + maxLen); i++) {
      const raw = lines[i];
      if (isPageNoise(raw)) continue;
      const n = norm(raw);
      if (i > start + 3 && STMT_TITLES.some(r => r.test(n))) break;
      const r = splitRow(raw);
      r.raw = raw.trim();
      rows.push(r);
    }
    return rows;
  }

  function locateStatements(lines) {
    const pick = (consRe, sepRe) => {
      const c = findBody(lines, consRe);
      if (c >= 0) return { at: c, consolidated: true };
      const s = findBody(lines, sepRe);
      return s >= 0 ? { at: s, consolidated: false } : null;
    };
    return {
      bs: pick(/^(\d-\d\.)?연결재무상태표$/, /^(\d-\d\.)?재무상태표$/),
      is: pick(/^(\d-\d\.)?연결(포괄)?손익계산서$/, /^(\d-\d\.)?(포괄)?손익계산서$/),
      cf: pick(/^(\d-\d\.)?연결현금흐름표$/, /^(\d-\d\.)?현금흐름표$/)
    };
  }

  function rec(store, key, value, row, scale) {
    if (value === null || value === undefined || Number.isNaN(value)) return;
    store[key] = { v: value * scale, src: row.raw };
  }
  function addTo(store, key, value, row, scale) {
    const prev = store[key];
    const v = (prev ? prev.v : 0) + value * scale;
    store[key] = { v, src: (prev ? prev.src + ' / ' : '') + row.raw };
  }

  // ---------- 재무상태표 ----------
  function parseBS(lines, at) {
    const unit = findUnit(lines, at, 10) || 1e-8;
    const rows = sectionRows(lines, at);
    const cur = {}, prev = {}, prev2 = {};
    let zone = null;
    const fin = /(금융자산|금융상품|단기투자|유가증권|매도가능|상각후원가|만기보유)/;
    const debt = /(차입금|사채|유동성장기부채|리스부채)/;
    const debtNot = /(파생|조정|할인|할증|상환할증)/;
    const potential = [];
    for (const r of rows) {
      const L = clean(r.L);
      if (L === '유동자산') zone = 'ca';
      else if (L === '비유동자산') zone = 'nca';
      else if (L === '유동부채') zone = 'cl';
      else if (L === '비유동부채') zone = 'ncl';
      else if (L === '자본' || L === '자본총계' || L.startsWith('지배기업')) zone = zone === 'cl' || zone === 'ncl' ? 'eq' : zone;
      if (!r.nums.length) continue;
      const a = r.nums[0], b = r.nums.length > 1 ? r.nums[1] : null, c = r.nums.length > 2 ? r.nums[2] : null;
      const put = (k) => { rec(cur, k, a, r, unit); if (b !== null) rec(prev, k, b, r, unit); if (c !== null) rec(prev2, k, c, r, unit); };
      const add = (k) => { addTo(cur, k, a, r, unit); if (b !== null) addTo(prev, k, b, r, unit); if (c !== null) addTo(prev2, k, c, r, unit); };
      if (L === '유동자산') { put('cur_assets'); continue; }
      if (L === '유동부채') { put('cur_liab'); continue; }
      if (L.startsWith('자산총계')) { put('assets'); continue; }
      if (L.startsWith('부채총계')) { put('liab'); zone = 'eq'; continue; }
      if (L.startsWith('자본총계')) { put('equity'); continue; }
      if (L === '자본금' && !cur.capital) { put('capital'); continue; }
      if (zone === 'eq' && L.includes('지배기업') && !cur.equity_ctrl) { put('equity_ctrl'); continue; }
      if (zone === 'ca') {
        if (L.startsWith('현금및현금성자산') && !cur.cash) put('cash');
        else if (L.startsWith('매출채권') && !cur.receivables) put('receivables');
        else if (L.startsWith('재고자산') && !cur.inventory) put('inventory');
        else if (fin.test(L) && !/(파생|매출채권|법인세)/.test(L)) add('st_fin');
      } else if (zone === 'nca') {
        if (fin.test(L) && !/(관계기업|종속|공동기업|파생|매출채권|법인세)/.test(L)) add('lt_fin');
      } else if (zone === 'cl' || zone === 'ncl') {
        if (L.includes('계약부채')) add('contract_liab');
        if (debt.test(L) && !debtNot.test(L)) {
          add(zone === 'cl' ? 'debt_1y' : 'debt_lt');
          if (/(전환사채|교환사채|신주인수권부사채)/.test(L) && Math.abs(a) > 0) potential.push(r.label.trim());
        }
      }
    }
    for (const s of [cur, prev, prev2]) {
      const d1 = s.debt_1y ? s.debt_1y.v : 0, d2 = s.debt_lt ? s.debt_lt.v : 0;
      if (s.debt_1y || s.debt_lt) s.debt_total = { v: d1 + d2, src: '유동 + 비유동 차입금·사채·리스부채 합계' };
    }
    return { unit, cur, prev, prev2, potential };
  }

  // ---------- 손익계산서 ----------
  function parseIS(lines, at) {
    const unit = findUnit(lines, at, 10) || 1e-8;
    const head = lines.slice(at, at + 10).join(' ');
    const fourCol = /누적/.test(head);
    const rows = sectionRows(lines, at);
    const cur = {}, prev = {}, prev2 = {}, curQ = {}, prevQ = {};
    let afterNi = false;
    let attr = null; // '귀속' 머리줄: 순이익 귀속(ni)인지 포괄손익 귀속(oci)인지
    const REV = new Set(['매출액', '수익(매출액)', '수익', '영업수익', '매출', '매출수익', '영업수익(매출액)']);
    for (const r of rows) {
      if (!r.nums.length) {
        if (r.L.includes('귀속')) attr = /포괄/.test(r.L) ? 'oci' : 'ni';
        continue;
      }
      const L = clean(r.L);
      const niAttr = afterNi && !L.startsWith('포괄') && (attr === 'ni' || (attr === null && /순이익|순손실/.test(L)) || /순이익|순손실/.test(L));
      const n = r.nums;
      const put = (k) => {
        if (cur[k]) return;
        if (fourCol && n.length >= 4) {
          rec(cur, k, n[1], r, unit); rec(prev, k, n[3], r, unit);
          rec(curQ, k, n[0], r, unit); rec(prevQ, k, n[2], r, unit);
        } else {
          rec(cur, k, n[0], r, unit); if (n.length > 1) rec(prev, k, n[1], r, unit); if (n.length > 2) rec(prev2, k, n[2], r, unit);
        }
      };
      if (!cur.rev && REV.has(L)) put('rev');
      else if (L.startsWith('매출원가')) put('cogs');
      else if (L.startsWith('매출총이익') || L.startsWith('매출총손실')) put('gp');
      else if (/^판매비(와|및)?관리비|^판매관리비/.test(L)) put('sga');
      else if (L.startsWith('영업이익') || L.startsWith('영업손실')) put('op');
      else if (L.startsWith('금융수익')) put('fin_inc');
      else if (L.startsWith('금융비용') || L.startsWith('금융원가')) put('fin_cost');
      else if (L.startsWith('기타수익') || L.startsWith('기타영업외수익')) put('oth_inc');
      else if (L.startsWith('기타비용') || L.startsWith('기타영업외비용')) put('oth_exp');
      else if (/^법인세(비용)?차감전/.test(L)) put('pbt');
      else if (!cur.ni && /^(당기|반기|분기)?(연결)?(순이익|순손실|당기순이익|당기순손실)/.test(L) && !L.includes('귀속') && !L.includes('주당')) { put('ni'); afterNi = true; }
      else if (niAttr && !cur.ni_ctrl && L.includes('지배기업') && !L.includes('비지배')) put('ni_ctrl');
      else if (niAttr && !cur.nci && L.startsWith('비지배')) put('nci');
    }
    for (const s of [cur, prev, prev2, curQ, prevQ]) {
      if (!s.gp && s.rev && s.cogs) s.gp = { v: s.rev.v - s.cogs.v, src: '매출액 − 매출원가로 계산' };
      if (!s.ni_ctrl && s.ni) s.ni_ctrl = { v: s.ni.v, src: '비지배지분이 없어 당기순이익과 같음' };
    }
    return { unit, fourCol, cur, prev, prev2, curQ, prevQ };
  }

  // ---------- 현금흐름표 ----------
  function parseCF(lines, at) {
    const unit = findUnit(lines, at, 10) || 1e-8;
    const rows = sectionRows(lines, at);
    const cur = {}, prev = {}, prev2 = {};
    for (const r of rows) {
      if (!r.nums.length) continue;
      const L = clean(r.L);
      const n = r.nums;
      const put = (k) => { if (cur[k]) return; rec(cur, k, n[0], r, unit); if (n.length > 1) rec(prev, k, n[1], r, unit); if (n.length > 2) rec(prev2, k, n[2], r, unit); };
      const addAbs = (k) => { addTo(cur, k, Math.abs(n[0]), r, unit); if (n.length > 1) addTo(prev, k, Math.abs(n[1]), r, unit); if (n.length > 2) addTo(prev2, k, Math.abs(n[2]), r, unit); };
      if (L.startsWith('영업활동')) put('ocf');
      else if (L.startsWith('투자활동')) put('icf');
      else if (L.startsWith('재무활동')) put('fcf_fin');
      else if (/^유형자산의?취득/.test(L)) addAbs('capex_ppe');
      else if (/^무형자산의?취득/.test(L)) addAbs('capex_int');
      else if (/^배당금의?지급/.test(L)) addAbs('div_paid');
      else if (/^이자의?지급/.test(L)) addAbs('int_paid');
      else if (/^이자의?수취/.test(L)) addAbs('int_recv');
      else if (/^자기주식의?취득/.test(L)) addAbs('buyback');
    }
    return { unit, cur, prev, prev2 };
  }

  // ---------- 요약재무정보(직전 사업연도 연간 숫자) ----------
  function parseSummary(lines) {
    let at = -1;
    for (let i = 0; i < lines.length; i++) {
      const n = norm(lines[i]);
      if (/^(가\.)?요약연결재무정보$/.test(n) || /^(가\.)?요약재무정보$/.test(n)) {
        if (/단위/.test(lines.slice(i + 1, i + 14).join(' '))) { at = i; break; }
      }
    }
    if (at < 0) return null;
    const unit = findUnit(lines, at, 16) || 1e-8;
    const out = {};
    let afterNi = false;
    for (let i = at + 1; i < Math.min(lines.length, at + 90); i++) {
      const raw = lines[i];
      if (i > at + 3 && /^나\./.test(norm(raw))) break;
      const r = splitRow(raw); r.raw = raw.trim();
      if (r.nums.length < 2) continue;
      const L = clean(r.L);
      const put = (k) => { if (!out[k]) out[k] = { v: r.nums[1] * unit, src: r.raw }; };
      if (['매출액', '수익(매출액)', '수익', '영업수익', '매출'].includes(L)) put('rev');
      else if (L.startsWith('영업이익') || L.startsWith('영업손실')) put('op');
      else if (/^(당기|반기|분기)?순이익|^(당기|반기|분기)?순손실/.test(L)) { put('ni'); afterNi = true; }
      else if (afterNi && L.includes('지배기업')) put('ni_ctrl');
    }
    if (out.ni && !out.ni_ctrl) out.ni_ctrl = { v: out.ni.v, src: out.ni.src };
    return Object.keys(out).length ? out : null;
  }

  // ---------- 보고서 정보 ----------
  function parseMeta(lines) {
    const top = lines.slice(0, 400);
    let company = null, type = null, end = null;
    for (const s of top) {
      const m = s.match(/회\s*사\s*명\s*[:：]\s*(.+)/);
      if (m && !company) company = m[1].replace(/\s{2,}.*/, '').trim();
      const n = norm(s);
      if (!type && /^(반기보고서|분기보고서|사업보고서)$/.test(n)) type = n;
      const d = s.match(/(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일\s*까지/);
      if (d && !end) end = { y: +d[1], m: +d[2], d: +d[3] };
    }
    if (!type) {
      const t = top.join(' ');
      type = /반\s*기\s*보\s*고\s*서/.test(t) ? '반기보고서' : /분\s*기\s*보\s*고\s*서/.test(t) ? '분기보고서' : /사\s*업\s*보\s*고\s*서/.test(t) ? '사업보고서' : null;
    }
    let label = null;
    if (end) {
      if (type === '반기보고서') label = `${end.y} 상반기`;
      else if (type === '분기보고서') label = `${end.y} ${end.m <= 3 ? '1분기' : end.m <= 9 && end.m > 6 ? '3분기' : end.m + '월'}`;
      else if (type === '사업보고서') label = `${end.y} 연간`;
      else label = `${end.y}.${String(end.m).padStart(2, '0')}`;
    }
    const cumLabel = type === '반기보고서' ? '상반기 누적' : type === '분기보고서' ? '누적' : '연간';
    return { company, type, end, label, cumLabel, sortKey: end ? end.y * 10000 + end.m * 100 + end.d : 0 };
  }

  function parseShares(lines) {
    for (const s of lines) {
      const n = norm(s);
      if (n.includes('발행주식의총수') && (n.startsWith('Ⅳ') || n.includes('(Ⅱ-Ⅲ)') || n.startsWith('IV'))) {
        const r = splitRow(s);
        const nums = r.nums.filter(x => x > 0);
        if (r.nums.length >= 3 && r.nums[2] > 0) return { v: r.nums[2], src: s.trim() };
        if (nums.length) return { v: nums[0], src: s.trim() };
      }
    }
    return null;
  }

  function parseBacklog(lines) {
    for (let i = 0; i < lines.length; i++) {
      const n = norm(lines[i]);
      if (!/수주(상황|현황)$/.test(n) || n.includes('매출및')) continue;
      if (/\.{5,}/.test(lines[i])) continue;
      const unit = findUnit(lines, i, 14);
      if (!unit) continue;
      let firstRow = null;
      for (let j = i + 1; j < Math.min(lines.length, i + 40); j++) {
        if (isPageNoise(lines[j])) continue;
        const r = splitRow(lines[j]); r.raw = lines[j].trim();
        if (/^(\d+\.|[가-하]\.)/.test(norm(lines[j])) && j > i + 2 && !r.nums.length) break;
        if (!r.nums.length) continue;
        const L = norm(r.label);
        if (/단위|기준일/.test(L)) continue;
        if (/^합계|^총계/.test(L)) return { v: r.nums[r.nums.length - 1] * unit, src: r.raw };
        if (!firstRow) firstRow = r;
      }
      if (firstRow) return { v: firstRow.nums[firstRow.nums.length - 1] * unit, src: firstRow.raw + ' (합계 줄이 없어 첫 줄 사용)' };
    }
    return null;
  }

  function parseOverview(lines) {
    let at = -1;
    for (let i = 0; i < lines.length; i++) {
      if (norm(lines[i]) === '1.사업의개요' && !/\.{5,}/.test(lines[i])) { at = i; break; }
    }
    if (at < 0) return null;
    let text = '';
    for (let i = at + 1; i < Math.min(lines.length, at + 30); i++) {
      const s = lines[i].trim();
      if (!s || isPageNoise(s)) continue;
      const n = norm(s);
      if (/^(2\.주요제품|가\.|나\.)/.test(n) && text.length > 80) break;
      if (/^\(단위/.test(n)) break;
      const prevChar = text.slice(-1), nextChar = s[0];
      const hangul = (c) => /[가-힣]/.test(c);
      text += text && !(hangul(prevChar) && hangul(nextChar)) ? ' ' + s : s;
      if (text.length > 650) break;
    }
    return text.length > 650 ? text.slice(0, 640).replace(/\s\S*$/, '') + '…' : text;
  }

  // ---------- 감가상각비·무형자산상각비 (EBITDA 계산용) ----------
  // 1순위: 주석 '비용의 성격별 분류', 2순위: 주석 '현금흐름표(에 관한 정보)'의 조정 항목
  function parseDA(lines) {
    const tryBlock = (headRe, rowRe, totalRe) => {
      for (let i = 0; i < lines.length; i++) {
        if (/\.{5,}/.test(lines[i])) continue;
        const n = norm(lines[i]);
        if (!headRe.test(n)) continue;
        const unit = findUnit(lines, i, 6) || null;
        if (!unit) continue;
        const res = { cur: null, prev: null };
        let which = 'cur', count = 0;
        for (let j = i + 1; j < Math.min(lines.length, i + 70); j++) {
          if (isPageNoise(lines[j])) continue;
          const L = norm(lines[j]);
          if (j > i + 2 && /^\d+\./.test(L) && !/단위/.test(L)) break;
          if (/^(전반기|전기|전분기)(\(|$)/.test(L) || /^전(반)?기\(?단위/.test(L)) { if (res.cur) which = 'prev'; continue; }
          const r = splitRow(lines[j]);
          if (!r.nums.length) continue;
          const lab = clean(norm(r.label));
          if (totalRe.test(lab)) {
            const v = Math.abs(r.nums[0]) * unit;
            if (which === 'cur' && !res.cur) res.cur = { v, src: lines[j].trim() };
            else if (which === 'prev' && !res.prev) res.prev = { v, src: lines[j].trim() };
            if (r.nums.length > 1 && which === 'cur' && !res.prev && headRe.source.includes('현금흐름')) res.prev = { v: Math.abs(r.nums[1]) * unit, src: lines[j].trim() };
            continue;
          }
          if (rowRe.test(lab) && !/투자부동산|손상/.test(lab)) {
            const tgt = which;
            const prevVal = res[tgt];
            res[tgt] = { v: (prevVal ? prevVal.v : 0) + Math.abs(r.nums[0]) * unit, src: (prevVal ? prevVal.src + ' / ' : '') + lines[j].trim() };
            if (r.nums.length > 1 && tgt === 'cur' && headRe.source.includes('현금흐름')) {
              const p = res.prev;
              res.prev = { v: (p ? p.v : 0) + Math.abs(r.nums[1]) * unit, src: (p ? p.src + ' / ' : '') + lines[j].trim() };
            }
            count++;
          }
          if (/^(성격별비용합계|합계|조정합계)/.test(lab) && res.cur && which === 'prev' && res.prev) break;
        }
        if (res.cur) return res;
      }
      return null;
    };
    return tryBlock(/비용의성격별분류(\(연결\))?$/, /^(감가상각비|무형자산상각비|사용권자산(감가)?상각비)/, /감가상각비및무형자산상각비/)
      || tryBlock(/(현금흐름표에관한정보|^\d+\.현금흐름표)(\(연결\))?$/, /^(감가상각비|무형자산상각비|사용권자산(감가)?상각비)/, /^감가상각비및무형자산상각비/);
  }

  function parseTicker(lines) {
    for (const s of lines) {
      const m = s.match(/\(A(\d{6})\)/) || s.match(/종목코드\s*[:：]?\s*A?(\d{6})/);
      if (m) return m[1];
    }
    return null;
  }

  function parseReport(lines) {
    const meta = parseMeta(lines);
    meta.ticker = parseTicker(lines);
    const loc = locateStatements(lines);
    const bs = loc.bs ? parseBS(lines, loc.bs.at) : null;
    const is = loc.is ? parseIS(lines, loc.is.at) : null;
    const cf = loc.cf ? parseCF(lines, loc.cf.at) : null;
    const consolidated = loc.bs ? loc.bs.consolidated : null;
    return {
      meta, consolidated,
      bs, is, cf,
      summary: parseSummary(lines),
      shares: parseShares(lines),
      backlog: parseBacklog(lines),
      da: parseDA(lines),
      overview: parseOverview(lines)
    };
  }

  return { parseReport, splitRow, norm };
});
