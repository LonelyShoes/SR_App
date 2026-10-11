import { describe, expect, jest, test } from '@jest/globals';
// jest.mock calls below are hoisted above this import
import { buildMinutesHtml, describePdfError, minutesPdfName } from '../pdf';
import type { Meeting } from '../../meetings/repository';

jest.mock('expo-print', () => ({}));
jest.mock('expo-sharing', () => ({}));
jest.mock('expo-file-system', () => ({ Directory: class {}, File: class {}, Paths: {} }));

const meeting = (title: string): Meeting =>
  ({
    id: 'm1',
    title,
    start_at: new Date(2026, 9, 11, 9, 0).getTime(),
    end_at: new Date(2026, 9, 11, 10, 0).getTime(),
    location: 'Ruang <A>',
  }) as Meeting;

describe('minutes PDF', () => {
  test('file name is dated and safe for Android folders', () => {
    expect(minutesPdfName(meeting('Rapat tim'))).toBe('Notula Rapat tim 2026-10-11.pdf');
    expect(minutesPdfName(meeting('Evaluasi Q1/Q2: "hasil"?'))).toBe('Notula Evaluasi Q1 Q2 hasil 2026-10-11.pdf');
    expect(minutesPdfName(meeting('a\\b|c*d'))).toBe('Notula a b c d 2026-10-11.pdf');
    expect(minutesPdfName(meeting('   '))).toBe('Notula Rapat 2026-10-11.pdf');
  });

  test('long titles are shortened', () => {
    const name = minutesPdfName(meeting('x'.repeat(200)));
    expect(name.length).toBeLessThan(90);
  });

  test('HTML escapes user content', () => {
    const html = buildMinutesHtml(meeting('<script>'), {
      discussion: 'a & b',
      decisions: '',
      attendees: ['Budi'],
      action_items: [{ text: 'Kirim <laporan>', assignee: null, due_at: null }],
      attachments: [],
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('a &amp; b');
    expect(html).toContain('Kirim &lt;laporan&gt;');
    expect(html).toContain('Ruang &lt;A&gt;');
  });

  test('error message includes the native code', () => {
    const e = Object.assign(new Error('Write failed'), { code: 'ERR_PDF' });
    expect(describePdfError(e)).toBe('Write failed (ERR_PDF)');
    expect(describePdfError('boom')).toBe('boom');
  });
});
