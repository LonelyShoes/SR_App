import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { Directory, File, Paths } from 'expo-file-system';
import * as Crypto from 'expo-crypto';

export type Attachment = {
  id: string;
  name: string;
  uri: string; // local file:// uri inside the app's document directory
  mime_type: string | null;
  size: number | null;
};

const attachmentsDir = () => {
  const dir = new Directory(Paths.document, 'attachments');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
};

/**
 * Let the user pick files and copy them into permanent app storage.
 * The picker's cache copy can be purged by the OS, so it is not kept.
 * Returns an empty array when the user cancels.
 */
export const pickAttachments = async (): Promise<Attachment[]> => {
  const result = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
  if (result.canceled) return [];

  const dir = attachmentsDir();
  const saved: Attachment[] = [];
  for (const asset of result.assets) {
    const id = Crypto.randomUUID();
    const source = new File(asset.uri);
    const destination = new File(dir, `${id}-${asset.name}`);
    await source.copy(destination);
    saved.push({
      id,
      name: asset.name,
      uri: destination.uri,
      mime_type: asset.mimeType ?? null,
      size: asset.size ?? null,
    });
  }
  return saved;
};

export const deleteAttachmentFile = (attachment: Attachment) => {
  const file = new File(attachment.uri);
  if (file.exists) file.delete();
};

/** Open the attachment through the system share sheet (view or send). */
export const openAttachment = async (attachment: Attachment) => {
  if (!new File(attachment.uri).exists) {
    throw new Error('File lampiran tidak ditemukan di perangkat ini.');
  }
  await Sharing.shareAsync(attachment.uri, {
    mimeType: attachment.mime_type ?? undefined,
    dialogTitle: attachment.name,
  });
};

export const formatFileSize = (bytes: number | null) => {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
