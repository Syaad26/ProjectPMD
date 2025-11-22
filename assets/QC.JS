// ===============================
//   DATA QC
// ===============================
let qcList = [];


// ===============================
//   ELEMEN FORM UTAMA
// ===============================
const namaInput       = document.getElementById("namaInput");
const saveBtn         = document.getElementById("saveBtn");
const tanggalInput    = document.getElementById("tanggalInput");
const listContainer   = document.getElementById("qcList");

// Tambahan: elemen untuk menambah part
const addPartBtn      = document.getElementById("addPartBtn");
const extraParts      = document.getElementById("extraParts");

function createPartNode() {
    const wrapper = document.createElement("div");
    wrapper.className = "extra-part";
    wrapper.style.marginTop = "12px";
    wrapper.innerHTML = `
        <div class="form-group">
            <label>Benda Kerja (tambahan)</label>
            <input type="text" class="bendaKerja" placeholder="Benda kerja" />
        </div>

        <div class="form-group">
            <label>Jenis Proses</label>
            <select class="prosesInput">
                <option>Milling</option>
                <option>Turning</option>
                <option>Grinding</option>
                <option>Inspection Only</option>
            </select>
        </div>

        <div class="form-group">
            <label>Standar</label>
            <input type="text" class="kodeStandar" placeholder="Standar" />
        </div>

        <div class="form-group">
            <label>Toleransi</label>
            <input type="text" class="kodeToleransi" placeholder="Toleransi" />
        </div>

        <div class="form-group">
            <label>Hasil Pemeriksaan</label>
            <input type="text" class="hasilPemeriksaan" placeholder="Hasil" />
        </div>

        <button type="button" class="removePartBtn">Hapus Benda</button>
        <hr />
    `;

    const removeBtn = wrapper.querySelector(".removePartBtn");
    removeBtn.addEventListener("click", () => wrapper.remove());

    return wrapper;
}

addPartBtn.addEventListener("click", () => {
    extraParts.appendChild(createPartNode());
});

// ===============================
//   SIMPAN DATA
// ===============================
saveBtn.addEventListener("click", () => {

    // Ambil nilai dari form utama
    const mainBenda    = document.getElementById("bendaKerja").value;
    const mainProses   = document.getElementById("prosesInput").value;
    const mainStandar  = document.getElementById("kodeStandar").value;
    const mainToleransi= document.getElementById("kodeToleransi").value;
    const mainHasil    = document.getElementById("hasilPemeriksaan").value;

    // Ambil semua part tambahan (jika ada)
    const extraBendaArr     = [...document.querySelectorAll("#extraParts .bendaKerja")].map(e => e.value);
    const extraProsesArr    = [...document.querySelectorAll("#extraParts .prosesInput")].map(e => e.value);
    const extraStandarArr   = [...document.querySelectorAll("#extraParts .kodeStandar")].map(e => e.value);
    const extraToleransiArr = [...document.querySelectorAll("#extraParts .kodeToleransi")].map(e => e.value);
    const extraHasilArr     = [...document.querySelectorAll("#extraParts .hasilPemeriksaan")].map(e => e.value);

    // Gabungkan nilai utama + tambahan
    const bendaArr     = [mainBenda, ...extraBendaArr].filter(v => v !== undefined && v !== "");
    const prosesArr    = [mainProses, ...extraProsesArr].filter(v => v !== undefined && v !== "");
    const standarArr   = [mainStandar, ...extraStandarArr].filter(v => v !== undefined && v !== "");
    const toleransiArr = [mainToleransi, ...extraToleransiArr].filter(v => v !== undefined && v !== "");
    const hasilArr     = [mainHasil, ...extraHasilArr].filter(v => v !== undefined && v !== "");

    // Buat array part (panjang mengikuti bendaArr)
    const parts = bendaArr.map((_, i) => ({
        benda: bendaArr[i] || "",
        proses: prosesArr[i] || "",
        standar: standarArr[i] || "",
        toleransi: toleransiArr[i] || "",
        hasil: hasilArr[i] || ""
    }));

    // Simpan data QC
    const data = {
        nama: namaInput.value,
        tanggal: tanggalInput.value,
        parts: parts
    };

    qcList.push(data);
    renderList();

    // update grafik dashboard
    updateDashboardChart();

    // Reset form utama dan bagian tambahan
    namaInput.value = "";
    tanggalInput.value = "";
    document.getElementById("bendaKerja").value = "";
    document.getElementById("prosesInput").selectedIndex = 0;
    document.getElementById("kodeStandar").value = "";
    document.getElementById("kodeToleransi").value = "";
    document.getElementById("hasilPemeriksaan").value = "";
    document.getElementById("extraParts").innerHTML = "";
});


// ===============================
//   RENDER LIST QC
// ===============================
function renderList() {
    listContainer.innerHTML = "";

    qcList.forEach((item, index) => {
        const div = document.createElement("div");
        div.className = "qc-card";
        div.style.cursor = "pointer";

        div.innerHTML = `
            <h3>QC-${index + 1}</h3>
            <div>Pemeriksa: ${item.nama}</div>
            <div>Tanggal: ${item.tanggal}</div>
            <div>Benda kerja: ${item.parts.length} item</div>
        `;

        div.addEventListener("click", () => openModal(item));
        listContainer.appendChild(div);
    });
}


// ===============================
//   MODAL
// ===============================
let dashboardChartInstance = null;
let modalChartInstance = null;

