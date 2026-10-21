# DompetKu - Versi Offline (HTML, CSS, JavaScript)

Versi ini berjalan langsung di browser tanpa server, tanpa Laravel, tanpa MySQL.

## Cara menjalankan
1. Ekstrak folder ini.
2. Buka `index.html` dengan Chrome, Edge, atau Firefox (klik dua kali).
3. Daftar akun baru, lalu mulai mencatat.

Untuk dibuka dari HP: unggah ketiga file (`index.html`, `style.css`, `app.js`) ke hosting statis, atau jalankan `python3 -m http.server 8080` di folder ini dan buka alamat IP komputer di HP yang satu Wi-Fi. Catatan: fitur enkripsi sandi butuh browser modern.

## Fitur
- Daftar, masuk, keluar (dengan sandi di-hash SHA-256 + salt acak)
- Dashboard: saldo saat ini, pemasukan dan pengeluaran bulan ini, selisih, grafik pemasukan dan pengeluaran per bulan selama 6 bulan terakhir, grafik kategori
- Tambah, edit, hapus transaksi (hapus dengan konfirmasi)
- Cari, filter jenis, urutkan terbaru atau terlama
- Laporan bulanan, tahunan, atau rentang tanggal, dengan grafik tren 6 bulan dan tabel rincian
- Ekspor laporan ke file CSV yang dapat dibuka di Excel
- Kategori bawaan dan kategori pribadi
- Saldo awal dihitung sekali. Saldo = saldo awal + pemasukan - pengeluaran.

## Batasan penting (baca)
- Data hanya tersimpan di browser perangkat itu (localStorage). Menghapus data browser akan menghapus semua catatan. Tidak ada sinkronisasi antara laptop dan HP.
- Ini bukan sistem produksi. Tidak ada server, sehingga tidak ada isolasi data yang diverifikasi server, tidak ada backup, dan tidak ada pembatasan percobaan login.
- Ekspor berupa CSV, bukan .xlsx asli. Jika kolom tampil menyatu di Excel, gunakan Data > From Text/CSV dan pilih pemisah titik koma (;).
- Tidak memenuhi spesifikasi arsitektur (backend, MySQL, token). Versi lengkap ada di folder `dompetku/`.
