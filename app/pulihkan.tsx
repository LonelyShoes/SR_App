import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { useTheme } from '../src/theme/ThemeProvider';
import { tokens } from '../src/theme/tokens';
import { Card } from '../src/components/Card';
import { Icon } from '../src/components/Icon';
import { IconBubble } from '../src/components/IconBubble';
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
      {error ? (
        <EmptyState icon="cloud_off" tone="error" title="Gagal memuat backup" description={error} />
      ) : !backups ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: tokens.spacing.xl }} />
      ) : backups.length === 0 ? (
        <EmptyState
          icon="backup"
          title="Belum ada backup"
          description="Backup cloud dibuat otomatis setiap hari saat kamu masuk ke akun."
        />
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
            <Card
              onPress={opening === null ? () => open(item) : undefined}
              accessibilityLabel={`Pulihkan backup ${item.name}`}
            >
              <View style={styles.row}>
                <IconBubble name="restore" tone="santai" />
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
                {opening === item.path ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <Icon name="chevron_right" size={22} color={colors.textSecondary} />
                )}
              </View>
            </Card>
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
    gap: tokens.spacing.sm + tokens.spacing.xs,
  },
  flex: {
    flex: 1,
  },
});
