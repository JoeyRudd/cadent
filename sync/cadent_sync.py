"""Pull recent Garmin running activities into Cadent's SQLite database."""

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


def is_run(activity: dict) -> bool:
    # Every Garmin running type ends in "running": running, trail_running, track_running, ...
    return "running" in activity.get("activityType", {}).get("typeKey", "")


def to_row(activity: dict) -> dict:
    duration = activity.get("movingDuration") or activity["duration"]
    avg_hr = activity.get("averageHR")
    return {
        "id": str(activity["activityId"]),
        "date": activity["startTimeLocal"][:10],
        "type": activity["activityType"]["typeKey"],
        "distance_m": round(activity.get("distance") or 0),
        "duration_s": round(duration),
        "avg_hr": round(avg_hr) if avg_hr is not None else None,
    }


def save(conn: sqlite3.Connection, activities: list[dict]) -> int:
    rows = [to_row(a) for a in activities if is_run(a)]
    with conn:
        conn.execute(SCHEMA)
        conn.executemany(UPSERT, rows)
    return len(rows)


def fetch(days: int) -> list[dict]:
    from garminconnect import Garmin

    garmin = Garmin(os.environ.get("GARMIN_EMAIL"), os.environ.get("GARMIN_PASSWORD"))
    garmin.login(os.environ.get("GARMINTOKENS", "~/.garminconnect"))
    today = date.today()
    start = today - timedelta(days=days)
    return garmin.get_activities_by_date(start.isoformat(), today.isoformat())


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--days", type=int, default=14, help="how many days back to sync")
    args = parser.parse_args()

    db_path = Path(os.environ.get("CADENT_DB", REPO_ROOT / "data" / "cadent.db"))
    db_path.parent.mkdir(parents=True, exist_ok=True)
    activities = fetch(args.days)
    conn = sqlite3.connect(db_path)
    count = save(conn, activities)
    conn.close()
    print(f"Synced {count} runs from the last {args.days} days to {db_path}")


if __name__ == "__main__":
    main()
