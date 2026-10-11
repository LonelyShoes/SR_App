package expo.modules.sralarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class AlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      AlarmCore.ACTION_FIRE -> AlarmCore.ring(
        context,
        intent.getStringExtra(AlarmCore.EXTRA_TITLE) ?: "Timer selesai",
        intent.getStringExtra(AlarmCore.EXTRA_BODY) ?: ""
      )
      AlarmCore.ACTION_DISMISS -> AlarmCore.dismiss(context)
    }
  }
}
