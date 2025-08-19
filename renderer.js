
const XLSX = require('xlsx');
let dataRows = []; let columns = []; let columnOrder = [];
// Visible columns (keep order in columnOrder); if empty -> all columns visible
let _visibleCols = new Set();
function getVisibleColumns(){
  return (_visibleCols && _visibleCols.size) ? columnOrder.filter(c=> _visibleCols.has(c)) : columnOrder.slice();
}

// mirror for external access (read-only); use setColumnOrder to change
Object.defineProperty(window, 'columnOrder', { get(){ return columnOrder; }, set(v){ /* ignore direct sets */ } });
let filters = {}; // col -> Set(selected values)
let selectedIndex = -1;
let cards = []; let currentCardsIndex = -1;
let columnWidths = {}; // colName -> px width

const el = id => document.getElementById(id);
const E = {
  btnLoad: el('btnLoad'), btnFilters: el('btnFilters'), btnDeleteAllRows: el('btnDeleteAllRows'),
  btnExportAllCSV: el('btnExportAllCSV'), btnExportAllXLSX: el('btnExportAllXLSX'), btnColumns: el('btnColumns'),
  search: el('search'), headrow: el('headrow'), bodyrows: el('bodyrows'),
  // cards
  cards: el('cards'), btnAdd: el('btnAdd'), btnRemove: el('btnRemove'), btnMoveUp: el('btnMoveUp'),
  btnMoveDown: el('btnMoveDown'), btnClearCards: el('btnClearCards'), btnExportSelCSV: el('btnExportSelCSV'),
  btnExportSelXLSX: el('btnExportSelXLSX'), btnExportSelPDF: el('btnExportSelPDF'),
  // filter modal
  filterModal: el('filterModal'), chips: el('chips'), filterBody: el('filterBody'), filterSearch: el('filterSearch'),
  btnClearThis: el('btnClearThis'), btnSelectAll: el('btnSelectAll'), btnSelectNone: el('btnSelectNone'),
  btnClearAll: el('btnClearAll'), btnFilterApply: el('btnFilterApply'), btnFilterCancel: el('btnFilterCancel'),
  file: el('file'),
};





