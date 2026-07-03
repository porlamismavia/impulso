(() => {
  'use strict';

  const TITLE_KEY = 'Nombre Entidad / Nombre centro virtual';
  const EXPORT_FIELDS = [TITLE_KEY,'Fed','CNAE','Sector','Comarca CV','Dirección CV','Campo9','Provincia CV','CP  CV','CIF','NSS','Clave','Trab','Afs','UGT','CCOO','USO','CSI-CSIF','RESTO','TOTAL','FVota','Convenio','Promotor'];
  const CARD_DETAIL_FIELDS = ['Sector','Comarca CV','Dirección CV','Campo9','Provincia CV','CP  CV','CIF','NSS','Clave','CNAE','Trab','Afs','FVota','Convenio','Promotor'];
  const FIELD_LABELS = {
    'Sector':'Sector','Comarca CV':'Comarca','Dirección CV':'Dirección','Campo9':'Localidad','Provincia CV':'Provincia',
    'CP  CV':'Código Postal','CIF':'CIF','NSS':'Núm. Seguridad Social','Clave':'Clave Expediente','CNAE':'CNAE',
    'Trab':'Nº Trabajadores','Afs':'Afiliados','UGT':'Delegados UGT','CCOO':'Delegados CCOO','USO':'Delegados USO',
    'CSI-CSIF':'Delegados CSI-CSIF','RESTO':'Delegados Resto','TOTAL':'Total Delegados','FVota':'Fecha Votación',
    'Convenio':'Convenio Colectivo','Promotor':'Sindicato Promotor', [TITLE_KEY]:'Empresa / Centro',
    'Fed':'Federación'
  };
  const UNION_KEYS = ['UGT','CCOO','USO','CSI-CSIF','RESTO'];
  const UNION_VAR = { 'UGT':'--ugtsp', 'CCOO':'--fesmc', 'USO':'--fica', 'CSI-CSIF':'--other', 'RESTO':'--ink-soft' };
  const FED_VAR = { 'FESMC':'--fesmc', 'FICA':'--fica', 'UGT-SP':'--ugtsp' };

  let DATA = [];
  let DIVISION_LABELS = {};
  let currentResults = [];
  let currentFilters = {};

  const $ = (id) => document.getElementById(id);
  const screenHome = $('screenHome');
  const screenResults = $('screenResults');
  const backBtn = $('backBtn');
  const headerTitle = $('headerTitle');
  const headerEyebrow = $('headerEyebrow');
  const actionBar = $('actionBar');
  const toastEl = $('toast');

  const selCnae = $('fCnae');
  const selFed = $('fFed');
  const selProv = $('fProv');
  const selLoc = $('fLoc');
  const searchBtn = $('searchBtn');
  const countHint = $('countHint');

  function showToast(msg){
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toastEl.classList.remove('show'), 2200);
  }

  function uniqueSorted(arr){
    return [...new Set(arr)].filter(v => v !== '' && v !== null && v !== undefined)
      .sort((a,b) => String(a).localeCompare(String(b), 'es', {numeric:true}));
  }

  function divisionOf(code){
    return String(code).slice(0,2);
  }

  function buildDivisionLabels(){
    const freq = {};
    DATA.forEach(r => {
      const div = divisionOf(r['CNAE']);
      const sector = r['Sector'];
      if (!sector) return;
      if (!freq[div]) freq[div] = {};
      freq[div][sector] = (freq[div][sector] || 0) + 1;
    });
    const labels = {};
    Object.entries(freq).forEach(([div, counts]) => {
      let best = '', bestN = -1;
      Object.entries(counts).forEach(([s,n]) => { if (n > bestN){ best = s; bestN = n; } });
      labels[div] = best;
    });
    return labels;
  }

  function populateSelects(){
    DIVISION_LABELS = buildDivisionLabels();
    uniqueSorted(DATA.map(r => divisionOf(r['CNAE']))).forEach(div => {
      const label = DIVISION_LABELS[div];
      const opt = document.createElement('option');
      opt.value = div;
      opt.textContent = label ? `${div} — ${cap(label)}` : div;
      selCnae.appendChild(opt);
    });
    uniqueSorted(DATA.map(r => r['Fed'])).forEach(v => addOpt(selFed, v));
    uniqueSorted(DATA.map(r => r['Provincia CV'])).forEach(v => addOpt(selProv, v, cap));
    populateLocalidades('');
  }

  function populateLocalidades(provinciaFilter){
    const prevValue = selLoc.value;
    selLoc.innerHTML = '<option value="">Todas</option>';
    const subset = provinciaFilter ? DATA.filter(r => r['Provincia CV'] === provinciaFilter) : DATA;
    uniqueSorted(subset.map(r => r['Campo9'])).forEach(v => addOpt(selLoc, v, cap));
    if ([...selLoc.options].some(o => o.value === prevValue)) selLoc.value = prevValue;
  }

  function addOpt(select, value, fmt){
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = fmt ? fmt(value) : value;
    select.appendChild(opt);
  }

  function cap(s){
    if (!s) return s;
    return s.toString().toLowerCase().replace(/(^|\s|\()([a-záéíóúñü])/g, (m,p1,p2) => p1 + p2.toUpperCase());
  }

  function onProvinciaChange(){
    populateLocalidades(selProv.value);
    updateHint();
  }

  function updateHint(){
    const active = getActiveFilters();
    const hasAny = Object.keys(active).length > 0;
    searchBtn.disabled = !hasAny;
    [selCnae, selFed, selProv, selLoc].forEach(s => s.classList.toggle('active', !!s.value));
    if (!hasAny){
      countHint.innerHTML = 'Selecciona un criterio para empezar.';
      return;
    }
    const n = applyFilters(active).length;
    countHint.innerHTML = `<strong>${n}</strong> empresa${n===1?'':'s'} coinciden con la selección actual.`;
  }

  function getActiveFilters(){
    const f = {};
    if (selCnae.value) f['CNAE'] = selCnae.value;
    if (selFed.value) f['Fed'] = selFed.value;
    if (selProv.value) f['Provincia CV'] = selProv.value;
    if (selLoc.value) f['Campo9'] = selLoc.value;
    return f;
  }

  function applyFilters(filters){
    const keys = Object.keys(filters);
    if (keys.length === 0) return [];
    return DATA.filter(r => keys.every(k => {
      if (k === 'CNAE') return divisionOf(r['CNAE']) === filters[k];
      return r[k] === filters[k];
    }));
  }

  function fedColor(fed){
    return `var(${FED_VAR[fed] || '--other'})`;
  }

  function filterChipLabel(key, value){
    const labels = { 'CNAE':'CNAE', 'Fed':'Federación', 'Provincia CV':'Provincia', 'Campo9':'Localidad' };
    let v = value;
    if (key === 'Provincia CV' || key === 'Campo9') v = cap(value);
    if (key === 'CNAE') v = DIVISION_LABELS[value] ? `${value} · ${cap(DIVISION_LABELS[value])}` : value;
    return `${labels[key]}: <b>${escapeHtml(v)}</b>`;
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function renderResults(){
    const list = $('resultsList');
    const chips = $('filterChips');
    const summary = $('resultsSummary');
    const empty = $('emptyState');

    chips.innerHTML = Object.entries(currentFilters).map(([k,v]) => `<span>${filterChipLabel(k,v)}</span>`).join('');
    summary.innerHTML = `<strong>${currentResults.length}</strong> resultado${currentResults.length===1?'':'s'} encontrado${currentResults.length===1?'':'s'}`;

    if (currentResults.length === 0){
      list.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');

    list.innerHTML = currentResults.map(r => {
      const fed = r['Fed'];
      const rows = CARD_DETAIL_FIELDS.map(k => {
        let v = r[k];
        if (k === 'Campo9' || k === 'Provincia CV') v = cap(v);
        if (v === '' || v === null || v === undefined) v = '—';
        return `<dt>${FIELD_LABELS[k]}</dt><dd>${escapeHtml(v)}</dd>`;
      }).join('');
      const unionChips = UNION_KEYS.map(k => {
        const n = r[k] || 0;
        const dim = n === 0 ? 'opacity:.35' : '';
        return `<span class="union-chip" style="${dim}"><span class="union-dot" style="background:var(${UNION_VAR[k]})"></span>${k} ${n}</span>`;
      }).join('');
      return `
        <article class="card" style="border-left-color:${fedColor(fed)}">
          <span class="fed-tag" style="background:${fedColor(fed)}">${escapeHtml(fed || 'Sin federación')}</span>
          <h3>${escapeHtml(cap(r[TITLE_KEY]))}</h3>
          <div class="union-row">${unionChips}<span class="union-total">Total: ${r['TOTAL']}</span></div>
          <dl>${rows}</dl>
        </article>`;
    }).join('');
  }

  function goToResults(){
    currentFilters = getActiveFilters();
    currentResults = applyFilters(currentFilters);
    renderResults();
    screenHome.classList.add('hidden');
    screenResults.classList.remove('hidden');
    backBtn.classList.remove('hidden');
    actionBar.classList.remove('hidden');
    headerTitle.textContent = 'Resultados';
    headerEyebrow.textContent = 'UGT Castilla-La Mancha';
    window.scrollTo(0,0);
  }

  function goToHome(){
    screenResults.classList.add('hidden');
    screenHome.classList.remove('hidden');
    backBtn.classList.add('hidden');
    actionBar.classList.add('hidden');
    headerTitle.textContent = 'Buscador de Empresas';
    window.scrollTo(0,0);
  }

  function exportToXLS(){
    if (!currentResults.length) return;
    const rows = currentResults.map(r => {
      const o = {};
      EXPORT_FIELDS.forEach(k => { o[FIELD_LABELS[k]] = r[k]; });
      return o;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = EXPORT_FIELDS.map(() => ({ wch: 20 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Resultados');
    XLSX.writeFile(wb, `empresas_${timestamp()}.xlsx`);
    showToast('Excel exportado');
  }

  function exportToPDF(){
    if (!currentResults.length) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const cols = EXPORT_FIELDS.map(k => FIELD_LABELS[k]);
    const body = currentResults.map(r => EXPORT_FIELDS.map(k => {
      let v = r[k];
      if (k === 'Campo9' || k === 'Provincia CV') v = cap(v);
      return v === '' || v === null || v === undefined ? '—' : String(v);
    }));

    doc.setFontSize(13);
    doc.setTextColor(122,31,43);
    doc.text('Buscador de Empresas · UGT Castilla-La Mancha', 30, 30);
    doc.setFontSize(9);
    doc.setTextColor(90,90,90);
    const chipLabels = { 'CNAE':'CNAE', 'Fed':'Federación', 'Provincia CV':'Provincia', 'Campo9':'Localidad' };
    const filterText = Object.entries(currentFilters).map(([k,v]) => `${chipLabels[k]}: ${v}`).join('   |   ') || 'Sin filtros';
    doc.text(`Filtros aplicados: ${filterText}`, 30, 46);
    doc.text(`${currentResults.length} resultado(s) · Generado el ${new Date().toLocaleDateString('es-ES')}`, 30, 60);

    doc.autoTable({
      head: [cols],
      body: body,
      startY: 74,
      styles: { fontSize: 7, cellPadding: 3.5, overflow: 'linebreak' },
      headStyles: { fillColor: [122,31,43], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [246,244,242] },
      margin: { left: 20, right: 20 }
    });

    doc.save(`empresas_${timestamp()}.pdf`);
    showToast('PDF exportado');
  }

  function timestamp(){
    const d = new Date();
    const pad = n => String(n).padStart(2,'0');
    return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
  }

  async function init(){
    try {
      DATA = await fetch('data.json').then(r => r.json());
      populateSelects();
      updateHint();
    } catch (e) {
      countHint.textContent = 'No se han podido cargar los datos. Comprueba la instalación de la app.';
      searchBtn.disabled = true;
      console.error(e);
    }
  }

  selProv.addEventListener('change', onProvinciaChange);
  [selCnae, selFed, selLoc].forEach(s => s.addEventListener('change', updateHint));
  searchBtn.addEventListener('click', goToResults);
  backBtn.addEventListener('click', goToHome);
  $('newSearchBtn').addEventListener('click', goToHome);
  $('exportXlsBtn').addEventListener('click', exportToXLS);
  $('exportPdfBtn').addEventListener('click', exportToPDF);

  if ('serviceWorker' in navigator){
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js').catch(() => {});
    });
  }

  init();
})();
