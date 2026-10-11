import { Alert } from 'react-native';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import type { Snapshot } from './snapshot';
import { restoreBackup } from './service';

const countRows = (snapshot: Snapshot, table: string) =>
  (snapshot.tables[table] ?? []).filter((r) => r.deleted_at == null).length;

/** Ask before overwriting local data, then restore. Calls onDone after success. */
export const confirmRestore = (snapshot: Snapshot, onDone?: () => void) => {
  const when = format(snapshot.created_at, 'd MMM yyyy, HH:mm', { locale: localeId });
  Alert.alert(
    'Pulihkan backup?',
    `Backup ${when}: ${countRows(snapshot, 'tasks')} tugas, ${countRows(snapshot, 'meetings')} rapat, ` +
      `${countRows(snapshot, 'minutes')} notula.\n\nData saat ini akan diganti. Salinan data saat ini dibuat dulu secara otomatis.`,
    [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Pulihkan',
        style: 'destructive',
        onPress: async () => {
          try {
            await restoreBackup(snapshot);
            Alert.alert('Berhasil', 'Data sudah dipulihkan.');
            onDone?.();
          } catch (e) {
            Alert.alert('Gagal memulihkan', e instanceof Error ? e.message : String(e));
          }
        },
      },
    ],
  );
};
