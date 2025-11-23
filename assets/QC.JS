// ===============================
//   DATA QC
// ===============================
let qcList = [];

/* elemen inti */
const $ = (id) => document.getElementById(id);
const namaInput = $("namaInput");
const tanggalInput = $("tanggalInput");
const saveBtn = $("saveBtn");
const listContainer = $("qcList");

const bendaNameInput = $("bendaNameInput");
const measurementsArea = $("measurementsArea");
const addPanjangBtn = $("addPanjangBtn");
const addLebarBtn = $("addLebarBtn");
const addDiameterBtn = $("addDiameterBtn");
const addTinggiBtn = $("addTinggiBtn");

/* buat block measurement dinamis, sembunyikan tombol saat ditambahkan, kembalikan saat dihapus */
function addMeasurement(type, values = {}) {
  try {
    if (!measurementsArea || !type) return;
    const key = String(type).trim().toLowerCase();
    // mencegah duplikat
    if (
      Array.from(measurementsArea.children).some((c) => c.dataset?.type === key)
    )
      return;

    const wrapper = document.createElement("div");
    wrapper.className = "part";
    wrapper.dataset.type = key;
    wrapper.style.marginBottom = "12px";

    wrapper.innerHTML = [
      `<div class="part-header">`,
      `  <strong>${type}</strong>`,
      `  <div style="margin-left:auto">`,
      `    <button type="button" class="remove-measurement" title="Hapus"`,
      `      style="background:#d33;color:#fff;border-radius:8px;padding:6px 8px;border:none;cursor:pointer">Hapus</button>`,
      `  </div>`,
      `</div>`,
      `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:8px">`,
      `  <input class="m-standar" type="number" step="any" placeholder="Standar (mm)" value="${
        values.standar ?? ""
      }">`,
      `  <input class="m-toleransi" type="number" step="any" placeholder="Toleransi ± (mm)" value="${
        values.toleransi ?? ""
      }">`,
      `  <input class="m-hasil" type="number" step="any" placeholder="Hasil (mm)" value="${
        values.hasil ?? ""
      }">`,
      `</div>`,
    ].join("");

    measurementsArea.appendChild(wrapper);

    // sembunyikan tombol add terkait
    const btnId = `add${type.charAt(0).toUpperCase() + type.slice(1)}Btn`;
    const relatedBtn = document.getElementById(btnId);
    if (relatedBtn) relatedBtn.style.display = "none";

    const rem = wrapper.querySelector(".remove-measurement");
    if (rem) {
      rem.addEventListener("click", () => {
        wrapper.remove();
        if (relatedBtn) relatedBtn.style.display = "";
      });
    }
  } catch (err) {
    console.error("addMeasurement error:", err);
  }
}

/* hubungkan tombol */
addPanjangBtn &&
  addPanjangBtn.addEventListener("click", () => addMeasurement("Panjang"));
addLebarBtn &&
  addLebarBtn.addEventListener("click", () => addMeasurement("Lebar"));
addDiameterBtn &&
  addDiameterBtn.addEventListener("click", () => addMeasurement("Diameter"));
addTinggiBtn &&
  addTinggiBtn.addEventListener("click", () => addMeasurement("Tinggi"));

/* kumpulkan semua measurement yang ada di DOM */
function gatherMeasurementsFromDOM() {
  const out = {};
  if (!measurementsArea) return out;
  Array.from(measurementsArea.children).forEach((el) => {
    const type = (el.dataset.type || "").toLowerCase();
    if (!type) return;
    const s = el.querySelector(".m-standar")?.value ?? "";
    const t = el.querySelector(".m-toleransi")?.value ?? "";
    const h = el.querySelector(".m-hasil")?.value ?? "";
    out[type] = { standar: s, toleransi: t, hasil: h };
  });
  return out;
}

