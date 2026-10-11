import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert } from 'react-native';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { useTheme } from '../../theme/ThemeProvider';
import { tokens } from '../../theme/tokens';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import {
  SyncStatus,
  isLinkedToOtherAccount,
  linkAccount,
  signIn,
  signOut,
  signUp,
  syncNow,
  useSyncStore,
} from './service';

const STATUS_LABEL: Record<SyncStatus, string> = {
  unconfigured: 'Belum dikonfigurasi',
  'signed-out': 'Belum masuk',
  idle: 'Tersinkron',
  syncing: 'Sedang menyinkronkan…',
  error: 'Gagal',
  offline: 'Offline, akan dicoba lagi',
};

export function SyncSettingsCard() {
  const { colors } = useTheme();
  const { status, email, lastSyncedAt, error } = useSyncStore();
  const [formEmail, setFormEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const statusColor: Record<SyncStatus, string> = {
    unconfigured: colors.textSecondary,
    'signed-out': colors.textSecondary,
    idle: colors.success,
    syncing: colors.primary,
    error: colors.error,
    offline: colors.warning,
  };

  const finishLogin = async (userId: string) => {
    if (await isLinkedToOtherAccount(userId)) {
      Alert.alert(
        'Akun berbeda',
        'Data di HP ini sebelumnya tersinkron dengan akun lain. Unggah semua data di HP ini ke akun yang baru masuk?',
        [
          { text: 'Batal & keluar', style: 'cancel', onPress: () => signOut() },
          { text: 'Unggah', onPress: () => linkAccount(userId) },
        ],
      );
      return;
    }
    await linkAccount(userId);
  };

  const submit = async (mode: 'masuk' | 'daftar') => {
    if (!formEmail.trim() || !password) {
      setMessage('Isi email dan kata sandi.');
      return;
    }
    setBusy(true);
    setMessage(null);
    const result = mode === 'masuk' ? await signIn(formEmail, password) : await signUp(formEmail, password);
    setBusy(false);
    if (result.error) {
      setMessage(result.error);
    } else if (result.needsConfirmation) {
      setMessage('Akun dibuat. Buka tautan konfirmasi di email, lalu masuk di sini.');
    } else if (result.userId) {
      setPassword('');
      await finishLogin(result.userId);
    }
  };

  if (status === 'unconfigured') {
    return (
      <Card>
        <Text style={{ color: colors.textSecondary }}>
          Sinkronisasi cloud belum dikonfigurasi. App tetap berfungsi penuh secara offline.
        </Text>
      </Card>
    );
  }

  if (!email) {
    return (
      <Card>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          Opsional: masuk untuk menyinkronkan data antar perangkat. Tanpa akun, data tetap tersimpan di HP ini.
        </Text>
        <TextInput
          value={formEmail}
          onChangeText={setFormEmail}
          placeholder="Email"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Kata sandi (min. 6 karakter)"
          placeholderTextColor={colors.textSecondary}
          secureTextEntry
          autoComplete="password"
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
        />
        {message && <Text style={[styles.hint, { color: colors.error }]}>{message}</Text>}
        <View style={styles.row}>
          <View style={styles.flex}>
            <Button title="Masuk" onPress={() => submit('masuk')} loading={busy} />
          </View>
          <View style={styles.flex}>
            <Button title="Daftar" variant="secondary" onPress={() => submit('daftar')} disabled={busy} />
          </View>
        </View>
      </Card>
    );
  }

  return (
    <Card>
      <Text style={{ color: colors.text }}>Masuk sebagai {email}</Text>
      <Text style={{ color: statusColor[status], marginTop: tokens.spacing.xs, fontWeight: 'bold' }}>
        {STATUS_LABEL[status]}
      </Text>
      {error && <Text style={[styles.hint, { color: colors.error }]}>{error}</Text>}
      <Text style={[styles.hint, { color: colors.textSecondary }]}>
        Sinkron terakhir:{' '}
        {lastSyncedAt ? format(lastSyncedAt, 'd MMM yyyy, HH:mm', { locale: localeId }) : 'belum pernah'}
      </Text>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Button title="Sinkronkan sekarang" onPress={() => syncNow()} loading={status === 'syncing'} />
        </View>
        <View style={styles.flex}>
          <Button
            title="Keluar"
            variant="secondary"
            onPress={() =>
              Alert.alert('Keluar dari akun?', 'Data tetap tersimpan di HP ini.', [
                { text: 'Batal', style: 'cancel' },
                { text: 'Keluar', onPress: () => signOut() },
              ])
            }
          />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: tokens.borderRadius.md,
    padding: tokens.spacing.sm + tokens.spacing.xs,
    marginBottom: tokens.spacing.sm,
  },
  hint: {
    ...tokens.typography.caption,
    marginVertical: tokens.spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.sm,
  },
  flex: {
    flex: 1,
  },
});
