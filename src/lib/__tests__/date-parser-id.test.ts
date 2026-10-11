import { describe, expect, test } from '@jest/globals';
import { parseQuickPlan } from '../date-parser-id';

// Senin, 12 Oktober 2026 pukul 08.00 (waktu lokal)
const NOW = new Date(2026, 9, 12, 8, 0);

const at = (month: number, day: number, hour = 0, minute = 0, year = 2026) =>
  new Date(year, month, day, hour, minute);

const parse = (text: string) => parseQuickPlan(text, NOW);

describe('parseQuickPlan: hari relatif', () => {
  test('besok tanpa jam', () => {
    expect(parse('besok kirim laporan')).toEqual({
      kind: 'task',
      title: 'Kirim laporan',
      date: at(9, 13),
      hasTime: false,
    });
  });

  test('lusa', () => {
    expect(parse('lusa bayar listrik').date).toEqual(at(9, 14));
  });

  test('hari ini + jam siang + rapat', () => {
    expect(parse('hari ini rapat evaluasi jam 2 siang')).toEqual({
      kind: 'meeting',
      title: 'Rapat evaluasi',
      date: at(9, 12, 14),
      hasTime: true,
    });
  });

  test('nanti jam 7 malam', () => {
    const r = parse('nanti jam 7 malam telepon ibu');
    expect(r.date).toEqual(at(9, 12, 19));
    expect(r.title).toBe('Telepon ibu');
  });

  test('besok pagi tanpa jam memakai jam default periode', () => {
    expect(parse('besok pagi lari').date).toEqual(at(9, 13, 8));
  });

  test('besok sore jam 4: periode dari kata hari', () => {
    const r = parse('besok sore jam 4 main futsal');
    expect(r.date).toEqual(at(9, 13, 16));
    expect(r.title).toBe('Main futsal');
  });
});

describe('parseQuickPlan: nama hari', () => {
  test('Senin depan = Senin minggu berikutnya', () => {
    const r = parse('Senin depan presentasi proyek');
    expect(r.date).toEqual(at(9, 19));
    expect(r.title).toBe('Presentasi proyek');
  });

  test('Rabu = Rabu terdekat', () => {
    expect(parse('rabu kumpulkan tugas').date).toEqual(at(9, 14));
  });

  test('Senin saat hari ini Senin = Senin pekan depan', () => {
    expect(parse('senin servis laptop').date).toEqual(at(9, 19));
  });

  test('hari Jumat + jam', () => {
    const r = parse('hari jumat rapat divisi jam 10');
    expect(r).toEqual({ kind: 'meeting', title: 'Rapat divisi', date: at(9, 16, 10), hasTime: true });
  });

  test("ejaan Jum'at", () => {
    expect(parse("jum'at kerja bakti").date).toEqual(at(9, 16));
  });

  test('Sabtu depan', () => {
    expect(parse('sabtu depan nonton').date).toEqual(at(9, 24));
  });

  test('Minggu = hari Minggu terdekat', () => {
    expect(parse('minggu servis motor').date).toEqual(at(9, 18));
  });

  test('hari Minggu depan', () => {
    expect(parse('hari minggu depan arisan').date).toEqual(at(9, 25));
  });

  test('minggu depan (tanpa "hari") = Senin pekan depan', () => {
    const r = parse('minggu depan susun anggaran');
    expect(r.date).toEqual(at(9, 19));
    expect(r.title).toBe('Susun anggaran');
  });
});

describe('parseQuickPlan: tanggal', () => {
  test('tanggal 15 bulan ini', () => {
    const r = parse('tanggal 15 bayar kos');
    expect(r.date).toEqual(at(9, 15));
    expect(r.title).toBe('Bayar kos');
  });

  test('tanggal yang sudah lewat pindah ke bulan depan', () => {
    expect(parse('tanggal 5 perpanjang SIM').date).toEqual(at(10, 5));
  });

  test('tgl + nama bulan', () => {
    expect(parse('tgl 20 desember tutup buku').date).toEqual(at(11, 20));
  });

  test('tanggal + bulan yang sudah lewat pindah ke tahun depan', () => {
    expect(parse('tanggal 3 januari bayar pajak').date).toEqual(at(0, 3, 0, 0, 2027));
  });

  test('tanggal + bulan + tahun + jam', () => {
    expect(parse('tanggal 2 maret 2027 jam 10 rapat tahunan').date).toEqual(at(2, 2, 10, 0, 2027));
  });

  test('tanggal tidak valid diabaikan', () => {
    expect(parse('tanggal 31 november cek stok').date).toBeNull();
  });
});