/* helpers parsing & perhitungan (biarkan seperti sebelumnya, atau gunakan yang sudah ada) */
const toNum = (v) => {
  if (v === null || v === undefined) return null;
  const cleaned = String(v)
    .replace(/[^0-9+\-eE.,]/g, "")
    .replace(",", ".")
    .trim();
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

function _prepareScaled(std, tol, val, maxDecimals = 8) {
  const clean = (x) =>
    String(x ?? "")
      .replace(/±/g, "")
      .replace(/[^0-9+\-eE.,]/g, "")
      .replace(",", ".")
      .trim();
  const sStr = clean(std),
    tStr = clean(tol),
    hStr = clean(val);
  if (!sStr || !tStr || !hStr) return null;
  if (/[eE]/.test(sStr + tStr + hStr)) {
    const s = Number(sStr),
      t = Number(tStr),
      h = Number(hStr);
    if (![s, t, h].every(Number.isFinite)) return null;
    return { scaled: false, s, t, h, scale: 1 };
  }
  const decimals = (str) => (str.match(/\.(\d+)/) || ["", ""])[1].length;
  const dec = Math.min(
    maxDecimals,
    Math.max(decimals(sStr), decimals(tStr), decimals(hStr))
  );
  const scale = 10 ** dec;
  const s = Math.round(Number(sStr) * scale);
  const t = Math.round(Number(tStr) * scale);
  const h = Math.round(Number(hStr) * scale);
  if (![s, t, h].every(Number.isInteger)) return null;
  return { scaled: true, s, t, h, scale };
}

function checkPass(std, tol, val) {
  const p = _prepareScaled(std, tol, val);
  if (!p) return null;
  return Math.abs(p.h - p.s) <= Math.abs(p.t);
}

/**
 * FUNGSI INI SUDAH DIKOREKSI: Mengembalikan proporsionalitas 1.00% hingga 100.00%
 * dan menjamin akurasi 2 desimal.
 */
function percentMatch(std, tol, val) {
  const p = _prepareScaled(std, tol, val);
  if (!p) return null;

  // Definisikan skor minimum untuk komponen yang masih Lolos
  const MIN_SCORE = 1.0;
  const SCORE_RANGE = 100.0 - MIN_SCORE; // 99.0

  // Fungsi pembulatan ke 2 desimal (penting!)
  const round2 = (num) => Math.round(num * 100) / 100;

  const diff = Math.abs(p.h - p.s);
  const absT = Math.abs(p.t);

  if (absT === 0) return diff === 0 ? 100.0 : 0.0;

  // --- LOGIKA PERHITUNGAN PROPORSIONAL ---
  if (diff <= absT) {
    // Hitung rasio deviasi: 0 (ideal) hingga 1 (batas)
    const ratio = diff / absT;
    // Hitung skor proporsional: 1.00 + (99.00 * (1 - ratio))
    const score = MIN_SCORE + SCORE_RANGE * (1 - ratio);

    return round2(Math.max(MIN_SCORE, Math.min(100.0, score)));
  }
  // Jika tidak lolos, kembalikan 0%
  return 0.0;
}

function partPercent(part) {
  const keys = Object.keys(part.measurements || {});
  if (!keys.length) return 0.0;
  let sum = 0,
    cnt = 0;
  keys.forEach((k) => {
    const m = (part.measurements && part.measurements[k]) || {};
    const p = percentMatch(m.standar, m.toleransi, m.hasil);
    if (p !== null) {
      sum += p;
      cnt++;
    } else {
      const ok = checkPass(m.standar, m.toleransi, m.hasil);
      if (ok === true) {
        sum += 100.0; // Pastikan 2 desimal untuk konsistensi
        cnt++;
      } else if (ok === false) {
        sum += 0.0;
        cnt++;
      }
    }
  }); // kembalikan nilai rata-rata sebagai float, bulatkan ke 2 desimal
  const round2 = (num) => Math.round(num * 100) / 100;
  return cnt ? round2(sum / cnt) : 0.0;
}

/* simpan dinamis: ambil semua measurement dari DOM */
if (saveBtn) {
  saveBtn.addEventListener("click", () => {
    const measurements = gatherMeasurementsFromDOM();
    const part = { benda: bendaNameInput?.value || "", measurements };
    qcList.push({
      nama: namaInput?.value || "",
      tanggal: tanggalInput?.value || "",
      parts: [part],
    }); // jangan simpan ke localStorage -> data hanya di memori (hilang saat reload) // removed: localStorage.setItem("qcList", JSON.stringify(qcList));

    renderList();
    updateDashboardChart(); // reset form & kembalikan tombol add

    [namaInput, tanggalInput, bendaNameInput].forEach(
      (el) => el && (el.value = "")
    );
    if (measurementsArea) {
      measurementsArea.innerHTML = "";
      [
        "addPanjangBtn",
        "addLebarBtn",
        "addDiameterBtn",
        "addTinggiBtn",
      ].forEach((id) => {
        const b = document.getElementById(id);
        if (b) b.style.display = "";
      });
    }
  });
}

/* render clickable list — buka modal berdasarkan index */
function renderList() {
  if (!listContainer) return;
  listContainer.innerHTML = "";
  qcList.forEach((item, i) => {
    const avg =
      item.parts && item.parts.length
        ? item.parts.reduce((s, p) => s + partPercent(p), 0) / item.parts.length
        : 0.0;
    const div = document.createElement("div");
    div.className = "qc-card";
    div.style.cursor = "pointer";
    div.dataset.index = i; // KOREKSI: Gunakan toFixed(2) untuk menampilkan 2 desimal
    div.innerHTML = `<h3>QC-${i + 1}</h3><div>Pemeriksa: ${
      item.nama || "-"
    }</div><div>Tanggal: ${
      item.tanggal || "-"
    }</div><div>Kesesuaian: ${avg.toFixed(2)}%</div>`;
    div.addEventListener("click", () => openModal(i));
    listContainer.appendChild(div);
  });
}

/* chart & modal rendering yang mendukung measurement dinamis */
let dashboardChart = null,
  modalChart = null;

function updateDashboardChart() {
  const labels = qcList.map((_, i) => `QC-${i + 1}`);
  const data = qcList.map((it) =>
    it.parts && it.parts.length
      ? Math.round(
          it.parts.reduce((s, p) => s + partPercent(p), 0) / it.parts.length
        ) // Bulatkan ke int untuk Chart
      : 0
  );
  const ctx = $("qcChart");
  if (!ctx) return;
  const bg = data.map((v) =>
    v >= 80 ? "#0a9a3f" : v >= 40 ? "#f6b100" : "#d13030"
  );
  const cfg = {
    type: "bar",
    data: {
      labels,
      datasets: [{ label: "Kesesuaian (%)", data, backgroundColor: bg }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, max: 100 } },
    },
  };
  if (dashboardChart) {
    dashboardChart.data.labels = labels;
    dashboardChart.data.datasets[0].data = data;
    dashboardChart.data.datasets[0].backgroundColor = bg;
    dashboardChart.update();
  } else dashboardChart = new Chart(ctx, cfg);
}

