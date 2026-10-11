import { NativeModule, requireOptionalNativeModule } from 'expo';

type SrAlarmEvents = {
  onDismissed: () => void;
};

declare class SrAlarmModule extends NativeModule<SrAlarmEvents> {
  /** Ring at `triggerAtMs` (epoch ms) via AlarmManager; replaces any pending alarm. */
  schedule(triggerAtMs: number, title: string, body: string): void;
  /** Cancel the pending alarm (does not stop one that is already ringing). */
  cancelScheduled(): void;
  /** Stop a ringing alarm and close the alarm screen. */
  dismiss(): void;
  isRinging(): boolean;
  canScheduleExactAlarms(): boolean;
  canUseFullScreenIntent(): boolean;
  openExactAlarmSettings(): void;
  openFullScreenIntentSettings(): void;
}

/** Android-only native alarm; `null` on iOS/web, Expo Go and in tests. */
export const SrAlarm = requireOptionalNativeModule<SrAlarmModule>('SrAlarm');
