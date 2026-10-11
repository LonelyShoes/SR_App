import React, { useState } from 'react';
import { View, Text, Switch, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { useTheme } from '../../theme/ThemeProvider';
import { tokens } from '../../theme/tokens';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { useSyncStore } from '../sync/service';
import { backupToCloud, exportBackupFile, pickBackupFile, setAutoBackupEnabled, useBackupStore } from './service';
import { confirmRestore } from './confirm-restore';

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function BackupSettingsCard() {
  const { colors } = useTheme();
  const { lastBackupAt, autoEnabled } = useBackupStore();
  const signedIn = useSyncStore((s) => s.email !== null);
  const [busy, setBusy] = useState<'cloud' | 'export' | 'import' | null>(null);

  const run = async (kind: 'cloud' | 'export' | 'import', task: () => Promise<void>) => {
    setBusy(kind);
    try {
      await task();
    } catch (e) {
      Alert.alert('Backup gagal', errorText(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Text style={{ color: colors.text }}>Backup otomatis harian</Text>
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            {signedIn ? 'Ke cloud, menyimpan 7 backup terakhir.' : 'Masuk ke akun untuk mengaktifkan backup cloud.'}
          </Text>
        </View>
        <Switch
          value={autoEnabled}
          onValueChange={setAutoBackupEnabled}
          trackColor={{ true: colors.primary, false: colors.border }}
          accessibilityLabel="Backup otomatis harian"
        />
      </View>
      <Text style={[styles.hint, { color: colors.textSecondary }]}>
        Backup terakhir:{' '}
        {lastBackupAt ? format(lastBackupAt, 'd MMM yyyy, HH:mm', { locale: localeId }) : 'belum pernah'}
      </Text>

      <View style={styles.buttons}>
        {signedIn && (
          <>
            <Button
              title="Backup ke cloud sekarang"
              loading={busy === 'cloud'}
              disabled={busy !== null}
              onPress={() =>
                run('cloud', async () => {
                  await backupToCloud();
                  Alert.alert('Backup selesai', 'Data tersimpan di cloud.');
                })
              }
            />
            <Button title="Pulihkan dari cloud" variant="secondary" onPress={() => router.push('/pulihkan')} />
          </>
        )}
        <Button
          title="Ekspor ke file"
          variant="secondary"
          loading={busy === 'export'}
          disabled={busy !== null}
          onPress={() => run('export', exportBackupFile)}
        />
        <Button
          title="Impor dari file"
          variant="secondary"
          loading={busy === 'import'}
          disabled={busy !== null}
          onPress={() =>
            run('import', async () => {
              const snapshot = await pickBackupFile();
              if (snapshot) confirmRestore(snapshot);
            })
          }
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  flex: {
    flex: 1,
  },
  hint: {
    ...tokens.typography.caption,
    marginTop: tokens.spacing.xs,
  },
  buttons: {
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.md,
  },
});