function renderModalChart(item) {
  const canvas = $("modalChart");
  if (!canvas) return;
  const part = (item.parts && item.parts[0]) || null;
  if (!part) return;
  const m = part.measurements || {};
  const keys = Object.keys(m);
  const data = keys.map((k) =>
    Math.round(
      percentMatch(m[k]?.standar, m[k]?.toleransi, m[k]?.hasil) ?? // Bulatkan untuk tampilan Chart
        (checkPass(m[k]?.standar, m[k]?.toleransi, m[k]?.hasil) ? 100 : 0)
    )
  );
  const labels = keys.map((k) => k.charAt(0).toUpperCase() + k.slice(1));
  const colors = data.map((v) =>
    v >= 80 ? "#0a9a3f" : v >= 40 ? "#f6b100" : "#d13030"
  );
  if (modalChart) {
    modalChart.destroy();
    modalChart = null;
  }
  modalChart = new Chart(canvas.getContext("2d"), {
    type: "bar",
    data: { labels, datasets: [{ data, backgroundColor: colors }] },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, max: 100 } },
    },
  });
}

/* buka modal berdasarkan index, tampilkan ringkasan & detail perhitungan */
function openModal(idx) {
  const item = qcList[idx];
  if (!item) return;
  $("modalKode").textContent = `QC-${idx + 1}`;
  $("modalNama").textContent = item.nama || "-";
  $("modalTanggal").textContent = item.tanggal || "-";
  const part = (item.parts && item.parts[0]) || null;
  if (!part) {
    $("modalBenda").textContent = "-";
    $("modalSummaryList").textContent = "";
    $("modalDetail").innerHTML = "<div>Tidak ada data benda.</div>";
    $("qcModal").style.display = "flex";
    return;
  }
  $("modalBenda").textContent = part.benda || "-";
  const m = part.measurements || {};
  $("modalSummaryList").textContent = Object.keys(m)
    .map(
      (k) =>
        `${k.charAt(0).toUpperCase() + k.slice(1)}: Std ${
          m[k].standar || "-"
        } Tol ±${m[k].toleransi || "-"} Hasil ${m[k].hasil || "-"}`
    )
    .join(" | ");
  const detailHtml = Object.keys(m)
    .map((k) => {
      const mm = m[k] || {};
      const ok = checkPass(mm.standar, mm.toleransi, mm.hasil);
      const pct = percentMatch(mm.standar, mm.toleransi, mm.hasil);
      const badge =
        ok === true
          ? '<span class="modal-pass">PASS</span>'
          : ok === false
          ? '<span class="modal-fail">FAIL</span>'
          : '<span style="color:#999">N/A</span>'; // KOREKSI: Gunakan toFixed(2) untuk tampilan detail
      const pctText =
        pct === null
          ? ok === true
            ? "100.00%"
            : ok === false
            ? "0.00%"
            : "N/A"
          : `${pct.toFixed(2)}%`;
      return `<div style="margin-bottom:8px;"><b>${
        k.charAt(0).toUpperCase() + k.slice(1)
      }</b><br>Std: ${mm.standar || "-"} | Tol: ±${
        mm.toleransi || "-"
      } | Hasil: ${mm.hasil || "-"} — ${badge} (${pctText})</div>`;
    })
    .join("");
  $("modalDetail").innerHTML = detailHtml;
  $("qcModal").style.display = "flex";
  renderModalChart(item);
}

