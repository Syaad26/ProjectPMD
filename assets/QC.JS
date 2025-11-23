// ===============================
//   DATA QC
// ===============================
let qcList = [];

const namaInput = document.getElementById("namaInput");
const tanggalInput = document.getElementById("tanggalInput");
const saveBtn = document.getElementById("saveBtn");
const listContainer = document.getElementById("qcList");

// measurement inputs
const bendaNameInput = document.getElementById("bendaNameInput");
const panjangStandar = document.getElementById("panjangStandar");
const panjangToleransi = document.getElementById("panjangToleransi");
const panjangHasil = document.getElementById("panjangHasil");
const lebarStandar = document.getElementById("lebarStandar");
const lebarToleransi = document.getElementById("lebarToleransi");
const lebarHasil = document.getElementById("lebarHasil");
const tinggiStandar = document.getElementById("tinggiStandar");
const tinggiToleransi = document.getElementById("tinggiToleransi");
const tinggiHasil = document.getElementById("tinggiHasil");

// helpers (fokus: ringkas & aman)
const toNum = (v) => {
  if (v === null || v === undefined) return null; // hapus semua karakter selain digit, titik, tanda +/-, dan exponent
  const cleaned = String(v)
    .replace(/[^0-9+\-eE.,]/g, "")
    .replace(",", ".")
    .trim();
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

/**
 * Parse three numeric inputs and return either scaled-integers or raw numbers.
 * - Handles comma as decimal, strips ± and text.
 * - If any value uses exponent notation (e/E) we fallback to Number-based path.
 * - Decimals are scaled up to `maxDecimals` (caps at 8) to perform integer math.
 */
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

  if (!sStr || !tStr || !hStr) return null; // if exponent forms present, fallback to Number arithmetic (still safe)

  if (/[eE]/.test(sStr + tStr + hStr)) {
    const s = Number(sStr),
      t = Number(tStr),
      h = Number(hStr);
    if (![s, t, h].every(Number.isFinite)) return null;
    return { scaled: false, s, t, h, scale: 1 };
  }

  const decimals = (str) => {
    const m = str.match(/\.(\d+)/);
    return m ? m[1].length : 0;
  };
  const dec = Math.min(
    maxDecimals,
    Math.max(decimals(sStr), decimals(tStr), decimals(hStr))
  );
  const scale = Math.pow(10, dec);

  const s = Math.round(Number(sStr) * scale);
  const t = Math.round(Number(tStr) * scale);
  const h = Math.round(Number(hStr) * scale);

  if (![s, t, h].every((n) => Number.isInteger(n))) return null;
  return { scaled: true, s, t, h, scale };
}

function checkPass(std, tol, val) {
  const p = _prepareScaled(std, tol, val);
  if (!p) return null;
  if (!p.scaled) {
    // fallback Number path (inclusive)
    return Math.abs(p.h - p.s) <= Math.abs(p.t);
  }
  const diff = Math.abs(p.h - p.s);
  const absT = Math.abs(p.t);
  return diff <= absT;
}

/**
 * FUNGSI INI SUDAH DIKOREKSI (AKURASI DESIMAL)
 * Menghitung kesesuaian secara proporsional: 100.00% (ideal) hingga 1.00% (batas toleransi).
 * Hasil dikembalikan sebagai Number dengan akurasi 2 desimal.
 */
