"""Pull recent Garmin runs and overnight wellness (HRV, sleep, resting HR) into Cadent's SQLite database."""

import argparse
import os
import sqlite3
from datetime import date, timedelta
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

SCHEMA = """
CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  type TEXT NOT NULL,
  distance_m INTEGER NOT NULL,
  duration_s INTEGER NOT NULL,
  avg_hr INTEGER
)
"""

UPSERT = """
INSERT INTO activities (id, date, type, distance_m, duration_s, avg_hr)
VALUES (:id, :date, :type, :distance_m, :duration_s, :avg_hr)
ON CONFLICT(id) DO UPDATE SET
  date = excluded.date,
  type = excluded.type,
  distance_m = excluded.distance_m,
  duration_s = excluded.duration_s,
  avg_hr = excluded.avg_hr
"""

# One row per calendar day. Any column can be null: no watch overnight, or Garmin still building a baseline.
# A re-sync that comes back empty keeps what an earlier sync stored.
WELLNESS_SCHEMA = """
CREATE TABLE IF NOT EXISTS wellness (
  date TEXT PRIMARY KEY,
  hrv_ms INTEGER,
  hrv_week_ms INTEGER,
  hrv_status TEXT,
  sleep_s INTEGER,
  rhr INTEGER
)
"""

WELLNESS_UPSERT = """
INSERT INTO wellness (date, hrv_ms, hrv_week_ms, hrv_status, sleep_s, rhr)
VALUES (:date, :hrv_ms, :hrv_week_ms, :hrv_status, :sleep_s, :rhr)
ON CONFLICT(date) DO UPDATE SET
  hrv_ms = COALESCE(excluded.hrv_ms, hrv_ms),
  hrv_week_ms = COALESCE(excluded.hrv_week_ms, hrv_week_ms),
  hrv_status = COALESCE(excluded.hrv_status, hrv_status),
  sleep_s = COALESCE(excluded.sleep_s, sleep_s),
  rhr = COALESCE(excluded.rhr, rhr)
"""


# Readiness compares last night with the 7 nights before it, so older wellness is never read.
WELLNESS_DAYS = 7


def round_or_none(value: float | None) -> int | None:
    return round(value) if value is not None else None


def is_run(activity: dict) -> bool:
    # Every Garmin running type ends in "running": running, trail_running, track_running, ...
    return "running" in activity.get("activityType", {}).get("typeKey", "")


def to_row(activity: dict) -> dict:
    duration = activity.get("movingDuration") or activity["duration"]
    return {
        "id": str(activity["activityId"]),
        "date": activity["startTimeLocal"][:10],
        "type": activity["activityType"]["typeKey"],
        "distance_m": round(activity.get("distance") or 0),
        "duration_s": round(duration),
        "avg_hr": round_or_none(activity.get("averageHR")),
    }


def to_wellness_row(day: str, hrv: dict | None, sleep: dict | None, stats: dict | None) -> dict:
    summary = (hrv or {}).get("hrvSummary") or {}
    return {
        "date": day,
        "hrv_ms": round_or_none(summary.get("lastNightAvg")),
        "hrv_week_ms": round_or_none(summary.get("weeklyAvg")),
        "hrv_status": summary.get("status"),
        # Garmin reports 0 for a night the watch wasn't worn.
        "sleep_s": ((sleep or {}).get("dailySleepDTO") or {}).get("sleepTimeSeconds") or None,
        "rhr": (stats or {}).get("restingHeartRate"),
    }


def save(conn: sqlite3.Connection, activities: list[dict]) -> int:
    rows = [to_row(a) for a in activities if is_run(a)]
    with conn:
        conn.execute(SCHEMA)
        conn.executemany(UPSERT, rows)
    return len(rows)


def save_wellness(conn: sqlite3.Connection, rows: list[dict]) -> int:
    with conn:
        conn.execute(WELLNESS_SCHEMA)
        conn.executemany(WELLNESS_UPSERT, rows)
    return len(rows)


def login():
    from garminconnect import Garmin

    garmin = Garmin(os.environ.get("GARMIN_EMAIL"), os.environ.get("GARMIN_PASSWORD"))
    garmin.login(os.environ.get("GARMINTOKENS") or "~/.garminconnect")
    return garmin


def fetch(garmin, days: int) -> list[dict]:
    today = date.today()
    start = today - timedelta(days=days)
    return garmin.get_activities_by_date(start.isoformat(), today.isoformat())


def fetch_wellness(garmin, days: int) -> list[dict]:
    # Garmin dates overnight data by the morning you wake up, so "today" holds last night.
    today = date.today()
    rows = []
    for n in range(days + 1):
        day = (today - timedelta(days=n)).isoformat()
        rows.append(
            to_wellness_row(
                day, garmin.get_hrv_data(day), garmin.get_sleep_data(day), garmin.get_stats(day)
            )
        )
    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--days", type=int, default=14, help="how many days back to sync")
    args = parser.parse_args()

    db_path = Path(os.environ.get("CADENT_DB") or REPO_ROOT / "data" / "cadent.db")
    db_path.parent.mkdir(parents=True, exist_ok=True)
    garmin = login()
    conn = sqlite3.connect(db_path)
    # Runs first, so a failing wellness call never costs the runs.
    count = save(conn, fetch(garmin, args.days))
    nights = save_wellness(conn, fetch_wellness(garmin, WELLNESS_DAYS))
    conn.close()
    print(
        f"Synced {count} runs from the last {args.days} days and {nights} days of wellness to {db_path}"
    )


if __name__ == "__main__":
    main()
