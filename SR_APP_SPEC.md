# SR App: Spesifikasi & Rencana Implementasi

> Dokumen ini adalah sumber kebenaran (single source of truth) untuk membangun **SR App**.
> Baca seluruh dokumen sebelum menulis kode. Kerjakan **per fase**, berhenti di akhir tiap fase, dan tunggu konfirmasi sebelum lanjut.

---

## 1. Ringkasan Produk

**SR App** adalah aplikasi produktivitas pribadi untuk Android: mengelola agenda/rapat, tugas dengan Matrix Eisenhower (4 kuadran), notula rapat, timer fokus bergaya alarm, dan widget home screen.

**Target perangkat tunggal: Samsung Galaxy A14 5G**
- Android 13 (upgrade ke 14/15), One UI
- Layar 1080×2408 (~411×915 dp), 90 Hz
- Exynos 1330, RAM 4/6 GB → perangkat kelas menengah-bawah, **performa harus dijaga**
- Hanya Android, hanya portrait. Tidak ada kode iOS/web.

**Bahasa UI: Bahasa Indonesia.** Semua teks tampilan dalam Bahasa Indonesia; kode, nama variabel, dan komentar dalam Bahasa Inggris.

---

## 2. Tech Stack (wajib diikuti)

| Aspek | Pilihan |
|---|---|
| Framework | Expo (SDK terbaru stabil) + React Native + **TypeScript strict** |
| Build | **Development Build** via EAS (BUKAN Expo Go). Output APK untuk install langsung |
| Navigasi | Expo Router (file-based), bottom tabs |
| Database lokal | `expo-sqlite` + **Drizzle ORM** (migrasi via drizzle-kit) |
| State | Zustand |
| Notifikasi | `expo-notifications` (channel terpisah untuk alarm timer dan pengingat rapat) |
| Widget | `react-native-android-widget` (Expo config plugin) |
| Voice | `expo-speech-recognition` (locale `id-ID`) |
| Ekspor PDF | `expo-print` + `expo-sharing` |
| Cloud (sync & backup) | **Supabase** (Auth + Postgres + Storage + Row Level Security). Ini pilihan default; lihat bagian 8 |
| Penyimpanan token | `expo-secure-store` |
| Tugas background | `expo-background-task` |
| Chart statistik | `react-native-gifted-charts` (berbasis SVG) atau SVG kustom sederhana |
| Tanggal | `date-fns` (locale `id`) |
| Validasi | `zod` |
| Lint/format | ESLint + Prettier |

Aktifkan: Hermes, New Architecture (jika semua library kompatibel; jika ada yang bermasalah, catat dan nonaktifkan dengan alasan).

---

## 3. Fitur Final (Scope v1.0)

1. Dashboard
2. Matrix (tugas + rencana rapat + grid 4Q)
3. Notula (+ Quick Plan voice)
4. Timer (fokus / rehat / santai, bunyi seperti alarm)
5. Widget (quick action + dashboard)
6. **Sinkronisasi cloud**
7. **Backup otomatis**
8. **Pengingat rapat otomatis (default H-30 menit)**
9. **Statistik produktivitas dari riwayat timer**
10. **Tema gelap**

---

## 4. Struktur Folder

```
sr-app/
├── app/
│   ├── _layout.tsx
│   ├── (tabs)/
│   │   ├── _layout.tsx
│   │   ├── index.tsx          # Dashboard
│   │   ├── matrix.tsx
│   │   ├── notula.tsx
│   │   └── timer.tsx
│   ├── modals/                # form tugas, rapat, quick plan, preset timer
│   ├── notula/[id].tsx
│   ├── statistik.tsx
│   ├── pengaturan.tsx         # tema, pengingat, sync, backup, izin
│   └── onboarding.tsx         # izin notifikasi, exact alarm, baterai Samsung
├── src/
│   ├── db/                    # schema.ts, client.ts, migrations/
│   ├── features/
│   │   ├── tasks/
│   │   ├── meetings/
│   │   ├── minutes/
│   │   ├── timer/
│   │   ├── voice/
│   │   ├── stats/
│   │   ├── sync/
│   │   └── backup/
│   ├── components/            # UI reusable
│   ├── theme/                 # tokens.ts, ThemeProvider.tsx
│   ├── widgets/               # definisi & handler widget Android
│   ├── notifications/         # channel, scheduler, permission
│   └── lib/                   # date-parser-id.ts, ids.ts, utils
├── assets/
├── app.config.ts
├── eas.json
└── SR_APP_SPEC.md
```