// Helper: cek apakah part lulus berdasarkan angka (asumsi angka)
// mengembalikan true = lulus, false = gagal, null = tidak bisa dibandingkan (non-numeric)
function checkPartPass(part) {
    const s = parseFloat((part.standar || "").toString().replace(/[^0-9.\-]/g, ""));
    const t = parseFloat((part.toleransi || "").toString().replace(/[^0-9.\-]/g, ""));
    const h = parseFloat((part.hasil || "").toString().replace(/[^0-9.\-]/g, ""));
    if (isNaN(s) || isNaN(t) || isNaN(h)) return null;
    return Math.abs(h - s) <= Math.abs(t);
}

// NEW: hitung persentase kesesuaian untuk satu part
// logika: 100% bila h == s; turun linier sampai 0% saat |h - s| >= |t|
function partMatchPercent(part) {
    const s = parseFloat((part.standar || "").toString().replace(/[^0-9.\-]/g, ""));
    const t = parseFloat((part.toleransi || "").toString().replace(/[^0-9.\-]/g, ""));
    const h = parseFloat((part.hasil || "").toString().replace(/[^0-9.\-]/g, ""));
    if (isNaN(s) || isNaN(t) || isNaN(h) || t === 0) return null;
    const diff = Math.abs(h - s);
    const ratio = Math.max(0, 1 - (diff / Math.abs(t))); // 1..0
    const percent = Math.round(ratio * 100);
    return percent < 0 ? 0 : percent;
}

// Render atau update grafik dashboard (persentase kecocokan per QC)
function updateDashboardChart() {
    const labels = qcList.map((it, i) => `QC-${i+1}`);
    const data = qcList.map(it => {
        const parts = it.parts || [];
        let countComparable = 0;
        let sumPercent = 0;
        parts.forEach(p => {
            const pct = partMatchPercent(p);
            if (pct !== null) { sumPercent += pct; countComparable++; }
            else {
                // fallback: jika tidak numeric, gunakan pass/fail biner
                const ok = checkPartPass(p);
                if (ok === true) { sumPercent += 100; countComparable++; }
                else if (ok === false) { sumPercent += 0; countComparable++; }
            }
        });
        return countComparable === 0 ? 0 : Math.round(sumPercent / countComparable);
    });

    const ctx = document.getElementById("qcChart");
    if (!ctx) return;

    const bg = data.map(v => v >= 80 ? '#0a9a3f' : v >= 40 ? '#f6b100' : '#d13030');

    if (dashboardChartInstance) {
        dashboardChartInstance.data.labels = labels;
        dashboardChartInstance.data.datasets[0].data = data;
        dashboardChartInstance.data.datasets[0].backgroundColor = bg;
        dashboardChartInstance.update();
    } else {
        dashboardChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Kesesuaian (%)',
                    data: data,
                    backgroundColor: bg,
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: { beginAtZero: true, max: 100 }
                },
                plugins: { legend: { display: false } }
            }
        });
    }
}

// Render chart modal per item: satu grafik berisi semua benda (persentase tiap benda)
function renderModalChart(item) {
    const canvas = document.getElementById("modalChart");
    if (!canvas) return;

    const labels = item.parts.map((p, i) => `Benda ${i+1}`);
    const data = item.parts.map(p => {
        const pct = partMatchPercent(p);
        if (pct === null) {
            // gunakan checkPartPass sebagai fallback: PASS => 100, FAIL => 0, else 0
            const ok = checkPartPass(p);
            if (ok === true) return 100;
            if (ok === false) return 0;
            return 0;
        }
        return pct;
    });

    const colors = data.map(v => v >= 80 ? '#0a9a3f' : v >= 40 ? '#f6b100' : '#d13030');

    if (modalChartInstance) {
        modalChartInstance.destroy();
        modalChartInstance = null;
    }

    modalChartInstance = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Kesesuaian (%) per Benda',
                data: data,
                backgroundColor: colors
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: { beginAtZero: true, max: 100 }
            },
            plugins: { legend: { display: false } }
        }
    });
}

// Update openModal untuk menampilkan indikator pass/fail di detail dan chart
function openModal(item) {
    document.getElementById("modalKode").textContent = "QC DOCUMENT";
    document.getElementById("modalNama").textContent = item.nama;
    document.getElementById("modalProses").textContent = item.parts.map(p => p.proses).join(", ");
    document.getElementById("modalStandar").textContent = item.parts.map(p => p.standar).join(", ");
    document.getElementById("modalToleransi").textContent = item.parts.map(p => p.toleransi).join(", ");
    document.getElementById("modalHasil").textContent = item.parts.map(p => p.hasil).join(", ");
    document.getElementById("modalTanggal").textContent = item.tanggal;

    // detail dengan indikator
    document.getElementById("modalDetail").innerHTML = item.parts.map((p,i)=> {
        const ok = checkPartPass(p);
        const badge = ok === true ? `<span class="modal-pass">PASS</span>` :
                      ok === false ? `<span class="modal-fail">FAIL</span>` :
                      `<span style="color:#666">N/A</span>`;
        return `
            <div style="margin-bottom:8px;">
                <b>Benda ${i+1}</b><br>
                Benda: ${p.benda}<br>
                Proses: ${p.proses}<br>
                Standar: ${p.standar} | Toleransi: ${p.toleransi} | Hasil: ${p.hasil} ${badge}
            </div>
        `;
    }).join("");

    document.getElementById("qcModal").style.display = "flex";

    // render chart modal
    renderModalChart(item);
}

// closeModal juga hapus modalChartInstance
function closeModal() {
    document.getElementById("qcModal").style.display = "none";
    if (modalChartInstance) {
        modalChartInstance.destroy();
        modalChartInstance = null;
    }
}

window.closeModal = closeModal;

// Panggil update dashboard saat inisialisasi (kosong) dan setiap kali data berubah
updateDashboardChart();
