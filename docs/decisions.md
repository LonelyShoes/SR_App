# Keputusan Teknis

## 1. Timer Alarm: Notification Channel vs Native Module

**Tanggal:** 2026-10-11 (diperbarui setelah uji di Samsung A14 5G)
**Keputusan awal:** `expo-notifications` dengan channel `timer-alarm` (importance MAX).
**Hasil uji:** alarm timer hanya muncul sebagai notifikasi biasa: bunyi sekali dengan suara notifikasi, tidak seperti alarm.
**Keputusan final:** native module lokal `modules/sr-alarm` (Expo Modules API, Android saja).

**Cara kerja:**
- `AlarmManager.setAlarmClock` menjadwalkan alarm tepat waktu, tetap jalan saat Doze, layar mati, atau app di-swipe. Tanpa izin alarm tepat, jatuh ke `setAndAllowWhileIdle`.
- `AlarmReceiver` memasang notifikasi kategori ALARM di channel `timer-alarm-ring`:
  - nada alarm pengguna (`DEFAULT_ALARM_ALERT_URI`, `USAGE_ALARM`, ikut volume alarm);
  - `FLAG_INSISTENT`, sehingga bunyi dan getar berulang sampai dimatikan;
  - tombol **Matikan**;
  - otomatis berhenti setelah 3 menit.
- Full-screen intent membuka `AlarmActivity` (native, `showWhenLocked` + `turnScreenOn`) di atas layar kunci, dengan tombol **Matikan** dan **Buka SR App**. Activity native dipilih agar muncul seketika tanpa menunggu JS dimuat.
- Saat app terbuka, `AlarmOverlay` (React) menampilkan layar alarm dengan tombol Matikan dan "Mulai Rehat/Fokus". `useTimerWatcher` menyelesaikan sesi dari layar mana pun.
- `stop()` (berhenti manual) membatalkan alarm. `complete()` (waktu habis) membiarkan alarm berbunyi.
- Fallback ke `expo-notifications` bila modul tidak tersedia (Expo Go, test, iOS).

**Izin:** `SCHEDULE_EXACT_ALARM`, `USE_EXACT_ALARM` (otomatis diberikan untuk app alarm/timer di Android 13+), `USE_FULL_SCREEN_INTENT`. Status keduanya tampil di Pengaturan → Cek Kesehatan Alarm, dengan tombol ke halaman izinnya.

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

## 12. Backup dan Pulihkan

**Tanggal:** 2026-10-11
**Keputusan dan detail:**
- **Isi snapshot:** JSON berisi `schema_version`, lalu semua tabel yang tersinkron dengan kolom yang sama seperti sync. Tidak menyertakan `settings`, `dirty`, atau `reminder_notification_id`. Validasi memakai `zod`. Backup versi lama di-upgrade lewat rantai `MIGRATIONS`, dan backup dari versi app yang lebih baru ditolak.
- **Restore harus menang atas sync:** baris dari backup ditulis dengan `updated_at = sekarang` dan `dirty = 1`. Baris lokal yang tidak ada di backup di-soft-delete dengan cara yang sama. Tanpa ini, sync berikutnya akan menarik kembali versi server dan membatalkan restore. Restore berjalan dalam satu transaksi, jadi kalau gagal di tengah, semuanya dibatalkan.
- **Sebelum restore,** data saat ini disalin ke `Paths.document/backups/` (7 terakhir) dan, bila sudah login, juga ke cloud. Setelah restore, pengingat rapat dijadwalkan ulang dan sync dijalankan.
- **Cloud:** bucket privat `backups`, path `{user_id}/{timestamp}.json` dengan RLS per folder (`supabase/migrations/20261011010000_backups_storage.sql`). Retensi 7 backup terbaru.
- **Unduhan** memakai signed URL + `fetch`, karena `Blob.text()` tidak tersedia di React Native.
- **Jadwal:** dicek 15 detik setelah app dibuka dan di tugas latar belakang sync (sekitar tiap jam). Backup dibuat bila yang terakhir lebih dari 24 jam lalu. Backup otomatis butuh login, sedangkan ekspor/impor file bisa tanpa akun.

## 13. Polishing Rilis: Kontras, Ikon, Build

**Tanggal:** 2026-10-11
- **Kontras WCAG AA:** warna terang `primary`, `error`, `success`, `warning`, dan kuadran digelapkan sampai ≥ 4.5:1, baik sebagai teks di latar terang/abu maupun sebagai latar teks `onPrimary`. Diverifikasi dengan rumus luminans WCAG. Warna lama `#208AEF` + teks putih hanya mencapai 3.53:1.
- **Token baru:** `onPrimary`, `onError`, `overlay`, dan warna mode timer `fokus`/`rehat`/`santai`. Tidak ada lagi warna hex di komponen. PDF notula memakai token terang (selalu terang). Hex hanya tersisa di `app.config.ts` (ikon notifikasi dan splash), karena config dibaca di luar app.
- **Ikon:** dibuat dari `assets/images/sr-logo.jpg` lewat skrip `jimp-compact`. Huruf mengisi 52% lebar ikon adaptif, masih di dalam area aman 61% semua bentuk masker. Juga dibuat ikon monochrome (Android 13+), ikon notifikasi putih-transparan, serta splash terang dan gelap. Aset sisa template Expo dan `scripts/reset-project.js` (berbahaya bila dijalankan) dihapus.
- **Index SQLite:** migrasi `0001_add_indexes` pada kolom yang dipakai query layar, statistik, dan sync (`status`+`quadrant`, `due_at`, `completed_at`, `start_at`, `meeting_id`, `started_at`, `dirty`).
- **Build:** semua profil EAS menghasilkan APK (spec: install langsung). Profil `production` memakai `autoIncrement` dengan versi yang dikelola EAS (`appVersionSource: remote`). Variabel Supabase diambil dari environment EAS sesuai profil.
- **Uji E2E Supabase:** `npm run test:e2e` menjalankan mesin sync yang sama terhadap project Supabase sungguhan (RLS, trigger LWW, kursor, bucket). Test ini memakai konfigurasi Jest tanpa preset `jest-expo`, karena preset itu mengganti `fetch` sehingga request HTTP sungguhan tidak bisa jalan.

