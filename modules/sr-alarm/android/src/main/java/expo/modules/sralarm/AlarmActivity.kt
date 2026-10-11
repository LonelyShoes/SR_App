package expo.modules.sralarm

import android.app.Activity
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.text.format.DateFormat
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.view.animation.AccelerateDecelerateInterpolator
import android.widget.LinearLayout
import android.widget.TextView
import java.util.Date

/**
 * Full-screen alarm shown over the lock screen when a timer session ends.
 * Native (not React Native) so it appears instantly even when the JS app is not running.
 * Colors mirror the pastel tokens in src/theme/tokens.ts.
 */
class AlarmActivity : Activity() {
  private val onDismissed: () -> Unit = { runOnUiThread { finish() } }

  private data class Palette(
    val background: Int,
    val bubble: Int,
    val accent: Int,
    val onAccent: Int,
    val text: Int,
    val textSecondary: Int,
  )

  private val palette: Palette
    get() {
      val night = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
        Configuration.UI_MODE_NIGHT_YES
      return if (night) {
        Palette(
          background = Color.parseColor("#17181B"),
          bubble = Color.parseColor("#3A2A30"),
          accent = Color.parseColor("#F4AFBB"),
          onAccent = Color.parseColor("#2A1418"),
          text = Color.parseColor("#EEEEEA"),
          textSecondary = Color.parseColor("#A9ABA3"),
        )
      } else {
        Palette(
          background = Color.parseColor("#FBF3EE"),
          bubble = Color.parseColor("#FADCE0"),
          accent = Color.parseColor("#A93448"),
          onAccent = Color.WHITE,
          text = Color.parseColor("#24262A"),
          textSecondary = Color.parseColor("#6A6D66"),
        )
      }
    }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
    } else {
      @Suppress("DEPRECATION")
      window.addFlags(
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
      )
    }
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    AlarmCore.dismissListeners.add(onDismissed)
    render(intent)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    render(intent)
  }

  override fun onDestroy() {
    AlarmCore.dismissListeners.remove(onDismissed)
    super.onDestroy()
  }

  private fun dp(value: Float) =
    TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value, resources.displayMetrics).toInt()

  private fun text(value: String, sizeSp: Float, color: Int, bold: Boolean = false) = TextView(this).apply {
    this.text = value
    setTextSize(TypedValue.COMPLEX_UNIT_SP, sizeSp)
    setTextColor(color)
    gravity = Gravity.CENTER
    if (bold) typeface = Typeface.DEFAULT_BOLD
  }

  private fun pill(label: String, fill: Int, ink: Int, onClick: () -> Unit) = TextView(this).apply {
    text = label
    setTextSize(TypedValue.COMPLEX_UNIT_SP, 18f)
    typeface = Typeface.DEFAULT_BOLD
    setTextColor(ink)
    gravity = Gravity.CENTER
    setPadding(dp(24f), dp(18f), dp(24f), dp(18f))
    background = GradientDrawable().apply {
      cornerRadius = dp(32f).toFloat()
      setColor(fill)
    }
    isClickable = true
    isFocusable = true
    setOnClickListener { onClick() }
  }

  private fun render(intent: Intent) {
    val p = palette
    val title = intent.getStringExtra(AlarmCore.EXTRA_TITLE) ?: "Timer selesai"
    val body = intent.getStringExtra(AlarmCore.EXTRA_BODY) ?: ""

    window.statusBarColor = p.background
    window.navigationBarColor = p.background

    val bubble = text("⏰", 64f, p.text).apply {
      background = GradientDrawable().apply {
        shape = GradientDrawable.OVAL
        setColor(p.bubble)
      }
      layoutParams = LinearLayout.LayoutParams(dp(160f), dp(160f)).apply { gravity = Gravity.CENTER_HORIZONTAL }
    }
    // Gentle pulse so the screen reads as "ringing"
    bubble.animate().cancel()
    pulse(bubble)

    val clock = text(DateFormat.getTimeFormat(this).format(Date()), 56f, p.text, bold = true)
    val titleView = text(title, 26f, p.accent, bold = true)
    val bodyView = text(body, 16f, p.textSecondary)

    val stop = pill("Matikan", p.accent, p.onAccent) {
      AlarmCore.dismiss(this)
      finish()
    }
    val open = pill("Buka SR App", p.bubble, p.text) {
      AlarmCore.dismiss(this)
      val launch = packageManager.getLaunchIntentForPackage(packageName)?.apply {
        action = Intent.ACTION_VIEW
        data = Uri.parse("srapp://timer")
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      if (launch != null) startActivity(launch)
      finish()
    }

    val column = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setBackgroundColor(p.background)
      setPadding(dp(32f), dp(48f), dp(32f), dp(48f))
    }
    fun space(height: Float) = View(this).apply {
      layoutParams = LinearLayout.LayoutParams(1, dp(height))
    }
    val fill = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)

    column.addView(clock)
    column.addView(space(32f))
    column.addView(bubble)
    column.addView(space(32f))
    column.addView(titleView)
    column.addView(space(8f))
    column.addView(bodyView)
    column.addView(space(48f))
    column.addView(stop, fill)
    column.addView(space(12f))
    column.addView(open, fill)
    setContentView(column)
  }

  private fun pulse(view: View) {
    view.animate()
      .scaleX(1.08f).scaleY(1.08f)
      .setDuration(700)
      .setInterpolator(AccelerateDecelerateInterpolator())
      .withEndAction {
        view.animate().scaleX(1f).scaleY(1f).setDuration(700).withEndAction {
          if (!isFinishing) pulse(view)
        }.start()
      }
      .start()
  }

  // Back keeps the alarm ringing; the user must choose Matikan or Buka
  @Deprecated("Deprecated in Java")
  override fun onBackPressed() {
    moveTaskToBack(true)
  }
}
