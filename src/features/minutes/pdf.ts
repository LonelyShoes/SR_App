import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Directory, File, Paths } from 'expo-file-system';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import type { Meeting } from '../meetings/repository';
import { tokens } from '../../theme/tokens';
import type { MinuteInput } from './repository';

// PDF is always light (spec 6.8)
const pdfColors = tokens.colors.light;

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// Keep line breaks typed in multiline inputs
const paragraph = (value: string) => (value.trim() ? escapeHtml(value).replace(/\n/g, '<br/>') : '<em>-</em>');

export const buildMinutesHtml = (meeting: Meeting, minute: MinuteInput): string => {
  const date = format(meeting.start_at, 'EEEE, d MMMM yyyy', { locale: localeId });
  const time = `${format(meeting.start_at, 'HH:mm')}–${format(meeting.end_at, 'HH:mm')}`;

  const attendees = minute.attendees.length
    ? `<ul>${minute.attendees.map((a) => `<li>${escapeHtml(a)}</li>`).join('')}</ul>`
    : '<p><em>-</em></p>';

  const actionRows = minute.action_items
    .map(
      (item, i) => `<tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(item.text)}</td>
        <td>${item.assignee ? escapeHtml(item.assignee) : '-'}</td>
        <td>${item.due_at ? format(item.due_at, 'd MMM yyyy', { locale: localeId }) : '-'}</td>
      </tr>`,
    )
    .join('');

  const actionItems = minute.action_items.length
    ? `<table><thead><tr><th>No</th><th>Tindak Lanjut</th><th>PJ</th><th>Tenggat</th></tr></thead><tbody>${actionRows}</tbody></table>`
    : '<p><em>-</em></p>';

  const attachments = minute.attachments.length
    ? `<ul>${minute.attachments.map((a) => `<li>${escapeHtml(a.name)}</li>`).join('')}</ul>`
    : '<p><em>-</em></p>';

  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8" />
<style>
  @page { margin: 32px; }
  body { font-family: sans-serif; color: ${pdfColors.text}; font-size: 12pt; line-height: 1.5; }
  .header { background: ${pdfColors.primarySoft}; border-radius: 12px; padding: 14px 18px; margin-bottom: 8px; }
  .kicker { color: ${pdfColors.primary}; font-size: 9pt; font-weight: bold; letter-spacing: 1px; margin: 0; }
  h1 { font-size: 18pt; margin: 2px 0 4px; }
  h2 { font-size: 13pt; color: ${pdfColors.primary}; margin: 20px 0 6px; border-bottom: 1px solid ${pdfColors.border}; padding-bottom: 4px; }
  .meta { color: ${pdfColors.textSecondary}; margin: 0; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid ${pdfColors.border}; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: ${pdfColors.primarySoft}; }
</style>
</head>
<body>
  <div class="header">
    <p class="kicker">NOTULA RAPAT</p>
    <h1>${escapeHtml(meeting.title)}</h1>
    <p class="meta">${date}, ${time}${meeting.location ? ` · ${escapeHtml(meeting.location)}` : ''}</p>
  </div>
  <h2>Peserta Hadir</h2>
  ${attendees}
  <h2>Pembahasan</h2>
  <p>${paragraph(minute.discussion)}</p>
  <h2>Keputusan</h2>
  <p>${paragraph(minute.decisions)}</p>
  <h2>Action Items</h2>
  ${actionItems}
  <h2>Lampiran</h2>
  ${attachments}
</body>
</html>`;
};

// Characters Android/SAF reject in file names
const safeFileName = (value: string) =>
  value
    .replace(/[\\/:*?"<>|\n\r\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60) || 'Rapat';

export const minutesPdfName = (meeting: Meeting) =>
  `Notula ${safeFileName(meeting.title)} ${format(meeting.start_at, 'yyyy-MM-dd')}.pdf`;

/** Render the notula to a PDF in the cache, named after the meeting. */
export const renderMinutesPdf = async (meeting: Meeting, minute: MinuteInput): Promise<File> => {
  const { uri } = await Print.printToFileAsync({ html: buildMinutesHtml(meeting, minute) });
  const dir = new Directory(Paths.cache, 'notula-pdf');
  if (!dir.exists) dir.create({ intermediates: true });
  const target = new File(dir, minutesPdfName(meeting));
  if (target.exists) target.delete();
  new File(uri).moveSync(target);
  return target;
};

/** Open the share sheet; falls back to the system print dialog ("Simpan sebagai PDF"). */
export const shareMinutesPdf = async (pdf: File, meeting: Meeting) => {
  try {
    if (!(await Sharing.isAvailableAsync())) throw new Error('Fitur berbagi tidak tersedia di perangkat ini.');
    await Sharing.shareAsync(pdf.uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Notula ${meeting.title}`,
      UTI: 'com.adobe.pdf',
    });
  } catch (e) {
    console.warn('Share PDF failed, opening print dialog:', e);
    await Print.printAsync({ uri: pdf.uri });
  }
};

/**
 * Save a copy into a folder the user picks (e.g. Download).
 * Returns false when the picker was cancelled.
 */
export const saveMinutesPdf = async (pdf: File, meeting: Meeting): Promise<boolean> => {
  let dir: Directory;
  try {
    dir = await Directory.pickDirectoryAsync();
  } catch {
    return false; // cancelled
  }
  const target = dir.createFile(minutesPdfName(meeting).replace(/\.pdf$/, ''), 'application/pdf');
  target.write(await pdf.bytes());
  return true;
};

/** Readable message for an export failure, including the native error code. */
export const describePdfError = (e: unknown) => {
  if (e instanceof Error) {
    const code = (e as Error & { code?: string }).code;
    return code ? `${e.message} (${code})` : e.message;
  }
  return String(e);
};