## 14. Audit Spec Sebelum Rilis: Kekurangan yang Ditutup

**Tanggal:** 2026-10-11
Audit kriteria spec terhadap kode sebelum build produksi menemukan bahwa sebagian Fase 2–3 tercentang padahal belum lengkap. Kekurangan yang sudah ditutup:
- **Matrix (6.2):**
  - Form tugas lengkap (kuadran, tenggat tanggal/jam, catatan) dan bisa diedit/dihapus.
  - Form rapat lengkap (tanggal, jam mulai/selesai, lokasi, peserta, agenda, status, pengingat per rapat) dan bisa diedit/dihapus. Sebelumnya jam rapat selalu "1 jam dari sekarang".
  - Grid 4Q berisi daftar tugas yang bisa dicentang, dan tugas bisa dipindah kuadran dengan tekan lama.
- **Dashboard (6.1):** agenda bisa ditambah/diedit lewat bottom sheet, tugas prioritas bisa diedit, dan ringkasan 4Q membuka grid (`/matrix?tab=grid`). Briefing memakai `summarizeDashboard` yang sama dengan widget.
- **Pengingat (6.6):**
  - Offset global 10/15/30/60 menit di Pengaturan (`default_reminder_offset_min`), mengubahnya langsung menjadwal ulang.
  - Isi notifikasi memuat jam dan lokasi. Mengetuk notifikasi membuka rapatnya (`/matrix?rapat=<id>`).
  - Rekonsiliasi kini berjalan berurutan, karena dua rekonsiliasi yang tumpang tindih bisa menghasilkan notifikasi ganda.
  - `reminder_notification_id` dikosongkan bila tidak ada pengingat.
  - Ditambah test penjadwalan ulang (aturan agent no. 8).
- **Timer (6.4):**
  - Preset bisa diatur (nama + durasi 1–180 menit).
  - Warna aksen mengikuti preset terpilih.
  - Preset disimpan sebagai ID agar perubahan durasi langsung terpakai.
- **Input tanggal/jam** memakai teks `hh/bb/tttt` dan `JJ:mm` (`src/lib/date-input.ts`), tanpa dependency date-picker native di luar tabel stack.
- **Keterbatasan:** status izin "Alarm & pengingat" dan pengecualian baterai tidak bisa dibaca dari JS tanpa native module. Layar Cek Kesehatan menampilkan status izin notifikasi dan tombol menuju pengaturan untuk dua izin lainnya.

## 15. Desain Pastel dan Interaksi

**Tanggal:** 2026-10-11
**Keputusan:** UI dirombak ke palet pastel mengikuti referensi pengguna (99designs, "Promise Serves"): kartu tanpa border dengan sudut membulat dan bayangan lembut, ikon garis, tile horizontal, bottom sheet berikon, dan tombol pill.

- **Token:** setiap aksen (`primary` sage, `q1` rose, `q2` mint, `q3` butter, `q4` lavender, `fokus`/`rehat`/`santai`) punya dua tingkat:
  - `xxx` tua untuk teks, ikon, dan tombol;
  - `xxxSoft` pastel untuk latar tile dan chip.
- **Kontras:** semua pasangan diperiksa WCAG AA ≥ 4.5:1, yaitu aksen di atas background/surface/soft-nya sendiri dan `onPrimary` di atas aksen, di tema terang dan gelap.
- **Ikon:** `expo-symbols` (Material Symbols, font ikut dalam bundle sehingga jalan offline), sudah terpasang, tanpa dependency baru. Emoji di UI diganti ikon.
- **Interaksi:**
  - `Tap` (Reanimated) mengecil saat ditekan;
  - daftar muncul dengan `FadeInDown` berurutan;
  - dial timer dari 60 tick yang menyala sesuai sisa waktu dan "bernapas" saat berjalan;
  - mikrofon Quick Plan beriak saat mendengarkan;
  - tombol + mengambang di Matrix.
- **Reanimated + React Compiler:** shared value diubah lewat `.set()`/`.get()`, bukan `.value =`, karena aturan lint `react-hooks/immutability`.
- **Warna di luar token:** `AlarmActivity.kt` menyalin nilai token karena kode native tidak bisa membaca `tokens.ts`.

## 16. Ekspor PDF Notula

**Tanggal:** 2026-10-11
**Masalah:** pengguna melaporkan "gagal mengekspor PDF". Pesan error belum didapat.
**Dugaan kuat:** `expo-sharing` di Android hanya menerima satu permintaan share sekaligus (`pendingPromise`). Bila hasil share sebelumnya (misalnya saat membuka lampiran) tidak kembali, semua share berikutnya gagal.
**Perubahan:**
- PDF dirender dulu (`renderMinutesPdf`) lalu diberi nama `Notula <judul> <yyyy-MM-dd>.pdf` di cache.
- Pengguna lalu memilih di bottom sheet:
  - **Bagikan:** share sheet. Bila gagal, jatuh ke dialog cetak sistem, yang punya "Simpan sebagai PDF".
  - **Simpan ke folder:** Storage Access Framework (`Directory.pickDirectoryAsync`) menulis langsung ke folder pilihan, misalnya Download, tanpa `expo-sharing`.
- Pesan error kini menyertakan kode native agar penyebabnya bisa dilacak.
- Header PDF memakai warna pastel tema terang.

