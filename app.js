/* DompetKu - versi offline/demo.
   Data disimpan di localStorage browser. Ini BUKAN database produksi.
   Versi lengkap dengan backend dan MySQL ada di folder dompetku/. */

(() => {
  'use strict';

  const DB_KEY = 'dompetku_offline_v1';
  const TZ = 'Asia/Jakarta';

  const DEFAULT_CATEGORIES = {
    income: ['Gaji', 'Uang Saku', 'Bisnis', 'Hadiah', 'Investasi / Pendapatan Lain'],
    expense: ['Makanan & Minuman', 'Transportasi', 'Pendidikan', 'Tagihan', 'Belanja', 'Kesehatan', 'Hiburan', 'Tabungan', 'Lainnya'],
  };

  // ---------- Penyimpanan ----------
  function loadDB() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) { /* data rusak: mulai baru */ }
    const db = { users: [], session: null, nextId: 1, transactions: [], categories: [] };
    let id = 1;
    for (const [type, names] of Object.entries(DEFAULT_CATEGORIES)) {
      for (const name of names) db.categories.push({ id: id++, userId: null, name, type });
    }
    db.nextId = id;
    return db;
  }

  let db = loadDB();

  function saveDB() {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  }

  function newId() {
    return db.nextId++;
  }

  // ---------- Utilitas ----------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function rupiah(n) {
    return 'Rp' + Math.round(Number(n) || 0).toLocaleString('id-ID');
  }

  function todayJakarta() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  }

  function formatDate(iso) {
    const [y, m, d] = iso.split('-');
    return `${d}-${m}-${y}`;
  }

  function monthOf(iso) { return iso.slice(0, 7); }

  function toast(message, isError = false) {
    const el = $('#toast');
    el.textContent = message;
    el.className = 'toast' + (isError ? ' error' : '');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.add('hidden'), 2800);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // Hash sandi dengan SHA-256 + salt acak. (Di versi backend memakai bcrypt Laravel.)
  async function hashPassword(password, salt) {
    if (!window.crypto || !crypto.subtle) throw new Error('Browser ini tidak mendukung enkripsi sandi. Gunakan Chrome/Edge/Firefox terbaru.');
    const data = new TextEncoder().encode(salt + password);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  function randomSalt() {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // ---------- Sesi & data pengguna ----------
  function currentUser() {
    return db.users.find((u) => u.id === db.session) || null;
  }

  function userTx() {
    const u = currentUser();
    return u ? db.transactions.filter((t) => t.userId === u.id) : [];
  }

  function userCategories(type) {
    const u = currentUser();
    return db.categories.filter((c) => (c.userId === null || (u && c.userId === u.id)) && (!type || c.type === type));
  }

  function categoryName(id) {
    const c = db.categories.find((x) => x.id === id);
    return c ? c.name : '-';
  }

  function totals(list) {
    let income = 0, expense = 0;
    for (const t of list) {
      if (t.type === 'income') income += t.amount; else expense += t.amount;
    }
    return { income, expense, diff: income - expense };
  }

  // Saldo saat ini = saldo awal + seluruh pemasukan - seluruh pengeluaran
  function currentBalance() {
    const u = currentUser();
    const { income, expense } = totals(userTx());
    return (u ? u.opening : 0) + income - expense;
  }

  // ---------- Pindah halaman ----------
  function showAuth(mode) {
    $('#auth-view').classList.remove('hidden');
    $('#app-view').classList.add('hidden');
    $('#login-form').classList.toggle('hidden', mode !== 'login');
    $('#register-form').classList.toggle('hidden', mode !== 'register');
    $$('.error').forEach((e) => (e.textContent = ''));
  }

  function showApp() {
    $('#auth-view').classList.add('hidden');
    $('#app-view').classList.remove('hidden');
    const now = new Date();
    $('#rep-month').value = todayJakarta().slice(0, 7);
    $('#rep-year').value = todayJakarta().slice(0, 4);
    $('#rep-from').value = todayJakarta().slice(0, 8) + '01';
    $('#rep-to').value = todayJakarta();
    void now;
    switchTab('dashboard');
    renderAll();
  }

  function switchTab(name) {
    $$('.tab').forEach((t) => t.classList.add('hidden'));
    $('#tab-' + name).classList.remove('hidden');
    $$('.bottom-nav button').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
    $('#fab').classList.toggle('hidden', name === 'profile');
    window.scrollTo(0, 0);
    renderAll();
  }

  function activeTab() {
    const b = $('.bottom-nav button.active');
    return b ? b.dataset.tab : 'dashboard';
  }

  // ---------- Render ----------
  function renderAll() {
    const u = currentUser();
    if (!u) return;
    renderDashboard();
    const tab = activeTab();
    if (tab === 'transactions') renderTransactions();
    if (tab === 'reports') renderReports();
    if (tab === 'profile') renderProfile();
  }

  function txItemHtml(t, withActions) {
    const sign = t.type === 'income' ? '+' : '-';
    const actions = withActions
      ? `<div class="tx-actions"><button data-edit="${t.id}">Edit</button><button class="btn-danger" data-del="${t.id}">Hapus</button></div>`
      : '';
    return `<li>
      <div class="tx-info">
        <div class="title">${escapeHtml(categoryName(t.categoryId))}${t.note ? ' · ' + escapeHtml(t.note) : ''}</div>
        <div class="muted small">${formatDate(t.date)}</div>
        ${actions}
      </div>
      <div class="tx-amount ${t.type}">${sign}${rupiah(t.amount)}</div>
    </li>`;
  }

  function renderDashboard() {
    const u = currentUser();
    $('#greeting').textContent = 'Halo, ' + u.name + ' · saldo awal ' + rupiah(u.opening);
    $('#balance').textContent = rupiah(currentBalance());

    const month = todayJakarta().slice(0, 7);
    const mt = totals(userTx().filter((t) => monthOf(t.date) === month));
    $('#month-income').textContent = rupiah(mt.income);
    $('#month-expense').textContent = rupiah(mt.expense);
    $('#month-diff').textContent = rupiah(mt.diff);
    $('#month-diff').style.color = mt.diff >= 0 ? 'var(--income)' : 'var(--expense)';

    renderTrend();

    // Pengeluaran per kategori bulan ini
    const byCat = {};
    for (const t of userTx()) {
      if (t.type === 'expense' && monthOf(t.date) === month) {
        byCat[t.categoryId] = (byCat[t.categoryId] || 0) + t.amount;
      }
    }
    const entries = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    const max = entries.length ? entries[0][1] : 1;
    $('#category-bars').innerHTML = entries.length
      ? entries.map(([id, amt]) => `
          <div class="bar-row">
            <div class="bar-label"><span>${escapeHtml(categoryName(Number(id)))}</span><span>${rupiah(amt)}</span></div>
            <div class="bar-track"><div class="bar-fill" style="width:${Math.round((amt / max) * 100)}%"></div></div>
          </div>`).join('')
      : '<p class="muted">Belum ada pengeluaran bulan ini.</p>';

    const recent = [...userTx()].sort(sortNewest).slice(0, 5);
    $('#recent-list').innerHTML = recent.length
      ? recent.map((t) => txItemHtml(t, false)).join('')
      : '<li class="muted">Belum ada transaksi. Tekan tombol + untuk mulai.</li>';
  }

  function sortNewest(a, b) {
    return b.date.localeCompare(a.date) || b.id - a.id;
  }

  function renderTransactions() {
    const q = $('#tx-search').value.trim().toLowerCase();
    const type = $('#tx-type').value;
    const order = $('#tx-sort').value;

    let list = userTx().filter((t) => {
      if (type && t.type !== type) return false;
      if (q) {
        const hay = (categoryName(t.categoryId) + ' ' + (t.note || '')).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    list.sort(order === 'asc' ? (a, b) => a.date.localeCompare(b.date) || a.id - b.id : sortNewest);

    $('#tx-list').innerHTML = list.map((t) => txItemHtml(t, true)).join('');
    $('#tx-empty').classList.toggle('hidden', list.length > 0);
  }

  function renderReports() {
    const list = filteredReportTx();
    const t = totals(list);
    $('#rep-income').textContent = rupiah(t.income);
    $('#rep-expense').textContent = rupiah(t.expense);
    $('#rep-diff').textContent = rupiah(t.diff);
    $('#rep-diff').style.color = t.diff >= 0 ? 'var(--income)' : 'var(--expense)';

    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
    $('#rep-body').innerHTML = sorted.map((x) => `<tr>
        <td>${formatDate(x.date)}</td>
        <td>${x.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}</td>
        <td>${escapeHtml(categoryName(x.categoryId))}</td>
        <td>${escapeHtml(x.note || '')}</td>
        <td class="num">${rupiah(x.amount)}</td></tr>`).join('');
    $('#rep-empty').classList.toggle('hidden', sorted.length > 0);

    renderTrend();
  }

  function reportRange() {
    const period = $('#rep-period').value;
    if (period === 'month') {
      const m = $('#rep-month').value || todayJakarta().slice(0, 7);
      const [y, mo] = m.split('-').map(Number);
      const last = new Date(y, mo, 0).getDate();
      return { from: `${y}-${String(mo).padStart(2, '0')}-01`, to: `${y}-${String(mo).padStart(2, '0')}-${String(last).padStart(2, '0')}`, label: m };
    }
    if (period === 'year') {
      const y = $('#rep-year').value || todayJakarta().slice(0, 4);
      return { from: `${y}-01-01`, to: `${y}-12-31`, label: y };
    }
    const from = $('#rep-from').value, to = $('#rep-to').value;
    return { from, to, label: `${from} s/d ${to}` };
  }

  function filteredReportTx() {
    const { from, to } = reportRange();
    if (!from || !to) return [];
    return userTx().filter((t) => t.date >= from && t.date <= to);
  }

  function renderTrend() {
    const now = todayJakarta().slice(0, 7);
    const [y, m] = now.split('-').map(Number);
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(y, m - 1 - i, 1));
      months.push(d.toISOString().slice(0, 7));
    }
    const data = months.map((mo) => ({ mo, ...totals(userTx().filter((t) => monthOf(t.date) === mo)) }));
    const max = Math.max(1, ...data.flatMap((d) => [d.income, d.expense]));
    const chart = `<div class="trend" role="img" aria-label="Grafik batang pemasukan dan pengeluaran selama enam bulan terakhir">${data.map((d) => `
        <div class="trend-col" title="Pemasukan ${rupiah(d.income)} · Pengeluaran ${rupiah(d.expense)}">
          <div class="trend-pair">
            <span class="i" style="height:${(d.income / max) * 120}px"></span>
            <span class="e" style="height:${(d.expense / max) * 120}px"></span>
          </div>
          <small>${d.mo.slice(5)}/${d.mo.slice(2, 4)}</small>
        </div>`).join('')}</div>
      <p class="muted small"><span style="color:var(--income)">■</span> Pemasukan &nbsp; <span style="color:var(--expense)">■</span> Pengeluaran</p>`;
    $('#dashboard-trend-bars').innerHTML = chart;
    $('#trend-bars').innerHTML = chart;
  }

  function renderProfile() {
    const u = currentUser();
    $('#profile-name').textContent = u.name;
    $('#profile-email').textContent = u.email;
    $('#profile-opening').value = u.opening;
    renderCategoryList();
  }

  function renderCategoryList() {
    const u = currentUser();
    const mine = db.categories.filter((c) => c.userId === u.id);
    const builtin = db.categories.filter((c) => c.userId === null);
    $('#cat-list').innerHTML = [...builtin.map((c) => catHtml(c, false)), ...mine.map((c) => catHtml(c, true))].join('');
  }

  function catHtml(c, deletable) {
    const used = db.transactions.some((t) => t.categoryId === c.id);
    return `<li><div><div class="title">${escapeHtml(c.name)}</div>
      <div class="muted small">${c.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}${c.userId === null ? ' · bawaan' : ''}</div></div>
      ${deletable && !used ? `<button class="btn-danger" data-delcat="${c.id}">Hapus</button>` : (deletable ? '<span class="muted small">dipakai</span>' : '')}</li>`;
  }

  // ---------- Transaksi (tambah / edit) ----------
  let editingId = null;

  function openTxDialog(tx) {
    editingId = tx ? tx.id : null;
    const form = $('#tx-form');
    form.reset();
    $('#tx-dialog-title').textContent = tx ? 'Edit transaksi' : 'Tambah transaksi';
    setTxType(form, tx ? tx.type : 'expense');
    form.elements.amount.value = tx ? tx.amount : '';
    form.elements.date.value = tx ? tx.date : todayJakarta();
    form.elements.note.value = tx ? (tx.note || '') : '';
    fillCategoryOptions(getTxType(form), tx ? tx.categoryId : null);
    $('[data-for="tx"]').textContent = '';
    $('#tx-dialog').showModal();
  }

  function getTxType(form) {
    const checked = form.querySelector('input[name="type"]:checked');
    return checked ? checked.value : 'expense';
  }

  function setTxType(form, type) {
    const radio = form.querySelector(`input[name="type"][value="${type}"]`);
    if (radio) radio.checked = true;
  }

  function fillCategoryOptions(type, selectedId) {
    const select = $('#tx-form').elements.category;
    select.innerHTML = userCategories(type).map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    if (selectedId) select.value = String(selectedId);
  }

  function validateTx(form) {
    const amount = Number(form.elements.amount.value);
    const date = form.elements.date.value;
    const note = form.elements.note.value.trim();
    const categoryId = Number(form.elements.category.value);
    const type = getTxType(form);

    if (!Number.isInteger(amount) || amount <= 0) return 'Nominal harus berupa bilangan bulat lebih dari 0.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) return 'Tanggal tidak valid.';
    if (note.length > 255) return 'Catatan maksimal 255 karakter.';
    const cat = userCategories(type).find((c) => c.id === categoryId);
    if (!cat) return 'Kategori tidak valid untuk jenis transaksi ini.';
    return { type, amount, date, note, categoryId };
  }

  // ---------- Ekspor CSV (dibuka di Excel) ----------
  function exportCsv() {
    const { from, to, label } = reportRange();
    const u = currentUser();
    const list = filteredReportTx().sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
    if (!list.length) return toast('Belum ada transaksi pada periode ini.', true);

    const t = totals(list);
    const rows = [
      ['DompetKu - Laporan Keuangan'],
      ['Nama pengguna', u.name],
      ['Periode', label, from, to],
      [],
      ['Tanggal', 'Jenis', 'Kategori', 'Keterangan', 'Pemasukan', 'Pengeluaran'],
      ...list.map((x) => [
        formatDate(x.date),
        x.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
        categoryName(x.categoryId),
        x.note || '',
        x.type === 'income' ? x.amount : '',
        x.type === 'expense' ? x.amount : '',
      ]),
      [],
      ['', '', '', 'Total pemasukan', t.income],
      ['', '', '', 'Total pengeluaran', t.expense],
      ['', '', '', 'Selisih', t.diff],
    ];
    const esc = (v) => {
      const s = String(v);
      return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const csv = '\uFEFF' + rows.map((r) => r.map(esc).join(';')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `DompetKu_Laporan_${label.replace(/[^0-9A-Za-z_-]+/g, '_')}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('File laporan berhasil diunduh.');
  }

  // ---------- Event ----------
  document.addEventListener('click', (e) => {
    const sw = e.target.closest('[data-switch]');
    if (sw) { e.preventDefault(); showAuth(sw.dataset.switch); return; }

    const tabBtn = e.target.closest('.bottom-nav button');
    if (tabBtn) { switchTab(tabBtn.dataset.tab); return; }

    const edit = e.target.closest('[data-edit]');
    if (edit) {
      const tx = db.transactions.find((t) => t.id === Number(edit.dataset.edit));
      if (tx) openTxDialog(tx);
      return;
    }

    const del = e.target.closest('[data-del]');
    if (del) {
      if (!confirm('Hapus transaksi ini? Tindakan ini tidak dapat dibatalkan.')) return;
      db.transactions = db.transactions.filter((t) => t.id !== Number(del.dataset.del));
      saveDB();
      renderAll();
      toast('Transaksi dihapus.');
      return;
    }

    const delCat = e.target.closest('[data-delcat]');
    if (delCat) {
      const id = Number(delCat.dataset.delcat);
      if (db.transactions.some((t) => t.categoryId === id)) return toast('Kategori masih dipakai transaksi.', true);
      if (!confirm('Hapus kategori ini?')) return;
      db.categories = db.categories.filter((c) => c.id !== id);
      saveDB();
      renderCategoryList();
      toast('Kategori dihapus.');
    }
  });

  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const email = f.elements.email.value.trim().toLowerCase();
    const password = f.elements.password.value;
    const user = db.users.find((u) => u.email === email);
    // Pesan sama untuk email salah maupun password salah
    const hash = user ? await hashPassword(password, user.salt) : null;
    if (!user || hash !== user.hash) {
      $('[data-for="login"]').textContent = 'Email atau password salah.';
      return;
    }
    db.session = user.id;
    saveDB();
    f.reset();
    showApp();
  });

  $('#register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const err = $('[data-for="register"]');
    const name = f.elements.name.value.trim();
    const email = f.elements.email.value.trim().toLowerCase();
    const password = f.elements.password.value;
    const opening = Number(f.elements.opening.value || 0);

    if (password.length < 8) return (err.textContent = 'Password minimal 8 karakter.');
    if (password !== f.elements.confirm.value) return (err.textContent = 'Konfirmasi password tidak cocok.');
    if (!Number.isInteger(opening) || opening < 0) return (err.textContent = 'Saldo awal harus angka bulat dan tidak negatif.');
    if (db.users.some((u) => u.email === email)) return (err.textContent = 'Email sudah terdaftar.');

    const salt = randomSalt();
    const user = { id: newId(), name, email, salt, hash: await hashPassword(password, salt), opening };
    db.users.push(user);
    db.session = user.id;
    saveDB();
    f.reset();
    showApp();
    toast('Akun berhasil dibuat. Selamat datang!');
  });

  $('#logout-btn').addEventListener('click', () => {
    db.session = null;
    saveDB();
    showAuth('login');
    toast('Anda sudah keluar.');
  });

  $('#fab').addEventListener('click', () => openTxDialog(null));

  $('#tx-form').addEventListener('change', (e) => {
    if (e.target.name === 'type') fillCategoryOptions(getTxType($('#tx-form')), null);
  });

  $('#tx-cancel').addEventListener('click', () => $('#tx-dialog').close());

  $('#tx-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.target;
    const result = validateTx(form);
    if (typeof result === 'string') {
      $('[data-for="tx"]').textContent = result;
      return;
    }
    const u = currentUser();
    if (editingId) {
      const tx = db.transactions.find((t) => t.id === editingId && t.userId === u.id);
      if (!tx) return toast('Transaksi tidak ditemukan.', true);
      Object.assign(tx, { type: result.type, amount: result.amount, date: result.date, note: result.note, categoryId: result.categoryId, updatedAt: Date.now() });
      toast('Transaksi diperbarui.');
    } else {
      db.transactions.push({ id: newId(), userId: u.id, ...result, createdAt: Date.now(), updatedAt: Date.now() });
      toast('Transaksi disimpan.');
    }
    saveDB();
    $('#tx-dialog').close();
    renderAll();
  });

  $('#tx-search').addEventListener('input', renderTransactions);
  $('#tx-type').addEventListener('change', renderTransactions);
  $('#tx-sort').addEventListener('change', renderTransactions);

  ['#rep-period', '#rep-month', '#rep-year', '#rep-from', '#rep-to'].forEach((sel) =>
    $(sel).addEventListener('change', () => {
      $('#rep-month').classList.toggle('hidden', $('#rep-period').value !== 'month');
      $('#rep-year').classList.toggle('hidden', $('#rep-period').value !== 'year');
      $('#rep-range').classList.toggle('hidden', $('#rep-period').value !== 'range');
      renderReports();
    }));
  $('#rep-period').dispatchEvent(new Event('change'));

  $('#export-btn').addEventListener('click', exportCsv);

  $('#save-opening').addEventListener('click', () => {
    const val = Number($('#profile-opening').value);
    if (!Number.isInteger(val) || val < 0) return toast('Saldo awal harus angka bulat dan tidak negatif.', true);
    currentUser().opening = val;
    saveDB();
    renderAll();
    toast('Saldo awal disimpan.');
  });

  $('#cat-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#cat-name').value.trim();
    const type = $('#cat-type').value;
    if (!name || name.length > 50) return toast('Nama kategori 1 sampai 50 karakter.', true);
    const u = currentUser();
    if (db.categories.some((c) => c.name.toLowerCase() === name.toLowerCase() && c.type === type && (c.userId === null || c.userId === u.id))) {
      return toast('Kategori tersebut sudah ada.', true);
    }
    db.categories.push({ id: newId(), userId: u.id, name, type });
    saveDB();
    e.target.reset();
    renderCategoryList();
    toast('Kategori ditambahkan.');
  });

  // Mulai aplikasi
  if (currentUser()) showApp(); else showAuth('login');
})();
