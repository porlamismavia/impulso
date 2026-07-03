(() => {
  'use strict';

  const FIELD_ORDER = ['R Social','Domicilio','Localidad','Código Postal','PROVINCIA','Núm SS','CIF','Nº Trabajadores','Cnae 2025','Desc CNAE','FEDERACION'];
  const FIELD_LABELS = {
    'R Social':'Razón Social','Domicilio':'Domicilio','Localidad':'Localidad','Código Postal':'Código Postal',
    'PROVINCIA':'Provincia','Núm SS':'Núm. Seguridad Social','CIF':'CIF','Nº Trabajadores':'Nº Trabajadores',
    'Cnae 2025':'CNAE','Desc CNAE':'Descripción CNAE','FEDERACION':'Federación'
  };
  const FED_VAR = { 'FESMC':'--fesmc', 'FICA':'--fica', 'UGT-SP':'--ugtsp' };

  let DATA = [];
  let CNAE_MAP = {};
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

  function populateSelects(){
    uniqueSorted(DATA.map(r => r['Cnae 2025'])).forEach(code => {
      const desc = CNAE_MAP[code];
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = desc ? `${code} — ${cap(desc)}` : code;
      selCnae.appendChild(opt);
    });
    uniqueSorted(DATA.map(r => r['FEDERACION'])).forEach(v => addOpt(selFed, v));
    uniqueSorted(DATA.map(r => r['PROVINCIA'])).forEach(v => addOpt(selProv, v, cap));
    uniqueSorted(DATA.map(r => r['Localidad'])).forEach(v => addOpt(selLoc, v, cap));
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
    if (selCnae.value) f['Cnae 2025'] = selCnae.value;
    if (selFed.value) f['FEDERACION'] = selFed.value;
    if (selProv.value) f['PROVINCIA'] = selProv.value;
    if (selLoc.value) f['Localidad'] = selLoc.value;
    return f;
  }

  function applyFilters(filters){
    const keys = Object.keys(filters);
    if (keys.length === 0) return [];
    return DATA.filter(r => keys.every(k => r[k] === filters[k]));
  }

  function fedColor(fed){
    return `var(${FED_VAR[fed] || '--other'})`;
  }

  function filterChipLabel(key, value){
    const labels = { 'Cnae 2025':'CNAE', 'FEDERACION':'Federación', 'PROVINCIA':'Provincia', 'Localidad':'Localidad' };
    let v = value;
    if (key === 'PROVINCIA' || key === 'Localidad') v = cap(value);
    if (key === 'Cnae 2025' && CNAE_MAP[value]) v = `${value} · ${cap(CNAE_MAP[value])}`;
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
      const fed = r['FEDERACION'];
      const rows = FIELD_ORDER.filter(k => k !== 'R Social' && k !== 'FEDERACION').map(k => {
        let v = r[k];
        if (k === 'Localidad' || k === 'PROVINCIA') v = cap(v);
        if (v === '' || v === null || v === undefined) v = '—';
        return `<dt>${FIELD_LABELS[k]}</dt><dd>${escapeHtml(v)}</dd>`;
      }).join('');
      return `
        <article class="card" style="border-left-color:${fedColor(fed)}">
          <span class="fed-tag" style="background:${fedColor(fed)}">${escapeHtml(fed || 'Sin federación')}</span>
          <h3>${escapeHtml(cap(r['R Social']))}</h3>
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
      FIELD_ORDER.forEach(k => { o[FIELD_LABELS[k]] = r[k]; });
      return o;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = FIELD_ORDER.map(() => ({ wch: 20 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Resultados');
    XLSX.writeFile(wb, `empresas_${timestamp()}.xlsx`);
    showToast('Excel exportado');
  }

  function exportToPDF(){
    if (!currentResults.length) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const cols = FIELD_ORDER.map(k => FIELD_LABELS[k]);
    const body = currentResults.map(r => FIELD_ORDER.map(k => {
      let v = r[k];
      if (k === 'Localidad' || k === 'PROVINCIA') v = cap(v);
      return v === '' || v === null || v === undefined ? '—' : String(v);
    }));

    doc.setFontSize(13);
    doc.setTextColor(122,31,43);
    doc.text('Buscador de Empresas · UGT Castilla-La Mancha', 30, 30);
    doc.setFontSize(9);
    doc.setTextColor(90,90,90);
    const filterText = Object.entries(currentFilters).map(([k,v]) => {
      const labels = { 'Cnae 2025':'CNAE', 'FEDERACION':'Federación', 'PROVINCIA':'Provincia', 'Localidad':'Localidad' };
      return `${labels[k]}: ${v}`;
    }).join('   |   ') || 'Sin filtros';
    doc.text(`Filtros aplicados: ${filterText}`, 30, 46);
    doc.text(`${currentResults.length} resultado(s) · Generado el ${new Date().toLocaleDateString('es-ES')}`, 30, 60);

    doc.autoTable({
      head: [cols],
      body: body,
      startY: 74,
      styles: { fontSize: 7.5, cellPadding: 4, overflow: 'linebreak' },
      headStyles: { fillColor: [122,31,43], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [246,244,242] },
      margin: { left: 30, right: 30 }
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
      const [dataRes, mapRes] = await Promise.all([
        fetch('data.json').then(r => r.json()),
        fetch('cnae_map.json').then(r => r.json())
      ]);
      DATA = dataRes;
      CNAE_MAP = mapRes;
      populateSelects();
      updateHint();
    } catch (e) {
      countHint.textContent = 'No se han podido cargar los datos. Comprueba la instalación de la app.';
      searchBtn.disabled = true;
      console.error(e);
    }
  }

  [selCnae, selFed, selProv, selLoc].forEach(s => s.addEventListener('change', updateHint));
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
