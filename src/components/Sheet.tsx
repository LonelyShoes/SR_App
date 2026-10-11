import React from 'react';
import { View, StyleSheet, Modal, Pressable, Text, ScrollView, KeyboardAvoidingView } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { tokens } from '../theme/tokens';
import { Icon, IconName } from './Icon';
import { Tap } from './Tap';

type SheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** Pastel icon above the title, like the reference bottom sheets */
  icon?: IconName;
  subtitle?: string;
  children: React.ReactNode;
};

export const Sheet = ({ visible, onClose, title, icon, subtitle, children }: SheetProps) => {
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Tutup" />
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.header}>
            <View style={styles.headerText}>
              {icon && (
                <View style={[styles.iconBubble, { backgroundColor: colors.primarySoft }]}>
                  <Icon name={icon} size={26} color={colors.primary} />
                </View>
              )}
              {title && <Text style={[styles.title, { color: colors.text }]}>{title}</Text>}
              {subtitle && <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>}
            </View>
            <Tap
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Tutup"
              hitSlop={8}
              style={[styles.close, { backgroundColor: colors.surfaceAlt }]}
            >
              <Icon name="close" size={20} color={colors.textSecondary} />
            </Tap>
          </View>
          {/* Long forms scroll; taps on buttons work while the keyboard is open */}
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheet: {
    borderTopLeftRadius: tokens.borderRadius.xl,
    borderTopRightRadius: tokens.borderRadius.xl,
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.sm + tokens.spacing.xs,
    paddingBottom: tokens.spacing.lg,
    minHeight: 300,
    maxHeight: '92%',
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: tokens.spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: tokens.spacing.md,
  },
  headerText: {
    flex: 1,
  },
  iconBubble: {
    width: 52,
    height: 52,
    borderRadius: tokens.borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.spacing.sm + tokens.spacing.xs,
  },
  title: {
    ...tokens.typography.h2,
  },
  subtitle: {
    ...tokens.typography.caption,
    marginTop: tokens.spacing.xs,
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: tokens.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
