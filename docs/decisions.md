# Keputusan Teknis

## 1. Timer Alarm: Notification Channel vs Native Module

**Tanggal:** 2026-10-11
**Keputusan:** Menggunakan `expo-notifications` dengan Android Notification Channel `timer-alarm` (importance MAX, bypassDnd: true).

**Alasan:**
- `expo-notifications` channel dengan `AndroidImportance.MAX` dan `bypassDnd: true` sudah cukup untuk menampilkan notifikasi bertipe alarm (heads-up notification, muncul di lockscreen, berbunyi).
- Notification channel MAX pada Android secara otomatis menggunakan perilaku heads-up notification yang muncul di atas layar lain.
- Belum diperlukan full-screen intent atau native module karena channel MAX sudah memadai untuk kebutuhan timer alarm.
- Jika saat pengujian di Samsung Galaxy A14 5G notifikasi tidak berbunyi saat layar mati atau app di-swipe, akan dipertimbangkan pembuatan native module via Expo Modules API untuk full-screen alarm intent.

**Risiko:**
- Samsung/One UI mungkin membatasi notifikasi di background. Mitigasi: onboarding screen memandu pengguna untuk menonaktifkan battery optimization.
- `bypassDnd` hanya berlaku jika pengguna mengizinkan channel untuk melewati DND.

## 2. Timer Accuracy: end_at Timestamp Approach

**Tanggal:** 2026-10-11
**Keputusan:** Timer menggunakan pendekatan `end_at` timestamp, bukan `setInterval` sebagai sumber waktu.

**Alasan:**
- `setInterval` / `setTimeout` di JavaScript tidak akurat karena event loop dan throttling saat app di-background.
- Dengan menyimpan `end_at = now + duration`, sisa waktu dihitung sebagai `end_at - Date.now()` setiap tick.
- Notifikasi alarm dijadwalkan menggunakan `scheduleNotificationAsync` dengan trigger `DATE` pada `end_at`, sehingga alarm tetap berbunyi bahkan jika app tertidur.
- Tick UI (setiap 200ms) hanya untuk menampilkan countdown, bukan sebagai sumber waktu.

## 3. Meeting Reminder Reconciliation

**Tanggal:** 2026-10-11
**Keputusan:** Menggunakan pendekatan "cancel-all then re-schedule" saat rekonsiliasi.

**Alasan:**
- Lebih sederhana dan lebih aman daripada melacak individual notification IDs.
- Dijalankan saat: app dibuka, setelah sync, saat data rapat berubah.
- Mencegah notifikasi ganda atau notifikasi orphan dari rapat yang sudah dihapus/dibatalkan.

## 4. Route Notula Memakai ID Rapat

**Tanggal:** 2026-10-11
**Keputusan:** `app/notula/[id].tsx` menerima **ID rapat**, bukan ID notula.

**Alasan:**
- Satu rapat paling banyak punya satu notula aktif, jadi ID rapat cukup untuk membuka atau membuat notula.
- "Buat notula dari rapat" (Matrix dan tab Notula) cukup memakai satu route tanpa membuat baris kosong lebih dulu.
- Action item yang diubah jadi tugas langsung menyimpan notula, supaya tautan `task_id` tidak hilang dan tidak ada tugas ganda.

## 5. Live Query: Change Listener SQLite

**Tanggal:** 2026-10-11
**Keputusan:** Database dibuka dengan `openDatabaseSync('srapp.db', { enableChangeListener: true })`, dan query join memakai `useTablesVersion` sebagai deps `useLiveQuery`.

**Alasan:**
- `useLiveQuery` drizzle bergantung pada `addDatabaseChangeListener`, yang hanya aktif jika `enableChangeListener` bernilai true (default false). Tanpa itu, layar tidak pernah refresh setelah data ditulis.
- `useLiveQuery` hanya memantau tabel utama (FROM). Daftar notula join `minutes` + `meetings`, sehingga butuh pemicu refresh untuk kedua tabel.

## 6. Aturan Parser Quick Plan untuk Frasa Ambigu

