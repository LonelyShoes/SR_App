# Panduan Uji di Samsung Galaxy A14 5G

Centang setiap butir. Jika ada yang gagal, catat langkah + apa yang terlihat, lalu kirim ke Claude.

## 0. Pasang APK

Ada dua APK di https://expo.dev/accounts/whitesr/projects/sr-app/builds :

| Build | Untuk apa | Butuh laptop? |
|---|---|---|
| **production** | Pemakaian harian & uji 5 hari | Tidak |
| **development** | Mengubah kode dan langsung melihat hasilnya | Ya: `npx expo start` di laptop, HP di Wi-Fi yang sama |

1. Buka tautan build **production** di browser HP → **Install** → unduh APK.
2. Izinkan "Instal aplikasi tidak dikenal" untuk browser bila diminta → pasang.
3. Buka SR App → ikuti layar onboarding (izin notifikasi, alarm, baterai).

## 1. Izin & baterai (Samsung One UI) — lakukan dulu

- [ ] Notifikasi diizinkan.
- [ ] Pengaturan HP → Aplikasi → SR App → Baterai → **Tidak dibatasi**.
- [ ] Pengaturan → Perawatan baterai → Batas penggunaan latar belakang → **matikan** "Tidurkan aplikasi yang tidak digunakan", dan pastikan SR App tidak ada di daftar "Aplikasi tidur".
- [ ] Pengaturan → Aplikasi → SR App → **Alarm & pengingat** diizinkan.

## 2. Timer & alarm (paling penting)

Pakai preset pendek: Timer → ✏️ Atur preset → durasi 1 menit (kembalikan ke 25 setelah selesai).
- [ ] Layar menyala, app terbuka → alarm berbunyi seperti alarm, muncul di atas layar.
- [ ] **Layar mati** → alarm tetap berbunyi tepat waktu.
- [ ] App **ditutup/di-swipe** dari Recent → alarm tetap berbunyi.
- [ ] Mode **hemat daya** aktif → alarm tetap berbunyi.
- [ ] Jeda → lanjut → berhenti bekerja; sesi muncul di Statistik.
- [ ] Widget "Mulai Fokus" memulai timer.

## 3. Pengingat rapat (H-30)

- [ ] Buat rapat 35 menit dari sekarang → notifikasi pengingat muncul 30 menit sebelum (suara notifikasi biasa, bukan alarm).
- [ ] Hapus rapat lain yang punya pengingat → pengingatnya tidak muncul.
- [ ] Pengaturan → Pengingat Rapat → ubah ke 10 menit → pengingat rapat ber-"Default" bergeser.
- [ ] Ketuk notifikasi pengingat → Matrix terbuka dengan rapat itu.

## 4. Matrix, Dashboard, Notula

- [ ] Tambah tugas dengan kuadran, tenggat, catatan; ketuk tugas → edit; hapus.
- [ ] Tambah rapat dengan tanggal, jam, lokasi, peserta, agenda; ketuk rapat → edit jam → pengingat ikut bergeser.
- [ ] Grid 4Q: centang tugas; tahan tugas → pindah kuadran.
- [ ] Dashboard: + Tambah agenda, ketuk agenda untuk edit, ketuk ringkasan 4Q → grid.
- [ ] Tambah/ceklis/hapus tugas; grid 4Q dan Dashboard langsung berubah.
- [ ] Konfirmasi rapat dari Dashboard.
- [ ] Buat notula dari rapat → peserta & agenda terisi otomatis.
- [ ] Action item → **Jadikan tugas** → muncul di Matrix.
- [ ] Tambah lampiran (foto/PDF) → buka → hapus.
- [ ] **Ekspor & Bagikan PDF** → PDF terbuka rapi (selalu tema terang).
- [ ] Simpan notula → konfirmasi status rapat **selesai**.

## 5. Quick Plan suara

Butuh internet dan layanan Google Speech aktif.
- [ ] Tombol 🎤 di tab Notula → izin mikrofon diminta saat pertama kali.
- [ ] Ucapkan "rapat tim besok jam 9" → draft rapat besok 09.00, bisa diedit, baru tersimpan setelah ditekan Simpan.
- [ ] Ucapkan "kirim laporan lusa" → draft tugas.
- [ ] Tanpa internet → pesan error yang jelas, bisa mengetik manual.

## 6. Widget

- [ ] Tahan layar beranda → Widget → SR App → pasang **SR Quick Action** (4×1) dan **SR Dashboard** (4×2).
- [ ] Tiga tombol Quick Action membuka layar yang benar.
- [ ] Tambah/hapus tugas atau rapat → angka di widget Dashboard berubah.
- [ ] Ganti tema HP terang/gelap → widget ikut berubah.

## 7. Tema & tampilan

- [ ] Pengaturan → Tema: Sistem / Terang / Gelap; pilihan tetap setelah app ditutup.
- [ ] Semua layar terbaca baik di tema gelap (Dashboard, Matrix, Notula, Timer, Statistik, Pengaturan, Quick Plan, Pulihkan).
- [ ] Ikon app = logo SR; splash screen sesuai tema HP.

## 8. Sinkronisasi & backup

- [ ] Pengaturan → Akun & Sinkronisasi → Daftar → status **Tersinkron**.
- [ ] Perangkat kedua (HP lain/emulator) dengan akun yang sama → data muncul.
- [ ] Mode pesawat → tambah tugas → status "Offline" → matikan mode pesawat → tersinkron sendiri.
- [ ] Backup → **Backup ke cloud sekarang** → muncul di **Pulihkan dari cloud**.
- [ ] Hapus satu tugas → Pulihkan backup → tugas kembali, dan **tetap ada setelah sinkron**.
- [ ] Ekspor ke file → Impor dari file berhasil.

## 9. Performa

- [ ] Buka app dari kondisi tertutup < 3 detik.
- [ ] Gulir daftar panjang (puluhan tugas) tetap mulus.

## 10. Uji pemakaian harian (minimal 5 hari)

Pakai seperti biasa: timer, pengingat rapat, widget. Catat setiap kejadian aneh (tanggal, jam, apa yang terjadi).

| Hari | Tanggal | Catatan |
|---|---|---|
| 1 | | |
| 2 | | |
| 3 | | |
| 4 | | |
| 5 | | |