function percentMatch(std, tol, val) {
  const p = _prepareScaled(std, tol, val);
  if (!p) return null;

  // Definisikan skor minimum untuk komponen yang masih Lolos
  const MIN_SCORE = 1.0;
  const SCORE_RANGE = 100.0 - MIN_SCORE; // Rentang skor proporsional adalah 99.0

  let absT, diff;

  // Fungsi pembulatan ke 2 desimal
  const round2 = (num) => Math.round(num * 100) / 100;

  // --- JALUR 1: STANDARD NUMBER (FLOAT) ARITHMETIC ---
  if (!p.scaled) {
    absT = Math.abs(p.t);
    diff = Math.abs(p.h - p.s);

    if (absT === 0) return diff === 0 ? 100.0 : 0.0;

    if (diff <= absT) {
      const ratio = 1 - diff / absT;
      const score = MIN_SCORE + SCORE_RANGE * ratio;

      return round2(Math.max(MIN_SCORE, score));
    }

    return 0.0;
  }

  // --- JALUR 2: SCALED INTEGER ARITHMETIC (Math Aman) ---
  diff = Math.abs(p.h - p.s);
  absT = Math.abs(p.t);

  if (absT === 0) return diff === 0 ? 100.0 : 0.0;

  if (diff <= absT) {
    const proportionalScore = (SCORE_RANGE * (absT - diff)) / absT;
    const finalScore = MIN_SCORE + proportionalScore;

    return round2(Math.max(MIN_SCORE, Math.min(100.0, finalScore)));
  }

  return 0.0;
}

function partPercent(part) {
  const keys = ["panjang", "lebar", "tinggi"];
  let sum = 0,
    cnt = 0;
  // Fungsi pembulatan ke 2 desimal
  const round2 = (num) => Math.round(num * 100) / 100;

  keys.forEach((k) => {
    const m = (part.measurements && part.measurements[k]) || {};
    const p = percentMatch(m.standar, m.toleransi, m.hasil);
    if (p !== null) {
      sum += p;
      cnt++;
    } else {
      const ok = checkPass(m.standar, m.toleransi, m.hasil);
      if (ok === true) {
        sum += 100.0;
        cnt++;
      } else if (ok === false) {
        sum += 0.0;
        cnt++;
      }
    }
  }); // Pembulatan rata-rata akhir ke 2 desimal
  return cnt ? round2(sum / cnt) : 0.0;
}

// save single-part QC
saveBtn.addEventListener("click", () => {
  const part = {
    benda: bendaNameInput.value || "",
    measurements: {
      panjang: {
        standar: panjangStandar.value,
        toleransi: panjangToleransi.value,
        hasil: panjangHasil.value,
      },
      lebar: {
        standar: lebarStandar.value,
        toleransi: lebarToleransi.value,
        hasil: lebarHasil.value,
      },
      tinggi: {
        standar: tinggiStandar.value,
        toleransi: tinggiToleransi.value,
        hasil: tinggiHasil.value,
      },
    },
  };
  qcList.push({
    nama: namaInput.value || "",
    tanggal: tanggalInput.value || "",
    parts: [part],
  });
  renderList();
  updateDashboardChart(); // reset
  [
    namaInput,
    tanggalInput,
    bendaNameInput,
    panjangStandar,
    panjangToleransi,
    panjangHasil,
    lebarStandar,
    lebarToleransi,
    lebarHasil,
    tinggiStandar,
    tinggiToleransi,
    tinggiHasil,
  ].forEach((el) => el && (el.value = ""));
});

// render list
function renderList() {
  listContainer.innerHTML = "";
  qcList.forEach((item, i) => {
    // Menghitung rata-rata (tanpa pembulatan awal)
    const avg =
      item.parts && item.parts.length
        ? item.parts.reduce((s, p) => s + partPercent(p), 0) / item.parts.length
        : 0.0;

    const div = document.createElement("div");
    div.className = "qc-card";
    div.style.cursor = "pointer";
    // Menggunakan toFixed(2) untuk tampilan 2 desimal
    div.innerHTML = `<h3>QC-${i + 1}</h3><div>Pemeriksa: ${
      item.nama
    }</div><div>Tanggal: ${item.tanggal}</div><div>Kesesuaian: ${avg.toFixed(
      2
    )}%</div>`;
    div.addEventListener("click", () => openModal(item));
    listContainer.appendChild(div);
  });
}

// charts & modal
let dashboardChart = null,
  modalChart = null;

