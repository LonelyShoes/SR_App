# Tugas Tertunda (dikerjakan di akhir)

Dicatat 2026-10-11 setelah Fase 3. Kerjakan sebelum/saat Fase 10 (Polishing & Rilis).

- [ ] Tambahkan konfigurasi Prettier (Fase 0)
- [ ] Development build via EAS (`npx eas-cli@latest build --profile development --platform android`) dan pasang di Samsung A14 5G (Fase 0)
- [ ] Uji bunyi alarm timer: layar mati, app ditutup/di-swipe, mode hemat baterai (Fase 3)
- [ ] Finalkan keputusan channel vs native module di `docs/decisions.md` #1 berdasarkan hasil uji (Fase 3)
- [x] Commit pertama + push ke github.com/LonelyShoes/SR_App (branch `main`), project EAS @whitesr/sr-app terhubung lewat `owner` + `projectId`
- [ ] Samakan lokasi route: kode di `app/`, sedangkan `AGENTS.md` menyebut `src/app/`
- [x] Lampiran notula: `expo-document-picker` disetujui dan sudah dipasang (Fase 4)
- [ ] Uji di HP: ekspor PDF + share sheet, alur "Jadikan tugas", konfirmasi status `selesai`, tambah/buka/hapus lampiran (Fase 4)
- [ ] Uji di HP: Quick Plan suara `id-ID` di A14 5G (izin mikrofon saat pertama dipakai, hasil pengenalan, error tanpa internet). Pastikan layanan Google Speech aktif (Fase 5)
- [ ] Uji di HP: tambah kedua widget di launcher One UI, cek tiga deep link Quick Action, pembaruan Dashboard setelah tambah/hapus tugas atau rapat, dan pergantian tema terang/gelap (Fase 6)
- [ ] Gambar pratinjau widget (`previewImage` di `app.config.ts`) agar pemilih widget tidak hanya menampilkan ikon app (Fase 6/10)
- [ ] Simpan pilihan tema (Ikuti sistem/Terang/Gelap) ke tabel `settings`: `ThemeProvider` masih menyimpannya di state saja, jadi kembali ke 'system' saat app dibuka ulang (spec 6.8)
- [ ] Uji di HP: layar Statistik dengan data nyata (7/30/90 hari, tema gelap) (Fase 7)
