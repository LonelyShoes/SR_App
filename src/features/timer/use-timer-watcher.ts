import { useEffect } from 'react';
import { AppState } from 'react-native';
import { SrAlarm } from '../../../modules/sr-alarm';
import { isTimerAlarmRinging } from './alarm';
import { useTimerStore } from './store';

// Ending later than this means the app was in the background when the alarm fired
const LATE_MS = 5000;

/**
 * App-wide: completes the session when the countdown hits zero (whatever screen is open)
 * and keeps `ringing` in sync with the native alarm.
 */
export function useTimerWatcher() {
  const endAt = useTimerStore((s) => s.endAt);
  const status = useTimerStore((s) => s.status);

  useEffect(() => {
    if (status !== 'running' || !endAt) return;

    const finish = () => {
      const late = Date.now() - endAt > LATE_MS;
      useTimerStore.getState().complete();
      // Already silenced from the notification or alarm screen while we were away
      if (late && SrAlarm && !isTimerAlarmRinging()) useTimerStore.setState({ ringing: false });
    };

    const timeout = setTimeout(finish, Math.max(0, endAt - Date.now()));
    // Timers are paused in the background; re-check when the app comes back
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && Date.now() >= endAt) finish();
    });
    return () => {
      clearTimeout(timeout);
      sub.remove();
    };
  }, [status, endAt]);

  useEffect(() => {
    if (!SrAlarm) return;
    const dismissed = SrAlarm.addListener('onDismissed', () => useTimerStore.setState({ ringing: false }));
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && useTimerStore.getState().ringing && !isTimerAlarmRinging()) {
        useTimerStore.setState({ ringing: false });
      }
    });
    return () => {
      dismissed.remove();
      sub.remove();
    };
  }, []);
}
