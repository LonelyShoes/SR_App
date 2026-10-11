# Tugas Tertunda (dikerjakan di akhir)

Dicatat 2026-10-11 setelah Fase 3. Kerjakan sebelum/saat Fase 10 (Polishing & Rilis).

- [x] Konfigurasi Prettier (`npm run format`)
- [x] Development build + APK produksi (versionCode 3) dibuat di EAS; tinggal dipasang di Samsung A14 5G (lihat docs/uji-hp.md)
- [ ] Uji bunyi alarm timer: layar mati, app ditutup/di-swipe, mode hemat baterai (Fase 3)
- [ ] Finalkan keputusan channel vs native module di `docs/decisions.md` #1 berdasarkan hasil uji (Fase 3)
- [x] Commit pertama + push ke github.com/LonelyShoes/SR_App (branch `main`), project EAS @whitesr/sr-app terhubung lewat `owner` + `projectId`
- [x] Lokasi route disamakan: `AGENTS.md` kini menyebut `app/`
- [x] Lampiran notula: `expo-document-picker` disetujui dan sudah dipasang (Fase 4)
- [ ] Uji di HP: ekspor PDF + share sheet, alur "Jadikan tugas", konfirmasi status `selesai`, tambah/buka/hapus lampiran (Fase 4)
- [ ] Uji di HP: Quick Plan suara `id-ID` di A14 5G (izin mikrofon saat pertama dipakai, hasil pengenalan, error tanpa internet). Pastikan layanan Google Speech aktif (Fase 5)
- [ ] Uji di HP: tambah kedua widget di launcher One UI, cek tiga deep link Quick Action, pembaruan Dashboard setelah tambah/hapus tugas atau rapat, dan pergantian tema terang/gelap (Fase 6)
- [ ] Gambar pratinjau widget (`previewImage` di `app.config.ts`) agar pemilih widget tidak hanya menampilkan ikon app (Fase 6/10)
- [x] Simpan pilihan tema ke tabel `settings` (+ status bar dan latar sistem mengikuti tema)
- [ ] Uji di HP: layar Statistik dengan data nyata (7/30/90 hari, tema gelap) (Fase 7)
- [ ] Hubungkan GitHub ke Expo (dipandu di akhir): https://expo.dev/accounts/whitesr/projects/sr-app/github → Connect → pasang Expo GitHub App di akun `LonelyShoes` → pilih repo `SR_App` (base directory kosong) → aktifkan Build triggers (branch `main`, Android, profile `development`)
- [ ] Uji sync di HP: dua perangkat dengan akun yang sama, offline lalu online, ganti akun (Fase 8)
- [ ] Unggah file lampiran notula ke Supabase Storage (saat ini hanya metadata yang tersinkron)
- [ ] Uji di HP: backup cloud otomatis, ekspor/impor file, pulihkan dari cloud (cek data yang dipulihkan tidak ditimpa sync) (Fase 9)
- [x] "Confirm email" di Supabase dimatikan
- [ ] Hapus 2 akun uji E2E di Supabase → Authentication → Users (`sr-e2e-a-…@example.com`, `sr-e2e-b-…@example.com`); datanya sudah dibersihkan