function updateDashboardChart() {
  const labels = qcList.map((_, i) => `QC-${i + 1}`);
  const data = qcList.map((it) =>
    it.parts && it.parts.length
      ? it.parts.reduce((s, p) => s + partPercent(p), 0) / it.parts.length // tidak dibulatkan
      : 0
  );
  const ctx = document.getElementById("qcChart");
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
  const canvas = document.getElementById("modalChart");
  if (!canvas) return;
  const part = (item.parts && item.parts[0]) || null;
  if (!part) return;
  const m = part.measurements || {};
  const data = ["panjang", "lebar", "tinggi"].map((k) => {
    const p = percentMatch(m[k]?.standar, m[k]?.toleransi, m[k]?.hasil);
    // gunakan nilai decimal dari percentMatch, fallback ke 100/0 sesuai checkPass
    return p ?? (checkPass(m[k]?.standar, m[k]?.toleransi, m[k]?.hasil) ? 100 : 0);
  });
  const colors = data.map((v) =>
    v >= 80 ? "#0a9a3f" : v >= 40 ? "#f6b100" : "#d13030"
  );
  if (modalChart) {
    modalChart.destroy();
    modalChart = null;
  }
  modalChart = new Chart(canvas.getContext("2d"), {
    type: "bar",
    data: {
      labels: ["Panjang", "Lebar", "Tinggi"],
      datasets: [{ data, backgroundColor: colors }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, max: 100 } },
    },
  });
}

function openModal(item) {
  document.getElementById("modalKode").textContent = "QC DOCUMENT";
  document.getElementById("modalNama").textContent = item.nama;
  document.getElementById("modalTanggal").textContent = item.tanggal;
  const part = (item.parts && item.parts[0]) || null;
  if (!part) {
    document.getElementById("modalBenda").textContent = "-";
    ["Panjang", "Lebar", "Tinggi"].forEach((_, i) => {
      document.getElementById(
        ["modalPanjang", "modalLebar", "modalTinggi"][i]
      ).textContent = "-";
    });
    document.getElementById("modalDetail").innerHTML =
      "<div>Tidak ada data benda.</div>";
    document.getElementById("qcModal").style.display = "flex";
    return;
  }
  document.getElementById("modalBenda").textContent = part.benda || "";
  const m = part.measurements || {};
  document.getElementById("modalPanjang").textContent = `Std: ${
    m.panjang?.standar || "-"
  } | Tol: ±${m.panjang?.toleransi || "-"} | Hasil: ${m.panjang?.hasil || "-"}`;
  document.getElementById("modalLebar").textContent = `Std: ${
    m.lebar?.standar || "-"
  }   | Tol: ±${m.lebar?.toleransi || "-"}   | Hasil: ${m.lebar?.hasil || "-"}`;
  document.getElementById("modalTinggi").textContent = `Std: ${
    m.tinggi?.standar || "-"
  }  | Tol: ±${m.tinggi?.toleransi || "-"}  | Hasil: ${m.tinggi?.hasil || "-"}`;

  const detailHtml = ["panjang", "lebar", "tinggi"]
    .map((k) => {
      const mm = m[k] || {};
      const ok = checkPass(mm.standar, mm.toleransi, mm.hasil);
      const pct = percentMatch(mm.standar, mm.toleransi, mm.hasil);
      const badge =
        ok === true
          ? `<span class="modal-pass">PASS</span>`
          : ok === false
          ? `<span class="modal-fail">FAIL</span>`
          : `<span style="color:#999">N/A</span>`;
      const pctText =
        pct === null
          ? ok === true
            ? "100.00"
            : ok === false
            ? "0.00"
            : "N/A"
          : `${pct.toFixed(2)}%`;
      return `<div style="margin-bottom:8px;"><b>${
        k.charAt(0).toUpperCase() + k.slice(1)
      }</b><br>Std: ${mm.standar || "-"} | Tol: ±${
        mm.toleransi || "-"
      } | Hasil: ${mm.hasil || "-"} — ${badge} (${pctText})</div>`;
    })
    .join("");
  document.getElementById("modalDetail").innerHTML = detailHtml;
  document.getElementById("qcModal").style.display = "flex";
  renderModalChart(item);
}

function closeModal() {
  document.getElementById("qcModal").style.display = "none";
  if (modalChart) {
    modalChart.destroy();
    modalChart = null;
  }
}
window.closeModal = closeModal;

// init
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