---

## 5. Model Data

**Aturan umum semua tabel (wajib, untuk sync):**
- `id`: UUID v4 (string), dibuat di klien
- `created_at`, `updated_at`: integer epoch ms (UTC)
- `deleted_at`: integer nullable (**soft delete**, jangan hapus fisik)
- `dirty`: integer 0/1 (ada perubahan lokal yang belum dikirim)

### tasks
`title`, `notes`, `quadrant` (`Q1`|`Q2`|`Q3`|`Q4`), `due_at` (nullable), `status` (`todo`|`done`), `completed_at` (nullable), `source` (`manual`|`voice`), `meeting_id` (nullable)

Definisi kuadran:
- Q1 = Penting & Mendesak
- Q2 = Penting & Tidak Mendesak
- Q3 = Tidak Penting & Mendesak
- Q4 = Tidak Penting & Tidak Mendesak

### meetings
`title`, `start_at`, `end_at`, `location`, `participants` (JSON array string), `agenda`, `status` (`rencana`|`terkonfirmasi`|`selesai`|`batal`), `source` (`manual`|`voice`), `reminder_offset_min` (nullable; null = pakai default pengaturan), `reminder_notification_id` (nullable, **hanya lokal, tidak di-sync**)

### minutes (notula)
`meeting_id`, `discussion`, `decisions`, `attendees` (JSON), `action_items` (JSON array: `{text, assignee, due_at, task_id?}`), `attachments` (JSON, uri lokal)

### timer_presets
`kind` (`fokus`|`rehat`|`santai`), `name`, `duration_sec`, `sort_order`

### timer_sessions
`kind`, `planned_sec`, `started_at`, `ended_at`, `completed` (0/1; 1 jika timer habis sendiri, 0 jika dibatalkan/dihentikan), `actual_sec`, `preset_id` (nullable)

### settings (key-value, lokal)
`theme_mode` (`system`|`light`|`dark`), `default_reminder_offset_min` (default 30), `reminders_enabled`, `sync_enabled`, `last_pulled_at`, `last_backup_at`, `auto_backup_enabled`, dan lainnya sesuai kebutuhan

---

## 6. Spesifikasi Fitur & Acceptance Criteria

### 6.1 Dashboard (`(tabs)/index`)
- **Daily briefing**: kartu berisi (a) jumlah agenda hari ini, (b) berapa yang berstatus `terkonfirmasi`, (c) jumlah tugas `todo` yang harus dikerjakan (due hari ini atau Q1).
- **Agenda hari ini**: daftar rapat/kegiatan urut jam; tombol tambah dan edit (bottom sheet); ubah status (mis. konfirmasi) dengan satu ketukan.
- **Tugas prioritas**: Q1 dan Q2 yang belum selesai, maksimal 5 teratas.
- **Ringkasan matrix 4Q**: 4 kotak mini dengan jumlah tugas belum selesai per kuadran, ketuk untuk ke tab Matrix.
- Ikon masuk ke **Statistik** dan **Pengaturan** di header.

✅ Selesai jika: data live dari SQLite, update instan setelah tambah/edit, state kosong (empty state) ramah, tanpa jank di 90 Hz.

### 6.2 Matrix (`(tabs)/matrix`)
- Segmented control: **Tugas** | **Rapat** | **Grid 4Q**.
- Tambah/edit/hapus tugas (pilih kuadran, due date, catatan).
- Tambah/edit rencana rapat (judul, tanggal, jam, lokasi, peserta, agenda).
- Grid 4Q: 4 kuadran dengan daftar tugas **belum selesai** dan totalnya; pindah kuadran lewat long-press/menu; centang selesai.

