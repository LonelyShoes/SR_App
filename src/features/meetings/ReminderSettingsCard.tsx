import React, { useState } from 'react';
import { Text } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { tokens } from '../../theme/tokens';
import { Card } from '../../components/Card';
import { Segmented } from '../../components/Form';
import { getSettingSync, setSetting } from '../settings/repository';
import {
  DEFAULT_REMINDER_OFFSET_MIN,
  REMINDER_OFFSET_CHOICES,
  reconcileMeetingReminders,
} from '../../notifications/scheduler';

type Choice = `${(typeof REMINDER_OFFSET_CHOICES)[number]}`;

const OPTIONS = REMINDER_OFFSET_CHOICES.map((m) => ({ value: String(m) as Choice, label: `${m} mnt` }));

/** Global default for meeting reminders (spec 6.6); meetings can override it individually. */
export function ReminderSettingsCard() {
  const { colors } = useTheme();
  const [value, setValue] = useState<Choice>(
    () => (getSettingSync('default_reminder_offset_min') ?? String(DEFAULT_REMINDER_OFFSET_MIN)) as Choice,
  );

  const change = async (next: Choice) => {
    setValue(next);
    await setSetting('default_reminder_offset_min', next);
    // Reschedule every upcoming reminder with the new offset
    await reconcileMeetingReminders();
  };

  return (
    <Card>
      <Segmented label="Ingatkan sebelum rapat" options={OPTIONS} value={value} onChange={change} />
      <Text style={{ ...tokens.typography.caption, color: colors.textSecondary, marginTop: -tokens.spacing.sm }}>
        Berlaku untuk rapat yang pengingatnya &quot;Default&quot;. Bisa diubah per rapat di form rapat.
      </Text>
    </Card>
  );
}
