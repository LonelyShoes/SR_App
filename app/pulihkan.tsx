import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { Stack, router } from 'expo-router';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { useTheme } from '../src/theme/ThemeProvider';
import { tokens } from '../src/theme/tokens';
import { Card } from '../src/components/Card';
import { EmptyState } from '../src/components/EmptyState';
import { CloudBackup, downloadCloudBackup, listCloudBackups } from '../src/features/backup/service';
import { confirmRestore } from '../src/features/backup/confirm-restore';
import { formatFileSize } from '../src/features/minutes/attachments';

export default function Pulihkan() {
  const { colors } = useTheme();
  const [backups, setBackups] = useState<CloudBackup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  useEffect(() => {
    listCloudBackups()
      .then(setBackups)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const open = async (backup: CloudBackup) => {
    setOpening(backup.path);
    try {
      const snapshot = await downloadCloudBackup(backup.path);
      confirmRestore(snapshot, () => router.back());
    } catch (e) {
      Alert.alert('Gagal membuka backup', e instanceof Error ? e.message : String(e));
    } finally {
      setOpening(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.text }} />
      {error ? (
        <EmptyState title="Gagal memuat backup" description={error} />
      ) : !backups ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: tokens.spacing.xl }} />
      ) : backups.length === 0 ? (
        <EmptyState title="Belum ada backup" description="Backup cloud dibuat otomatis setiap hari saat kamu masuk ke akun." />
      ) : (
        <FlatList
          data={backups}
          keyExtractor={(b) => b.path}
          contentContainerStyle={styles.content}
          ListHeaderComponent={
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              Pilih backup untuk dipulihkan. Data saat ini akan dicadangkan dulu.
            </Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => open(item)} disabled={opening !== null} activeOpacity={0.7}>
              <Card style={styles.row}>
                <View style={styles.flex}>
                  <Text style={{ color: colors.text, fontWeight: 'bold' }}>
                    {item.createdAt
                      ? format(item.createdAt, 'EEEE, d MMM yyyy · HH:mm', { locale: localeId })
                      : item.name}
                  </Text>
                  {item.size != null && (
                    <Text style={{ color: colors.textSecondary, ...tokens.typography.small }}>
                      {formatFileSize(item.size)}
                    </Text>
                  )}
                </View>
                {opening === item.path && <ActivityIndicator color={colors.primary} />}
              </Card>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: tokens.spacing.md,
  },
  hint: {
    ...tokens.typography.caption,
    marginBottom: tokens.spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flex: {
    flex: 1,
  },
});