✅ Selesai jika: semua operasi CRUD berfungsi, total per kuadran akurat, soft delete dipakai.

### 6.3 Notula (`(tabs)/notula`)
- Daftar notula + daftar rapat yang belum punya notula.
- Buat notula dari rapat di Matrix: data rapat terisi otomatis.
- Form: pembahasan, keputusan, peserta hadir, **action items** (tiap item bisa "Jadikan tugas" → membuat `task` di Matrix dengan `meeting_id`), lampiran.
- Ekspor PDF (expo-print) dan bagikan (expo-sharing).
- Menyimpan notula mengubah status rapat menjadi `selesai` (dengan konfirmasi).
- **Quick Plan (voice)**:
  1. Tombol mic → rekam ucapan `id-ID`.
  2. Parser (`src/lib/date-parser-id.ts`) mengubah teks jadi draft tugas atau rapat.
  3. **Selalu tampilkan layar konfirmasi** yang bisa diedit sebelum disimpan. Jangan simpan otomatis.
  4. Parser rule-based mendukung: *besok, lusa, hari ini, nanti, Senin–Minggu, Senin depan, tanggal 15, jam 9, jam 3 sore, jam 7 malam, setengah 8, pukul 14.30*. Kata kunci "rapat/meeting/pertemuan" → rapat; selain itu → tugas.
  5. Sertakan unit test untuk parser (minimal 30 kasus).

### 6.4 Timer (`(tabs)/timer`)
- Tiga mode: **Fokus**, **Rehat**, **Santai**; preset bisa diatur (default Fokus 25 mnt, Rehat 5 mnt, Santai 15 mnt).
- Kontrol: mulai, jeda, lanjut, berhenti.
- **Akurasi:** jangan pakai `setInterval` sebagai sumber waktu. Simpan `end_at` (timestamp), tampilkan sisa = `end_at - now`, dan jadwalkan **notifikasi tepat di `end_at`**.
- **Bunyi seperti alarm, bukan media:**
  - Notification channel `timer-alarm`: importance MAX, audio usage `ALARM`, suara nada dering/alarm sistem, getar, tampil di lockscreen.
  - Uji di perangkat: berbunyi saat layar mati, app di-swipe dari recent, dan mode hemat baterai.
  - Jika channel saja belum cukup (mis. tidak berulang/tidak full-screen), buat **native module kecil** (Expo Modules API) atau gunakan library notifikasi native. **Catat keputusan dan alasannya di `docs/decisions.md`.**
- Setiap sesi dicatat ke `timer_sessions` (dipakai Statistik).
- Notifikasi ditutup/dihentikan lewat ketukan; layar timer tidak boleh crash jika dibuka dari notifikasi.

### 6.5 Widget (Android)
- **Widget Quick Action** (mis. 4×1): tombol *Tugas Baru*, *Quick Plan (voice)*, *Mulai Fokus*. Deep link ke layar terkait.
- **Widget Dashboard** (mis. 4×2): jumlah agenda hari ini, jumlah terkonfirmasi, jumlah tugas, 2–3 agenda terdekat.
- Widget diperbarui setiap data berubah dan berkala (maks. tiap 30 menit).
- Widget mengikuti tema sistem (terang/gelap).

### 6.6 Pengingat Rapat Otomatis (H-30 menit)
- Untuk setiap rapat berstatus `rencana`/`terkonfirmasi` dengan `start_at` di masa depan, jadwalkan notifikasi lokal pada `start_at - offset`.
- Offset default **30 menit**; bisa diubah global di Pengaturan (10/15/30/60 menit) dan per rapat (`reminder_offset_min`).
- Channel `meeting-reminder`: importance HIGH, suara notifikasi biasa (BUKAN alarm).
- Isi notifikasi: judul rapat, jam, lokasi. Ketuk → buka detail rapat.
- **Penjadwalan ulang otomatis** saat: rapat dibuat/diedit/dibatalkan/dihapus, offset diubah, hasil sync menambah/mengubah rapat, dan setelah perangkat reboot/app dibuka (rekonsiliasi: batalkan semua jadwal lama lalu jadwalkan ulang dari DB).
- Jika sisa waktu < offset saat rapat dibuat, tidak ada pengingat (jangan bunyi seketika).
- Simpan `reminder_notification_id` agar bisa dibatalkan tepat sasaran.