// Load file
E.btnLoad.onclick = ()=> E.file.click();
E.file.onchange = async (e)=>{ console.log('file change', e.target.files && e.target.files[0] && e.target.files[0].name);
  const file = e.target.files[0]; if (!file) return;
  const buf = await file.arrayBuffer();
  if (file.name.toLowerCase().endsWith('.csv')) {
    const text = new TextDecoder('utf-8').decode(buf);
    const rows = text.split(/\r?\n/).filter(Boolean).map(r=>r.split(','));
    columns = rows[0];
    dataRows = rows.slice(1).map(r=>{ const obj={}; columns.forEach((c,i)=>{ obj[c] = (r[i] ?? ''); }); return obj; });
  } else {
    const wb = XLSX.read(new Uint8Array(buf), { type:'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    dataRows = XLSX.utils.sheet_to_json(ws);
    columns = dataRows.length? Object.keys(dataRows[0]) : [];
  }
  columnOrder = [...columns];
  window.headers = columns.slice(); // expose full headers for popup
  // init widths for unseen columns
  columnOrder.forEach(c=>{ if(!(c in columnWidths)) columnWidths[c]=50; });
  ensureColGroup();
  // expose headers and setter/getter to other scripts
  window.headers = columns.slice();
  window.setColumnOrder = function(arr){
    try{
      columnOrder = Array.isArray(arr) ? arr.slice() : [];
      window.columnOrder = columnOrder; // reflect for other scripts
      // Keep activeFilterCol valid
      if (!columnOrder.includes(activeFilterCol)) activeFilterCol = columnOrder[0] || null;
      renderTable(document.getElementById('search')?.value || '');
      renderCards();
    }catch(e){ console.warn('setColumnOrder failed', e); }
      ensureColGroup();
    renderCards();
  
  };
  filters = {};
  selectedIndex = -1;
  renderTable(); resetFileInput(); /*__RESET_AFTER_UPLOAD__*/ updateTableCounters();
  renderCards();
};

// Search
E.search.addEventListener('input', e=> { renderTable(e.target.value); updateTableCounters(); });


// Return rows filtered by all active filters EXCEPT the provided column
function filteredRowsExcept(exceptCol){
  let rows = dataRows.slice();
  for (const [col, setVals] of Object.entries(filters)){
    if (col === exceptCol) continue;
    if (setVals && setVals.size){
      rows = rows.filter(r => setVals.has(String(r[col] ?? '')));
    }
  }
  return rows;
}
function filteredRows(text=''){
  let rows = dataRows.slice();
  // apply filters
  for (const [col, setVals] of Object.entries(filters)){
    if (setVals && setVals.size){
      rows = rows.filter(r => setVals.has(String(r[col] ?? '')));
    }
  }
  if (text){
    const t = text.toLowerCase();
    rows = rows.filter(r => columnOrder.some(c => String(r[c]??'').toLowerCase().includes(t)));
  }
  return rows;
}

function ensureColGroup(){
  const table = document.getElementById('grid');
  if (!table) return null;
  let cg = table.querySelector('colgroup#colgroup');
  if (!cg){
    cg = document.createElement('colgroup'); cg.id='colgroup';
    table.insertBefore(cg, table.firstChild);
  }
  // sync cols to columnOrder
  cg.innerHTML='';
  // fixed index column (ردیف) at 50px
  { const colIdx = document.createElement('col'); colIdx.style.width='45px'; cg.appendChild(colIdx); }
  const colIdx = document.createElement('col'); colIdx.style.width='64px'; cg.appendChild(colIdx);
  columnOrder.forEach(c=>{
    const col = document.createElement('col');
    const w = columnWidths[c] || 50;
    col.style.width = (w|0) + 'px';
    cg.appendChild(col);
  });
  return cg;
}



function updateTableCounters(){
  const totEl = document.getElementById('totalCount');
  const curEl = document.getElementById('filteredCount');
  if (!totEl || !curEl) return;
  const total = dataRows.length || 0;
  // Use current search text if available
  const q = (document.getElementById('search') && document.getElementById('search').value) || '';
  const current = filteredRows(q).length;
  // Persian numerals
  totEl.textContent = 'کل رشته‌ها: ' + total.toLocaleString('fa-IR');
  curEl.textContent = 'بعد فیلتر: ' + current.toLocaleString('fa-IR');
}
function renderTable(text=''){
  E.headrow.innerHTML = ''; E.bodyrows.innerHTML = ''; ensureColGroup();
  // add index header
  const thIdx=document.createElement('th'); thIdx.textContent='ردیف'; thIdx.className='th-index'; E.headrow.appendChild(thIdx);
  getVisibleColumns().forEach((c, idx)=>{
    const th=document.createElement('th'); th.textContent=c; th.title='عرض ستون';
    // resizer
    const rz = document.createElement('div'); rz.className='th-resizer'; th.appendChild(rz);
    let startX=0, startW=columnWidths[c]||70, dragging=false;
    const onDown = (e)=>{ dragging=true; startX=e.clientX; startW=columnWidths[c]||70; document.body.style.userSelect='none'; };
    const onMove = (e)=>{
      if(!dragging) return;
      const dx = (e.clientX - startX);
      let w = Math.max(50, Math.min(100, (startW + dx)|0));
      columnWidths[c]=w;
      const table = document.getElementById('grid');
      const cg = table && table.querySelector('colgroup#colgroup');
      if (cg && cg.children[idx+1]) cg.children[idx+1].style.width = w+'px';
    };
    const onUp = ()=>{ if(dragging){ dragging=false; document.body.style.userSelect=''; } };
    rz.addEventListener('mousedown', onDown);
    rz.addEventListener('dblclick', ()=>{ columnWidths[c]=70; const table=document.getElementById('grid'); const cg=table && table.querySelector('colgroup#colgroup'); if (cg && cg.children[idx+1]) cg.children[idx+1].style.width='66px'; });
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    E.headrow.appendChild(th);
  });
  const __rows = filteredRows(text);
  window.lastFilteredRows = __rows.slice();
  __rows.forEach((row, rowIdx)=>{
    const tr = document.createElement('tr');
    // index cell
    const tdIdx=document.createElement('td'); tdIdx.className='td-index'; tdIdx.textContent=(rowIdx+1).toLocaleString('fa-IR'); tr.appendChild(tdIdx);
    tr.onclick = ()=>{ const prev=E.bodyrows.querySelector('tr.selected'); if(prev) prev.classList.remove('selected'); tr.classList.add('selected'); selectedIndex = dataRows.indexOf(row); };
    getVisibleColumns().forEach(c=>{ const td=document.createElement('td'); td.textContent = row[c] ?? ''; tr.appendChild(td); });
    E.bodyrows.appendChild(tr);

  // add resizers
  const ths = E.headrow.querySelectorAll('th');
  ths.forEach(th => {
    th.classList.add('resizable');
    const resizer = document.createElement('div');
    resizer.className = 'resizer';
    th.appendChild(resizer);
    let startX, startWidth;
    resizer.addEventListener('mousedown', e => {
      startX = e.pageX;
      startWidth = th.offsetWidth;
      document.documentElement.addEventListener('mousemove', onMouseMove);
      document.documentElement.addEventListener('mouseup', onMouseUp);
    });
    function onMouseMove(e){
      const newWidth = startWidth + (e.pageX - startX);
      th.style.width = newWidth + 'px';
    }
    function onMouseUp(){
      document.documentElement.removeEventListener('mousemove', onMouseMove);
      document.documentElement.removeEventListener('mouseup', onMouseUp);
    }
  });

  });
}

function renderCards(){
  E.cards.innerHTML = '';
  cards.forEach((row,i)=>{
    const card=document.createElement('div'); card.className='card'+(currentCardsIndex===i?' selected':''); card.draggable=true;
    const badge=document.createElement('span'); badge.className='idx-badge'; badge.textContent = (i+1).toLocaleString('fa-IR'); card.appendChild(badge);
    const del=document.createElement('button'); del.className='remove'; del.textContent='حذف';
    del.onclick=(ev)=>{ ev.stopPropagation(); cards.splice(i,1); if(currentCardsIndex===i) currentCardsIndex=-1; renderCards(); };
    card.appendChild(del);
    // drag & drop reorder for cards
    card.addEventListener('dragstart', (e)=>{ card.classList.add('dragging'); e.dataTransfer.setData('text/card-index', String(i)); });
    card.addEventListener('dragend', ()=>{ card.classList.remove('dragging'); });
    card.addEventListener('dragover', (e)=>{ e.preventDefault(); e.dataTransfer.dropEffect='move'; });
    card.addEventListener('drop', (e)=>{
      e.preventDefault();
      const from = parseInt(e.dataTransfer.getData('text/card-index'), 10);
      const to = i;
      if (!Number.isNaN(from) && from!==to){
        const moved = cards.splice(from,1)[0];
        cards.splice(to,0,moved);
        currentCardsIndex = to;
        renderCards();
      }
    });

    (columnOrder.length? columnOrder:Object.keys(row)).forEach(k=>{
      const line=document.createElement('div'); line.className='row';
      const key=document.createElement('span'); key.className='key'; key.textContent=k+' :';
      const val=document.createElement('span'); val.textContent=String(row[k]??'');
      line.appendChild(key); line.appendChild(val); card.appendChild(line);
    });
    card.onclick=()=>{ currentCardsIndex=i; renderCards(); };
    E.cards.appendChild(card);
  });
}

// Card actions
E.btnAdd.onclick = ()=>{ if (selectedIndex<0) return; cards.push(dataRows[selectedIndex]); currentCardsIndex=cards.length-1; renderCards(); };
E.btnRemove.onclick = ()=>{ if(currentCardsIndex<0) return; cards.splice(currentCardsIndex,1); currentCardsIndex=-1; renderCards(); };
E.btnMoveUp.onclick = ()=>{ if(currentCardsIndex>0){ [cards[currentCardsIndex-1], cards[currentCardsIndex]] = [cards[currentCardsIndex], cards[currentCardsIndex-1]]; currentCardsIndex--; renderCards(); } };
E.btnMoveDown.onclick = ()=>{ if(currentCardsIndex>=0 && currentCardsIndex<cards.length-1){ [cards[currentCardsIndex+1], cards[currentCardsIndex]] = [cards[currentCardsIndex], cards[currentCardsIndex+1]]; currentCardsIndex++; renderCards(); } };
E.btnClearCards.onclick = ()=>{ cards=[]; currentCardsIndex=-1; renderCards(); };

// Export helpers
function exportRowsToCSV(rows, filename){
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const esc = s => `"${String(s??'').replace(/"/g,'""')}"`;
  const csv = [cols.map(esc).join(',')].concat(rows.map(r=> cols.map(c=>esc(r[c])).join(','))).join('\n');
  const url = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
  const a=document.createElement('a'); a.href=url; a.download=filename; a.click(); URL.revokeObjectURL(url);
}
function exportRowsToXLSX(rows, filename){
  if (!rows.length) return;
  const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const buf = XLSX.write(wb, { bookType:'xlsx', type:'array' });
  const url = URL.createObjectURL(new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
  const a=document.createElement('a'); a.href=url; a.download=filename; a.click(); URL.revokeObjectURL(url);
}
E.btnExportSelCSV.onclick = ()=> exportSelectedWithOrderCSV(cards, 'selected.csv');
E.btnExportSelXLSX.onclick = ()=> exportSelectedWithOrderXLSX(cards, 'selected.xlsx');
E.btnExportSelPDF.onclick = ()=> alert('خروجی PDF در این نسخه اضافه نشده');

// Filters modal behaviour
let activeFilterCol = null;
function uniqueValues(col){
  const base = filteredRowsExcept(col);
  return Array.from(new Set(base.map(r=> String(r[col] ?? '')))).sort((a,b)=> a.localeCompare(b,'fa'));
}
function buildChips(){
  E.chips.innerHTML = '';
  columnOrder.forEach(c=>{
    const b=document.createElement('button'); b.className='chip'; b.textContent=c;
    if (c===activeFilterCol) b.classList.add('active');
    b.onclick = ()=>{ activeFilterCol=c; buildChips(); buildValueList(); };
    E.chips.appendChild(b);
  });
}

function buildValueList(){
  if (!activeFilterCol) return;
  const allVals = uniqueValues(activeFilterCol);
  // When opening, by default no selection => no filter
  const set = filters[activeFilterCol] || new Set(); 
  const q = (E.filterSearch.value||'').toLowerCase();
  E.filterBody.innerHTML = '';
  allVals.filter(v=> v.toLowerCase().includes(q)).forEach(v=>{
    const row=document.createElement('div'); row.className='filter-item';
    if (set.has(v)) row.classList.add('active');
    row.onclick = ()=>{
      if (set.has(v)) set.delete(v); else set.add(v);
      if (set.size===0) { delete filters[activeFilterCol]; } else { filters[activeFilterCol]=set; }
      row.classList.toggle('active');
    };
    row.textContent = v;
    E.filterBody.appendChild(row);
  });
  // Persist
  if (set.size===0) { delete filters[activeFilterCol]; } else { filters[activeFilterCol]=set; }
}
E.btnFilters.onclick = ()=>{
  if (!columns.length) return;
  activeFilterCol = columnOrder[0] || columns[0];
  buildChips(); E.filterSearch.value=''; buildValueList();
  E.filterModal.style.display='flex';
};
E.btnFilterCancel.onclick = ()=> E.filterModal.style.display='none';
E.btnFilterApply.onclick = ()=>{ E.filterModal.style.display='none'; renderTable(E.search.value); updateTableCounters(); };

E.btnClearThis.onclick = ()=>{ if(!activeFilterCol) return; delete filters[activeFilterCol]; buildValueList(); };
E.btnSelectAll.onclick = ()=>{ if(!activeFilterCol) return; filters[activeFilterCol] = new Set(uniqueValues(activeFilterCol)); buildValueList(); };
E.btnSelectNone.onclick = ()=>{ if(!activeFilterCol) return; filters[activeFilterCol] = new Set(); buildValueList(); };
E.btnClearAll.onclick = ()=>{ filters = {}; buildValueList(); renderTable(E.search.value); updateTableCounters(); };

E.filterSearch.addEventListener('input', buildValueList);

// delete all rows (visual)
E.btnDeleteAllRows.onclick = ()=>{ dataRows=[]; renderTable(); resetFileInput(); /*__RESET_AFTER_UPLOAD__*/ updateTableCounters(); };

// init

// === Splitter drag to resize left/right panels ===
(function setupSplitter(){
  const content = document.querySelector('.content');
  const splitter = document.getElementById('splitter');
  if (!content || !splitter) return;
  const root = document.documentElement;
  function setLeftPercent(p){
    // clamp between 20% and 80%
    const cl = Math.max(20, Math.min(80, p));
    root.style.setProperty('--leftW', cl.toFixed(1) + '%');
  }
  // Init from existing var (or 50)
  if (!getComputedStyle(root).getPropertyValue('--leftW').trim()) setLeftPercent(50);
  let dragging=false, startX=0, startLeft=50, total=0;
  function recalcTotal(){ total = content.getBoundingClientRect().width; }
  window.addEventListener('resize', recalcTotal); recalcTotal();
  splitter.addEventListener('mousedown', (e)=>{
    dragging=true; startX=e.clientX;
    const val = getComputedStyle(root).getPropertyValue('--leftW').trim().replace('%','');
    startLeft = parseFloat(val || '50') || 50;
    document.body.style.userSelect='none';
  });
  window.addEventListener('mousemove', (e)=>{
    if(!dragging) return;
    const dx = e.clientX - startX;
    // In RTL, moving mouse to the right should DECREASE left width visually, so invert
    const newLeft = startLeft - (dx) / (total/100);
    setLeftPercent(newLeft);
  });
  window.addEventListener('mouseup', ()=>{
    if(dragging){ dragging=false; document.body.style.userSelect=''; }
  });
})(); // end splitter
renderTable(); resetFileInput(); /*__RESET_AFTER_UPLOAD__*/ updateTableCounters(); renderCards();
function exportSelectedWithOrderCSV(rows, filename){
  if (!rows.length) return;
  const cols = ['ترتیب'].concat(columnOrder.slice());
  const esc = (s)=> ('"'+String(s).replace(/"/g,'""')+'"');
  const csv = [cols.map(esc).join(',')].concat(rows.map((r,idx)=> cols.map(c=>{
    if (c==='ترتیب') return esc(idx+1);
    return esc(r[c] ?? '');
  }).join(','))).join('\n');
  const url = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
  const a=document.createElement('a'); a.href=url; a.download=filename; a.click(); URL.revokeObjectURL(url);
}
function exportSelectedWithOrderXLSX(rows, filename){
  if (!rows.length) return;
  const data = rows.map((r,idx)=>{
    const obj={ 'ترتیب': idx+1 };
    columnOrder.forEach(c=> obj[c] = r[c] ?? '');
    return obj;
  });
  const ws = XLSX.utils.json_to_sheet(data, { header: ['ترتیب'].concat(columnOrder.slice()) });
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Selected');
  const buf = XLSX.write(wb, { bookType:'xlsx', type:'array' });
  const url = URL.createObjectURL(new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
  const a=document.createElement('a'); a.href=url; a.download=filename; a.click(); URL.revokeObjectURL(url);
}

// Set visible columns (array of names); empty -> all visible
window.setVisibleColumns = function(names){
  try{
    _visibleCols = new Set(Array.isArray(names)? names : []);
    ensureColGroup();
    renderTable(document.getElementById('search')?.value || '');
  } catch(e){ console.warn('setVisibleColumns error', e); }
};

// === Global column width sizer ===
(function setupGlobalColSizer(){
  const r = document.getElementById('colRange');
  const v = document.getElementById('colRangeVal');
  if (!r || !v) return;
  function setAll(px){
    const val = Math.max(50, Math.min(100, parseInt(px||100,10)));
    if (v) v.textContent = (val.toLocaleString('fa-IR')) + 'px';
    if (Array.isArray(columnOrder)){
      columnOrder.forEach(c=> columnWidths[c] = val);
      ensureColGroup();
      renderTable(document.getElementById('search')?.value || '');
    }
  }
  // init from current first col width if exists
  try{
    const first = columnOrder && columnOrder.length ? (columnWidths[columnOrder[0]]||100) : 100;
    r.value = first;
    if (v) v.textContent = (first.toLocaleString('fa-IR')) + 'px';
  }catch(e){}
  r.addEventListener('input', (e)=> setAll(e.target.value));
})();

/** Reset the file input so selecting the same file again triggers `change` **/
function resetFileInput(){
  try{
    const el = document.getElementById('fileInput') || document.querySelector('input[type=file]');
    if (el) el.value = "";
  }catch(e){ console.warn('resetFileInput failed', e); }
}

/** Clear table/grid data and state so re-upload works cleanly **/
function clearGridAndState(){
  try{
    // core arrays
    if (window.dataRows) dataRows.length = 0;
    if (window.columns) columns.length = 0;
    if (window.columnOrder) columnOrder.length = 0;

    // visible set for table (if exists)
    if (window._visibleCols && typeof _visibleCols.clear === 'function') _visibleCols.clear();

    // rebuild table
    if (typeof ensureColGroup === 'function') ensureColGroup();
    if (typeof renderTable === 'function') renderTable(document.getElementById('search')?.value || '');
    if (typeof updateTableCounters === 'function') updateTableCounters();

  }catch(e){ console.warn('clearGridAndState error', e); }
  resetFileInput();
}




// Wire 'حذف همه' برای فلش‌کارت‌ها فقط کارت‌ها را پاک کند
window.lastDeletedCards = [];
(function wireCardsClearAndRestore(){
  const btnClear = document.getElementById('btnClearCards');
  if (btnClear && !btnClear.dataset._wired){
    btnClear.addEventListener('click', (e)=>{
  e.preventDefault(); e.stopPropagation();
  if (Array.isArray(cards)){
    try{ window.lastDeletedCards = JSON.parse(JSON.stringify(cards)); }catch(e){ window.lastDeletedCards = cards.slice(); }
    cards.length = 0; currentCardsIndex = -1; renderCards();
  }
});
    btnClear.dataset._wired = '1';
  }
  // Add restore button 🔄 next to it if not present
  let btnRestore = document.getElementById('btnRestoreCards');
  if (!btnRestore && btnClear && btnClear.parentElement){
    btnRestore = document.createElement('button');
    btnRestore.id = 'btnRestoreCards';
    btnRestore.title = 'بازگرداندن همه فلش‌کارت‌ها';
    btnRestore.textContent = '🔄';
    btnRestore.className = btnClear.className; // same style
    btnClear.parentElement.insertBefore(btnRestore, btnClear.nextSibling);
  }
  if (btnRestore && !btnRestore.dataset._wired){
    btnRestore.addEventListener('click', (e)=>{
      e.preventDefault(); e.stopPropagation();
      try{
        const rows = (Array.isArray(window.lastDeletedCards) && window.lastDeletedCards.length) ? window.lastDeletedCards : [];
        cards = rows.slice(); // clone
        currentCardsIndex = (cards.length? 0 : -1);
        renderCards();
      }catch(err){ console.warn('restore cards failed', err); }
    });
    btnRestore.dataset._wired = '1';
  }
})();


// === PDF Export (cards as Excel-like table) ===
let __pdfReady = false;
try { const { jsPDF } = require('jspdf'); require('jspdf-autotable'); __pdfReady = true; } catch(e){ console.warn('jsPDF load failed', e); }

function getCardColumns(){
  try{
    if (Array.isArray(columnOrder) && columnOrder.length) return columnOrder.slice();
  }catch(e){}
  try{
    if (Array.isArray(visibleColumnsForCards) && visibleColumnsForCards.length) return visibleColumnsForCards.slice();
  }catch(e){}
  try{
    if (Array.isArray(cards) && cards.length) return Object.keys(cards[0]);
  }catch(e){}
  return [];
}

function exportCardsToPDF(){
  try{
    if (!__pdfReady){ alert('PDF library not loaded'); return; }
    if (!Array.isArray(cards) || cards.length===0){ alert('هیچ فلش‌کارتی برای خروجی وجود ندارد.'); return; }
    const cols = getCardColumns();
    if (!cols.length){ alert('ستون‌های فلش‌کارت مشخص نیست.'); return; }
    const body = cards.map(row => cols.map(c => (row && (row[c]!==undefined && row[c]!==null)) ? String(row[c]) : ''));
    const doc = new (require('jspdf').jsPDF)();
    doc.autoTable({
      head: [cols],
      body,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [0,102,204], textColor: 255 },
      startY: 20,
      margin: { left: 10, right: 10 }
    });
    doc.save('flashcards.pdf');
  }catch(err){
    console.error('exportCardsToPDF failed', err);
    alert('خطا در خروجی PDF');
  }
}

function ensurePdfButton(){
  let btn = document.getElementById('btnExportPDF');
  if (!btn){
    // try to attach to cards controls if exists
    const host = document.getElementById('cardsControls') || document.getElementById('cardsToolbar') || document.querySelector('#cards .toolbar') || document.body;
    btn = document.createElement('button');
    btn.id = 'btnExportPDF';
    btn.textContent = 'PDF';
    btn.title = 'Export PDF';
    btn.style.marginInlineStart = '8px';
    host.appendChild(btn);
  }
  if (!btn.dataset._wired){
    btn.addEventListener('click', exportCardsToPDF);
    btn.dataset._wired = '1';
  }
}

document.addEventListener('DOMContentLoaded', ()=>{
  try{ ensurePdfButton(); }catch(e){}
});
