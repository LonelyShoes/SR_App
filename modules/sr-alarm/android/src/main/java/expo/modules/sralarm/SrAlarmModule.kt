package expo.modules.sralarm

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SrAlarmModule : Module() {
  private val context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val onDismissed: () -> Unit = { sendEvent("onDismissed", mapOf<String, Any?>()) }

  private fun openSettings(action: String) {
    val intent = Intent(action, Uri.parse("package:" + context.packageName))
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    try {
      context.startActivity(intent)
    } catch (e: Exception) {
      // Some OEM builds lack the dedicated page; fall back to the app's details page
      context.startActivity(
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + context.packageName))
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      )
    }
  }

  override fun definition() = ModuleDefinition {
    Name("SrAlarm")

    Events("onDismissed")

    OnCreate { AlarmCore.dismissListeners.add(onDismissed) }

    OnDestroy { AlarmCore.dismissListeners.remove(onDismissed) }

    Function("schedule") { triggerAtMs: Double, title: String, body: String ->
      AlarmCore.schedule(context, triggerAtMs.toLong(), title, body)
    }

    Function("cancelScheduled") { AlarmCore.cancelScheduled(context) }

    Function("dismiss") { AlarmCore.dismiss(context) }

    Function("isRinging") { AlarmCore.isRinging(context) }

    Function("canScheduleExactAlarms") { AlarmCore.canScheduleExact(context) }

    Function("canUseFullScreenIntent") { AlarmCore.canUseFullScreenIntent(context) }

    Function("openExactAlarmSettings") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        openSettings(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM)
      }
    }

    Function("openFullScreenIntentSettings") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        openSettings(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT)
      }
    }
  }
}
