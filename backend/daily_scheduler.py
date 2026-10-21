# daily_scheduler.py
# Background scheduler for triggering the daily job matching pipeline.
from datetime import datetime, timedelta
import threading

import daily_db
import daily_jobs

_schedule = {
    "enabled": True,
    "run_hour": 9,
    "run_minute": 0,
}
_stop_event = threading.Event()
_scheduler_thread = None
_lock = threading.Lock()


def _scheduler_loop():
    while not _stop_event.is_set():
        try:
            settings = daily_db.get_settings()
            with _lock:
                _schedule["enabled"] = bool(settings.get("enabled", True))
                _schedule["run_hour"] = int(settings.get("run_hour", 9))
                _schedule["run_minute"] = int(settings.get("run_minute", 0))

            if _schedule.get("enabled"):
                tz = daily_jobs.timezone()
                now = datetime.now(tz)
                if daily_jobs.should_catch_up(settings, now):
                    daily_jobs.run_daily_safely()
        except Exception as e:
            print(f"[DailyScheduler] Unexpected error: {e}")

        _stop_event.wait(timeout=30)


def start():
    """Start the background scheduler thread if not already running."""
    global _scheduler_thread
    with _lock:
        if _scheduler_thread is not None and _scheduler_thread.is_alive():
            return

        try:
            settings = daily_db.get_settings()
            _schedule["enabled"] = bool(settings.get("enabled", True))
            _schedule["run_hour"] = int(settings.get("run_hour", 9))
            _schedule["run_minute"] = int(settings.get("run_minute", 0))
        except Exception:
            pass

        _stop_event.clear()
        _scheduler_thread = threading.Thread(
            target=_scheduler_loop,
            daemon=True,
            name="DailySchedulerThread",
        )
        _scheduler_thread.start()


def shutdown():
    """Stop the background scheduler thread."""
    global _scheduler_thread
    with _lock:
        _stop_event.set()
        if _scheduler_thread is not None:
            _scheduler_thread.join(timeout=2.0)
            _scheduler_thread = None


def apply_schedule(enabled: bool, run_hour: int, run_minute: int):
    """Update scheduled time and enabled state."""
    with _lock:
        _schedule["enabled"] = bool(enabled)
        _schedule["run_hour"] = int(run_hour)
        _schedule["run_minute"] = int(run_minute)


def next_run_time():
    """Return ISO format string of the next scheduled run, or None if disabled."""
    with _lock:
        if not _schedule.get("enabled"):
            return None

        tz = daily_jobs.timezone()
        now = datetime.now(tz)
        target = now.replace(
            hour=_schedule["run_hour"],
            minute=_schedule["run_minute"],
            second=0,
            microsecond=0,
        )
        if target <= now:
            target += timedelta(days=1)

        return target.isoformat()
