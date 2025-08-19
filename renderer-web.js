// انتخاب ورودی فایل
const fileInput = document.getElementById("excelFileInput");
const tableHead = document.getElementById("tableHead");
const tableBody = document.getElementById("tableBody");
const flashcards = document.getElementById("flashcards");

fileInput.addEventListener("change", handleFile, false);

function handleFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (event) {
    const data = new Uint8Array(event.target.result);
    const workbook = XLSX.read(data, { type: "array" });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

    renderTable(jsonData);
  };
  reader.readAsArrayBuffer(file);
}

// ساخت جدول از داده‌های اکسل
function renderTable(data) {
  tableHead.innerHTML = "";
  tableBody.innerHTML = "";
  flashcards.innerHTML = "";

  if (data.length === 0) return;

  // هدر
  const headerRow = document.createElement("tr");
  data[0].forEach(header => {
    const th = document.createElement("th");
    th.textContent = header;
    headerRow.appendChild(th);
  });
  tableHead.appendChild(headerRow);

  // بدنه جدول
  data.slice(1).forEach((row, rowIndex) => {
    const tr = document.createElement("tr");

    row.forEach(cell => {
      const td = document.createElement("td");
      td.textContent = cell || "";
      tr.appendChild(td);
    });

    // دابل کلیک برای افزودن فلش کارت
    tr.addEventListener("dblclick", () => {
      addFlashcard(row);
    });

    tableBody.appendChild(tr);
  });
}

// افزودن فلش کارت
function addFlashcard(rowData) {
  const card = document.createElement("div");
  card.className = "flashcard";
  card.innerHTML = rowData.map(cell => `<p>${cell}</p>`).join("");
  flashcards.appendChild(card);
}