✅ Selesai jika: edit jam rapat menggeser pengingat; batal rapat menghapus pengingat; tidak ada notifikasi ganda.

### 6.7 Statistik Produktivitas (`app/statistik.tsx`)
Sumber data: `timer_sessions` (dan `tasks.completed_at` untuk tugas). Filter: **7 hari / 30 hari / 90 hari**.
- Total waktu fokus per hari (bar chart) dan total periode.
- Jumlah sesi selesai vs dibatalkan, **tingkat penyelesaian (%)**.
- Rata-rata durasi sesi fokus.
- **Streak** hari berturut-turut dengan minimal 1 sesi fokus selesai.
- Distribusi waktu Fokus / Rehat / Santai.
- Jam paling produktif (heatmap atau bar per jam 0–23).
- Tugas diselesaikan per hari/minggu.
- Semua perhitungan lewat query SQL teragregasi, **bukan** loop di JS atas ribuan baris. Zona waktu mengikuti perangkat (WIB).

### 6.8 Tema Gelap
- Tiga mode di Pengaturan: **Ikuti sistem / Terang / Gelap**, tersimpan di `settings`.
- Semua warna dari **design tokens** (`src/theme/tokens.ts`) via `ThemeProvider`/hook `useTheme()`. **Dilarang hardcode warna di komponen.**
- Kontras minimal WCAG AA untuk teks.
- Status bar, navigation bar, bottom sheet, chart, PDF notula (selalu terang), dan widget semuanya konsisten.
- `userInterfaceStyle: "automatic"` di `app.config.ts`.

---

## 7. Rancangan Teknis Sinkronisasi

**Prinsip: local-first.** App harus 100% berfungsi tanpa internet; sync berjalan di belakang.

- **Auth**: Supabase Auth (awal: email + password atau magic link; Google Sign-In sebagai peningkatan). Token disimpan di `expo-secure-store`. Sync bersifat **opsional** (app bisa dipakai tanpa login).
- **Server**: Postgres dengan tabel yang sama seperti lokal ditambah kolom `user_id`. **RLS wajib**: `user_id = auth.uid()` untuk semua operasi.
- **Push**: kirim semua baris `dirty = 1` (upsert berdasarkan `id`), lalu set `dirty = 0` setelah sukses.
- **Pull**: ambil baris dengan `updated_at > last_pulled_at` (dengan paginasi), upsert ke lokal, perbarui `last_pulled_at`.
- **Konflik**: *last-write-wins* per baris berdasarkan `updated_at`. `updated_at` memakai jam perangkat; dokumentasikan keterbatasan ini.
- **Penghapusan**: soft delete (`deleted_at`) ikut tersinkron.
- **Pemicu sync**: saat app dibuka, setelah perubahan data (debounce 5 detik), saat koneksi kembali, tombol "Sinkronkan sekarang", dan tugas background berkala.
- **Tidak di-sync**: `reminder_notification_id`, state timer yang sedang berjalan, tabel `settings` yang bersifat per-perangkat.
- **Lampiran notula**: di v1, hanya metadata yang di-sync; unggah file ke Supabase Storage sebagai tahap lanjutan (tandai TODO).
- UI: indikator status sync (sinkron / sedang sinkron / gagal / offline) dan waktu sync terakhir di Pengaturan.
- Penanganan error: retry dengan exponential backoff, jangan pernah menghapus data lokal karena error jaringan.

