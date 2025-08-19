// نسخه دیباگ‌دار مطمئن برای بارگذاری اکسل

(function(){
  const log  = (...a)=>{ try{console.log("[UPLOAD]",...a);}catch{} };
  const err  = (...a)=>{ try{console.error("[UPLOAD]",...a);}catch{} };
  const $    = (q)=>document.querySelector(q);

  const input   = $("#excelFileInput");
  const status  = $("#status");
  const thead   = $("#tableHead");
  const tbody   = $("#tableBody");
  const cards   = $("#flashcards");

  function setStatus(txt){ if(status) status.textContent = txt || ""; }

  function ensureXLSX(){
    if (typeof XLSX === "undefined") {
      setStatus("❌ کتابخانه XLSX لود نشده است (مسیر xlsx.full.min.js را چک کن).");
      alert("XLSX لود نشده است. فایل xlsx.full.min.js را کنار index.html و با همین نام بگذار.");
      return false;
    }
    return true;
  }

  function toRows(workbook){
    const first = workbook.SheetNames[0];
    const ws = workbook.Sheets[first];
    // header:1 → آرایه‌ی آرایه (ساده‌ترین برای دیباگ)
    return XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  }

  function renderTable(rows){
    thead.innerHTML = "";
    tbody.innerHTML = "";
    cards.innerHTML = "";

    if (!rows || !rows.length) { setStatus("هیچ ردیفی در فایل یافت نشد."); return; }

    // هدر
    const headers = rows[0] || [];
    const trh = document.createElement("tr");
    headers.forEach(h=>{
      const th = document.createElement("th");
      th.textContent = h;
      th.style.borderBottom = "1px solid #ccc";
      th.style.textAlign = "right";
      th.style.padding = "6px";
      trh.appendChild(th);
    });
    thead.appendChild(trh);

    // بدنه
    rows.slice(1).forEach((row)=>{
      const tr = document.createElement("tr");
      row.forEach(cell=>{
        const td = document.createElement("td");
        td.textContent = (cell ?? "");
        td.style.borderBottom = "1px solid #eee";
        td.style.padding = "6px";
        tr.appendChild(td);
      });
      // دابل کلیک → اضافه به فلش‌کارت
      tr.addEventListener("dblclick", ()=>{
        addFlashcard(row);
      });
      tbody.appendChild(tr);
    });

    setStatus(`✅ ${rows.length-1} ردیف لود شد.`);
  }

  function addFlashcard(row){
    const div = document.createElement("div");
    div.className = "flashcard";
    div.style.cssText = "border:1px solid #ddd; border-radius:8px; padding:8px; margin:8px 0;";
    div.innerHTML = row.map(c=>`<p style="margin:4px 0">${c}</p>`).join("");
    cards.appendChild(div);
  }

  async function onFileChange(e){
    const f = e.target.files && e.target.files[0];
    if (!f){ setStatus("فایلی انتخاب نشد."); return; }
    if (!ensureXLSX()) { e.target.value=""; return; }

    setStatus(`در حال خواندن: ${f.name} ...`);
    const reader = new FileReader();

    reader.onload = (ev)=>{
      try{
        const data = new Uint8Array(ev.target.result);
        const wb = XLSX.read(data, { type: "array" });
        const rows = toRows(wb);
        log("parsed rows:", rows.length);
        renderTable(rows);
      }catch(ex){
        err("parse error:", ex);
        setStatus("❌ خواندن فایل ناموفق بود. فرمت/صفحه اول را چک کن.");
        alert("خواندن فایل اکسل/CSV ناموفق بود.");
      }finally{
        e.target.value = ""; // اجازه انتخاب مجدد همان فایل
      }
    };
    reader.onerror = ()=>{
      setStatus("❌ خطا در خواندن فایل.");
      e.target.value="";
    };
    reader.readAsArrayBuffer(f);
  }

  function wire(){
    if (!input) { err("excelFileInput not found"); return; }
    if (!input.dataset.wired){
      input.addEventListener("change", onFileChange);
      input.dataset.wired = "1";
      log("input wired");
    }
    // تست لود XLSX
    if (typeof XLSX !== "undefined") {
      log("XLSX OK", XLSX.version || "");
      setStatus("کتابخانه XLSX آماده است. یک فایل اکسل انتخاب کنید.");
    } else {
      setStatus("منتظر کتابخانه XLSX ... اگر مشکل بود مسیر اسکریپت را چک کن.");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }
})();