describe('parseQuickPlan: jam', () => {
  test('jam 9 nanti hari ini (belum lewat)', () => {
    expect(parse('jam 9 cek email').date).toEqual(at(9, 12, 9));
  });

  test('jam yang sudah lewat tanpa hari pindah ke besok', () => {
    expect(parse('jam 7 sarapan').date).toEqual(at(9, 13, 7));
  });

  test('jam 3 tanpa periode dibaca sore', () => {
    expect(parse('jam 3 meeting klien')).toEqual({
      kind: 'meeting',
      title: 'Meeting klien',
      date: at(9, 12, 15),
      hasTime: true,
    });
  });

  test('jam 3 sore', () => {
    expect(parse('jam 3 sore jemput adik').date).toEqual(at(9, 12, 15));
  });

  test('jam 12 siang', () => {
    expect(parse('jam 12 siang makan bersama').date).toEqual(at(9, 12, 12));
  });

  test('jam 1 siang', () => {
    expect(parse('jam 1 siang kirim berkas').date).toEqual(at(9, 12, 13));
  });

  test('jam 12 malam = 00.00 berikutnya', () => {
    expect(parse('jam 12 malam deploy').date).toEqual(at(9, 13, 0));
  });

  test('setengah 8 pagi yang sudah lewat pindah ke besok', () => {
    expect(parse('setengah 8 pagi olahraga').date).toEqual(at(9, 13, 7, 30));
  });

  test('setengah 1 tanpa periode = 12.30', () => {
    expect(parse('setengah 1 istirahat').date).toEqual(at(9, 12, 12, 30));
  });

  test('pukul 14.30', () => {
    expect(parse('pukul 14.30 pertemuan dengan dosen')).toEqual({
      kind: 'meeting',
      title: 'Pertemuan dengan dosen',
      date: at(9, 12, 14, 30),
      hasTime: true,
    });
  });

  test('jam 14:30 dengan titik dua', () => {
    expect(parse('jam 14:30 bimbingan').date).toEqual(at(9, 12, 14, 30));
  });

  test('jam 9.15', () => {
    expect(parse('jam 9.15 standup').date).toEqual(at(9, 12, 9, 15));
  });

  test('angka dalam kata: jam tiga sore', () => {
    expect(parse('jam tiga sore rapat RT').date).toEqual(at(9, 12, 15));
  });

  test('angka dalam kata: setengah delapan malam', () => {
    expect(parse('setengah delapan malam belajar').date).toEqual(at(9, 12, 19, 30));
  });

  test('jam tidak valid diabaikan', () => {
    const r = parse('rapat jam 25');
    expect(r.date).toBeNull();
    expect(r.hasTime).toBe(false);
  });
});

describe('parseQuickPlan: jenis dan judul', () => {
  test('tanpa tanggal dan jam', () => {
    expect(parse('beli susu')).toEqual({ kind: 'task', title: 'Beli susu', date: null, hasTime: false });
  });

  test('kata kunci meeting', () => {
    expect(parse('Meeting proyek A').kind).toBe('meeting');
  });

  test('kata pengisi "ingatkan saya untuk" dibuang', () => {
    const r = parse('ingatkan saya untuk minum obat jam 9 malam');
    expect(r.title).toBe('Minum obat');
    expect(r.date).toEqual(at(9, 12, 21));
  });

  test('tanda baca dari hasil pengenalan suara', () => {
    expect(parse('Rapat, besok, jam 10.')).toEqual({
      kind: 'meeting',
      title: 'Rapat',
      date: at(9, 13, 10),
      hasTime: true,
    });
  });

  test('kapitalisasi asli dipertahankan', () => {
    expect(parse('besok kirim proposal ke PT Maju').title).toBe('Kirim proposal ke PT Maju');
  });
});