**Tanggal:** 2026-10-11
**Keputusan:** `src/lib/date-parser-id.ts` memakai aturan berikut untuk frasa yang ambigu. Semua hasil tetap bisa diedit di layar konfirmasi sebelum disimpan.

- **Nama hari tanpa "depan"** (mis. "Rabu") = kemunculan berikutnya **setelah** hari ini (1–7 hari). Hari ini cukup diucapkan dengan "hari ini".
- **"<hari> depan"** = hari itu di **minggu kalender berikutnya** (minggu dimulai Senin).
- **"minggu depan"** tanpa "hari" = Senin minggu berikutnya. "Hari Minggu depan" = hari Minggu minggu berikutnya.
- **Jam 1–5 tanpa pagi/siang/sore/malam** dibaca sebagai siang/sore (13.00–17.00), karena konteksnya jam kerja. "Setengah 1" = 12.30.
- **Jam tanpa hari yang sudah lewat** pindah ke besok.
- **"Besok pagi/siang/sore/malam" tanpa jam** memakai jam default 08.00 / 12.00 / 15.00 / 19.00.
- **Tanggal yang sudah lewat** pindah ke bulan berikutnya (atau tahun berikutnya bila bulan disebut).
- Angka dalam kata (mis. "jam tiga", "setengah delapan") didukung karena pengenal suara kadang menuliskannya sebagai kata.

## 7. Lampiran Notula

**Tanggal:** 2026-10-11
**Keputusan:** `expo-document-picker` dipakai untuk memilih file (disetujui pengguna). File langsung disalin ke `Paths.document/attachments/` dengan `expo-file-system`.

**Alasan:**
- Salinan cache dari picker bisa dihapus OS, jadi file dipindahkan ke penyimpanan permanen aplikasi.
- `File.pickFileAsync` bawaan `expo-file-system` di Android mengembalikan URI `content://` (SAF). Perilaku penyalinannya belum terverifikasi, jadi dipakai picker yang menghasilkan `file://`.
- Perubahan lampiran langsung menyimpan notula, karena file di disk sudah disalin atau dihapus saat itu juga.
- Lampiran dibuka atau dikirim lewat share sheet (`expo-sharing`), tanpa dependency viewer tambahan.
- Sesuai spec, hanya metadata yang nanti di-sync. Unggah file ke Supabase Storage menyusul (TODO Fase 8).

## 8. Widget Android

**Tanggal:** 2026-10-11
**Keputusan:** Dua widget `react-native-android-widget`, yaitu `QuickAction` (4×1) dan `Dashboard` (4×2). Task handler didaftarkan di entry `index.ts` (`package.json` `main`), lalu `expo-router/entry` dimuat lebih dulu.

**Alasan dan detail:**
- **Deep link** memakai scheme `srapp://` dengan `OPEN_URI`, sehingga klik ditangani native tanpa menjalankan JS:
  - Tugas Baru → `srapp://matrix?baru=tugas` (sheet tugas baru terbuka)
  - Quick Plan → `srapp://modals/quick-plan`
  - Mulai Fokus → `srapp://timer?mulai=fokus` (memulai preset Fokus bila timer sedang idle)
  - Ketuk widget Dashboard → `srapp://`
- **Tema:** widget dirender dalam varian `{ light, dark }` dari tokens aplikasi, dan Android memilih varian sesuai tema sistem.
- **Pembaruan data:** listener `addDatabaseChangeListener` pada tabel `tasks` dan `meetings` (debounce 1 detik) memanggil `requestWidgetUpdate` saat app hidup. Pembaruan berkala memakai `updatePeriodMillis` 30 menit, yang merupakan batas minimum Android.
- **Data widget:** `summarizeDashboard` memakai aturan yang sama dengan briefing Dashboard. Di headless task, bila DB belum siap (app belum pernah dibuka), widget menampilkan angka nol.

## 9. Statistik: SQL Teragregasi + Chart dari View