> Jika kamu lebih memilih backend lain (Firebase, backend sendiri), ganti hanya lapisan `src/features/sync/`; kontrak push/pull di atas tetap.

---

## 8. Rancangan Backup Otomatis

Sync = salinan data terkini. **Backup** = snapshot yang bisa dipulihkan jika data rusak/salah hapus.

- **Backup cloud otomatis**: snapshot JSON seluruh data (tanpa `settings` per-perangkat) diunggah ke Supabase Storage (bucket privat per user), path `backups/{user_id}/{timestamp}.json`. Simpan **7 backup terakhir**, hapus yang lebih lama.
- **Jadwal**: sekali sehari lewat `expo-background-task` (best effort), **plus** pengecekan saat app dibuka: jika `last_backup_at` > 24 jam, jalankan backup.
- **Backup lokal manual**: ekspor JSON ke file lewat `expo-sharing` (bisa disimpan ke Drive/WhatsApp) dan impor dari file.
- **Pulihkan**: layar Pengaturan → Backup → pilih snapshot → konfirmasi → ganti data lokal (buat backup otomatis dulu sebelum menimpa). Setelah restore, jadwalkan ulang semua notifikasi pengingat.
- Cantumkan `schema_version` di file backup dan tangani migrasi versi lama.
- Toggle "Backup otomatis" di Pengaturan, tampilkan waktu backup terakhir.

---

## 9. Izin & Penanganan Khusus Samsung/One UI

Onboarding (`onboarding.tsx`) dan Pengaturan harus memandu:
1. **POST_NOTIFICATIONS** (Android 13+).
2. **Exact alarm** (`SCHEDULE_EXACT_ALARM`/izin alarm & pengingat) agar timer dan pengingat tepat waktu; arahkan ke pengaturan sistem bila belum diberikan.
3. **Baterai**: minta pengguna mengatur app ke *Tidak dibatasi* dan mematikan *Put unused apps to sleep* (Pengaturan → Baterai → Batas penggunaan di latar belakang). Sediakan tombol yang membuka halaman pengaturan terkait.
4. **Mikrofon** (untuk voice) hanya diminta saat fitur dipakai pertama kali.

Tambahkan layar **"Cek Kesehatan Notifikasi"** di Pengaturan yang menampilkan status ketiga izin di atas dan tombol perbaikan.

---

## 10. Performa (target A14 5G)

- Daftar panjang pakai `FlashList`/`FlatList` dengan `keyExtractor` stabil dan item di-memo.
- Hindari re-render besar; selector Zustand granular.
- Animasi hanya `transform`/`opacity`, gunakan `react-native-reanimated` secukupnya.
- Query SQLite berindeks (`start_at`, `due_at`, `quadrant`, `status`, `started_at`, `updated_at`, `deleted_at`).
- Target: cold start < 3 detik, scroll 60 fps pada daftar 500 item, memori wajar.
- Ukur di perangkat nyata, bukan hanya emulator.

---

## 11. Aturan untuk Agent

1. Kerjakan **satu fase sekali**, selesaikan checklist-nya, jalankan lint + typecheck + test, lalu ringkas apa yang dibuat dan tunggu konfirmasi.
2. Jangan menambah dependency di luar tabel stack tanpa menjelaskan alasannya dan meminta persetujuan.
3. Jangan hardcode warna, string UI berulang, atau ID. Gunakan tokens dan helper.
4. Semua tulis ke DB lewat lapisan repository di `src/features/*/`; komponen UI tidak menjalankan SQL langsung.
5. Setiap perubahan skema = migrasi Drizzle baru, tidak pernah mengedit migrasi lama.
6. Setiap keputusan teknis penting dicatat singkat di `docs/decisions.md`.
7. Jika ada library yang tidak kompatibel dengan Expo/New Architecture, laporkan dan usulkan alternatif, jangan diam-diam diganti.
8. Tulis test untuk: parser tanggal Indonesia, penjadwalan ulang pengingat, logika sync (push/pull/konflik), perhitungan statistik, dan migrasi backup.
9. Jangan pernah menyimpan rahasia (kunci service role Supabase) di klien. Hanya `anon key` publik + RLS.

