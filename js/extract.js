/*
 * PDF → 줄(line) 단위 텍스트 추출
 * pdf.js의 텍스트 조각을 같은 높이(y)끼리 묶어서, 왼쪽부터 이어 붙입니다.
 * 브라우저(window.DartExtract)와 Node(module.exports) 양쪽에서 동작합니다.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DartExtract = api;
})(typeof self !== 'undefined' ? self : this, function () {
  async function pdfToLines(pdfjsLib, data, onProgress) {
    const doc = await pdfjsLib.getDocument({ data, disableFontFace: true, isEvalSupported: false }).promise;
    const lines = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const rows = [];
      for (const it of content.items) {
        const s = it.str;
        if (!s || !s.trim()) continue;
        const x = it.transform[4];
        const y = it.transform[5];
        const h = Math.abs(it.transform[3]) || 8;
        let row = rows.find(r => Math.abs(r.y - y) <= Math.max(2, h * 0.35));
        if (!row) { row = { y, items: [] }; rows.push(row); }
        row.items.push({ x, w: it.width || 0, s });
      }
      rows.sort((a, b) => b.y - a.y);
      for (const r of rows) {
        r.items.sort((a, b) => a.x - b.x);
        let out = '';
        let lastEnd = null;
        for (const it of r.items) {
          if (lastEnd !== null) {
            const gap = it.x - lastEnd;
            out += gap > 1.5 ? '  ' : '';
          }
          out += it.s;
          lastEnd = it.x + it.w;
        }
        lines.push(out.replace(/\s+$/, ''));
      }
      lines.push('\f');
      if (onProgress) onProgress(p, doc.numPages);
      page.cleanup();
    }
    await doc.destroy();
    return lines;
  }
  return { pdfToLines };
});
