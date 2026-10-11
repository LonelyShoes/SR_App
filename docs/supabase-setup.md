# Panduan Membuat Project Supabase untuk SR App

Waktu: ±10 menit. Gratis (paket Free cukup untuk pemakaian pribadi).
Tampilan dashboard Supabase kadang berubah sedikit; nama menu di bawah bisa berbeda tipis.

## 1. Buat akun dan project

1. Buka https://supabase.com → **Start your project** → masuk dengan akun GitHub (`LonelyShoes`) atau email.
2. Klik **New project**.
3. Isi:
   - **Name**: `sr-app`
   - **Database Password**: klik **Generate a password**, lalu **simpan di tempat aman** (pengelola kata sandi). Password ini *tidak* dipakai di app, tapi dibutuhkan kalau suatu saat mengelola database.
   - **Region**: **Southeast Asia (Singapore)**, paling dekat dengan Indonesia sehingga sync lebih cepat.
4. Klik **Create new project** dan tunggu ±2 menit sampai statusnya siap.

## 2. Buat tabel + keamanan (RLS)

1. Di menu kiri buka **SQL Editor** → **New query**.
2. Buka file `supabase/migrations/20261011000000_sync_init.sql` di repo ini, salin **seluruh isinya**, tempel ke editor.
3. Klik **Run**. Harus muncul "Success. No rows returned".
4. Cek di **Table Editor**: ada 5 tabel (`tasks`, `meetings`, `minutes`, `timer_presets`, `timer_sessions`), masing-masing berlabel **RLS enabled**.

SQL ini membuat tabel yang sama dengan database di HP, mengaktifkan **Row Level Security** (setiap akun hanya bisa membaca/menulis datanya sendiri), dan memasang aturan "perubahan terakhir menang".

## 3. Atur login email

1. Buka **Authentication** → **Sign In / Providers** (atau **Providers**) → pastikan **Email** aktif.
2. **Confirm email** — pilih salah satu:
   - **Matikan (disarankan untuk pemakaian pribadi):** daftar di app langsung bisa dipakai.
   - **Biarkan menyala:** setelah daftar, buka tautan di email. Tautan itu akan membuka halaman `localhost` yang terlihat error — itu normal, akun tetap terkonfirmasi. Lalu kembali ke app dan tekan **Masuk**.

## 4. Ambil URL dan kunci publik

1. Buka **Project Settings** (ikon roda gigi) → **API Keys**.
2. Salin **Publishable key** (diawali `sb_publishable_...`).
   - Jika project hanya menampilkan tab *Legacy*, pakai kunci **anon / public**.
   - **Jangan pernah** menyalin **Secret key** / **service_role** ke app atau mengirimkannya ke siapa pun.
3. Salin **Project URL** (`https://xxxx.supabase.co`) dari **Project Settings → Data API**, atau dari tombol **Connect** di bagian atas dashboard.

## 5. Masukkan ke project

Kirim **Project URL** dan **Publishable key** ke Claude (kunci ini memang publik dan aman dibagikan; keamanan data dijaga oleh RLS). Claude akan:

- membuat `.env.local` (tidak ikut ke GitHub) untuk pengembangan, dan
- mendaftarkan variabel yang sama di EAS (`npx eas-cli env:create`) agar build dari EAS/GitHub juga terhubung.

Atau lakukan sendiri: salin `.env.example` menjadi `.env.local` lalu isi kedua nilainya.

## 6. Uji

Setelah development build terpasang di HP:
1. **Pengaturan → Akun & Sinkronisasi** → isi email + kata sandi → **Daftar**, lalu **Masuk** bila diminta.
2. Status harus menjadi **Tersinkron**. Di Supabase → Table Editor, data dari HP muncul.
3. Uji dua perangkat: masuk dengan akun yang sama di perangkat kedua → data muncul di sana.
4. Uji offline: mode pesawat → tambah tugas → status "Offline, akan dicoba lagi" → matikan mode pesawat → data terkirim otomatis.
