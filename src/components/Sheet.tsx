import React from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, Text, ScrollView, KeyboardAvoidingView } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

type SheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
};

export const Sheet = ({ visible, onClose, title, children }: SheetProps) => {
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          {title && <Text style={[styles.title, { color: colors.text }]}>{title}</Text>}
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    minHeight: 300,
    maxHeight: '90%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
});
