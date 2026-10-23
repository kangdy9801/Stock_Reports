/* 공시 읽기 노트 — 화면 로직 */
(function () {
  'use strict';
  const A = window.DartAnalysis, P = window.DartParser, X = window.DartExtract, S = window.GongsiStore;
  const MAX_FILES = 3;
  const APP_ID = 'gongsi-note';
  if (window.pdfjsLib) window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdfjs/pdf.worker.min.js';

  const $ = (s, r = document) => r.querySelector(s);
  function h(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else if (k === 'dataset') Object.assign(n.dataset, v);
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat()) {
      if (k === null || k === undefined || k === false) continue;
      n.append(k.nodeType ? k : document.createTextNode(String(k)));
    }
    return n;
  }
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const fmt = A.fmtNum;
  const nowIso = () => new Date().toISOString();
  const fmtDate = (iso) => { const d = new Date(iso); return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  function parseNum(s) {
    if (s === null || s === undefined) return null;
    let t = String(s).trim().replace(/[,\s원억주배%]/g, '').replace(/[−–]/g, '-');
    if (!t) return null;
    if (/^\(.*\)$/.test(t)) t = '-' + t.slice(1, -1);
    const v = Number(t);
    return Number.isFinite(v) ? v : null;
  }

  // ---------- 탭(모드) ----------
  const MODES = {
    half: {
      name: '반기보고서 비교', accept: '반기보고서', short: '반기',
      dropMain: '반기보고서 PDF를 끌어다 놓거나 눌러서 고르세요',
      help: '같은 회사의 반기보고서를 최대 3개까지 넣습니다. 예: 2024·2025·2026년 반기보고서. 같은 상반기끼리 비교하므로 계절 영향 없이 비교할 수 있습니다.',
      wrong: '반기보고서만 넣을 수 있습니다. 사업보고서는 \'사업보고서 분석\' 탭에서 넣어 주세요.',
      howto: [
        ['DART에서 반기보고서 내려받기.', '회사 이름으로 검색해 반기보고서를 열고, 오른쪽 위 \'다운로드\'에서 PDF로 받습니다.'],
        ['최대 3개까지 올리기.', '2024·2025·2026년 반기보고서처럼 같은 상반기끼리 비교합니다. 하나만 올려도 보고서 안의 전년 동기 숫자로 비교합니다.'],
        ['숫자 확인하기.', '자동으로 찾은 숫자는 맨 아래 \'추출값 확인·수정\'에서 원문 줄과 함께 확인하고 고칠 수 있습니다.'],
        ['주가 입력하고 저장·인쇄하기.', '9단계에 오늘 주가를 넣으면 PER, PEG, PBR, PSR, EV/EBITDA가 계산됩니다. 결과는 기록으로 저장하거나 인쇄할 수 있습니다.']
      ]
    },
    quarter: {
      name: '분기보고서 분석', accept: '분기보고서', short: '분기',
      dropMain: '분기보고서 PDF를 끌어다 놓거나 눌러서 고르세요',
      help: '같은 회사의 분기보고서(1분기·3분기)를 최대 3개까지 넣습니다. 손익은 각 분기 3개월 숫자로, 현금흐름은 연초부터 누적 숫자로 보여 줍니다.',
      wrong: '분기보고서만 넣을 수 있습니다. 반기보고서·사업보고서는 해당 탭에서 넣어 주세요.',
      howto: [
        ['DART에서 분기보고서 내려받기.', '1분기(5월 중순 공시)와 3분기(11월 중순 공시) 보고서입니다. 2분기는 반기보고서, 4분기는 사업보고서에 들어 있습니다.'],
        ['최대 3개까지 올리기.', '같은 분기끼리(예: 2025·2026년 1분기) 비교하면 가장 정확합니다. 1년 전 같은 분기 보고서가 없으면 보고서 안의 전년 같은 분기 숫자로 비교 열을 만듭니다.'],
        ['분기 3개월과 누적 구분하기.', '손익은 해당 분기 3개월 숫자, 현금흐름·EBITDA는 연초부터 누적 숫자입니다. 서로 다른 분기의 누적 숫자는 나란히 비교하지 마세요.'],
        ['주가 입력하고 저장·인쇄하기.', '9단계에 주가와 기준일을 넣으면 PER, PEG, PBR, PSR, EV/EBITDA가 계산됩니다. 12개월 실적은 직전 사업연도와 누적 숫자로 계산합니다.']
      ]
    },
    annual: {
      name: '사업보고서 분석', accept: '사업보고서', short: '사업',
      dropMain: '사업보고서 PDF를 끌어다 놓거나 눌러서 고르세요',
      help: '사업보고서 1개에 3년치 재무제표가 들어 있습니다. 최대 3개를 넣으면 최대 5년의 흐름을 봅니다(정정사업보고서도 됩니다).',
      wrong: '사업보고서만 넣을 수 있습니다. 반기보고서는 \'반기보고서 비교\' 탭에서 넣어 주세요.',
      howto: [
        ['DART에서 사업보고서 내려받기.', '정정사업보고서가 있으면 최신 정정본을 받으세요.'],
        ['1~3개 올리기.', '보고서 1개로 3년, 2~3년 간격으로 3개를 넣으면 최대 5년 흐름을 연도별로 봅니다. 연도가 겹치면 최신 보고서 숫자를 씁니다.'],
        ['숫자 확인하기.', '맨 아래 \'추출값 확인·수정\'에서 원문 줄과 대조하고 고칠 수 있습니다.'],
        ['주가 입력하고 저장·인쇄하기.', '9단계에서 연간 실적 기준 PER, PEG, PBR, PSR, EV/EBITDA를 계산합니다.']
      ]
    }
  };
  const modeFromHash = (h) => h === '#annual' ? 'annual' : h === '#quarter' ? 'quarter' : h === '#half' ? 'half' : null;
  let mode = modeFromHash(location.hash) || 'half';

  // ---------- 상태 ----------
  const states = { half: fresh(), quarter: fresh(), annual: fresh() };
  const pendings = { half: [], quarter: [], annual: [] };
  const dirtyMap = { half: false, quarter: false, annual: false };
  let state = states[mode];
  let pending = pendings[mode];
  let dirty = false;
  function fresh() {
    return { recordId: null, createdAt: nowIso(), reports: [], overrides: {}, valuation: {}, checks: {}, notes: '', memo1: '', log: [] };
  }
  function markDirty(v = true) {
    dirty = v; dirtyMap[mode] = v;
    const b = $('#btn-save');
    b.textContent = dirty ? '기록 저장(변경 있음)' : '기록 저장';
  }
  function notice(msg, kind = 'info') {
    const n = $('#notice');
    if (!msg) { n.hidden = true; return; }
    n.hidden = false; n.className = 'notice ' + kind; n.textContent = msg;
  }

  // ---------- 파일 받기 ----------
  const drop = $('#drop'), input = $('#file-input');
  drop.addEventListener('click', () => input.click());
  drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  input.addEventListener('change', () => { handleFiles([...input.files]); input.value = ''; });
  ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (e) => handleFiles([...(e.dataTransfer.files || [])]));

  async function handleFiles(files) {
    notice('');
    const pdfs = files.filter(f => /\.pdf$/i.test(f.name) || f.type === 'application/pdf');
    if (pdfs.length < files.length) notice('PDF가 아닌 파일은 건너뛰었습니다.', 'warn');
    const md = mode, st = state, pend = pendings[md], cfg = MODES[md];
    const room = MAX_FILES - st.reports.length - pend.length;
    if (room <= 0) { notice(`보고서는 최대 ${MAX_FILES}개까지 넣을 수 있습니다. 하나를 빼고 다시 넣어 주세요.`, 'warn'); return; }
    if (pdfs.length > room) notice(`최대 ${MAX_FILES}개까지라 앞의 ${room}개만 읽습니다.`, 'warn');
    const take = pdfs.slice(0, room);
    const jobs = take.map(f => ({ id: uid(), fileName: f.name, file: f, progress: 0, error: null }));
    pend.push(...jobs);
    renderSlots();
    for (const job of jobs) {
      try {
        const buf = new Uint8Array(await job.file.arrayBuffer());
        const lines = await X.pdfToLines(window.pdfjsLib, buf, (p, n) => { job.progress = p / n; if (mode === md) renderSlots(); });
        const rep = P.parseReport(lines);
        if (!rep.is && !rep.bs) throw new Error('재무제표를 찾지 못했습니다. DART에서 내려받은 정기보고서 PDF인지 확인하세요.');
        if (rep.meta.type && rep.meta.type !== cfg.accept) throw new Error(`${rep.meta.type}입니다. ${cfg.wrong}`);
        if (!rep.meta.type) throw new Error(`보고서 종류를 알 수 없습니다. ${cfg.wrong}`);
        const cname = (x) => (x || '').replace(/\s|\(주\)|㈜|주식회사/g, '');
        const other = st.reports.find(r => r.meta.company && rep.meta.company && cname(r.meta.company) !== cname(rep.meta.company));
        if (other) throw new Error(`${rep.meta.company} 보고서입니다. 이 탭에는 ${other.meta.company} 보고서가 들어 있어요. 같은 회사끼리만 비교할 수 있으니, 다른 회사를 보려면 들어 있는 보고서를 빼고 넣어 주세요.`);
        if (!rep.meta.end || !rep.meta.label) throw new Error('보고서 기간(몇 년 몇 분기인지)을 읽지 못했습니다. 표지에 \'○○년 ○월 ○일 까지\' 같은 기간 표시가 있는 DART 원본 PDF인지 확인하세요.');
        if (st.reports.some(r => r.meta.label && r.meta.label === rep.meta.label && (r.meta.company || '') === (rep.meta.company || ''))) throw new Error(`${rep.meta.label} 보고서가 이미 들어 있습니다.`);
        rep.id = job.id; rep.fileName = job.fileName;
        st.reports.push(rep);
        st.log.push({ at: nowIso(), action: `파일 추가: ${job.fileName}` });
        if (mode === md) markDirty(); else dirtyMap[md] = true;
      } catch (err) {
        job.error = err && err.message ? err.message : String(err);
        if (mode === md) notice(`${job.fileName}: ${job.error}`, 'bad');
      }
      const i = pend.indexOf(job); if (i >= 0) pend.splice(i, 1);
      if (mode === md) renderSlots();
    }
    if (mode === md) { if (!jobs.some(j => j.error)) checkMix(); render(); }
  }

  function checkMix() {
    if (mode === 'annual' || mode === 'quarter') {
      const names = [...new Set(state.reports.map(r => (r.meta.company || '').replace(/\s|\(주\)|주식회사/g, '')).filter(Boolean))];
      if (names.length > 1) notice('서로 다른 회사의 보고서가 섞여 있습니다. 비교는 같은 회사끼리 해야 의미가 있습니다.', 'warn');
      else if (mode === 'quarter' && new Set(state.reports.map(r => r.meta.end && r.meta.end.m)).size > 1) notice('1분기와 3분기가 섞여 있습니다. 손익(분기 3개월)은 나란히 봐도 되지만, 현금흐름은 누적 기간이 달라 변화 열(전년 같은 분기 대비)로만 비교하세요.', 'info');
      return;
    }
    const names = [...new Set(state.reports.map(r => (r.meta.company || '').replace(/\s|\(주\)|주식회사/g, '')).filter(Boolean))];
    const labels = state.reports.map(r => r.meta.label);
    if (names.length > 1) notice('서로 다른 회사의 보고서가 섞여 있습니다. 비교는 같은 회사끼리 해야 의미가 있습니다.', 'warn');
    else if (new Set(labels).size < labels.length) notice('같은 기간의 보고서가 두 번 들어갔습니다. 하나를 빼 주세요.', 'warn');
    else {
      const types = new Set(state.reports.map(r => r.meta.type));
      const months = new Set(state.reports.map(r => r.meta.end && r.meta.end.m));
      if (types.size > 1 || months.size > 1) notice('보고서 기간이 서로 다릅니다(예: 반기와 1분기). 누적 기간이 달라 손익·현금흐름 비교는 참고만 하세요.', 'warn');
    }
  }

  function removeReport(id) {
    const r = state.reports.find(x => x.id === id);
    state.reports = state.reports.filter(x => x.id !== id);
    delete state.overrides[id]; delete state.overrides[id + ':prev'];
    if (r) state.log.push({ at: nowIso(), action: `파일 뺌: ${r.fileName}` });
    markDirty();
    notice('');
    checkMix();
    renderSlots(); render();
  }

  function renderSlots() {
    const ol = $('#slots');
    ol.replaceChildren();
    for (const r of [...state.reports].sort((a, b) => a.meta.sortKey - b.meta.sortKey)) {
      ol.append(h('li', { class: 'slot' },
        h('div', { class: 'slot-main' },
          h('span', { class: 'slot-period', text: mode === 'annual' && r.meta.end ? `${r.meta.end.y} 사업보고서 (${r.meta.end.y - 2}~${r.meta.end.y}년)` : (r.meta.label || '기간 확인 필요') }),
          h('span', { class: 'slot-company', text: r.meta.company || '회사명 확인 필요' }),
          h('span', { class: 'slot-file', text: `${r.fileName}${r.consolidated === false ? ' (별도재무제표 사용)' : ''}` })
        ),
        h('button', { type: 'button', class: 'btn ghost small', onclick: () => removeReport(r.id), 'aria-label': `${r.fileName} 빼기`, text: '빼기' })
      ));
    }
    for (const j of pending) {
      ol.append(h('li', { class: 'slot pending' },
        h('div', { class: 'slot-main' },
          h('span', { class: 'slot-period', text: '읽는 중' }),
          h('span', { class: 'slot-file', text: j.fileName })
        ),
        h('progress', { max: '1', value: String(j.progress || 0), 'aria-label': '읽기 진행률' })
      ));
    }
    const left = MAX_FILES - state.reports.length - pending.length;
    $('#drop').classList.toggle('full', left <= 0);
    $('.drop-main').textContent = left <= 0 ? `보고서 ${MAX_FILES}개가 모두 찼습니다` : state.reports.length ? `${MODES[mode].accept}를 ${left}개 더 넣을 수 있습니다` : MODES[mode].dropMain;
    $('#drop-help').textContent = MODES[mode].help;
  }

  // ---------- 분석 화면 ----------
  let last = null;
  function compute() {
    const { cols, resolved, D } = A.analyze(state.reports, state.overrides, mode);
    // 반기·분기 탭: 사업보고서 탭에 같은 회사의 직전 사업연도 보고서가 있으면 12개월 숫자 계산에 씁니다.
    let fy = null;
    if (mode !== 'annual') {
      const latest = cols[cols.length - 1].rep;
      const cname = (x) => (x || '').replace(/\s|\(주\)|㈜|주식회사/g, '');
      fy = states.annual.reports.find(r => latest.meta.end && r.meta.end && r.meta.end.y === latest.meta.end.y - 1 && cname(r.meta.company) === cname(latest.meta.company)) || null;
    }
    const vDef = A.valuationDefaults(cols, D, mode, fy);
    vDef.ticker = currentTicker(cols);
    vDef.price = null;
    const vIn = valuationInputs(vDef);
    const vOut = A.valuationCalc(vIn);
    const verdicts = A.verdicts(D, cols, vOut);
    return { cols, resolved, D, vDef, vIn, vOut, verdicts, insights: A.insights(D, cols), checks: A.checklist(D, cols, mode) };
  }
  // ---------- 주가(직접 입력) ----------
  function prevBusinessDay() {
    const d = new Date(); d.setDate(d.getDate() - 1);
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function currentTicker(cols) {
    const t = state.valuation.ticker;
    if (t && /^\d{6}$/.test(t)) return t;
    const reps = [...state.reports].sort((a, b) => b.meta.sortKey - a.meta.sortKey);
    const f = reps.find(r => r.meta.ticker);
    return f ? f.meta.ticker : null;
  }

  const VAL_FIELDS = [
    { key: 'price', label: '주가', unit: '원' },
    { key: 'shares', label: '발행주식수(보통주)', unit: '주' },
    { key: 'pref_shares', label: '우선주 수', unit: '주', onlyIf: 'pref' },
    { key: 'pref_price', label: '우선주 주가', unit: '원', onlyIf: 'pref' },
    { key: 'equity_ctrl', label: '지배주주 자본', unit: '억원' },
    { key: 'ttm_rev', label: '12개월 매출', unit: '억원' },
    { key: 'ttm_op', label: '12개월 영업이익', unit: '억원' },
    { key: 'ttm_ebitda', label: '12개월 EBITDA', unit: '억원' },
    { key: 'ttm_ni_ctrl', label: '12개월 지배주주 순이익', unit: '억원' },
    { key: 'growth', label: '이익 성장률(PEG용, 연)', unit: '%' },
    { key: 'ttm_fcf', label: '12개월 FCF', unit: '억원' },
    { key: 'net_cash', label: '순현금(현금성 자산 − 빚)', unit: '억원' },
    { key: 'nci', label: '비지배지분(EV에 더함)', unit: '억원' }
  ];
  function valuationInputs(def) {
    const out = {};
    for (const f of VAL_FIELDS) {
      const u = state.valuation[f.key];
      out[f.key] = (u !== undefined && u !== null && u !== '') ? +u : (def[f.key] !== undefined ? def[f.key] : null);
    }
    return out;
  }

  function renderEmpty() {
    const ol = $('#howto');
    ol.replaceChildren(...MODES[mode].howto.map(([b, t]) => h('li', null, h('b', { text: b }), ' ' + t)));
  }
  function render() {
    renderEmpty();
    const has = state.reports.length > 0;
    $('#empty').hidden = has;
    $('#results').hidden = !has;
    ['#btn-save', '#btn-print', '#btn-export'].forEach(s => { $(s).disabled = !has; });
    if (!has) { $('#results').replaceChildren(); last = null; return; }
    const R = last = compute();
    const root = $('#results');
    root.replaceChildren(
      summaryBlock(R),
      scorecard(R),
      flowChartBlock(R),
      ...A.STEPS.map(s => stepBlock(s, R)),
      insightBlock(R),
      memoBlock(),
      dataEditor(R),
      logBlock()
    );
    drawFlow();
  }

  const VERDICT_CLASS = { '저평가': 'good', '개선': 'good', '양호': 'ok', '낮은 편': 'ok', '보통': 'flat', '유지': 'flat', '주의': 'warn', '부담': 'warn', '위험': 'bad', '직접 확인': 'manual', '확인 필요': 'manual', '입력 필요': 'manual' };
  const chip = (v) => h('span', { class: 'chip ' + (VERDICT_CLASS[v] || 'flat'), text: v });

  function summaryText(R) {
    const counts = {};
    for (const s of A.STEPS) { const v = R.verdicts[s.step].verdict; counts[v] = (counts[v] || 0) + 1; }
    const order = ['개선', '저평가', '양호', '낮은 편', '보통', '주의', '부담', '위험', '확인 필요', '입력 필요'];
    const parts = order.filter(k => counts[k]).map(k => `${k} ${counts[k]}개`);
    return `9단계 판정: ${parts.join(', ')}. 아래 판정표의 이유를 먼저 읽고, 단계별 숫자로 확인하세요.`;
  }
  function summaryBlock(R) {
    const latest = R.cols[R.cols.length - 1];
    const company = latest.rep.meta.company || '회사명 확인 필요';
    return h('section', { class: 'summary', id: 'summary' },
      h('p', { class: 'summary-kicker', text: `${MODES[mode].name}  |  ` + R.cols.map(c => c.label).join('  vs  ') }),
      h('h2', { class: 'summary-title', text: company }),
      h('p', { class: 'summary-line', id: 'summary-line', text: summaryText(R) }),
      h('p', { class: 'summary-meta', text: `작성 ${fmtDate(nowIso())}  |  연결 기준${latest.rep.consolidated === false ? ' 아님(별도재무제표)' : ''}  |  금액 단위 억원` })
    );
  }

  // 비고: 단계별로 꼭 알아야 할 점(일회성 이익 등). 핵심 문장은 굵게, 나머지는 제목만.
  function remarkNodes(R, step) {
    const its = (R.insights || []).filter(i => i.step === step);
    if (!its.length) return [];
    const keys = its.filter(i => i.key && i.short).sort((a, b) => (/^비교 기준/.test(a.title) ? 1 : 0) - (/^비교 기준/.test(b.title) ? 1 : 0));
    const others = its.filter(i => !(i.key && i.short));
    return [
      ...keys.map(i => h('p', { class: 'remark key', text: i.short })),
      others.length ? h('p', { class: 'remark', text: others.map(i => i.title).join(' · ') }) : null
    ];
  }
  function scorecard(R) {
    const rows = A.STEPS.map(s => {
      const v = R.verdicts[s.step];
      return h('tr', { id: 'score-' + s.step },
        h('td', { class: 'sc-num', text: String(s.step) }),
        h('th', { scope: 'row' }, h('a', { href: '#step-' + s.step, text: s.name, onclick: (e) => { e.preventDefault(); const t = $('#step-' + s.step); if (t) t.scrollIntoView({ behavior: 'smooth' }); } }), h('span', { class: 'sc-q', text: s.question })),
        h('td', { class: 'sc-verdict' }, chip(v.verdict)),
        h('td', { class: 'sc-why', text: v.why }),
        h('td', { class: 'sc-note' }, remarkNodes(R, s.step))
      );
    });
    return h('section', { class: 'block', id: 'scorecard' },
      h('h2', { text: '9단계 판정표' }),
      h('div', { class: 'table-scroll' },
        h('table', { class: 'scoretable' },
          h('thead', null, h('tr', null, h('th', { scope: 'col', text: '단계' }), h('th', { scope: 'col', text: '항목과 핵심 질문' }), h('th', { scope: 'col', text: '판정' }), h('th', { scope: 'col', text: '이유' }), h('th', { scope: 'col', text: '비고' }))),
          h('tbody', null, rows)
        )
      )
    );
  }

  function flowChartBlock(R) {
    const legend = h('div', { class: 'legend' }, R.cols.map((c, i) => h('span', null, h('i', { class: 'sw sw' + (i === R.cols.length - 1 ? 'last' : i) }), c.label)));
    return h('section', { class: 'block', id: 'flow' },
      h('h2', { text: '매출에서 남는 현금까지' }),
      h('p', { class: 'note', text: (mode === 'quarter' ? '손익은 분기 3개월, 현금흐름은 연초부터 누적 숫자입니다. ' : '') + '매출 → 매출총이익(괄호 안은 매출총이익률) → 영업이익 → 영업현금흐름 → FCF 순서로, 매출이 이익과 현금으로 얼마나 이어졌는지 봅니다. 0선 왼쪽은 마이너스입니다. 단위 억원.' }),
      legend,
      h('div', { class: 'chart', id: 'flow-chart' })
    );
  }

  function drawFlow() {
    const box = $('#flow-chart');
    if (!box || !last) return;
    box.replaceChildren();
    const KEYS = mode === 'quarter'
      ? [['rev', '매출액(분기)'], ['gp', '매출총이익(분기)'], ['op', '영업이익(분기)'], ['ocf', '영업현금흐름(누적)'], ['fcf', 'FCF(누적)']]
      : [['rev', '매출액'], ['gp', '매출총이익'], ['op', '영업이익'], ['ocf', '영업현금흐름'], ['fcf', 'FCF']];
    const cols = last.cols, D = last.D;
    const rows = KEYS.map(([k, name]) => ({ k, name, vals: D.map(d => d[k]) })).filter(r => r.vals.some(v => v !== undefined));
    const all = rows.flatMap(r => r.vals.filter(v => v !== undefined));
    if (!all.length) { box.append(h('p', { class: 'note', text: '그릴 숫자가 없습니다.' })); return; }
    const W = Math.max(300, box.clientWidth || 600);
    const bar = 13, gap = 3, n = cols.length, groupH = n * (bar + gap) + 16;
    const H = rows.length * groupH;
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('width', '100%'); svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', '매출, 매출총이익, 영업이익, 영업현금흐름, FCF 기간별 막대 그래프');
    const labelW = Math.min(mode === 'quarter' ? 130 : 110, W * 0.3), valW = 92;
    const lo = Math.min(0, ...all), hi = Math.max(0, ...all);
    const x0 = labelW + (lo < 0 ? valW : 8), x1 = W - valW;
    const sx = (v) => x0 + (v - lo) / ((hi - lo) || 1) * (x1 - x0);
    const mk = (tag, attrs, txt) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (txt !== undefined) e.textContent = txt; return e; };
    svg.append(mk('line', { x1: sx(0), x2: sx(0), y1: 0, y2: H, class: 'axis' }));
    rows.forEach((r, gi) => {
      const y0 = gi * groupH + 6;
      svg.append(mk('text', { x: 0, y: y0 + (n * (bar + gap)) / 2 + 4, class: 'lab' }, r.name));
      r.vals.forEach((v, i) => {
        if (v === undefined) return;
        const y = y0 + i * (bar + gap);
        const a = sx(Math.min(0, v)), b = sx(Math.max(0, v));
        const rect = mk('rect', { x: a, y, width: Math.max(1.5, b - a), height: bar, rx: 3, class: 'bar ' + (i === n - 1 ? 'last' : 'b' + i) });
        rect.append(mk('title', {}, `${cols[i].label} ${r.name}: ${fmt(v)}억원`));
        svg.append(rect);
        const lab = r.k === 'gp' && D[i].gpm !== undefined ? `${fmt(v)} (${D[i].gpm.toFixed(1)}%)` : fmt(v);
        svg.append(mk('text', { x: v < 0 ? a - 4 : b + 4, y: y + bar - 2.5, class: 'val', 'text-anchor': v < 0 ? 'end' : 'start' }, lab));
      });
    });
    box.append(svg);
  }
  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(drawFlow, 150); });

  const QLABEL = {
    ocf: '영업활동현금흐름(누적)', ocf_ni: '영업현금흐름 ÷ 순이익(누적)', capex: '설비투자(누적)', fcf: 'FCF(누적)',
    div_paid: '배당금 지급(누적)', int_paid: '이자 지급액(누적)', icr: '이자보상배율(누적 영업이익 ÷ 이자 지급)',
    ebitda: 'EBITDA(누적)', ebitda_m: 'EBITDA 마진(누적)', backlog_x: '수주잔고 ÷ 누적 매출',
    rev: '매출액(분기 3개월)', gp: '매출총이익(분기)', sga: '판매비와관리비(분기)', op: '영업이익(분기)', ni: '당기순이익(분기)', npm: '순이익률(분기)', ni_ctrl: '지배주주 순이익(분기)',
    rev_yoy: '매출 성장률(전년 같은 분기 대비)'
  };
  function bizTableRows(step, R, ci) {
    const n = R.cols.length;
    const cum = mode === 'quarter' ? '(누적)' : '';
    let list = [];
    if (step === 1) {
      let src = A.bizRows(R.cols, 'products'), suffix = '매출';
      if (!src.some(r => r.vals.some(v => v !== undefined))) { src = A.bizRows(R.cols, 'segments', 'rev'); suffix = '부문 매출'; }
      list = src.filter(r => r.vals.some(v => v !== undefined && Math.abs(v) >= 0.5))
        .sort((a, b) => (b.vals[n - 1] ?? -1e9) - (a.vals[n - 1] ?? -1e9)).slice(0, 6)
        .map(r => ({ label: `${r.name} ${/부문$/.test(r.name) && suffix === '부문 매출' ? '매출' : suffix}${cum}`, vals: r.vals, better: 'up' }));
    }
    if (step === 8) list = A.bizRows(R.cols, 'segments', 'op').filter(r => r.vals.some(v => v !== undefined && Math.abs(v) >= 1))
      .map(r => ({ label: `${r.name} 영업이익${cum}`, vals: r.vals, better: 'up' }));
    return list.map(r => {
      const a = ci >= 0 ? r.vals[ci] : undefined, b = r.vals[n - 1];
      const ch = A.changeText(a, b, '억원');
      return h('tr', null,
        h('th', { scope: 'row', text: r.label }),
        r.vals.map((v, i) => h('td', { class: i === n - 1 ? 'latest' : '', text: fmt(v) })),
        h('td', { class: 'chg ' + A.tone(ch.dir, r.better), text: ch.text || '' })
      );
    });
  }
  function metricTable(step, R) {
    const ms = A.METRICS.filter(m => m.step === step);
    const n = R.cols.length;
    const ci = A.compareIndex(R.cols);
    const pre = step === 1 ? bizTableRows(1, R, ci) : [];
    const post = step === 8 ? bizTableRows(8, R, ci) : [];
    const rows0 = ms.map(m => {
      const vals = R.D.map(d => d[m.key]);
      if (vals.every(v => v === undefined)) return null;
      const a = ci >= 0 ? vals[ci] : undefined, b = vals[n - 1];
      const ch = m.noDelta ? { text: '', dir: 0 } : A.changeText(a, b, m.unit);
      const t = A.tone(ch.dir, m.better);
      return h('tr', null,
        h('th', { scope: 'row', text: ((mode === 'quarter' && QLABEL[m.key]) || m.label) + (m.unit && m.unit !== '억원' ? ` (${m.unit})` : '') }),
        vals.map((v, i) => h('td', { class: i === n - 1 ? 'latest' : '' }, fmt(v, m.unit), m.key === 'roe' && v >= 15 ? h('span', { class: 'badge good', text: '좋음' }) : null)),
        h('td', { class: 'chg ' + t, text: ch.text || '' })
      );
    }).filter(Boolean);
    const rows = [...pre, ...rows0, ...post];
    if (!rows.length) return h('p', { class: 'note', text: '이 단계에서 보여줄 숫자를 찾지 못했습니다. 맨 아래 추출값 표에서 입력할 수 있습니다.' });
    return h('div', { class: 'table-scroll' },
      h('table', { class: 'mtable' },
        h('thead', null, h('tr', null, h('th', { scope: 'col', text: '지표 (억원)' }), R.cols.map(c => h('th', { scope: 'col', text: c.label })), h('th', { scope: 'col', text: ci >= 0 && ci !== n - 2 ? `변화(${R.cols[ci].label.replace(' (비교 열)', '')} 대비)` : '변화' }))),
        h('tbody', null, rows)
      )
    );
  }

  function stepBlock(s, R) {
    const v = R.verdicts[s.step];
    const head = h('div', { class: 'step-head' },
      h('span', { class: 'step-num', text: String(s.step) }),
      h('div', null, h('h3', { text: s.name }), h('p', { class: 'step-q', text: s.question })),
      h('span', { class: 'step-chip', id: 'chip-' + s.step }, chip(v.verdict))
    );
    const why = h('p', { class: 'step-why', id: 'why-' + s.step, text: v.why });
    const body = [];
    const stepIns = (R.insights || []).filter(i => i.step === s.step);
    if (stepIns.length) body.push(h('div', { class: 'remark-box' },
      h('strong', { text: '비고' }),
      h('ul', null, stepIns.map(i => h('li', { class: i.key ? 'key' : '' }, h('b', { text: i.title }), ' ', i.body)))));
    if (s.step === 1) {
      const latest = R.cols[R.cols.length - 1];
      body.push(metricTable(1, R));
      if (mode === 'quarter') body.push(h('p', { class: 'note', text: '제품별 매출과 연구개발비는 보고서의 누적 숫자입니다.' }));
      if (latest.rep.overview) body.push(h('details', { class: 'overview-wrap' }, h('summary', { text: '보고서의 사업 개요 보기' }), h('blockquote', { class: 'overview' }, h('p', { text: latest.rep.overview }), h('cite', { text: '\'II. 사업의 내용 - 1. 사업의 개요\' 앞부분' }))));
    } else if (s.step === 9) {
      body.push(valuationEditor(R));
    } else {
      body.push(metricTable(s.step, R));
    }
    if (mode === 'quarter' && s.step === 2) body.push(h('p', { class: 'note', text: '손익은 각 분기 3개월 숫자입니다. EBITDA만 상각비가 누적 숫자라 누적 기준입니다. 계절 영향이 있으니 변화 열(전년 같은 분기 대비)을 중심으로 보세요.' }));
    if (mode === 'quarter' && [3, 4, 7].includes(s.step)) body.push(h('p', { class: 'note', text: '현금흐름은 연초부터 누적 숫자입니다(1분기 3개월, 3분기 9개월). 서로 다른 분기의 누적 숫자는 나란히 비교하지 말고 변화 열을 보세요.' }));
    if (s.step === 7) body.push(h('p', { class: 'note', text: '이자보상배율은 현금흐름표의 이자 지급액으로 계산합니다. 주석의 이자비용과 조금 다를 수 있습니다.' }));
    if (s.step === 8) body.push(h('p', { class: 'note', text: '부문별 영업이익은 주석의 영업부문 정보(자회사·사업부별)에서 가져온 내부거래 제거 전 숫자입니다.' + (mode === 'quarter' ? ' 누적 숫자입니다.' : '') }));
    if (s.step === 5) body.push(h('p', { class: 'note', text: '금융자산에는 담보로 잡혀 있거나 바로 팔기 어려운 자산이 섞일 수 있습니다. 주석의 담보 제공 자산을 확인하세요.' }));
    const c0 = R.cols[0];
    const dc = R.cols.find(c => c.derived && c.note);
    if (dc && [2, 3, 4, 5, 6, 7, 8].includes(s.step)) body.push(h('p', { class: 'note', text: `${dc.label}: ${dc.note}` }));
    return h('section', { class: 'block step', id: 'step-' + s.step }, head, why, ...body);
  }

  function valuationEditor(R) {
    const wrap = h('div', { class: 'val' });
    const dateIn = h('input', { type: 'date', id: 'val-date', value: state.valuation.date || '' });
    dateIn.addEventListener('input', () => { state.valuation.date = dateIn.value; markDirty(); });
    const tickIn = h('input', { type: 'text', id: 'val-ticker', inputmode: 'numeric', maxlength: '6', placeholder: '예: 218410', value: state.valuation.ticker || R.vDef.ticker || '' });
    tickIn.addEventListener('change', () => {
      const t = tickIn.value.trim().replace(/^A/i, '');
      if (/^\d{6}$/.test(t)) state.valuation.ticker = t; else delete state.valuation.ticker;
      markDirty(); render(); const st9 = $('#step-9'); if (st9) st9.scrollIntoView();
    });
    const tk = R.vDef.ticker;
    const hasPrice = state.valuation.price !== undefined && state.valuation.price !== null && state.valuation.price !== '';
    const priceInfo = hasPrice
      ? `입력한 주가 ${fmt(+state.valuation.price, '원')}원${state.valuation.date ? ` (${state.valuation.date} 기준)` : ''}로 계산했습니다. 기준일을 함께 적어 두면 나중에 기록을 볼 때 헷갈리지 않습니다.`
      : '아래 \'주가\' 칸에 주가를 직접 넣으면 PER, PEG, PBR, PSR, EV/EBITDA가 계산됩니다. 기준일도 함께 적어 두세요.' + (tk ? '' : ' 종목코드를 넣으면 시세 페이지 링크를 만들어 드립니다.');
    const priceRow = h('div', { class: 'price-info' + (hasPrice ? ' auto' : '') },
      h('p', { text: priceInfo }),
      tk ? h('a', { href: `https://finance.naver.com/item/sise_day.naver?code=${tk}`, target: '_blank', rel: 'noopener', text: `네이버 증권에서 ${tk} 일별 시세 보기` }) : null
    );
    const grid = h('div', { class: 'val-grid' });
    for (const f of VAL_FIELDS) {
      if (f.onlyIf === 'pref' && !(R.vDef.pref_shares > 0) && !(state.valuation.pref_shares > 0)) continue;
      const def = R.vDef[f.key];
      const user = state.valuation[f.key];
      const id = 'val-' + f.key;
      const inp = h('input', { id, type: 'text', inputmode: 'decimal', autocomplete: 'off', placeholder: def !== null && def !== undefined ? fmt(def, f.unit === '억원' ? undefined : f.unit) : (f.key === 'price' ? '예: 47,550' : '직접 입력') });
      inp.value = (user !== undefined && user !== null && user !== '') ? fmt(+user, f.unit === '억원' ? undefined : f.unit) : '';
      inp.addEventListener('input', () => {
        const v = parseNum(inp.value);
        if (inp.value.trim() === '') delete state.valuation[f.key]; else if (v !== null) state.valuation[f.key] = v;
        if (f.key === 'price' && inp.value.trim() !== '' && !dateIn.value) { dateIn.value = prevBusinessDay(); state.valuation.date = dateIn.value; }
        inp.classList.toggle('edited', inp.value.trim() !== '');
        markDirty(); updateValuation();
      });
      inp.addEventListener('blur', () => { const v = parseNum(inp.value); if (v !== null) inp.value = fmt(v, f.unit === '억원' ? undefined : f.unit); });
      if (inp.value) inp.classList.add('edited');
      const N = R.vDef.notes;
      const noteText = N[f.key] || (f.key.startsWith('ttm') ? N.ttm : '');
      grid.append(h('div', { class: 'field' },
        h('label', { for: id, text: `${f.label} (${f.unit})` }),
        inp,
        h('small', { text: f.key === 'price' ? (state.valuation.price !== undefined ? '직접 입력한 값' : '주식 앱이나 증권사에서 확인한 보통주 주가를 넣으세요') : f.key === 'pref_price' ? (state.valuation.pref_price !== undefined ? '직접 입력한 값' : R.vDef.notes.pref_price) : (def === null || def === undefined) ? '자동으로 찾지 못했습니다. 직접 입력하세요.' : (state.valuation[f.key] !== undefined ? '직접 입력한 값' : '비워두면 자동값: ' + noteText) })
      ));
    }
    const reset = h('button', { type: 'button', class: 'btn ghost small', text: '주가 외 칸을 자동값으로', onclick: () => { const keep = {}; ['ticker', 'price', 'date'].forEach(k => { if (state.valuation[k] !== undefined) keep[k] = state.valuation[k]; }); state.valuation = keep; markDirty(); render(); const st9 = $('#step-9'); if (st9) st9.scrollIntoView(); } });
    const outs = h('div', { class: 'val-out', id: 'val-out' });
    wrap.append(
      h('div', { class: 'val-top' },
        h('div', { class: 'field' }, h('label', { for: 'val-ticker', text: '종목코드' }), tickIn),
        h('div', { class: 'field' }, h('label', { for: 'val-date', text: '주가 기준일' }), dateIn),
        reset
      ),
      priceRow,
      grid, outs,
      h('p', { class: 'note', text: '주가는 직접 넣습니다. 나머지 칸은 보고서에서 계산한 자동값이 들어 있고, 고치면 그 값을 씁니다(비우면 자동값).' })
    );
    fillValOut(outs, R.vOut);
    return wrap;
  }
  function fillValOut(box, o) {
    const card = (label, v, unit, help) => h('div', { class: 'vcard' },
      h('span', { class: 'vlab', text: label }),
      h('span', { class: 'vnum', text: v === undefined ? '—' : (unit === '억원' ? fmt(v) : v.toFixed(1)) }, h('small', { text: v === undefined ? '' : unit })),
      h('span', { class: 'vhelp', text: help })
    );
    const missing = o.mcap && (o.ttm_ni_ctrl === null || o.ttm_ni_ctrl === undefined);
    const loss = !missing && o.ttm_ni_ctrl !== undefined && !(o.ttm_ni_ctrl > 0);
    const card2 = (label, v, unit, help, digits) => { const c = card(label, v, unit, help); if (digits && v !== undefined) c.querySelector('.vnum').firstChild.textContent = v.toFixed(digits); return c; };
    box.replaceChildren(
      card('시가총액', o.mcap, '억원', state.valuation.pref_shares > 0 || (last && last.vDef.pref_shares > 0) ? '보통주 + 우선주 시가총액' : '주가 × 발행주식수'),
      card('PER', o.per, '배', missing ? '12개월 지배주주 순이익이 없어 계산 안 됨' : loss ? '순이익이 적자라 계산 안 됨' : '시가총액 ÷ 12개월 지배주주 순이익. 몇 년치 이익에 사는지'),
      withBadge(card2('PEG', o.peg, '', (loss || missing) ? 'PER이 없어 계산 안 됨' : !(o.growth > 0) ? '성장률이 0 이하라 계산 안 됨' : 'PER ÷ 이익 성장률(%). 1보다 낮으면 저평가', 2), o.peg !== undefined && o.peg < 1 ? '저평가' : null),
      withBadge(card('ROE', o.roe, '%', '12개월 지배주주 순이익 ÷ 지배주주 자본. 15% 이상이면 좋음'), o.roe !== undefined && o.roe >= 15 ? '좋음' : null),
      card('PBR', o.pbr, '배', '시가총액 ÷ 지배주주 자본. 1배면 장부가치와 같은 가격'),
      card('PSR', o.psr, '배', '시가총액 ÷ 12개월 매출. 적자 기업 비교에 유용'),
      card('EV/EBITDA', o.ev_ebitda, '배', 'EV ÷ 12개월 EBITDA. EV = 시가총액 − 순현금 + 비지배지분'),
      card('FCF 수익률', o.fcf_yield, '%', '12개월 FCF ÷ 시가총액. 높을수록 싸다는 뜻'),
      card('EV/영업이익', o.ev_op, '배', 'EV ÷ 12개월 영업이익')
    );
  }
  function withBadge(c, label) {
    if (label) { c.classList.add('flag'); c.querySelector('.vlab').append(' ', h('span', { class: 'badge good', text: label })); }
    return c;
  }
  function updateValuation() {
    if (!last) return;
    last.vIn = valuationInputs(last.vDef);
    last.vOut = A.valuationCalc(last.vIn);
    const v9 = A.verdicts(last.D, last.cols, last.vOut)[9];
    last.verdicts[9] = v9;
    fillValOut($('#val-out'), last.vOut);
    $('#chip-9').replaceChildren(chip(v9.verdict));
    $('#why-9').textContent = v9.why;
    const row = $('#score-9');
    row.querySelector('.sc-verdict').replaceChildren(chip(v9.verdict));
    row.querySelector('.sc-why').textContent = v9.why;
    $('#summary-line').textContent = summaryText(last);
  }

  function insightBlock(R) {
    const list = R.insights.length ? h('ul', { class: 'insights' }, R.insights.map(i => h('li', { class: 'ins ' + i.tone }, h('h3', { text: i.title }), h('p', { text: i.body })))) :
      h('p', { class: 'note', text: '특별히 짚을 점을 찾지 못했습니다..' });
    return h('section', { class: 'block', id: 'insights' }, h('h2', { text: '함께 알아두면 좋은 점' }), list);
  }

  function memoBlock() {
    const notes = h('textarea', { id: 'notes', rows: '4', placeholder: '확인한 내용, 매수·매도 판단 근거, 다시 볼 날짜 등을 적어 두세요.' });
    notes.value = state.notes || '';
    notes.addEventListener('input', () => { state.notes = notes.value; markDirty(); });
    return h('section', { class: 'block', id: 'memo' }, h('h2', { text: '메모' }), notes);
  }
  function checklistBlock(R) {
    const done = () => R.checks.filter(c => state.checks[c.id]).length;
    const counter = h('span', { class: 'count', text: `${done()} / ${R.checks.length} 확인` });
    const items = R.checks.map(c => {
      const id = 'chk-' + c.id;
      const box = h('input', { type: 'checkbox', id });
      box.checked = !!state.checks[c.id];
      box.addEventListener('change', () => { state.checks[c.id] = box.checked; counter.textContent = `${done()} / ${R.checks.length} 확인`; markDirty(); });
      return h('li', { class: c.dyn ? 'dyn' : '' }, box, h('label', { for: id, text: c.text }), c.dyn ? h('span', { class: 'tag', text: '이 회사 숫자에서 나온 항목' }) : null);
    });
    const notes = h('textarea', { id: 'notes', rows: '4', placeholder: '확인한 내용, 매수·매도 판단 근거, 다시 볼 날짜 등을 적어 두세요.' });
    notes.value = state.notes || '';
    notes.addEventListener('input', () => { state.notes = notes.value; markDirty(); });
    return h('section', { class: 'block', id: 'checklist' },
      h('div', { class: 'block-head' }, h('h2', { text: '투자 전 확인사항' }), counter),
      h('ul', { class: 'checks' }, items),
      h('label', { class: 'memo-label', for: 'notes', text: '메모' }),
      notes
    );
  }

  function dataEditor(R) {
    const groups = [...new Set(A.BASE.map(b => b.group))];
    const tbody = h('tbody');
    for (const g of groups) {
      if (!A.BASE.some(x => x.group === g && R.cols.some((c, i) => c.base[x.key] || R.resolved[i][x.key]))) continue;
      tbody.append(h('tr', { class: 'grp' }, h('th', { colspan: String(R.cols.length + 1), text: g })));
      const used = A.BASE.filter(x => x.group === g && R.cols.some((c, i) => c.base[x.key] || R.resolved[i][x.key] || ['rev', 'op', 'ni', 'ocf', 'cash', 'debt_total', 'equity'].includes(x.key)));
      if (!used.length) continue;
      for (const b of used) {
        tbody.append(h('tr', null,
          h('th', { scope: 'row', text: b.label + (b.unit ? ` (${b.unit})` : '') }),
          R.cols.map((c, i) => {
            const cell = R.resolved[i][b.key];
            const ext = c.base[b.key];
            const ov = state.overrides[c.id] && state.overrides[c.id][b.key];
            const inp = h('input', { type: 'text', inputmode: 'decimal', 'aria-label': `${c.label} ${b.label}`, placeholder: '없음', title: ext ? '원문: ' + ext.src : '자동으로 찾지 못했습니다' });
            const hasOv = ov !== undefined && ov !== null && ov !== '';
            if (hasOv) { inp.value = fmt(+ov, b.unit); inp.classList.add('edited'); }
            else if (ext) inp.value = fmt(ext.v, b.unit);
            inp.addEventListener('change', () => {
              const v = parseNum(inp.value);
              state.overrides[c.id] = state.overrides[c.id] || {};
              const same = ext && v !== null && fmt(v, b.unit) === fmt(ext.v, b.unit);
              if (inp.value.trim() === '' || v === null || same) delete state.overrides[c.id][b.key];
              else state.overrides[c.id][b.key] = v;
              state.log.push({ at: nowIso(), action: `값 수정: ${c.label} ${b.label} → ${inp.value.trim() || '자동값'}` });
              markDirty(); render();
              const again = $('#data-editor'); if (again) again.open = true;
            });
            return h('td', { class: cell && cell.edited ? 'edited' : '' }, inp, ext ? h('span', { class: 'src', text: ext.src }) : null);
          })
        ));
      }
    }
    return h('details', { class: 'block editor', id: 'data-editor' },
      h('summary', null, h('h2', { text: '추출값 확인·수정' }), h('span', { class: 'note', text: '자동으로 찾은 숫자와 원문 줄입니다. 칸을 고치면 모든 계산에 반영되고(억원), 칸을 비우면 자동값으로 돌아갑니다. 파란 칸이 직접 고친 값입니다.' })),
      h('div', { class: 'table-scroll' },
        h('table', { class: 'etable' },
          h('thead', null, h('tr', null, h('th', { scope: 'col', text: '항목' }), R.cols.map(c => h('th', { scope: 'col', text: c.label })))),
          tbody
        )
      )
    );
  }

  function logBlock() {
    const items = state.log.slice(-12).reverse();
    return h('section', { class: 'block log', id: 'log' },
      h('h2', { text: '작업 기록' }),
      items.length ? h('ol', { class: 'loglist' }, items.map(l => h('li', null, h('time', { text: fmtDate(l.at) }), ' ', l.action))) : h('p', { class: 'note', text: '아직 기록이 없습니다.' })
    );
  }

  // ---------- 저장·불러오기·내보내기 ----------
  function recordTitle() {
    const sorted = [...state.reports].sort((a, b) => a.meta.sortKey - b.meta.sortKey);
    const company = (sorted[sorted.length - 1] && sorted[sorted.length - 1].meta.company) || '회사명 없음';
    return mode === 'annual' ? `${company} 사업보고서 ${sorted.map(r => r.meta.end ? r.meta.end.y : '').join(', ')}` : `${company} ${sorted.map(r => r.meta.label).join(', ')}`;
  }
  function snapshot() {
    return {
      app: APP_ID, version: 2, mode,
      id: state.recordId || uid(),
      title: recordTitle(),
      savedAt: nowIso(), createdAt: state.createdAt,
      reports: state.reports, overrides: state.overrides, valuation: state.valuation,
      checks: state.checks, notes: state.notes, memo1: state.memo1, log: state.log
    };
  }
  function save() {
    if (!state.reports.length) return;
    if (!S.available()) { notice('이 브라우저에서는 저장소를 쓸 수 없습니다. 파일로 내보내기를 이용하세요.', 'bad'); return; }
    const pr = state.valuation.price ? ` (주가 ${fmt(+state.valuation.price, '원')}원${state.valuation.date ? `, ${state.valuation.date} 기준` : ''})` : ' (주가 미입력)';
    state.log.push({ at: nowIso(), action: (state.recordId ? '기록 다시 저장' : '기록 처음 저장') + pr });
    const rec = snapshot();
    state.recordId = rec.id;
    if (!S.upsert(rec)) { state.log.pop(); notice('저장 공간이 부족합니다. 오래된 기록을 지우거나 파일로 내보내세요.', 'bad'); return; }
    markDirty(false);
    notice(`저장했습니다: ${rec.title}`, 'good');
    const lb = $('#log'); if (lb) lb.replaceWith(logBlock());
  }
  function load(rec) {
    if (!rec || rec.app !== APP_ID || !Array.isArray(rec.reports)) { notice('이 도구에서 만든 기록 파일이 아닙니다.', 'bad'); return; }
    const recMode = ['annual', 'quarter'].includes(rec.mode) ? rec.mode : 'half';
    if (recMode !== mode) switchMode(recMode, true);
    state = states[mode] = {
      recordId: rec.id || uid(), createdAt: rec.createdAt || nowIso(),
      reports: rec.reports, overrides: rec.overrides || {}, valuation: rec.valuation || {},
      checks: rec.checks || {}, notes: rec.notes || '', memo1: rec.memo1 || '', log: rec.log || []
    };
    state.log.push({ at: nowIso(), action: '기록 불러옴' });
    pending = pendings[mode] = [];
    markDirty(false);
    notice(`불러왔습니다: ${rec.title || recordTitle()}`, 'good');
    renderSlots(); render();
    window.scrollTo({ top: 0 });
  }
  function download(rec) {
    const blob = new Blob([JSON.stringify(rec, null, 2)], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `${rec.title.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_')}_공시노트.json` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function openRecords() {
    const list = S.readAll();
    const box = $('#records-list');
    box.replaceChildren();
    if (!list.length) box.append(h('p', { class: 'note', text: '저장한 기록이 없습니다. 분석 후 \'기록 저장\'을 누르면 여기에 남습니다.' }));
    else box.append(h('ul', { class: 'reclist' }, list.map(r => h('li', null,
      h('div', null,
        h('strong', null, h('span', { class: 'mode-tag', text: r.mode === 'annual' ? '사업보고서' : r.mode === 'quarter' ? '분기' : '반기' }), ' ', r.title),
        h('span', { class: 'note', text: `저장 ${fmtDate(r.savedAt)}${r.valuation && r.valuation.price ? `  |  주가 ${fmt(r.valuation.price, '원')}원${r.valuation.date ? ` (${r.valuation.date})` : ''}` : ''}` })
      ),
      h('div', { class: 'rec-actions' },
        h('button', { type: 'button', class: 'btn small', text: '열기', onclick: () => { if (dirty && !confirm('지금 화면의 저장하지 않은 변경은 사라집니다. 열까요?')) return; $('#records-dialog').close(); load(S.get(r.id)); } }),
        h('button', { type: 'button', class: 'btn ghost small', text: '파일로 내보내기', onclick: () => download(S.get(r.id)) }),
        h('button', { type: 'button', class: 'btn ghost small danger', text: '삭제', onclick: () => { if (confirm(`'${r.title}' 기록을 지울까요? 되돌릴 수 없습니다.`)) { S.remove(r.id); if (state.recordId === r.id) state.recordId = null; openRecords(); } } })
      )
    ))));
    const d = $('#records-dialog');
    if (!d.open) d.showModal();
  }

  function switchMode(next, silent) {
    if (next === mode) return;
    states[mode] = state; pendings[mode] = pending; dirtyMap[mode] = dirty;
    mode = next; state = states[mode]; pending = pendings[mode]; dirty = dirtyMap[mode];
    if (location.hash !== '#' + mode) history.replaceState(null, '', '#' + mode);
    document.querySelectorAll('.tab').forEach(t => { const on = t.dataset.mode === mode; t.setAttribute('aria-selected', on ? 'true' : 'false'); t.tabIndex = on ? 0 : -1; });
    document.title = `공시 읽기 노트 — ${MODES[mode].name}`;
    markDirty(dirty);
    if (!silent) { notice(''); renderSlots(); render(); }
  }
  document.querySelectorAll('.tab').forEach(t => {
    t.addEventListener('click', () => switchMode(t.dataset.mode));
    t.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const order = ['half', 'quarter', 'annual'];
      const nx = order[(order.indexOf(mode) + (e.key === 'ArrowRight' ? 1 : 2)) % 3];
      switchMode(nx); document.querySelector(`.tab[data-mode="${nx}"]`).focus();
    });
  });
  window.addEventListener('hashchange', () => { const m = modeFromHash(location.hash); if (m) switchMode(m); });

  $('#btn-save').addEventListener('click', save);
  $('#btn-records').addEventListener('click', openRecords);
  $('#btn-export').addEventListener('click', () => { const rec = snapshot(); download(rec); });
  $('#btn-import').addEventListener('click', () => $('#import-input').click());
  $('#import-input').addEventListener('change', async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try { load(JSON.parse(await f.text())); } catch (err) { notice('기록 파일을 읽지 못했습니다. 이 도구에서 내보낸 .json 파일인지 확인하세요.', 'bad'); }
  });
  $('#btn-print').addEventListener('click', () => window.print());
  window.addEventListener('beforeprint', () => { document.body.classList.add('printing'); drawFlow(); });
  window.addEventListener('afterprint', () => { document.body.classList.remove('printing'); drawFlow(); });
  window.addEventListener('beforeunload', (e) => { if (['half', 'quarter', 'annual'].some(m => dirtyMap[m] && states[m].reports.length) || (dirty && state.reports.length)) { e.preventDefault(); e.returnValue = ''; } });

  if (!window.pdfjsLib) notice('PDF 읽기 도구를 불러오지 못했습니다. 페이지를 새로고침하거나 vendor/pdfjs 폴더가 올라갔는지 확인하세요.', 'bad');
  const initial = mode; mode = initial === 'half' ? 'quarter' : 'half'; state = states[mode]; pending = pendings[mode];
  switchMode(initial);
})();