**Tanggal:** 2026-10-11
**Keputusan:**
- Semua angka statistik dihitung dengan query SQL teragregasi (`src/features/stats/sql.ts`). JS hanya mengolah hasil yang sudah kecil, yaitu paling banyak 90 baris per hari atau 24 baris per jam.
- Pengelompokan per hari dan per jam lokal memakai offset UTC perangkat, `date(ms/1000 + tz, 'unixepoch')`. Cara ini tidak bergantung pada `'localtime'` SQLite di Android. Indonesia tidak memakai DST, jadi offset tetap dan aman.
- Query disimpan sebagai string murni, sehingga query yang sama diuji di Jest dengan `node:sqlite` memakai migrasi Drizzle asli.
- Chart dibuat dari `View` (`src/components/BarChart.tsx`), tanpa `react-native-svg` atau `react-native-gifted-charts`. Semua chart berbentuk batang, dan warnanya diambil dari tokens tema.
- Tampilan 90 hari dikelompokkan per minggu agar batang tetap terbaca di layar ponsel.
- Streak dihitung dari seluruh riwayat (tidak ikut filter periode), dan tetap berjalan sampai akhir hari ini walaupun hari ini belum ada sesi.

## 10. Preset Timer Bawaan dengan ID Tetap

**Tanggal:** 2026-10-11
**Keputusan:** Preset bawaan memakai ID tetap (`default-fokus`, `default-rehat`, `default-santai`) dengan `updated_at = 0` dan `dirty = 0`. Ini pengecualian dari aturan "ID = UUID v4".

**Alasan:** Setiap perangkat men-seed preset sendiri. Dengan UUID acak, sinkronisasi dua perangkat akan menghasilkan preset ganda. Dengan ID tetap, semua perangkat memegang baris yang sama, dan editan pengguna (`updated_at` > 0) selalu menang.

## 11. Sinkronisasi Supabase

**Tanggal:** 2026-10-11
**Keputusan dan detail:**
- **Server:** tabel sama dengan lokal ditambah `user_id` dan `server_updated_at`. Primary key `(user_id, id)` dan RLS `user_id = auth.uid()` (`supabase/migrations/`).
- **Konflik:** last-write-wins per baris berdasarkan `updated_at` (jam perangkat), dijaga di dua sisi:
  - Lokal: `INSERT … ON CONFLICT DO UPDATE … WHERE excluded.updated_at > updated_at`.
  - Server: trigger `sync_lww_guard` menolak update yang lebih lama. Upsert mengembalikan versi tersimpan, sehingga klien mengambil versi server bila kalah.
- **Keterbatasan:** jam perangkat yang salah bisa membuat editan lama menang. Untuk pemakaian satu orang dengan beberapa perangkat yang jamnya otomatis (NTP), risiko ini kecil.
- **Kursor pull:** `(server_updated_at, id)` memakai jam server, bukan `updated_at`. Baris dari perangkat yang jamnya tertinggal tidak terlewat, dan baris dengan timestamp kembar di batas halaman juga aman.
- **Urutan:** pull dulu, baru push. Baris lokal yang kalah sudah diganti sebelum diunggah.
- **`dirty` hanya dihapus jika `updated_at` tidak berubah selama push**, sehingga editan di tengah push tidak hilang.
- **Pemicu sync:** app dibuka, kembali ke foreground, perubahan data (debounce 5 detik), tombol "Sinkronkan sekarang", tugas latar belakang `expo-background-task` (tiap ±60 menit, best effort), dan retry dengan backoff eksponensial (5 detik → maksimal 5 menit). Retry ini juga menangani "koneksi kembali" tanpa dependency NetInfo.
- **Sesi auth** disimpan di `expo-secure-store`, dipecah menjadi potongan 1800 karakter karena SecureStore membatasi 2048 byte. Tidak memakai AsyncStorage + aes-js seperti panduan resmi, sehingga tidak perlu 4 dependency tambahan.
- **Ganti akun di perangkat yang sama:** pengguna diminta konfirmasi. Jika setuju, semua baris lokal ditandai dirty dan diunggah ke akun baru, dan kursor di-reset. Logout tidak pernah menghapus data lokal.
- **Kunci:** hanya Project URL + publishable key lewat `EXPO_PUBLIC_*` (`.env.local`, tidak di-commit). Secret/service_role key tidak pernah ada di klien.
- **Lampiran:** hanya metadata yang tersinkron. Unggah file ke Supabase Storage menyusul (TODO).