---

## 12. Fase Implementasi (checklist)

### Fase 0: Persiapan
- [ ] Inisialisasi project Expo + TypeScript strict, ESLint, Prettier
- [x] `app.config.ts`: nama "SR App", Android only, portrait, `userInterfaceStyle: automatic`, package name, izin
- [ ] Setup EAS (`eas.json`), development build ke A14 5G berhasil terpasang dan terbuka
- [x] `ThemeProvider` + tokens terang/gelap (dasar tema sejak awal)
- [x] Wireframe/komponen dasar (Button, Card, Sheet, EmptyState)

### Fase 1: Fondasi
- [x] Skema Drizzle + migrasi awal semua tabel (termasuk kolom sync)
- [x] Client SQLite, repository dasar, seed preset timer
- [x] Navigasi 4 tab + stack/modal
- [x] Halaman Pengaturan (kerangka) dengan pemilih tema berfungsi

### Fase 2: Matrix + Dashboard
- [x] CRUD tugas dan rapat (soft delete)
- [x] Grid 4Q + total belum selesai
- [x] Dashboard: briefing, agenda hari ini, tugas prioritas, ringkasan 4Q

### Fase 3: Timer + Notifikasi (fase paling berisiko, jangan dilewati)
- [x] Channel `timer-alarm` dan `meeting-reminder`
- [x] Timer berbasis `end_at`, preset, jeda/lanjut/berhenti
- [ ] Uji bunyi alarm: layar mati, app ditutup, hemat baterai di A14 5G
- [ ] Putuskan: cukup channel atau perlu native module (catat di `docs/decisions.md`)
- [x] Pencatatan `timer_sessions`
- [x] Onboarding izin + "Cek Kesehatan Notifikasi"
- [x] **Pengingat rapat H-30** + rekonsiliasi jadwal

### Fase 4: Notula
- [x] Notula dari rapat, action item → tugas
- [x] Ekspor PDF + bagikan
- [x] Status rapat → `selesai`

### Fase 5: Quick Plan (voice)
- [x] Rekam suara `id-ID`
- [x] Parser tanggal/jam Indonesia + 30 unit test
- [x] Layar konfirmasi sebelum simpan

### Fase 6: Widget
- [x] Widget Quick Action + deep link
- [x] Widget Dashboard + pembaruan data + tema

### Fase 7: Statistik
- [x] Query agregasi + layar Statistik (7/30/90 hari)
- [x] Streak, tingkat penyelesaian, jam produktif
- [x] Chart mengikuti tema gelap

### Fase 8: Sinkronisasi Cloud
- [x] Project Supabase, tabel + RLS, Auth
- [x] Push/pull + resolusi konflik + indikator status
- [x] Rekonsiliasi notifikasi setelah pull
- [ ] Uji dua perangkat/dua akun, uji offline lalu online

### Fase 9: Backup Otomatis
- [x] Snapshot JSON + unggah ke Storage + retensi 7 backup
- [x] Jadwal harian + pengecekan saat app dibuka
- [x] Ekspor/impor manual, layar Pulihkan, `schema_version`

### Fase 10: Polishing & Rilis
- [ ] Audit performa di A14 5G, tema gelap di semua layar
- [ ] Uji pemakaian harian minimal 5 hari (timer, pengingat, widget)
- [ ] Ikon, splash screen, nama paket
- [ ] Build APK produksi via EAS

---

## 13. Definition of Done (v1.0)

- Semua fitur di bagian 3 berfungsi di Galaxy A14 5G fisik.
- Timer dan pengingat rapat berbunyi tepat waktu saat layar mati dan app ditutup.
- App berfungsi penuh offline; sync dan backup berjalan saat online.
- Tema gelap konsisten, tidak ada warna hardcode.
- Lint, typecheck, dan semua test lulus.
- Tidak ada crash pada alur utama (tambah tugas/rapat, notula, timer, voice, widget).
