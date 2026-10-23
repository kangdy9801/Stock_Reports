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
  const clean = (L) => L.replace(/\(주[\d,\s]*\)/g, '').replace(/\((손실|이익|손익)\)/g, '');

  const NUM_RE = /^[△▲]?\(?-?\d[\d,]*(\.\d+)?\)?$/;
  function splitRow(line) {
    const toks = line.trim().split(/\s+/);
    const nums = [];
    let i = toks.length - 1;
    for (; i >= 0; i--) {
      const t = toks[i];
      if (t === '-' || t === '–' || t === '－') { nums.unshift(0); continue; }
      if (NUM_RE.test(t)) {
        const neg = /^[(\-△▲]/.test(t);
        const v = parseFloat(t.replace(/[(),\-△▲]/g, ''));
        if (Number.isNaN(v)) break;
        nums.unshift(neg ? -v : v);
        continue;
      }
      break;
    }
    const label = toks.slice(0, i + 1).join(' ');
    // 쉼표 자리가 이상한 숫자(예: '417,09')는 보고서 오타일 수 있어 표시해 둡니다.
    const bad = toks.slice(i + 1).some(t => /,/.test(t) && !/^[△▲(\-]?\d{1,3}(,\d{3})*(\.\d+)?\)?$/.test(t));
    return { label, L: norm(label), nums, bad };
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
  // 표 머리글로 쓰이는 줄(다음 줄과 합치지 않음)
  const HEADER_ROW = /^(자산|부채|자본|부채와자본|자본과부채|유동자산|비유동자산|유동부채|비유동부채|수익|비용|조정항목|조정)$/;
  const isNoteFrag = (t) => /^\(?주[\d,\s]*\)?$|^[\d,\s]+\)$/.test(t.replace(/\s/g, ''));
  // 계정 이름이 좁은 칸에서 여러 줄로 나뉜 보고서(예: '현금및현금성자산' / 숫자 / '(주34,35)')를 한 줄로 합칩니다.
  function sectionRows(lines, start, maxLen = 260) {
    const rows = [];
    const stop = Math.min(lines.length, start + maxLen);
    const nextReal = (i) => { for (let j = i + 1; j < stop; j++) if (!isPageNoise(lines[j]) && lines[j].trim()) return j; return -1; };
    for (let i = start + 1; i < stop; i++) {
      const raw = lines[i];
      if (isPageNoise(raw) || !raw.trim()) continue;
      const n = norm(raw);
      if (i > start + 3 && STMT_TITLES.some(r => r.test(n))) break;
      const r = splitRow(raw);
      r.raw = raw.trim();
      const prev = rows[rows.length - 1];
      if (!r.nums.length) {
        const j = nextReal(i);
        const nxt = j >= 0 ? splitRow(lines[j]) : null;
        const nextIsBareNums = nxt && nxt.nums.length && !nxt.label.trim();
        // 앞 줄이 여러 줄로 나뉜 계정의 숫자 줄이었고, 지금 줄이 그 이름의 뒷부분이면 이어 붙임
        if (prev && prev.nums.length && prev.wrapped && !nextIsBareNums && (isNoteFrag(raw) || n.length <= 14) && !HEADER_ROW.test(clean(n))) {
          prev.label += raw.trim(); prev.L = norm(prev.label); prev.raw += ' ' + raw.trim();
          continue;
        }
        // 글자만 있는 짧은 조각이 이어지는 경우(예: '…의 귀' / '속')
        if (prev && !prev.nums.length && n.length <= 3 && !nextIsBareNums) { prev.label += raw.trim(); prev.L = norm(prev.label); prev.raw += raw.trim(); continue; }
        rows.push(r);
        continue;
      }
      if (prev && !prev.nums.length && !prev.used) {
        const pl = clean(prev.L);
        const bare = !r.label.trim();
        const colHead = /^(3개월|누적|당기|전기|전전기|당반기|전반기|당분기|전분기|반기|분기|1분기|3분기|제\d+기|과목|구분|금액|주석|\d{4}년)+$/.test(pl);
        if ((bare && !colHead) || (!bare && !colHead && !HEADER_ROW.test(pl) && !/귀속|단위|현재|부터|까지|^제\d+기/.test(pl) && !isNoteFrag(prev.raw))) {
          r.label = prev.label + (bare ? '' : ' ' + r.label);
          r.L = norm(r.label);
          r.raw = prev.raw + ' ' + r.raw;
          r.wrapped = true;
          if (!bare || !HEADER_ROW.test(pl)) rows.pop(); else prev.used = true;
        }
      }
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
    const fin = /(금융자산|금융상품|단기투자|투자자산|유가증권|매도가능|상각후원가|만기보유)/;
    const debt = /(차입금|사채|유동성장기부채|리스부채)/;
    const debtNot = /(파생|조정|할인|할증|상환할증)/;
    const potential = [];
    for (const r of rows) {
      const L = clean(r.L);
      if (L === '유동자산') zone = 'ca';
      else if (L === '비유동자산') zone = 'nca';
      else if (L === '유동부채') zone = 'cl';
      else if (L === '비유동부채') zone = 'ncl';
      else if (L === '자본' || L === '자본총계' || /^지배(기업|회사)/.test(L)) zone = zone === 'cl' || zone === 'ncl' ? 'eq' : zone;
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
      if (zone === 'eq' && /지배(기업|회사)|지배주주/.test(L) && !L.includes('비지배') && !cur.equity_ctrl) { put('equity_ctrl'); continue; }
      if (zone === 'ca') {
        if (L.startsWith('현금및현금성자산') && !cur.cash) put('cash');
        else if (L.startsWith('매출채권') && !cur.receivables) put('receivables');
        else if (L.startsWith('재고자산') && !cur.inventory) put('inventory');
        else if (fin.test(L) && !/(파생|매출채권|법인세)/.test(L)) add('st_fin');
      } else if (zone === 'nca') {
        // 비유동 금융자산 중 주식 투자(기타포괄손익-공정가치, 장기투자자산 등)는 현금처럼 쓸 돈이 아니라 뺍니다.
        if (fin.test(L) && !/(관계기업|종속|공동기업|파생|매출채권|법인세|부동산|기타포괄|지분상품|투자주식|장기투자자산)/.test(L)) add('lt_fin');
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
        if (/귀속|의귀$/.test(r.L)) attr = /포괄/.test(r.L) ? 'oci' : 'ni';
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
      else if (!cur.ni && /^(연결)?(총)?(당기|반기|분기)?(연결)?(총)?(순이익|순손실|당기순이익|당기순손실)/.test(L) && !L.includes('귀속') && !L.includes('주당')) { put('ni'); afterNi = true; }
      else if (niAttr && !cur.ni_ctrl && /지배(기업|회사)|지배주주/.test(L) && !L.includes('비지배')) put('ni_ctrl');
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
      else if (/^유형자산(및[^의]{0,12})?의?취득/.test(L)) addAbs('capex_ppe');
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
      const put = (k) => { if (!out[k] && !r.bad) out[k] = { v: r.nums[1] * unit, src: r.raw }; else if (!out[k]) out[k] = { bad: true }; };
      if (['매출액', '수익(매출액)', '수익', '영업수익', '매출'].includes(L)) put('rev');
      else if (L.startsWith('영업이익') || L.startsWith('영업손실')) put('op');
      else if (/^(연결)?(총)?(당기|반기|분기)?(연결)?(총)?순(이익|손실)/.test(L) && !L.includes('주당')) { put('ni'); afterNi = true; }
      else if (afterNi && /지배(기업|회사)|지배주주/.test(L) && !L.includes('비지배')) put('ni_ctrl');
    }
    for (const k of Object.keys(out)) if (out[k].bad) delete out[k];
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
      const d = s.match(/(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일\s*까지/) || s.match(/(\d{4})\s*[.\-\/]\s*(\d{1,2})\s*[.\-\/]\s*(\d{1,2})\s*까지/);
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
    const found = parseSharesMain(lines);
    if (found) return found;
    // 분기보고서 등에서 '주식의 총수' 표가 없으면 주석의 기말 유통주식수(보통주)를 씁니다.
    for (const s of lines) {
      const n = norm(s);
      if (/^기말유통주식수/.test(n)) {
        const r = splitRow(s);
        if (r.nums.length && r.nums[0] > 0) return { v: r.nums[0], src: s.trim() + ' (보통주 유통주식수, 자기주식 제외)' };
      }
    }
    return null;
  }
  function parseSharesMain(lines) {
    for (const s of lines) {
      const n = norm(s);
      if (n.includes('발행주식의총수') && (n.startsWith('Ⅳ') || n.includes('(Ⅱ-Ⅲ)') || n.startsWith('IV'))) {
        const r = splitRow(s);
        const nums = r.nums.filter(x => x > 0);
        // 열 순서: 보통주, 우선주(종류주식), 합계. 주가는 보통주 기준이라 보통주 수를 씁니다.
        if (r.nums.length >= 3 && r.nums[1] > 0 && r.nums[0] > 0) return { v: r.nums[0], src: s.trim() + ' (보통주. 우선주 ' + r.nums[1].toLocaleString('ko-KR') + '주는 제외)', pref: r.nums[1] };
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
        const partial = lines.slice(i, i + 6).some(x => /^\[\d\]/.test(x.trim()));
        if (/^합계|^총계/.test(L)) {
          // '452.404'처럼 쉼표 대신 점을 찍은 오타는 452,404로 읽습니다.
          const lastTok = r.raw.trim().split(/\s+/).pop();
          let v = r.nums[r.nums.length - 1];
          if (/^\d{1,3}\.\d{3}$/.test(lastTok)) v = parseFloat(lastTok.replace('.', ''));
          return { v: v * unit, src: r.raw + (partial ? ' (일부 사업의 수주만 공시됨)' : '') };
        }
        if (!firstRow) firstRow = r;
      }
      if (firstRow) return { v: firstRow.nums[firstRow.nums.length - 1] * unit, src: firstRow.raw + ' (합계 줄이 없어 첫 줄 사용)' };
    }
    return null;
  }

  function parseOverview(lines) {
    let at = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^1\.(\([^)]*\))?사업의개요$/.test(norm(lines[i])) && !/\.{5,}/.test(lines[i])) { at = i; break; }
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
      || tryBlock(/(현금흐름표에관한정보|^\d+\.현금흐름표)(\(연결\))?$/, /^(감가상각비|무형자산상각비|사용권자산(감가)?상각비)/, /^감가상각비및무형자산상각비/)
      || tryBlock(/^\d+\.영업비용(\(연결\))?$/, /^(감가상각비|무형자산상각비|사용권자산(감가)?상각비)/, /^감가상각비및무형자산상각비/);
  }

  function parseTicker(lines) {
    for (const s of lines) {
      const m = s.match(/\(A(\d{6})\)/) || s.match(/종목코드\s*[:：]?\s*A?(\d{6})/);
      if (m) return m[1];
    }
    return null;
  }

  // ---------- 사업 내용: 제품별 매출, 연구개발비, 연구인력, 특허 ----------
  // 금액 열만 남기고(%는 버림) 앞쪽 글자를 이름으로 씁니다.
  function amountsRow(line) {
    const toks = line.trim().split(/\s+/);
    let first = -1;
    const nums = [];
    toks.forEach((t, i) => {
      if (/%$/.test(t)) { if (first < 0) first = i; return; }
      if (t === '-' && i > 0) { if (first < 0) first = i; nums.push(0); return; }
      if (NUM_RE.test(t)) {
        if (first < 0) first = i;
        const neg = /^[(\-△▲]/.test(t);
        nums.push((neg ? -1 : 1) * parseFloat(t.replace(/[(),\-△▲]/g, '')));
      }
    });
    const label = (first < 0 ? toks : toks.slice(0, first)).join(' ');
    return { label, nums };
  }
  const isHeading = (n) => /^([가-하]\.|\d+\)|\d+\.|\(\d+\))/.test(n);
  // 표 머리글의 연도 순서(예: 2022년 2023년 2024년)를 읽어, 최신 연도가 맨 앞이 되도록 맞춥니다.
  function yearOrder(lines, from, to) {
    const ys = [];
    for (let j = from; j < to; j++) {
      const m = lines[j].match(/(20\d{2})\s*년/g);
      if (m && m.length >= 2) { m.forEach(x => ys.push(+x.slice(0, 4))); break; }
    }
    return ys;
  }
  function orderAmounts(nums, ys) {
    if (ys.length < 2) return nums;
    const a = nums.slice(0, ys.length);
    return ys[0] < ys[ys.length - 1] ? a.reverse() : a;
  }

  function parseProducts(lines) {
    for (let i = 0; i < lines.length; i++) {
      const n = norm(lines[i]);
      if (!/주요제품(등|및서비스)?(등)?의?(현황|매출|매출비중|매출현황)$/.test(n) || /\.{5,}/.test(lines[i])) continue;
      const unit = findUnit(lines, i, 14);
      if (!unit) continue;
      const rows = [];
      const ys = yearOrder(lines, i + 1, i + 8);
      // '품목' 칸이 있으면 그 칸의 글자를 제품 이름으로 씁니다(사업부문·용도 칸과 섞이지 않게).
      const items = lines.items || null;
      let px = null;
      if (items) for (let t = i + 1; t < Math.min(lines.length, i + 14) && px === null; t++) {
        for (const it of (items[t] || [])) if (/^품\s*목$/.test(it.s.trim())) { px = it.x + it.w / 2; break; }
      }
      const nameFromItems = (j) => {
        if (!items || !items[j]) return null;
        const txt = [];
        for (const it of items[j]) { const s2 = it.s.trim(); if (!s2) continue; if (NUM_RE.test(s2) || /%$/.test(s2)) break; txt.push(it); }
        if (!txt.length) return null;
        let pick = txt[0];
        if (px !== null) pick = txt.reduce((a, b) => Math.abs(b.x + b.w / 2 - px) < Math.abs(a.x + a.w / 2 - px) ? b : a);
        return pick.s.trim().replace(/,.*$/, '').trim();
      };
      let checkSum = 0, total = null;
      for (let j = i + 1; j < Math.min(lines.length, i + 40); j++) {
        if (isPageNoise(lines[j])) continue;
        const nj = norm(lines[j]);
        if (/^(합계|총계)/.test(nj)) { const t = amountsRow(lines[j]); if (t.nums.length) total = t.nums[0]; break; }
        if (/^\(?주\d?\)/.test(nj) || (isHeading(nj) && j > i + 2)) break;
        const r = amountsRow(lines[j]);
        if (r.nums.length && /내부거래|제거|조정/.test(nj)) checkSum += r.nums[0];
        if (!r.nums.length || !r.nums.some(v => Math.abs(v) > 0)) continue;
        let label = r.label.replace(/^[-–·\s]+/, '').replace(/\s+-$/, '');
        const comma = label.search(/\S+,/);
        if (comma > 0) label = label.slice(0, comma);
        label = label.replace(/\s+/g, ' ').trim();
        if (!label || /단위|기준일|금액|비율|^\d{4}년/.test(label)) continue;
        if (/내부거래|제거|조정|합계|총계|소계/.test(label.replace(/\s/g, ''))) continue;
        const itemName = nameFromItems(j);
        if (itemName && !/㈜|\(주\)|주식회사/.test(label)) label = itemName;
        if (/㈜|\(주\)|주식회사/.test(label)) return null; // 회사 이름과 제품이 섞인 표는 제품별로 나누기 어려워 쓰지 않음
        if (label.length > 22) label = label.slice(0, 21) + '…';
        rows.push({ name: label, amounts: orderAmounts(r.nums, ys).map(v => v * unit), src: lines[j].trim() });
        checkSum += r.nums[0];
      }
      // 합계와 맞지 않으면(여러 줄로 얽힌 표를 잘못 읽은 경우) 쓰지 않고 부문 정보로 대신합니다.
      if (rows.length && total !== null && Math.abs(checkSum - total) > Math.abs(total) * 0.01 + 1) return null;
      if (rows.length) return rows;
    }
    return null;
  }

  function parseRnd(lines) {
    for (let i = 0; i < lines.length; i++) {
      const n = norm(lines[i]);
      if (!/연구개발비(용)?(의?현황)?(\((연결|별도)(기준)?\))?$/.test(n) || /\.{5,}/.test(lines[i]) || n.length > 26) continue;
      const unit = findUnit(lines, i, 14);
      if (!unit) continue;
      const ys = yearOrder(lines, i + 1, i + 14);
      for (let j = i + 1; j < Math.min(lines.length, i + 30); j++) {
        if (isPageNoise(lines[j])) continue;
        const nj = clean(norm(lines[j]));
        const r = amountsRow(lines[j]);
        if (!r.nums.length) continue;
        const L = clean(norm(r.label));
        if (/^(합계|총계)$/.test(L) || /총계$/.test(L) || /^연구개발비(용)?(합계|계|총계)$/.test(L)) {
          return { amounts: (ys.length >= 2 && ys[0] < ys[ys.length - 1] ? orderAmounts(r.nums, ys) : r.nums).map(v => v * unit), src: lines[j].trim() };
        }
        if (j > i + 3 && isHeading(nj) && !r.nums.length) break;
      }
    }
    return null;
  }

  function parseResearchers(lines) {
    for (const s of lines) {
      const m = s.match(/(\d[\d,]*)\s*명의?\s*(전문\s*)?연구(인력|원|개발\s*인력)/) || s.match(/연구(인력|원)[^\d]{0,15}(\d[\d,]*)\s*명/);
      if (m) {
        const v = parseInt((m[1].match(/\d/) ? m[1] : m[2]).replace(/,/g, ''), 10);
        if (v > 0 && v < 100000) return { v, src: s.trim() };
      }
    }
    return null;
  }
  function parsePatents(lines) {
    for (const s of lines) {
      if (!/특허/.test(s)) continue;
      const m = s.match(/총\s*([\d,]+)\s*건[^.。]{0,40}특허/) || s.match(/특허[^.。]{0,30}총\s*([\d,]+)\s*건/);
      if (m) return { v: parseInt(m[1].replace(/,/g, ''), 10), src: s.trim() };
      // '국내 등록특허 3,804건 및 해외 등록특허 2,155건'처럼 나눠 적은 경우 합칩니다.
      const parts = [...s.matchAll(/(국내|해외)\s*(등록\s*)?특허\s*([\d,]+)\s*건/g)];
      if (parts.length) return { v: parts.reduce((a, x) => a + parseInt(x[3].replace(/,/g, ''), 10), 0), src: s.trim() };
    }
    return null;
  }


  // ---------- 영업부문(자회사·사업부별) 매출과 영업이익 ----------
  const segName = (s) => s.replace(/\(주\)|㈜|주식회사/g, '').replace(/\s+/g, ' ').trim();
  function parseSegments(lines) {
    const items = lines.items || null;
    let start = -1;
    for (let i = 0; i < lines.length; i++) {
      const n = norm(lines[i]);
      if (/\.{5,}/.test(lines[i])) continue;
      if (/영업부문(정보|에대한공시|별정보)|^\d+\.부문별보고/.test(n) && /단위/.test(lines.slice(i, i + 25).join(' '))) { start = i; break; }
    }
    if (start < 0) return null;
    const unit = findUnit(lines, start, 25) || 1e-8;
    const end = Math.min(lines.length, start + 220);
    const isRev = (L) => /^(영업수익|매출액|수익|매출|수익\(매출액\)|영업수익\(매출액\)|매출액\(수익\)|외부고객으로부터의수익)$/.test(L);
    const isOp = (L) => /^(영업손익|영업이익|영업손실|부문손익|부문이익)$/.test(L);
    // (1) 세로형: 머리글 줄에 '매출액'과 '영업손익'이 함께 있음
    for (let i = start; i < end; i++) {
      const hn = norm(lines[i]);
      if (splitRow(lines[i]).nums.length) continue;
      if (!/(매출액|영업수익)/.test(hn) || !/(영업손익|영업이익)/.test(hn)) continue;
      if (/다\.$/.test(lines[i].trim()) || hn.length > 60) continue;
      const head = lines[i].trim().split(/\s{2,}/).map(norm).filter(t => t && !/^(구|분|구분)$/.test(t));
      if (head.length < 2) continue;
      const ri = head.findIndex(t => /매출액|영업수익/.test(t)), oi = head.findIndex(t => /영업손익|영업이익/.test(t));
      if (ri < 0 || oi < 0) continue;
      const blocks = [];
      let k = i;
      while (k < end && blocks.length < 2) {
        const out = [];
        let pending = [], lastWrapped = null;
        let j = k + 1;
        for (; j < end; j++) {
          if (isPageNoise(lines[j])) continue;
          const r = splitRow(lines[j]);
          const L = norm(r.label);
          if ((/^(소계|합계|내부거래|조정|연결|계)/.test(L) || /합계|총계/.test(L)) && r.nums.length) break;
          if (!r.nums.length) {
            if (/(매출액|영업수익)/.test(norm(lines[j])) && /(영업손익|영업이익)/.test(norm(lines[j]))) break;
            if (/^\(\d\)|^[가-하]\.|^\d+\./.test(norm(lines[j])) && out.length) break;
            if (/단위|당기|전기|반기|분기|당기말|기말/.test(norm(lines[j])) && norm(lines[j]).length < 30) continue;
            pending.push(lines[j].trim());
            continue;
          }
          let name = r.label;
          if (!name) {
            if (lastWrapped && pending.length > 1) lastWrapped.name += ' ' + pending.shift();
            name = pending.join(' ');
          }
          pending = [];
          name = name.replace(/^((보고|영업)?부문\s+)+/, '');
          const row = { name: segName(name), rev: (r.nums[ri] || 0) * unit, op: (r.nums[oi] || 0) * unit };
          if (!r.label) lastWrapped = row; else lastWrapped = null;
          out.push(row);
        }
        if (lastWrapped && pending.length) lastWrapped.name += ' ' + pending.join(' ');
        if (out.length) blocks.push(out);
        // 다음 머리글(전기) 찾기
        k = j;
        let next = -1;
        for (let t = j + 1; t < Math.min(end, j + 25); t++) {
          const tn = norm(lines[t]);
          if (!splitRow(lines[t]).nums.length && /(매출액|영업수익)/.test(tn) && /(영업손익|영업이익)/.test(tn)) { next = t; break; }
        }
        if (next < 0) break;
        k = next;
      }
      if (blocks.length) return { cur: blocks[0], prev: blocks[1] || null, src: '주석의 영업부문 정보' };
    }
    // (2) 가로형: '영업수익' 줄에 부문별 숫자가 옆으로 나열됨 → 부문 합계와 맞는 앞쪽 열을 부문으로 봄
    const blocks = [];
    let rawK = 0;
    let i = start;
    while (i < end && blocks.length < 2) {
      let r1 = -1, r2 = -1;
      for (let t = i; t < end; t++) { const r = splitRow(lines[t]); if (r.nums.length >= 2 && isRev(clean(norm(r.label)))) { r1 = t; break; } }
      if (r1 < 0) break;
      for (let t = r1 + 1; t < Math.min(end, r1 + 6); t++) { const r = splitRow(lines[t]); if (r.nums.length >= 2 && isOp(clean(norm(r.label)))) { r2 = t; break; } }
      if (r2 < 0) break;
      let revN = splitRow(lines[r1]).nums, opN = splitRow(lines[r2]).nums;
      // '3개월 / 누적' 열이 번갈아 있으면 누적 열만 씁니다.
      const headQ = lines.slice(Math.max(start, r1 - 6), r1).join(' ');
      const cumOnly = /3개월/.test(headQ) && /누적/.test(headQ) && revN.length % 2 === 0;
      if (cumOnly) { revN = revN.filter((_, k) => k % 2 === 1); opN = opN.filter((_, k) => k % 2 === 1); }
      const groups = [];
      let from = 0;
      while (from < revN.length) {
        let k = -1, acc = 0;
        for (let c = from; c < revN.length - 1; c++) {
          acc += revN[c];
          if (c > from && Math.abs(acc - revN[c + 1]) <= Math.max(2, Math.abs(revN[c + 1]) * 0.001)) { k = c + 1; break; }
        }
        if (k < 0) break;
        groups.push([from, k]);
        from = k + 1;
        while (from < revN.length && Math.abs(revN[from]) > 0 && groups.length && false) from++;
      }
      if (!groups.length) { i = r1 + 1; continue; }
      if (blocks.length && (groups[0][1] - groups[0][0]) !== rawK) { i = r2 + 1; continue; }
      // 머리글 이름: 숫자 조각의 x 위치에 가장 가까운 머리글 글자를 모읍니다.
      const names = [];
      if (items && items[r1]) {
        let numItems = items[r1].filter(it => /^\(?-?\d[\d,]*\)?$|^-$/.test(it.s.trim()));
        if (cumOnly) numItems = numItems.filter((_, k) => k % 2 === 1);
        // 숫자는 열의 오른쪽 끝에, 머리글은 왼쪽 끝에 맞춰져 있어 '오른쪽 끝' 구간으로 열을 나눕니다.
        const rights = numItems.map(it => it.x + it.w);
        const cols = rights.map(() => []);
        let h0 = r1 - 1;
        while (h0 > i && h0 > r1 - 12 && !/단위/.test(lines[h0])) h0--;
        for (let t = h0 + 1; t < r1; t++) {
          for (const it of (items[t] || [])) {
            const txt = it.s.trim();
            if (!txt) continue;
            const best = rights.findIndex(rx => rx >= it.x + 2);
            if (best >= 0) cols[best].push(txt);
          }
        }
        cols.forEach((parts0) => {
          let parts = parts0.filter(p => !/^(부문|부문의|합계|합|계|영업부문|중요한|조정사항|기업|전체|총계|부문의 합계|중요한 조정사항|기업 전체 총계|보고부문|당반기|전반기|당기|전기|당분기|전분기|구분|구 분|구|분|3개월|누적)$/.test(p));
          // 여러 열을 묶는 상위 이름(예: '통신사업' 아래 '무선통신사업')은 빼고 아래쪽 이름을 씁니다.
          if (parts.length >= 2 && parts[parts.length - 1].length >= 4 && /(사업|부문)$/.test(parts[0])) parts = parts.slice(1);
          let nm = '';
          for (const p of parts) {
            if (/^(부문|부문의|합계|합|계|영업부문|중요한|조정사항|기업|전체|총계|부문의 합계|중요한 조정사항|기업 전체 총계|보고부문|당반기|전반기|당기|전기|당분기|전분기|구분|구 분|구|분)$/.test(p)) continue;
            nm += (nm && /[A-Za-z0-9]$/.test(nm) && /^[A-Za-z0-9]/.test(p)) ? ' ' + p : p;
          }
          names.push(segName(nm.replace(/\(?단위[^)]*\)?/g, '').replace(/^[^가-힣A-Za-z]*(천원|백만원|원)?\)?\.?/, '')));
        });
      }
      const [g0, gk] = groups[0];
      // 약칭 줄(예: 'HS MS VS ES 이노텍 기타')이 있으면 그것을 부문 이름으로 씁니다.
      if (items) {
        for (let t = r1 - 1; t > Math.max(start, r1 - 30); t--) {
          if (splitRow(lines[t]).nums.length) break;
          const its = (items[t] || []).map(it => it.s.trim()).filter(Boolean);
          if (its.length === gk - g0 && its.every(x => x.length <= 8 && !/[.,]/.test(x) && !/^(당|전)(반기|분기|기)$|^구\s*분$|합\s*계|^계$|부문의/.test(x))) {
            const firstX = (items[t].find(it => it.s.trim()) || {}).x || 0;
            const numX = items[r1].find(it => /\d/.test(it.s)) ? items[r1].find(it => /\d/.test(it.s)).x : 0;
            if (firstX >= numX - 60) { its.forEach((x, k) => { names[g0 + k] = x; }); break; }
          }
        }
      }
      const mk = (a, b) => {
        const out = [];
        for (let c = a; c < b; c++) {
          const nm = names[c] || `부문 ${c - a + 1}`;
          if (/조정|내부거래|제거|연결/.test(nm)) continue; // 조정 열은 부문이 아님
          out.push({ name: nm, rev: revN[c] * unit, op: (opN[c] || 0) * unit });
        }
        return out;
      };
      blocks.push(mk(g0, gk));
      if (blocks.length === 1) rawK = gk - g0;
      const headTxt = lines.slice(Math.max(start, r1 - 12), r1).join(' ').replace(/\s/g, '');
      const twoPeriods = /당(반기|분기|기)/.test(headTxt) && /전(반기|분기|기)/.test(headTxt);
      if (groups[1] && twoPeriods && blocks.length < 2) blocks.push(mk(groups[1][0], groups[1][1]).map((r, idx) => ({ ...r, name: blocks[0][idx] ? blocks[0][idx].name : r.name })));
      i = r2 + 1;
    }
    if (!blocks.length) return null;
    // 같은 머리글이 반복된 이전 블록 이름을 다음 블록에도 씁니다.
    if (blocks[1] && blocks[1].length === blocks[0].length) blocks[1] = blocks[1].map((r, idx) => ({ ...r, name: /^부문 \d+$/.test(r.name) ? blocks[0][idx].name : r.name }));
    return { cur: blocks[0], prev: blocks[1] || null, src: '주석의 영업부문 정보' };
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
      products: parseProducts(lines),
      rnd: parseRnd(lines),
      researchers: parseResearchers(lines),
      patents: parsePatents(lines),
      segments: parseSegments(lines),
      overview: parseOverview(lines)
    };
  }

  return { parseReport, splitRow, norm };
});
