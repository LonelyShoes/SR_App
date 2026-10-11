import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import type { Meeting } from '../meetings/repository';
import type { MinuteInput } from './repository';

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// Keep line breaks typed in multiline inputs
const paragraph = (value: string) =>
  value.trim() ? escapeHtml(value).replace(/\n/g, '<br/>') : '<em>-</em>';

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
  body { font-family: sans-serif; color: #1A1A1A; font-size: 12pt; line-height: 1.5; }
  h1 { font-size: 18pt; margin: 0 0 4px; }
  h2 { font-size: 13pt; margin: 20px 0 6px; border-bottom: 1px solid #E0E0E0; padding-bottom: 4px; }
  .meta { color: #666666; margin: 0; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #E0E0E0; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #F5F5F5; }
</style>
</head>
<body>
  <h1>Notula: ${escapeHtml(meeting.title)}</h1>
  <p class="meta">${date}, ${time}${meeting.location ? ` · ${escapeHtml(meeting.location)}` : ''}</p>
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

/** Render the notula to PDF and open the system share sheet. */
export const exportMinutesPdf = async (meeting: Meeting, minute: MinuteInput) => {
  const { uri } = await Print.printToFileAsync({ html: buildMinutesHtml(meeting, minute) });

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Fitur berbagi tidak tersedia di perangkat ini.');
  }

  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: `Notula ${meeting.title}`,
    UTI: 'com.adobe.pdf',
  });
};