/* tutup modal global */
function closeModal() {
  const modal = $("qcModal");
  if (modal) modal.style.display = "none";
  if (modalChart) {
    modalChart.destroy();
    modalChart = null;
  }
}
window.closeModal = closeModal;

/* inisialisasi: muat dari localStorage jika ada, render */
// try { const raw = localStorage.getItem("qcList"); if (raw) qcList = JSON.parse(raw); } catch (e) {}
renderList();
updateDashboardChart();

/* --- Custom select replacer (tidak berubah) --- */
function initCustomSelects(root = document) {
  const selects = Array.from(
    root.querySelectorAll("select.prosesInput, select.themed")
  );
  selects.forEach((sel) => {
    if (sel.dataset._themed) return;
    sel.dataset._themed = "1";
    const wrapper = document.createElement("div");
    wrapper.className = "custom-select";
    sel.parentNode.insertBefore(wrapper, sel);
    wrapper.appendChild(sel);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "custom-select__button";
    btn.setAttribute("aria-haspopup", "listbox");
    btn.setAttribute("aria-expanded", "false");
    const labelSpan = document.createElement("span");
    labelSpan.className = "custom-select__label";
    labelSpan.textContent =
      sel.selectedOptions[0]?.text || sel.options[0]?.text || "";
    const chev = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    chev.setAttribute("viewBox", "0 0 20 20");
    chev.classList.add("custom-select__chev");
    chev.setAttribute("aria-hidden", "true");
    chev.innerHTML =
      "<polyline points='4 7 10 13 16 7' fill='none' stroke='#eaf6ff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/>";
    btn.appendChild(labelSpan);
    btn.appendChild(chev);
    wrapper.appendChild(btn);
    const list = document.createElement("div");
    list.className = "custom-select__list";
    list.setAttribute("role", "listbox");
    list.setAttribute("tabindex", "-1");
    wrapper.appendChild(list);
    Array.from(sel.options).forEach((opt) => {
      const item = document.createElement("div");
      item.className = "custom-select__item";
      item.setAttribute("role", "option");
      item.setAttribute("data-value", opt.value);
      if (opt.disabled) item.setAttribute("aria-disabled", "true");
      if (opt.selected) item.setAttribute("aria-selected", "true");
      item.textContent = opt.text;
      item.addEventListener("click", () => {
        sel.value = opt.value;
        sel.dispatchEvent(new Event("change", { bubbles: true }));
        labelSpan.textContent = opt.text;
        list
          .querySelectorAll('[role="option"]')
          .forEach((it) => it.removeAttribute("aria-selected"));
        item.setAttribute("aria-selected", "true");
        closeList();
      });
      list.appendChild(item);
    });
    function openList() {
      wrapper.classList.add("open");
      btn.setAttribute("aria-expanded", "true");
      list.style.display = "block";
      const selItem =
        list.querySelector('[aria-selected="true"]') ||
        list.querySelector('[role="option"]');
      if (selItem) selItem.scrollIntoView({ block: "nearest" });
      document.addEventListener("click", outsideListener);
      document.addEventListener("keydown", keydownListener);
    }
    function closeList() {
      wrapper.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
      list.style.display = "none";
      document.removeEventListener("click", outsideListener);
      document.removeEventListener("keydown", keydownListener);
    }
    function toggleList(e) {
      e.stopPropagation();
      const isOpen = wrapper.classList.contains("open");
      if (isOpen) closeList();
      else openList();
    }
    function outsideListener(e) {
      if (!wrapper.contains(e.target)) closeList();
    }
    function keydownListener(e) {
      const items = Array.from(
        list.querySelectorAll('[role="option"]:not([aria-disabled="true"])')
      );
      if (!items.length) return;
      const focused =
        list.querySelector('[data-focus="1"]') ||
        list.querySelector('[aria-selected="true"]') ||
        items[0];
      let idx = items.indexOf(focused);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        idx = Math.min(items.length - 1, Math.max(0, idx + 1));
        updateFocus(items, idx);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        idx = Math.max(0, idx - 1);
        updateFocus(items, idx);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (items[idx]) items[idx].click();
      } else if (e.key === "Escape") {
        closeList();
        btn.focus();
      }
    }
    function updateFocus(items, idx) {
      items.forEach((it) => it.removeAttribute("data-focus"));
      const it = items[idx];
      if (!it) return;
      it.setAttribute("data-focus", "1");
      it.scrollIntoView({ block: "nearest" });
    }
    btn.addEventListener("click", toggleList);
    sel.addEventListener("change", () => {
      const currentOpt = sel.selectedOptions[0];
      labelSpan.textContent = currentOpt?.text || "";
      list
        .querySelectorAll('[role="option"]')
        .forEach((it) => it.removeAttribute("aria-selected"));
      const selectedItem = Array.from(
        list.querySelectorAll('[role="option"]')
      ).find((it) => it.dataset.value === sel.value);
      if (selectedItem) selectedItem.setAttribute("aria-selected", "true");
    });
    list.style.display = "none";
  });
}

document.addEventListener("DOMContentLoaded", () => {
  if (typeof initCustomSelects === "function") initCustomSelects(document);
});

window.addEventListener("load", () => {
  if (typeof initCustomSelects === "function") initCustomSelects(document);
});
