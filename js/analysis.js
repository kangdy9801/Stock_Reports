/*
 * 추출한 숫자로 9단계 체크리스트, 판정, '함께 알아두면 좋은 점', '투자 전 확인사항'을 만듭니다.
 * 모든 금액은 억원 단위입니다.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DartAnalysis = api;
})(typeof self !== 'undefined' ? self : this, function () {
  // 화면의 '추출값 확인·수정' 표에 나오는 기본 항목
  const BASE = [
    { key: 'rev', label: '매출액', group: '손익' },
    { key: 'gp', label: '매출총이익', group: '손익' },
    { key: 'sga', label: '판매비와관리비', group: '손익' },
    { key: 'op', label: '영업이익', group: '손익' },
    { key: 'fin_inc', label: '금융수익', group: '손익' },
    { key: 'fin_cost', label: '금융비용', group: '손익' },
    { key: 'oth_inc', label: '기타수익', group: '손익' },
    { key: 'oth_exp', label: '기타비용', group: '손익' },
    { key: 'ni', label: '당기순이익', group: '손익' },
    { key: 'ni_ctrl', label: '지배주주 순이익', group: '손익' },
    { key: 'nci', label: '비지배지분 순이익', group: '손익' },
    { key: 'da', label: '감가상각비·무형자산상각비', group: '손익' },
    { key: 'revQ', label: '최근 3개월 매출액', group: '손익' },
    { key: 'rev_cum', label: '누적 매출액', group: '손익' },
    { key: 'op_cum', label: '누적 영업이익', group: '손익' },
    { key: 'ni_cum', label: '누적 당기순이익', group: '손익' },
    { key: 'opQ', label: '최근 3개월 영업이익', group: '손익' },
    { key: 'ocf', label: '영업활동현금흐름', group: '현금흐름' },
    { key: 'capex', label: '설비투자(유형+무형 취득)', group: '현금흐름' },
    { key: 'icf', label: '투자활동현금흐름', group: '현금흐름' },
    { key: 'div_paid', label: '배당금 지급', group: '현금흐름' },
    { key: 'int_paid', label: '이자 지급', group: '현금흐름' },
    { key: 'cash', label: '현금및현금성자산', group: '재무상태' },
    { key: 'st_fin', label: '유동 금융자산', group: '재무상태' },
    { key: 'lt_fin', label: '비유동 금융자산', group: '재무상태' },
    { key: 'receivables', label: '매출채권', group: '재무상태' },
    { key: 'inventory', label: '재고자산', group: '재무상태' },
    { key: 'contract_liab', label: '계약부채(선수금)', group: '재무상태' },
    { key: 'debt_1y', label: '1년 내 갚을 차입금·사채·리스', group: '재무상태' },
    { key: 'debt_total', label: '이자 붙는 빚 합계', group: '재무상태' },
    { key: 'liab', label: '부채총계', group: '재무상태' },
    { key: 'equity', label: '자본총계', group: '재무상태' },
    { key: 'equity_ctrl', label: '지배주주 자본', group: '재무상태' },
    { key: 'capital', label: '자본금', group: '재무상태' },
    { key: 'backlog', label: '수주잔고', group: '사업' },
    { key: 'rnd', label: '연구개발비', group: '사업' },
    { key: 'researchers', label: '연구인력(명)', group: '사업', unit: '명' },
    { key: 'patents', label: '등록 특허(건)', group: '사업', unit: '건' },
    { key: 'shares', label: '발행주식수(주)', group: '사업', unit: '주' }
  ];

  // 단계별로 보여줄 지표
  const METRICS = [
    { key: 'rnd', step: 1, label: '연구개발비', unit: '억원', better: 'up' },
    { key: 'rnd_ratio', step: 1, label: '연구개발비 ÷ 매출', unit: '%', better: 'flat' },
    { key: 'researchers', step: 1, label: '연구인력', unit: '명', better: 'up' },
    { key: 'patents', step: 1, label: '등록 특허', unit: '건', better: 'up' },
    { key: 'rev', step: 2, label: '매출액', unit: '억원', better: 'up' },
    { key: 'gp', step: 2, label: '매출총이익', unit: '억원', better: 'up' },
    { key: 'gpm', step: 2, label: '매출총이익률', unit: '%', better: 'up' },
    { key: 'sga', step: 2, label: '판매비와관리비', unit: '억원', better: 'flat' },
    { key: 'op', step: 2, label: '영업이익', unit: '억원', better: 'up' },
    { key: 'opm', step: 2, label: '영업이익률', unit: '%', better: 'up' },
    { key: 'ni', step: 2, label: '당기순이익', unit: '억원', better: 'up' },
    { key: 'npm', step: 2, label: '순이익률', unit: '%', better: 'up' },
    { key: 'ebitda', step: 2, label: 'EBITDA(영업이익 + 감가상각비)', unit: '억원', better: 'up' },
    { key: 'ebitda_m', step: 2, label: 'EBITDA 마진', unit: '%', better: 'up' },
    { key: 'ni_ctrl', step: 2, label: '지배주주 순이익', unit: '억원', better: 'up' },
    { key: 'roe', step: 2, label: 'ROE(연환산, 15% 이상이면 좋음)', unit: '%', better: 'up' },
    { key: 'opQ', step: 2, label: '최근 3개월 영업이익', unit: '억원', better: 'up' },
    { key: 'ocf', step: 3, label: '영업활동현금흐름', unit: '억원', better: 'up' },
    { key: 'ocf_ni', step: 3, label: '영업현금흐름 ÷ 순이익', unit: '%', better: 'flat' },
    { key: 'receivables', step: 3, label: '매출채권(기말)', unit: '억원', better: 'watch' },
    { key: 'inventory', step: 3, label: '재고자산(기말)', unit: '억원', better: 'watch' },
    { key: 'contract_liab', step: 3, label: '계약부채·선수금(기말)', unit: '억원', better: 'up' },
    { key: 'capex', step: 4, label: '설비투자', unit: '억원', better: 'flat' },
    { key: 'fcf', step: 4, label: 'FCF(영업현금흐름 − 설비투자)', unit: '억원', better: 'up' },
    { key: 'div_paid', step: 4, label: '배당금 지급', unit: '억원', better: 'flat' },
    { key: 'cash', step: 5, label: '현금및현금성자산', unit: '억원', better: 'flat' },
    { key: 'st_fin', step: 5, label: '유동 금융자산', unit: '억원', better: 'flat' },
    { key: 'lt_fin', step: 5, label: '비유동 금융자산', unit: '억원', better: 'flat' },
    { key: 'cash_total', step: 5, label: '현금성 자산 합계', unit: '억원', better: 'up' },
    { key: 'debt_1y', step: 6, label: '1년 내 갚을 빚', unit: '억원', better: 'down' },
    { key: 'debt_total', step: 6, label: '이자 붙는 빚 합계', unit: '억원', better: 'down' },
    { key: 'debt_ratio', step: 6, label: '부채비율', unit: '%', better: 'down' },
    { key: 'shares', step: 6, label: '발행주식수', unit: '주', better: 'watch' },
    { key: 'int_paid', step: 7, label: '이자 지급액', unit: '억원', better: 'down' },
    { key: 'icr', step: 7, label: '이자보상배율(영업이익 ÷ 이자 지급)', unit: '배', better: 'up' },
    { key: 'cash_cover', step: 7, label: '바로 쓸 현금 ÷ 1년 내 갚을 빚', unit: '배', better: 'up' },
    { key: 'backlog', step: 8, label: '수주잔고', unit: '억원', better: 'up' },
    { key: 'backlog_x', step: 8, label: '수주잔고 ÷ 누적 매출', unit: '배', better: 'up' },
    { key: 'rev_yoy', step: 8, label: '매출 성장률(1년 전 대비)', unit: '%', better: 'up', noDelta: true },
    { key: 'rev_cagr', step: 8, label: '매출 연평균 성장률(첫 열 대비)', unit: '%', better: 'up', noDelta: true },
    { key: 'ni_cagr', step: 8, label: '지배주주 순이익 연평균 성장률(첫 열 대비)', unit: '%', better: 'up', noDelta: true }
  ];

  const STEPS = [
    { step: 1, name: '사업 이해', question: '무엇을 팔아 돈을 버는가?' },
    { step: 2, name: '수익성·가격 결정력', question: '매출이 늘면서 이익도 남는가?' },
    { step: 3, name: '실제 현금 창출', question: '장부상 이익이 현금으로 들어오는가?' },
    { step: 4, name: '투자 후 남는 현금', question: '필요한 투자를 하고도 현금이 남는가?' },
    { step: 5, name: '보유 현금', question: '지금 쓸 수 있는 돈이 얼마나 있는가?' },
    { step: 6, name: '부채 규모', question: '얼마의 빚을 언제까지 갚아야 하는가?' },
    { step: 7, name: '부채 조건·상환 능력', question: '만기가 몰리거나 금리가 올라도 감당할 수 있는가?' },
    { step: 8, name: '장기 성장성', question: '커지는 시장에서 실제로 돈을 벌고 있는가?' },
    { step: 9, name: '주가의 적정성', question: '좋은 기업을 지나치게 비싸게 사는 것은 아닌가?' }
  ];

  const val = (o, k) => (o && o[k] && typeof o[k].v === 'number' && !Number.isNaN(o[k].v)) ? o[k] : null;

  // 보고서 1개 → 열(column) 값 묶음
  function columnFromReport(rep, which, quarterIS) {
    const isPrev = which !== 'cur';
    const pick = (part, sub) => (rep[part] && rep[part][sub]) || {};
    const bs = pick('bs', which);
    const isCum = pick('is', which);
    // 분기 탭: 손익은 해당 분기 3개월 숫자, 현금흐름은 누적 숫자
    const is = quarterIS ? pick('is', isPrev ? 'prevQ' : 'curQ') : isCum;
    const isQ = which === 'prev2' ? {} : pick('is', isPrev ? 'prevQ' : 'curQ');
    const cf = pick('cf', which);
    const v = {};
    const take = (k, src, sk) => { const x = val(src, sk || k); if (x) v[k] = { v: x.v, src: x.src }; };
    ['rev', 'gp', 'sga', 'op', 'fin_inc', 'fin_cost', 'oth_inc', 'oth_exp', 'ni', 'ni_ctrl', 'nci'].forEach(k => take(k, is));
    if (quarterIS) {
      take('rev_cum', isCum, 'rev'); take('op_cum', isCum, 'op'); take('ni_cum', isCum, 'ni');
    } else { take('revQ', isQ, 'rev'); take('opQ', isQ, 'op'); }
    ['ocf', 'icf', 'div_paid', 'int_paid'].forEach(k => take(k, cf));
    const ppe = val(cf, 'capex_ppe'), intg = val(cf, 'capex_int');
    if (ppe || intg) v.capex = { v: (ppe ? ppe.v : 0) + (intg ? intg.v : 0), src: [ppe && ppe.src, intg && intg.src].filter(Boolean).join(' / ') };
    ['cash', 'st_fin', 'lt_fin', 'receivables', 'inventory', 'contract_liab', 'debt_1y', 'debt_total', 'liab', 'equity', 'equity_ctrl', 'capital'].forEach(k => take(k, bs));
    if (rep.da && rep.da[which]) v.da = { v: rep.da[which].v, src: rep.da[which].src };
    // 사업 내용 표(제품별 매출·연구개발비): 사업보고서는 연도 열이 있어 전기·전전기도 씀
    const annual = rep.meta && rep.meta.type === '사업보고서';
    const idx = which === 'cur' ? 0 : (annual ? (which === 'prev' ? 1 : 2) : -1);
    if (idx >= 0 && rep.rnd && rep.rnd.amounts[idx] !== undefined) v.rnd = { v: rep.rnd.amounts[idx], src: rep.rnd.src };
    if (which === 'cur') {
      if (rep.researchers) v.researchers = { v: rep.researchers.v, src: rep.researchers.src };
      if (rep.patents) v.patents = { v: rep.patents.v, src: rep.patents.src };
    }
    if (!isPrev) {
      if (rep.backlog) v.backlog = { v: rep.backlog.v, src: rep.backlog.src };
      if (rep.shares) v.shares = { v: rep.shares.v, src: rep.shares.src };
    }
    // 회계 숫자가 없는 '없음' 항목은 0으로 둡니다(계약부채, 배당 등은 없을 수 있음).
    return v;
  }

  function bizOf(rep, which) {
    const annual = rep.meta && rep.meta.type === '사업보고서';
    const idx = which === 'cur' ? 0 : (annual ? (which === 'prev' ? 1 : 2) : -1);
    const products = [];
    if (idx >= 0 && rep.products) for (const p of rep.products) if (p.amounts[idx] !== undefined) products.push({ name: p.name, v: p.amounts[idx] });
    const segBlock = rep.segments ? (which === 'cur' ? rep.segments.cur : which === 'prev' ? rep.segments.prev : null) : null;
    return { products, segments: segBlock ? segBlock.map(x => ({ name: x.name, rev: x.rev, op: x.op })) : [] };
  }

  // 사업보고서: 보고서 1개에 3개 연도가 들어 있어 연도별 열로 펼칩니다(겹치면 최신 보고서 숫자 사용).
  function buildAnnualColumns(reports) {
    const sorted = [...reports].sort((a, b) => a.meta.sortKey - b.meta.sortKey);
    const byYear = new Map();
    for (const r of sorted) {
      const y = r.meta.end ? r.meta.end.y : 0;
      [['prev2', y - 2], ['prev', y - 1], ['cur', y]].forEach(([which, yy]) => {
        const base = columnFromReport(r, which);
        const n = Object.keys(base).filter(k => !['backlog', 'shares'].includes(k)).length;
        if (n < 5) return;
        const older = byYear.get(yy);
        // 같은 연도가 겹치면 최신 보고서 숫자를 쓰되, 최신 보고서에 없는 항목(수주잔고·연구인력 등)은 이전 보고서에서 채웁니다.
        if (older) for (const [k, val] of Object.entries(older.base)) if (!base[k]) base[k] = val;
        byYear.set(yy, {
          fallback: older ? { rep: older.rep, which: older.which } : null,
          id: 'Y' + yy, reportId: r.id, derived: which !== 'cur', which,
          label: `${yy}년`, type: '사업보고서', end: { y: yy, m: 12, d: 31 },
          base, rep: r,
          note: which !== 'cur' ? `${r.meta.end.y}년 사업보고서의 비교 열에서 가져온 숫자입니다.` : null
        });
      });
    }
    const years = [...byYear.keys()].sort((a, b) => a - b).slice(-5);
    return years.map(y => byYear.get(y));
  }

  function buildQuarterColumns(reports) {
    const sorted = [...reports].sort((a, b) => a.meta.sortKey - b.meta.sortKey);
    const cols = sorted.map(r => ({
      id: r.id, reportId: r.id, derived: false, quarter: true,
      label: r.meta.label || r.fileName, type: r.meta.type, end: r.meta.end,
      base: columnFromReport(r, 'cur', true), rep: r
    }));
    // 최신 보고서와 같은 분기의 1년 전 보고서가 없으면, 보고서 안의 전년 같은 분기 숫자로 비교 열을 만듭니다.
    const L = sorted[sorted.length - 1];
    if (L && L.meta.end) {
      const e = L.meta.end;
      const has = sorted.some(r => r.meta.end && r.meta.end.y === e.y - 1 && r.meta.end.m === e.m);
      if (!has) {
        cols.push({
          id: L.id + ':prev', reportId: L.id, derived: true, quarter: true,
          label: (L.meta.label || '').replace(String(e.y), String(e.y - 1)) + ' (비교 열)', type: L.meta.type, end: { y: e.y - 1, m: e.m, d: e.d },
          base: columnFromReport(L, 'prev', true), rep: L,
          note: '손익은 전년 같은 분기 3개월, 현금흐름은 전년 같은 기간 누적, 재무상태 항목은 직전 사업연도 말 기준입니다.'
        });
        cols.sort((a, b) => (a.end.y * 100 + a.end.m) - (b.end.y * 100 + b.end.m));
      }
    }
    return cols;
  }

  function buildColumns(reports, mode) {
    if (mode === 'annual') return buildAnnualColumns(reports);
    if (mode === 'quarter') return buildQuarterColumns(reports);
    const sorted = [...reports].sort((a, b) => a.meta.sortKey - b.meta.sortKey);
    const cols = sorted.map(r => ({
      id: r.id, reportId: r.id, derived: false,
      label: r.meta.label || r.fileName, type: r.meta.type, end: r.meta.end,
      base: columnFromReport(r, 'cur'), rep: r
    }));
    if (sorted.length === 1) {
      const r = sorted[0];
      const e = r.meta.end;
      const prevLabel = e ? (r.meta.label || '').replace(String(e.y), String(e.y - 1)) : '전년 동기';
      cols.unshift({
        id: r.id + ':prev', reportId: r.id, derived: true,
        label: prevLabel + ' (비교 열)', type: r.meta.type, end: e ? { y: e.y - 1, m: e.m, d: e.d } : null,
        base: columnFromReport(r, 'prev'), rep: r,
        note: '손익·현금흐름은 전년 같은 기간, 재무상태 항목은 직전 사업연도 말 기준입니다.'
      });
    }
    return cols;
  }

  // 사용자가 고친 값을 반영한 최종 값
  function resolve(col, overrides) {
    const o = (overrides && overrides[col.id]) || {};
    const out = {};
    for (const b of BASE) {
      if (o[b.key] !== undefined && o[b.key] !== null && o[b.key] !== '') out[b.key] = { v: +o[b.key], src: '직접 입력', edited: true };
      else if (col.base[b.key]) out[b.key] = { ...col.base[b.key] };
    }
    if (!out.debt_total && out.debt_1y) out.debt_total = { v: out.debt_1y.v, src: '1년 내 빚만 확인됨' };
    return out;
  }

  const num = (x) => (x && typeof x.v === 'number') ? x.v : null;

  function derive(colVals, col, reports) {
    const g = (k) => num(colVals[k]);
    const d = {};
    const set = (k, v) => { if (v !== null && v !== undefined && Number.isFinite(v)) d[k] = v; };
    for (const b of BASE) set(b.key, g(b.key));
    const rev = g('rev');
    if (rev) { set('gpm', g('gp') !== null ? g('gp') / rev * 100 : null); set('opm', g('op') !== null ? g('op') / rev * 100 : null); set('npm', g('ni') !== null ? g('ni') / rev * 100 : null); }
    const ocf = g('ocf'), capex = g('capex');
    if (ocf !== null) set('fcf', ocf - (capex || 0));
    const ni = g('ni_cum') !== null ? g('ni_cum') : g('ni');
    if (ocf !== null && ni !== null && ni > 0) set('ocf_ni', ocf / ni * 100);
    const parts = ['cash', 'st_fin', 'lt_fin'].map(g).filter(x => x !== null);
    if (parts.length) set('cash_total', parts.reduce((a, b) => a + b, 0));
    const liquid = (g('cash') || 0) + (g('st_fin') || 0);
    set('liquid', liquid);
    if (g('liab') !== null && g('equity')) set('debt_ratio', g('liab') / g('equity') * 100);
    const opForCash = g('op_cum') !== null ? g('op_cum') : g('op');
    if (opForCash !== null && g('int_paid')) set('icr', opForCash / g('int_paid'));
    if (g('debt_1y')) set('cash_cover', liquid / g('debt_1y'));
    const revCum = g('rev_cum') !== null ? g('rev_cum') : rev;
    if (g('rnd') !== null && revCum) set('rnd_ratio', g('rnd') / revCum * 100);
    if (g('ni_ctrl') !== null && g('equity_ctrl')) {
      const months = col.quarter ? 3 : (col.end ? col.end.m : 12);
      set('roe', g('ni_ctrl') * (12 / months) / g('equity_ctrl') * 100);
    }
    if (g('backlog') !== null && revCum) set('backlog_x', g('backlog') / revCum);
    // 상각비는 누적 숫자라 누적 영업이익과 더합니다(분기 탭에서는 누적 EBITDA).
    if (opForCash !== null && g('da') !== null) { set('ebitda', opForCash + g('da')); if (revCum) set('ebitda_m', (opForCash + g('da')) / revCum * 100); }
    // 전년 동기 대비 성장률: 같은 보고서 안의 비교 열을 씁니다.
    if (col.quarter && !col.derived && col.rep && col.rep.is && col.rep.is.prevQ && col.rep.is.prevQ.rev && rev) {
      set('rev_yoy', (rev / col.rep.is.prevQ.rev.v - 1) * 100);
    } else if (!col.quarter && col.type !== '사업보고서' && !col.derived && col.rep && col.rep.is && col.rep.is.prev && col.rep.is.prev.rev && rev) {
      set('rev_yoy', (rev / col.rep.is.prev.rev.v - 1) * 100);
    }
    return d;
  }

  // 최신 열과 비교할 열: 같은 종류(같은 결산월)의 가장 가까운 과거 열, 없으면 바로 앞 열
  function compareIndex(cols) {
    const n = cols.length;
    if (n < 2) return -1;
    const L = cols[n - 1];
    for (let j = n - 2; j >= 0; j--) {
      const c = cols[j];
      if (c.type === L.type && c.end && L.end && c.end.m === L.end.m) return j;
    }
    return n - 2;
  }

  function changeText(a, b, unit) {
    if (a === undefined || b === undefined || a === null || b === null) return { text: '', dir: 0 };
    const dlt = b - a;
    const sign = dlt > 0 ? '+' : dlt < 0 ? '−' : '±';
    let text;
    if (unit === '%') text = sign + Math.abs(dlt).toFixed(1) + '%p';
    else if (unit === '배') text = sign + Math.abs(dlt).toFixed(1) + '배';
    else if (unit === '주') text = a ? sign + Math.abs(dlt / a * 100).toFixed(1) + '%' : '';
    else if (a < 0 || b < 0 || Math.abs(a) < 10) text = sign + fmtNum(Math.abs(dlt)) + '억';
    else text = sign + Math.abs(dlt / Math.abs(a) * 100).toFixed(1) + '%';
    return { text, dir: Math.sign(dlt) };
  }
  function tone(dir, better) {
    if (!dir) return 'flat';
    if (better === 'up') return dir > 0 ? 'good' : 'bad';
    if (better === 'down') return dir < 0 ? 'good' : 'bad';
    if (better === 'watch') return 'warn';
    return 'flat';
  }
  function fmtNum(v, unit) {
    if (v === null || v === undefined || !Number.isFinite(v)) return '—';
    if (unit === '%') return v.toFixed(1);
    if (unit === '배') return v.toFixed(1);
    if (unit === '주' || unit === '원') return Math.round(v).toLocaleString('ko-KR');
    const a = Math.abs(v);
    const s = a >= 100 ? Math.round(v).toLocaleString('ko-KR') : (Math.round(v * 10) / 10).toLocaleString('ko-KR', { maximumFractionDigits: 1 });
    return s;
  }
  const pct = (a, b) => (a && b !== null && b !== undefined) ? (b / a - 1) * 100 : null;

  // ---------- 문장 만들기 ----------
  function josa(word, withFinal, noFinal) {
    const ch = word.trim().slice(-1);
    if (/[가-힣]/.test(ch)) return (ch.charCodeAt(0) - 0xAC00) % 28 ? withFinal : noFinal;
    if (/[0-9]/.test(ch)) return '013678'.includes(ch) ? withFinal : noFinal;
    return /[lmnLMN]$/.test(ch) ? withFinal : noFinal;
  }
  // stem: '수주잔고가 늘' → 이어질 때 '늘고', 끝날 때 '늘었습니다', 반대 내용이 뒤따를 때 '늘었지만'
  function clause(stem, conn, past, done) {
    if (done) return { c: stem + conn, f: stem + '습니다', s: stem + '지만' };
    return { c: stem + past + conn, f: stem + past + '습니다', s: stem + past + '지만' };
  }
  function compose(pos, neg) {
    const out = [];
    pos.forEach((p, i) => out.push(i < pos.length - 1 ? p.c : (neg.length ? (p.s || p.f) : p.f)));
    neg.forEach((p, i) => out.push(i < neg.length - 1 ? p.c : p.f));
    return out.join(', ') + '.';
  }

  // ---------- 판정 ----------
  function verdicts(D, cols, val9) {
    const ci = compareIndex(cols);
    const L = D[D.length - 1] || {}, P = ci >= 0 ? D[ci] : {};
    const out = {};
    const v = (k, s, why) => { out[k] = { verdict: s, why }; };
    // 1 사업 이해: 제품별 매출과 연구개발
    {
      const n = cols.length, ci = compareIndex(cols);
      let prods = bizRows(cols, 'products').filter(r => r.vals[n - 1] !== undefined);
      if (!prods.length) prods = bizRows(cols, 'segments', 'rev').filter(r => r.vals[n - 1] !== undefined && Math.abs(r.vals[n - 1]) >= 1);
      const ph = [];
      let lead = null, lag = null;
      if (ci >= 0) for (const r of prods) {
        const a = r.vals[ci], b = r.vals[n - 1];
        if (a === undefined || b === undefined) continue;
        if (!lead || b - a > lead.d) lead = { name: r.name, d: b - a };
        if (!lag || b - a < lag.d) lag = { name: r.name, d: b - a };
      }
      const revG = (P.rev && L.rev !== undefined) ? (L.rev / P.rev - 1) * 100 : (L.rev_yoy ?? null);
      if (lead && lead.d > 0) ph.push(clause(`${lead.name}${josa(lead.name, '이', '가')} 성장을 이끌`, '고', '었'));
      else if (lag && lag.d < 0) ph.push(clause(`${lag.name} 매출이 줄`, '고', '었'));
      else if (revG !== null) ph.push(clause(`매출이 ${revG >= 0 ? '늘' : '줄'}`, '고', '었'));
      if (L.rnd !== undefined && P.rnd !== undefined) {
        const g = pct(P.rnd, L.rnd);
        ph.push(g > 5 ? clause('연구개발 투자가 늘', '고', '었') : g < -5 ? clause('연구개발 투자는 줄', '고', '었') : clause('연구개발 투자는 비슷하게 유지됐', '고', '', true));
      } else if (L.rnd !== undefined) ph.push({ c: `연구개발에 ${fmtNum(L.rnd)}억을 썼고`, f: `연구개발에 ${fmtNum(L.rnd)}억을 썼습니다` });
      let text = ph.length ? compose(ph, []) : '제품별 매출과 연구개발 숫자를 찾지 못했습니다.';
      if (L.researchers !== undefined && P.researchers !== undefined && L.researchers !== P.researchers) text += ` 연구인력은 ${P.researchers}명에서 ${L.researchers}명으로 ${L.researchers > P.researchers ? '늘었습니다' : '줄었습니다'}.`;
      const rndDown = L.rnd !== undefined && P.rnd !== undefined && pct(P.rnd, L.rnd) < -10;
      let verdict;
      if (revG === null && !prods.length) verdict = '확인 필요';
      else if (revG !== null && revG < -5) verdict = '주의';
      else if (revG !== null && revG > 5 && !rndDown) verdict = '개선';
      else verdict = '양호';
      if (rndDown && revG > 5) text += ' 매출은 늘었지만 연구개발 투자가 줄어 기술 경쟁력 유지 여부를 지켜볼 필요가 있습니다.';
      v(1, verdict, text);
    }
    // 2
    if (L.op === undefined) v(2, '확인 필요', '영업이익을 찾지 못했습니다. 아래 추출값 표에서 입력해 주세요.');
    else if (L.op < 0 && P.op !== undefined && L.op > P.op) v(2, '개선', `영업적자가 ${fmtNum(P.op)}억에서 ${fmtNum(L.op)}억으로 줄었습니다. 아직 흑자 전 단계입니다.`);
    else if (L.op < 0) v(2, '주의', '영업적자가 이어지거나 커졌습니다.');
    else if (P.opm !== undefined && L.opm !== undefined && L.opm > P.opm + 0.5 && (L.rev || 0) >= (P.rev || 0)) v(2, '개선', `매출과 함께 영업이익률이 ${P.opm.toFixed(1)}%에서 ${L.opm.toFixed(1)}%로 올랐습니다.`);
    else if (P.opm !== undefined && L.opm !== undefined && L.opm < P.opm - 2) v(2, '주의', `영업이익률이 ${P.opm.toFixed(1)}%에서 ${L.opm.toFixed(1)}%로 낮아졌습니다.`);
    else v(2, '양호', '흑자를 유지하고 있고 이익률 변화가 크지 않습니다.');
    // 3
    if (L.ocf === undefined) v(3, '확인 필요', '영업활동현금흐름을 찾지 못했습니다.');
    else if (L.ocf < 0) v(3, '주의', `영업에서 현금이 ${fmtNum(-L.ocf)}억 빠져나갔습니다.`);
    else {
      const invG = pct(P.inventory, L.inventory), revG = pct(P.rev, L.rev);
      if (invG !== null && revG !== null && invG > revG + 20) v(3, '주의', `현금은 들어왔지만 재고가 ${invG.toFixed(0)}% 늘어 매출 증가율(${revG.toFixed(0)}%)보다 훨씬 빠릅니다.`);
      else if ((L.ni_cum ?? L.ni) > 0 && L.ocf < (L.ni_cum ?? L.ni) * 0.6) v(3, '주의', '순이익에 비해 영업현금흐름이 적습니다. 외상(매출채권)이나 재고를 확인하세요.');
      else v(3, '양호', '장부상 이익이 현금으로 들어오고 있습니다.');
    }
    // 4
    if (L.fcf === undefined) v(4, '확인 필요', 'FCF를 계산하지 못했습니다.');
    else if (L.fcf < 0) v(4, '주의', `투자 후 현금이 ${fmtNum(-L.fcf)}억 부족했습니다.`);
    else if (P.fcf !== undefined && L.fcf > P.fcf) v(4, '개선', `남는 현금이 ${fmtNum(P.fcf)}억에서 ${fmtNum(L.fcf)}억으로 늘었습니다.`);
    else v(4, '양호', '투자를 하고도 현금이 남았습니다.');
    // 5
    if (L.cash_total === undefined) v(5, '확인 필요', '현금성 자산을 찾지 못했습니다.');
    else {
      const g = pct(P.cash_total, L.cash_total);
      if (g !== null && g < -20) v(5, '주의', `현금성 자산이 ${Math.abs(g).toFixed(0)}% 줄었습니다.`);
      else if (g !== null && g > 5) v(5, '개선', `현금성 자산이 ${g.toFixed(0)}% 늘었습니다.`);
      else v(5, '양호', '현금성 자산이 큰 변화 없이 유지됩니다.');
    }
    // 6
    if (L.debt_ratio !== undefined && L.debt_ratio > 200) v(6, '위험', `부채비율이 ${L.debt_ratio.toFixed(0)}%로 높습니다.`);
    else if (L.debt_total !== undefined && P.debt_total !== undefined && L.debt_total < P.debt_total * 0.95) v(6, '개선', `이자 붙는 빚이 ${fmtNum(P.debt_total)}억에서 ${fmtNum(L.debt_total)}억으로 줄었습니다.`);
    else if (L.debt_ratio !== undefined && L.debt_ratio > 100) v(6, '주의', `부채비율이 ${L.debt_ratio.toFixed(0)}%입니다.`);
    else if (L.debt_total !== undefined && P.debt_total !== undefined && L.debt_total > P.debt_total * 1.2) {
      if (L.cash_total !== undefined && L.cash_total > L.debt_total * 2) v(6, '양호', `이자 붙는 빚이 ${fmtNum(P.debt_total)}억에서 ${fmtNum(L.debt_total)}억으로 늘었지만, 현금성 자산(${fmtNum(L.cash_total)}억)이 빚보다 훨씬 많습니다.`);
      else v(6, '주의', '이자 붙는 빚이 20% 넘게 늘었습니다.');
    }
    else v(6, '양호', '빚의 규모가 크지 않거나 비슷하게 유지됩니다.');
    // 7
    if ((L.op_cum ?? L.op) !== undefined && (L.op_cum ?? L.op) <= 0 && (L.debt_total || 0) > 0) v(7, (L.cash_cover !== undefined && L.cash_cover < 1) ? '위험' : '주의', '영업적자라 이자를 영업이익으로 갚지 못하는 상태입니다.');
    else if (!(L.debt_total > 0)) v(7, '양호', '이자 붙는 빚이 거의 없습니다.');
    else if (L.cash_cover !== undefined && L.cash_cover < 1) v(7, '주의', '1년 내 갚을 빚이 바로 쓸 수 있는 현금보다 많습니다.');
    else if (L.icr !== undefined && L.icr < 3) v(7, '주의', `이자보상배율이 ${L.icr.toFixed(1)}배로 낮습니다.`);
    else v(7, '양호', '이자와 단기 빚을 감당할 여력이 있습니다.');
    // 8 장기 성장성: 수주잔고, 부문(자회사·사업부)별 영업이익
    {
      const ci = compareIndex(cols);
      const n = cols.length;
      const pos = [], neg = [], notes = [];
      if (L.backlog !== undefined && P.backlog !== undefined) {
        const g = pct(P.backlog, L.backlog);
        if (g > 5) pos.push(clause('수주잔고가 늘', '고', '었')); else if (g < -10) neg.push(clause('수주잔고가 줄', '고', '었'));
        const k1 = (cols[n - 1].base.backlog && cols[n - 1].base.backlog.src || '').split(/\s{2,}/)[0];
        const k0 = ci >= 0 && cols[ci].base.backlog ? (cols[ci].base.backlog.src || '').split(/\s{2,}/)[0] : k1;
        if (k1 && k0 && k1.replace(/[\d\s]/g, '') !== k0.replace(/[\d\s]/g, '')) notes.push('수주잔고 공시 기준이 바뀐 점도 감안하세요.');
      }
      if (L.rev_yoy !== undefined) {
        if (L.rev_yoy > 10) pos.push(clause(`매출이 1년 전보다 ${L.rev_yoy.toFixed(0)}% 늘`, '고', '었'));
        else if (L.rev_yoy < 0) neg.push(clause(`매출이 1년 전보다 ${Math.abs(L.rev_yoy).toFixed(0)}% 줄`, '고', '었'));
      }
      if (ci >= 0) {
        const segs = bizRows(cols, 'segments', 'op').filter(r => r.vals[ci] !== undefined && r.vals[n - 1] !== undefined && Math.max(Math.abs(r.vals[ci]), Math.abs(r.vals[n - 1])) >= 1);
        let lead = null;
        for (const r of segs) { const d = r.vals[n - 1] - r.vals[ci]; if (d > 0 && (!lead || d > lead.d)) lead = { name: r.name, d }; }
        if (lead && segs.length > 1) {
          const cur = segs.find(r => r.name === lead.name).vals[n - 1];
          pos.push(cur < 0 ? clause(`${lead.name}${josa(lead.name, '은', '는')} 적자를 크게 줄`, '고', '였') : clause(`${lead.name}${josa(lead.name, '이', '가')} 성장을 이끌`, '고', '었'));
        }
        for (const r of segs) {
          const a = r.vals[ci], b = r.vals[n - 1];
          if (a > 0 && b < 0) neg.push({ c: `${r.name}${josa(r.name, '은', '는')} 적자로 돌아섰고`, f: `${r.name}${josa(r.name, '은', '는')} 적자로 돌아섰습니다` });
          else if (a < 0 && b < a * 1.2 && b < -1) neg.push({ c: `${r.name}${josa(r.name, '은', '는')} 적자가 커졌고`, f: `${r.name}${josa(r.name, '은', '는')} 적자가 커졌습니다` });
        }
      }
      let text = (pos.length || neg.length) ? compose(pos, neg) : (L.rev_yoy !== undefined ? '매출이 1년 전과 비슷합니다.' : '성장성을 판단할 숫자를 찾지 못했습니다.');
      if (notes.length) text += ' ' + notes.join(' ');
      let verdict;
      if (!pos.length && !neg.length) verdict = L.rev_yoy === undefined ? '확인 필요' : '양호';
      else if (!neg.length) verdict = '개선';
      else if (pos.length >= neg.length) verdict = '양호';
      else verdict = '주의';
      v(8, verdict, text);
    }
    // 9
    if (!val9 || !val9.mcap) v(9, '입력 필요', '주가와 발행주식수를 입력하면 계산됩니다.');
    else if (val9.ttm_ni_ctrl === null || val9.ttm_ni_ctrl === undefined || Number.isNaN(val9.ttm_ni_ctrl)) v(9, '확인 필요', '12개월 지배주주 순이익을 찾지 못해 PER·PEG를 계산하지 못했습니다. 9단계의 \'12개월 지배주주 순이익\' 칸에 직접 넣어 주세요.');
    else if (!(val9.ttm_ni_ctrl > 0)) v(9, '부담', '최근 12개월 순이익이 적자라 PER·PEG로 평가할 수 없습니다. PBR, PSR, EV/EBITDA로 흑자 전환 기대가 얼마나 반영돼 있는지 보세요.');
    else {
      const per = val9.per, peg = val9.peg;
      const pegTxt = peg !== undefined ? `, PEG ${peg.toFixed(2)}` : '';
      if (peg !== undefined && peg < 1) v(9, '저평가', `PEG ${peg.toFixed(2)}로 1보다 낮아 성장률(${val9.growth.toFixed(0)}%)에 비해 저평가입니다(PER ${per.toFixed(1)}배). 그 성장률이 앞으로도 이어질지 확인하세요.` + (val9.growth > 100 ? ' 다만 성장률이 100%를 넘는 건 이익이 낮은 바닥에서 회복된 영향이라 PEG가 지나치게 낮게 나옵니다. 앞으로 기대하는 성장률로 바꿔 넣어 보세요.' : ''));
      else if (per > 40 || (peg !== undefined && peg > 2)) v(9, '부담', `PER ${per.toFixed(1)}배${pegTxt}로 높은 성장 기대가 반영돼 있습니다.`);
      else if (per > 20) v(9, '보통', `PER ${per.toFixed(1)}배${pegTxt}입니다. 성장률과 비교해 판단하세요.`);
      else v(9, '낮은 편', `PER ${per.toFixed(1)}배${pegTxt}로 이익에 비해 낮은 편입니다. 이익이 일회성은 아닌지 확인하세요.`);
    }
    return out;
  }

  // ---------- 함께 알아두면 좋은 점 ----------
  function insights(D, cols) {
    const ci = compareIndex(cols);
    const L = D[D.length - 1] || {}, P = ci >= 0 ? D[ci] : {};
    const lc = cols[cols.length - 1];
    const rep = lc.rep;
    const out = [];
    const f = fmtNum;
    // 1) 순이익과 영업이익 차이
    if (L.ni !== undefined && L.op !== undefined) {
      const gap = L.ni - L.op;
      if (Math.abs(gap) > Math.max(10, Math.abs(L.op) * 0.3)) {
        const parts = [];
        if (L.fin_inc !== undefined) parts.push(`금융수익 ${f(L.fin_inc)}억`);
        if (L.fin_cost !== undefined) parts.push(`금융비용 ${f(L.fin_cost)}억`);
        if (L.oth_inc !== undefined) parts.push(`기타수익 ${f(L.oth_inc)}억`);
        if (L.oth_exp !== undefined) parts.push(`기타비용 ${f(L.oth_exp)}억`);
        out.push({ tone: 'warn', title: '순이익과 영업이익이 크게 다릅니다', body: `영업이익 ${f(L.op)}억, 순이익 ${f(L.ni)}억으로 ${f(Math.abs(gap))}억 차이가 납니다. ${parts.join(', ')}. 본업 밖의 손익(자산 처분, 파생상품 평가 등)은 반복되지 않을 수 있으니, 주석의 '금융수익 및 금융비용', '기타수익 및 기타비용'에서 무엇인지 확인하세요.` });
      }
    }
    // 2) 큰 금융손익
    if (L.fin_inc !== undefined && L.fin_cost !== undefined && Math.max(L.fin_inc, L.fin_cost) > Math.max(30, Math.abs(L.op || 0))) {
      out.push({ tone: 'info', title: '금융손익 규모가 본업 이익보다 큽니다', body: `금융수익 ${f(L.fin_inc)}억과 금융비용 ${f(L.fin_cost)}억이 모두 큽니다. 전환사채 관련 파생상품 평가나 투자자산 처분일 가능성이 있으니 순이익보다 영업이익과 현금흐름을 기준으로 보세요.` });
    }
    // 3) 지배주주 몫
    if (L.ni > 0 && L.nci !== undefined && L.nci / L.ni > 0.15) {
      out.push({ tone: 'info', title: '이익 일부는 자회사 소수주주 몫입니다', body: `순이익 ${f(L.ni)}억 중 ${f(L.nci)}억(${(L.nci / L.ni * 100).toFixed(0)}%)이 비지배지분 몫입니다. 주주 입장에서는 지배주주 순이익 ${f(L.ni_ctrl)}억을 기준으로 보세요.` });
    }
    // 4) 이익 대비 현금
    const niC = L.ni_cum ?? L.ni;
    const cumTxt = L.ni_cum !== undefined ? '누적 ' : '';
    if (niC > 0 && L.ocf !== undefined && L.ocf < niC * 0.7) {
      out.push({ tone: 'warn', title: '이익만큼 현금이 들어오지 않았습니다', body: `${cumTxt}순이익 ${f(niC)}억에 비해 ${cumTxt}영업현금흐름은 ${f(L.ocf)}억입니다. 매출채권과 재고가 늘었는지 확인하세요.` });
    }
    if (niC !== undefined && niC <= 0 && L.ocf !== undefined && L.ocf < niC - 20) {
      out.push({ tone: 'warn', title: '손실보다 현금 유출이 더 큽니다', body: `${cumTxt}순손실은 ${f(-niC)}억이지만 영업에서 빠져나간 현금은 ${f(-L.ocf)}억입니다. 외상 매출(매출채권) 증가나 재고 증가가 원인인지 확인하세요.` });
    }
    // 5) 기간 중 매출채권·재고 변화(같은 보고서의 직전 연말 대비)
    const bsPrev = rep && rep.bs && rep.bs.prev;
    if (bsPrev) {
      const chk = (k, name, why) => {
        const a = bsPrev[k] && bsPrev[k].v, b = L[k];
        if (a && b !== undefined && b / a > 1.3 && b - a > 10) out.push({ tone: 'warn', title: `${name} 연초보다 크게 늘었습니다`, body: `직전 연말 ${f(a)}억에서 ${f(b)}억으로 ${((b / a - 1) * 100).toFixed(0)}% 늘었습니다. ${why} 다음 보고서에서 매출과 현금으로 바뀌는지 확인하세요.` });
      };
      chk('receivables', '매출채권이', '아직 받지 못한 외상값이 늘었다는 뜻이라 현금 유입이 늦어집니다.');
      chk('inventory', '재고자산이', '수주에 대비한 생산일 수도 있지만, 팔리지 않은 재고가 쌓였을 수도 있습니다.');
    }
    // 6) 선수금
    if (L.contract_liab !== undefined && P.contract_liab !== undefined && L.contract_liab > P.contract_liab * 1.2 && L.contract_liab > 20) {
      out.push({ tone: 'good', title: '고객 선수금이 늘었습니다', body: `계약부채(선수금)가 ${f(P.contract_liab)}억에서 ${f(L.contract_liab)}억으로 늘었습니다. 물건을 넘기기 전에 돈을 먼저 받는다는 뜻이라 협상력의 신호일 수 있습니다. 부채로 잡히지만 현금으로 갚는 빚은 아닙니다.` });
    }
    // 7) 주식 수 증가
    if (L.shares && P.shares && L.shares > P.shares * 1.02) {
      out.push({ tone: 'warn', title: '주식 수가 늘었습니다(지분 희석)', body: `발행주식수가 ${f(P.shares, '주')}주에서 ${f(L.shares, '주')}주로 ${((L.shares / P.shares - 1) * 100).toFixed(1)}% 늘었습니다. 전환사채 전환이나 유상증자로 기존 주주의 몫이 줄었을 수 있습니다.` });
    }
    // 8) 잠재 주식(전환사채 등)
    if (rep && rep.bs && rep.bs.potential && rep.bs.potential.length) {
      out.push({ tone: 'warn', title: '주식으로 바뀔 수 있는 사채가 남아 있습니다', body: `재무상태표에 ${[...new Set(rep.bs.potential)].join(', ')}이(가) 있습니다. 전환가액과 전환 가능한 주식 수를 주석과 'I. 회사의 개요'에서 확인하세요. 전환되면 빚은 줄지만 주식 수가 늘어납니다.` });
    }
    // 8-2) 전환사채가 사라진 경우
    const prevCol = ci >= 0 ? cols[ci] : null;
    if (prevCol && !prevCol.derived && prevCol.rep.bs && prevCol.rep.bs.potential && prevCol.rep.bs.potential.length && !(rep.bs && rep.bs.potential && rep.bs.potential.length)) {
      out.push({ tone: 'info', title: '전환사채 등이 사라졌습니다', body: '이전 보고서에 있던 전환사채·교환사채가 이번에는 없습니다. 주식으로 전환됐다면 빚은 줄었지만 주식 수가 늘었고, 현금으로 상환했다면 현금이 줄었습니다. 자본변동표와 현금흐름표의 재무활동에서 어느 쪽인지 확인하세요.' });
    }
    // 9) 단기 유동성
    if (L.debt_1y > 0 && L.liquid !== undefined && L.debt_1y > L.liquid) {
      out.push({ tone: 'bad', title: '1년 내 갚을 빚이 바로 쓸 현금보다 많습니다', body: `1년 내 갚을 빚 ${f(L.debt_1y)}억, 현금과 유동 금융자산 ${f(L.liquid)}억입니다. 만기 연장이나 추가 조달 계획을 확인하세요.` });
    } else if (L.debt_total > 0 && L.debt_1y !== undefined && L.debt_1y / L.debt_total > 0.8 && L.debt_total > 30) {
      out.push({ tone: 'info', title: '빚 대부분이 1년 안에 만기입니다', body: `이자 붙는 빚 ${f(L.debt_total)}억 중 ${f(L.debt_1y)}억이 1년 내 만기입니다. 정책금융처럼 매년 연장되는 경우가 많지만, 연장 여부를 주석의 차입금 항목에서 확인하세요.` });
    }
    // 10) 영업 적자를 무엇으로 메웠나
    if (L.ocf !== undefined && L.ocf < 0 && L.icf !== undefined && L.icf > 0) {
      out.push({ tone: 'warn', title: '영업 적자를 보유 자산을 팔아 메웠습니다', body: `영업현금흐름은 ${f(L.ocf)}억인데 투자활동현금흐름이 +${f(L.icf)}억입니다. 금융자산 등을 처분해 현금을 마련했다는 뜻입니다. 이 방식은 보유 자산이 바닥나면 이어갈 수 없습니다.` });
    }
    // 11) 분기 흐름
    if (L.opQ !== undefined && L.op !== undefined && lc.rep && lc.rep.meta.type === '반기보고서') {
      const q1 = L.op - L.opQ;
      const better = L.opQ > q1;
      out.push({ tone: better ? 'good' : 'info', title: '분기별로 나눠 보기', body: `상반기 영업이익 ${f(L.op)}억 = 1분기 약 ${f(q1)}억 + 2분기 ${f(L.opQ)}억입니다. 2분기가 1분기보다 ${better ? '좋아졌습니다' : '나빠졌거나 비슷합니다'}. 누적 숫자만 보면 최근 흐름을 놓칠 수 있습니다.` });
    }
    if (lc.quarter && rep && rep.meta.end && rep.meta.end.m === 9 && L.op_cum !== undefined && L.op !== undefined) {
      out.push({ tone: 'info', title: '누적과 분기를 나눠 보기', body: `1~9월 누적 영업이익 ${f(L.op_cum)}억 중 3분기(7~9월)가 ${f(L.op)}억, 1~2분기가 ${f(L.op_cum - L.op)}억입니다. 이 탭의 손익은 분기 3개월 숫자라 계절 영향을 받을 수 있으니 전년 같은 분기와 비교하세요.` });
    }
    // 12) 배당
    if (L.div_paid > 0 && P.div_paid !== undefined && L.div_paid > P.div_paid * 1.5 && L.div_paid - P.div_paid > 5) {
      out.push({ tone: 'good', title: '배당 지급이 크게 늘었습니다', body: `배당금 지급이 ${f(P.div_paid)}억에서 ${f(L.div_paid)}억으로 늘었습니다. FCF로 감당 가능한 수준인지 함께 보세요.` });
    }
    // 13) 적자
    if ((L.op_cum ?? L.op) !== undefined && (L.op_cum ?? L.op) < 0) {
      out.push({ tone: 'info', title: '적자 기업은 다른 잣대로 봅니다', body: '영업이익이 마이너스라 PER, 이자보상배율 같은 이익 기반 지표는 의미가 없습니다. 흑자 전환 시점, 남은 현금으로 버틸 수 있는 기간, 추가 자금 조달(유상증자·사채) 가능성을 중심으로 보세요.' });
    }
    // 14) 수주
    if (L.backlog !== undefined && (L.rev_cum ?? L.rev)) {
      out.push({ tone: 'info', title: '수주잔고는 기준을 확인하세요', body: `수주잔고 ${f(L.backlog)}억은 누적 매출의 ${(L.backlog / (L.rev_cum ?? L.rev)).toFixed(1)}배입니다. 회사마다 수주잔고를 적는 기준(전체/일부 품목, 제출일/기준일)이 다르고, 같은 회사도 보고서마다 바뀔 수 있습니다.` });
    }
    return out;
  }

  // ---------- 투자 전 확인사항 ----------
  function checklist(D, cols, mode) {
    const L = D[D.length - 1] || {};
    const rep = cols[cols.length - 1].rep;
    const annual = mode === 'annual';
    const items = [
      annual
        ? { id: 'audit', text: '감사의견 확인: \'V. 회계감사인의 감사의견 등\'에서 감사의견이 \'적정\'인지, 핵심감사사항과 계속기업 관련 문구가 있는지 봅니다.' }
        : { id: 'audit', text: '감사인 검토의견 확인: \'V. 회계감사인의 감사의견 등\'에서 검토의견이 \'적정\'(또는 특이사항 없음)인지 봅니다.' },
      { id: 'filings', text: '보고서 이후 공시 확인: DART에서 유상증자, 전환사채 발행, 최대주주 변경, 소송 같은 주요사항보고서를 검색합니다.' },
      { id: 'owner', text: '최대주주와 특수관계인 지분 변화: \'VII. 주주에 관한 사항\'에서 지분이 줄고 있지 않은지 봅니다.' },
      { id: 'contingent', text: '우발부채·소송·담보: \'XI. 그 밖에 투자자 보호를 위하여 필요한 사항\'과 주석을 읽습니다.' },
      { id: 'next', text: '다음 실적 일정 확인: 분기 종료 후 45일 안에 정기보고서가, 그 전에 잠정실적 공시가 나올 수 있습니다.' },
      { id: 'peers', text: '같은 업종 회사 2~3곳과 이익률, 성장률, 밸류에이션을 나란히 비교합니다.' },
      { id: 'thesis', text: '투자 이유를 한두 문장으로 적고, 어떤 일이 생기면 다시 판단할지(재검토 조건)를 정합니다.' },
      { id: 'size', text: '투자 비중을 정합니다. 한 종목이 틀려도 전체 자산에 큰 타격이 없도록 나눕니다.' },
      annual
        ? { id: 'annual', text: '이 사업보고서의 \'II-5. 위험관리 및 파생거래\'(금리·환율·유동성 위험)와 \'IV. 이사의 경영진단 및 분석의견\'을 읽습니다.' }
        : { id: 'annual', text: '최근 사업보고서의 \'위험관리\'와 \'이사의 경영진단 및 분석의견\'을 읽습니다(반기보고서보다 자세합니다).' }
    ];
    if (annual) {
      items.push({ id: 'debtnote', text: '주석의 차입금·사채: 차입처별 금리, 만기, 담보와 유동성위험 만기표로 언제 얼마를 갚는지 확인합니다.' });
      items.push({ id: 'dividend', text: '\'III-6. 배당에 관한 사항\'에서 배당 정책과 최근 몇 년의 배당 추이를 확인합니다.' });
    }
    if ((L.op_cum ?? L.op) !== undefined && (L.op_cum ?? L.op) < 0) items.push({ id: 'turn', text: '흑자 전환 근거 확인: 회사가 밝힌 수주, 신제품 승인, 원가 절감 계획이 숫자로 이어지는지 다음 분기에 확인합니다.', dyn: true });
    if (rep && rep.bs && rep.bs.potential && rep.bs.potential.length) items.push({ id: 'cb', text: '전환사채·신주인수권 조건 확인: 전환가액, 전환 가능 주식 수, 조기상환(풋) 시점을 봅니다.', dyn: true });
    if (L.debt_1y > 0 && L.liquid !== undefined && L.debt_1y > L.liquid * 0.7) items.push({ id: 'refi', text: '차입금 만기 연장·차환 계획 확인: 주석의 차입금 항목에서 만기와 금리, 담보를 봅니다.', dyn: true });
    if (L.backlog !== undefined) items.push({ id: 'backlog', text: '수주잔고의 납기와 고객 집중도 확인: 특정 고객 한두 곳에 쏠려 있지 않은지 봅니다.', dyn: true });
    const invUp = rep && rep.bs && rep.bs.prev && rep.bs.prev.inventory && L.inventory > rep.bs.prev.inventory.v * 1.3;
    if (invUp) items.push({ id: 'inv', text: '재고 내용 확인: 주석의 재고자산에서 원재료·제품 구성과 평가손실(충당금)을 봅니다.', dyn: true });
    if (L.ni > 0 && L.nci !== undefined && L.nci / L.ni > 0.15) items.push({ id: 'subs', text: '자회사 지분율 확인: 이익을 내는 자회사의 지분을 얼마나 가졌는지 \'연결대상 종속회사 현황\'에서 봅니다.', dyn: true });
    return items;
  }

  // ---------- 주가 ----------
  // PEG용 이익 성장률: 지배주주 순이익의 전년 대비 증가율
  function setGrowth(out, prev, cur, label) {
    if (!(prev > 0) || cur === undefined || cur === null) {
      out.growth = null;
      out.notes.growth = prev !== undefined && !(prev > 0) ? '전년 지배주주 순이익이 0 이하라 증가율을 계산할 수 없습니다. 기대 성장률을 직접 넣으세요.' : '전년 숫자를 찾지 못해 계산하지 못했습니다. 기대 성장률을 직접 넣으세요.';
      return;
    }
    const g = (cur / prev - 1) * 100;
    out.growth = g;
    out.notes.growth = `${label} ${g >= 0 ? '+' : ''}${g.toFixed(1)}%.` + (g <= 0 ? ' 0 이하라 PEG는 계산되지 않습니다.' : '') + ' 한 해 숫자는 출렁일 수 있으니 기대 성장률로 바꿔 넣어도 됩니다.';
  }

  function valuationDefaults(cols, D, mode) {
    const lc = cols[cols.length - 1];
    const rep = lc.rep;
    const L = D[D.length - 1] || {};
    const out = { notes: {} };
    out.shares = L.shares || (L.capital ? Math.round(L.capital * 1e8 / 500) : null);
    const pref = rep.shares && rep.shares.pref;
    out.notes.shares = L.shares ? (pref ? '보고서의 발행주식 중 보통주. 우선주는 아래 칸에 따로 넣습니다' : '보고서의 발행주식의 총수') : '자본금 ÷ 액면가 500원으로 추정. 실제 액면가를 확인하세요.';
    out.pref_shares = pref || 0;
    out.notes.pref_shares = '보고서의 발행주식 중 우선주. 시가총액에 우선주 몫도 더해야 PER·PBR이 주당순이익(EPS) 기준과 맞습니다';
    out.pref_price = null;
    out.notes.pref_price = '비워두면 보통주 주가로 계산합니다(우선주는 보통 더 싸므로 실제 우선주 주가를 넣으면 정확해집니다)';
    out.equity_ctrl = L.equity_ctrl !== undefined ? L.equity_ctrl : L.equity;
    out.notes.equity_ctrl = '최근 보고서의 지배주주 자본';
    out.nci = (L.equity !== undefined && L.equity_ctrl !== undefined) ? Math.max(0, L.equity - L.equity_ctrl) : 0;
    out.notes.nci = '자본총계 − 지배주주 자본. 자회사 소수주주 몫으로, EV에 더합니다.';
    out.net_cash = (L.cash_total !== undefined) ? L.cash_total - (L.debt_total || 0) : null;
    out.notes.net_cash = '현금성 자산 합계 − 이자 붙는 빚 (담보로 잡힌 자산은 빼지 않음)';
    if (mode === 'annual' || rep.meta.type === '사업보고서') {
      out.ttm_rev = L.rev ?? null; out.ttm_op = L.op ?? null; out.ttm_ni_ctrl = L.ni_ctrl ?? null;
      out.ttm_ebitda = L.ebitda ?? null; out.ttm_fcf = L.fcf ?? null;
      out.notes.ttm = `${lc.label} 연간 숫자`;
      out.notes.ttm_ebitda = '영업이익 + 감가상각비·무형자산상각비 (주석의 비용의 성격별 분류 등)';
      out.notes.ttm_fcf = '연간 FCF';
      // PEG용 성장률 = 지배주주 순이익의 전년 대비 증가율
      const pv = D.length > 1 && cols[cols.length - 2].end && lc.end && lc.end.y - cols[cols.length - 2].end.y === 1 ? D[D.length - 2].ni_ctrl : undefined;
      setGrowth(out, pv, L.ni_ctrl, `지배주주 순이익 전년 대비 증가율(${cols[cols.length - 2] ? cols[cols.length - 2].label : '전년'} → ${lc.label})`);
      return out;
    }
    const sum = rep.summary;
    const curIS = rep.is ? rep.is.cur : {}, prevIS = rep.is ? rep.is.prev : {};
    const ttm = (k) => {
      if (!sum || !sum[k] || !curIS[k] || !prevIS[k]) return null;
      return sum[k].v - prevIS[k].v + curIS[k].v;
    };
    out.ttm_rev = ttm('rev'); out.ttm_op = ttm('op'); out.ttm_ni_ctrl = ttm('ni_ctrl');
    out.notes.ttm = '직전 사업연도 − 전년 같은 기간 누적 + 올해 누적 (요약재무정보 사용)';
    const m = rep.meta.end ? rep.meta.end.m : 6;
    const factor = 12 / m;
    const daCur = rep.da && rep.da.cur ? rep.da.cur.v : null;
    out.ttm_ebitda = (out.ttm_op !== null && daCur !== null) ? out.ttm_op + daCur * factor : null;
    out.notes.ttm_ebitda = `최근 12개월 영업이익 + 올해 누적 상각비 × ${factor} (상각비는 단순 연환산 추정)`;
    out.ttm_fcf = L.fcf !== undefined ? L.fcf * factor : null;
    out.notes.ttm_fcf = `누적 FCF × ${+factor.toFixed(2)} (단순 연환산 추정${m <= 3 ? '. 1분기 숫자를 4배 한 값이라 출렁임이 매우 큽니다' : ''}. 사업보고서의 연간 FCF로 바꿔 넣으면 정확해집니다)`;
    out.notes.ttm_ebitda = `12개월 영업이익 + 누적 상각비 × ${+factor.toFixed(2)} (상각비는 단순 연환산 추정)`;
    // PEG용 성장률 = 지배주주 순이익의 전년 대비(같은 기간) 증가율
    setGrowth(out, prevIS.ni_ctrl ? prevIS.ni_ctrl.v : undefined, curIS.ni_ctrl ? curIS.ni_ctrl.v : undefined,
      `${rep.meta.type === '반기보고서' ? '상반기' : '연초 이후 누적'} 지배주주 순이익 전년 대비 증가율(${rep.meta.end ? rep.meta.end.y - 1 : '전년'} → ${rep.meta.end ? rep.meta.end.y : '올해'}, 같은 기간끼리)`);
    return out;
  }
  function valuationCalc(inp) {
    const r = {};
    if (inp.price > 0 && inp.shares > 0) {
      const prefPrice = inp.pref_price > 0 ? inp.pref_price : inp.price;
      r.mcap = (inp.price * inp.shares + (inp.pref_shares > 0 ? inp.pref_shares * prefPrice : 0)) / 1e8;
    }
    if (r.mcap) {
      const ev = r.mcap - (inp.net_cash || 0) + (inp.nci || 0);
      r.ev = ev;
      if (inp.ttm_ni_ctrl > 0) r.per = r.mcap / inp.ttm_ni_ctrl;
      if (r.per && inp.growth > 0) r.peg = r.per / inp.growth;
      if (inp.equity_ctrl > 0) r.pbr = r.mcap / inp.equity_ctrl;
      if (inp.ttm_rev > 0) r.psr = r.mcap / inp.ttm_rev;
      if (inp.ttm_ebitda > 0) r.ev_ebitda = ev / inp.ttm_ebitda;
      if (inp.ttm_fcf !== null && inp.ttm_fcf !== undefined && inp.ttm_fcf !== '') r.fcf_yield = inp.ttm_fcf / r.mcap * 100;
      if (inp.ttm_op > 0) r.ev_op = ev / inp.ttm_op;
      r.ttm_ni_ctrl = inp.ttm_ni_ctrl; r.growth = inp.growth;
    }
    if (inp.ttm_ni_ctrl !== null && inp.ttm_ni_ctrl !== undefined && inp.equity_ctrl > 0) r.roe = inp.ttm_ni_ctrl / inp.equity_ctrl * 100;
    return r;
  }

  function analyze(reports, overrides, mode) {
    const cols = buildColumns(reports, mode);
    for (const c of cols) {
      c.biz = bizOf(c.rep, c.which || (c.derived ? 'prev' : 'cur'));
      if (c.fallback) {
        const fb = bizOf(c.fallback.rep, c.fallback.which);
        if (!c.biz.products.length) c.biz.products = fb.products;
        if (!c.biz.segments.length) c.biz.segments = fb.segments;
      }
    }
    const resolved = cols.map(c => resolve(c, overrides));
    const D = cols.map((c, i) => derive(resolved[i], c, reports));
    // 사업보고서: 전년 대비 성장률은 바로 앞 연도 열로 계산
    if (mode === 'annual') {
      for (let i = 1; i < D.length; i++) {
        if (cols[i].end.y - cols[i - 1].end.y === 1 && D[i - 1].rev && D[i].rev !== undefined) D[i].rev_yoy = (D[i].rev / D[i - 1].rev - 1) * 100;
      }
    }
    // 같은 기간끼리 3개 이상이면 첫 열 대비 연평균 성장률
    const n = cols.length;
    if (n >= 3) {
      const a = cols[0], b = cols[n - 1];
      const same = cols.every(c => c.type === b.type && c.end && b.end && c.end.m === b.end.m);
      const yrs = a.end && b.end ? b.end.y - a.end.y : 0;
      if (same && yrs > 0) {
        const cagr = (x, y) => (x > 0 && y > 0) ? (Math.pow(y / x, 1 / yrs) - 1) * 100 : undefined;
        const rc = cagr(D[0].rev, D[n - 1].rev), nc = cagr(D[0].ni_ctrl, D[n - 1].ni_ctrl);
        if (rc !== undefined) D[n - 1].rev_cagr = rc;
        if (nc !== undefined) D[n - 1].ni_cagr = nc;
      }
    }
    return { cols, resolved, D };
  }

  // 이름이 한 글자 다른 경우(보고서 오타 등)도 같은 항목으로 봅니다.
  function sameName(a, b) {
    const x = a.replace(/\s/g, '').toLowerCase(), y = b.replace(/\s/g, '').toLowerCase();
    if (x === y) return true;
    // 오타 한 글자만 허용. 앞 두 글자가 다르면(무선/유선, DX/DS) 다른 항목으로 봅니다.
    if (x.length !== y.length || x.length < 6) return false;
    let diff = 0, at = -1; for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) { diff++; at = i; }
    return diff === 1 && at >= 2;
  }
  // 열별 제품·부문 숫자를 같은 이름끼리 모은 행
  function bizRows(cols, kind, field) {
    const rows = [];
    cols.forEach((c, ci) => {
      for (const it of (c.biz ? c.biz[kind] : [])) {
        let r = rows.find(x => sameName(x.name, it.name));
        if (!r) { r = { name: it.name, vals: cols.map(() => undefined) }; rows.push(r); }
        else r.name = it.name; // 최신 보고서의 이름을 씁니다(보고서 오타 대비)
        r.vals[ci] = field ? it[field] : it.v;
      }
    });
    return rows;
  }

  return { BASE, METRICS, STEPS, analyze, compareIndex, bizRows, sameName, verdicts, insights, checklist, valuationDefaults, valuationCalc, changeText, tone, fmtNum };
});
