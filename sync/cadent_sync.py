"""Pull recent Garmin runs, their laps and samples, and overnight wellness (HRV, sleep, resting HR) into
Cadent's SQLite database."""

import argparse
import json
import os
import sqlite3
import sys
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


# One row per run: its Garmin laps and its samples, each a JSON array of arrays (see to_details_row).
# Fetched once per run: the run detail screen only needs them as Garmin first recorded them.
DETAILS_SCHEMA = """
CREATE TABLE IF NOT EXISTS details (
  activity_id TEXT PRIMARY KEY,
  laps TEXT NOT NULL,
  points TEXT NOT NULL
)
"""

# Samples per run: enough for a phone-width chart; Garmin downsamples to this.
DETAIL_POINTS = 500

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


def to_details_row(activity_id: str, splits: dict | None, details: dict | None) -> dict:
    """Laps as [distance_m, duration_s, avg_hr, max_hr, elev_gain_m, cadence_spm] and samples as
    [elapsed_s, distance_m, hr, speed_m_s, elevation_m]. Any value but the first two can be null."""
    from garminconnect.activity_details import parse_activity_detail_metrics

    laps = [
        [
            round(lap.get("distance") or 0),
            round(lap.get("movingDuration") or lap.get("duration") or 0),
            round_or_none(lap.get("averageHR")),
            round_or_none(lap.get("maxHR")),
            round_or_none(lap.get("elevationGain")),
            round_or_none(lap.get("averageRunCadence")),
        ]
        for lap in (splits or {}).get("lapDTOs") or []
    ]
    points = [
        [
            round(sample["sumDuration"]),
            round(sample["sumDistance"]),
            round_or_none(sample.get("directHeartRate")),
            round(sample["directSpeed"], 2) if sample.get("directSpeed") is not None else None,
            round(sample["directElevation"], 1)
            if sample.get("directElevation") is not None
            else None,
        ]
        for sample in parse_activity_detail_metrics(details or {})
        # A sample before the GPS locks has no distance yet; it can't sit on a distance axis.
        if sample.get("sumDuration") is not None and sample.get("sumDistance") is not None
    ]
    return {"activity_id": activity_id, "laps": json.dumps(laps), "points": json.dumps(points)}


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


def missing_details(conn: sqlite3.Connection, activities: list[dict]) -> list[str]:
    """Ids of the runs in `activities` with no details row yet."""
    conn.execute(DETAILS_SCHEMA)
    have = {row[0] for row in conn.execute("SELECT activity_id FROM details")}
    return [
        row["id"] for row in (to_row(a) for a in activities if is_run(a)) if row["id"] not in have
    ]


def save_details(conn: sqlite3.Connection, row: dict) -> None:
    with conn:
        conn.execute(DETAILS_SCHEMA)
        conn.execute(
            "INSERT OR REPLACE INTO details (activity_id, laps, points) VALUES (:activity_id, :laps, :points)",
            row,
        )


def save_wellness(conn: sqlite3.Connection, rows: list[dict]) -> int:
    with conn:
        conn.execute(WELLNESS_SCHEMA)
        conn.executemany(WELLNESS_UPSERT, rows)
    return len(rows)


# Exit code for "no usable Garmin token": the app tells the user to connect Garmin in Settings.
NOT_CONNECTED = 3

# Saved beside Garmin's token on connect, with the account's name for Settings.
ACCOUNT_FILE = "account.json"


def tokens_dir() -> Path:
    return Path(os.environ.get("GARMINTOKENS") or "~/.garminconnect").expanduser()


def login():
    """Signs in with the saved token only. The password is never stored, so there's nothing to fall back to."""
    from garminconnect import Garmin

    garmin = Garmin()
    garmin.login(str(tokens_dir()))
    return garmin


def connect() -> None:
    """Logs in once with the email and password the app writes to stdin, then saves only Garmin's token.

    Talks to the app line by line on stdout: "mfa" asks for the code (read from the next stdin line),
    then "connected", "bad-login" or "too-many"; any other failure is a non-zero exit with no line.
    The password never touches argv, the environment, disk or a log.
    """
    from garminconnect import Garmin
    from garminconnect.exceptions import (
        GarminConnectAuthenticationError,
        GarminConnectTooManyRequestsError,
    )

    def ask_mfa() -> str:
        print("mfa", flush=True)
        return sys.stdin.readline().strip()

    tokens = tokens_dir()
    try:
        login_details = json.loads(sys.stdin.readline())
        garmin = Garmin(login_details["email"], login_details["password"], prompt_mfa=ask_mfa)
        # No token store here: a fresh login, not a reload of whatever token is already saved.
        garmin.login()
        garmin.client.dump(str(tokens))
        # Written last: the app reads this file as "connected".
        (tokens / ACCOUNT_FILE).write_text(json.dumps({"name": garmin.get_full_name()}))
    except GarminConnectAuthenticationError:
        print("bad-login", flush=True)
        sys.exit(1)
    except GarminConnectTooManyRequestsError:
        print("too-many", flush=True)
        sys.exit(1)
    print("connected", flush=True)


def disconnect() -> None:
    """Deletes the saved token and account. Garmin's library names its own token file."""
    from garminconnect.client.tokens import token_file_path

    tokens = tokens_dir()
    # Token first: if that fails, Settings still shows the account as connected, which it is.
    token_file_path(str(tokens)).unlink(missing_ok=True)
    (tokens / ACCOUNT_FILE).unlink(missing_ok=True)


def fetch(garmin, days: int) -> list[dict]:
    today = date.today()
    start = today - timedelta(days=days)
    return garmin.get_activities_by_date(start.isoformat(), today.isoformat())


def fetch_details(garmin, activity_id: str) -> dict:
    return to_details_row(
        activity_id,
        garmin.get_activity_splits(activity_id),
        garmin.get_activity_details(activity_id, maxchart=DETAIL_POINTS),
    )


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
    parser.add_argument(
        "--wellness-days",
        type=int,
        default=WELLNESS_DAYS,
        help="how many nights back to sync wellness (the app's Sync button only needs the latest)",
    )
    parser.add_argument(
        "--connect",
        action="store_true",
        help="log in and save Garmin's token (used by the app's Settings; reads the login from stdin)",
    )
    parser.add_argument(
        "--disconnect",
        action="store_true",
        help="delete the saved token (used by the app's Settings)",
    )
    args = parser.parse_args()
    if args.connect:
        connect()
        return
    if args.disconnect:
        disconnect()
        return

    db_path = Path(os.environ.get("CADENT_DB") or REPO_ROOT / "data" / "cadent.db")
    db_path.parent.mkdir(parents=True, exist_ok=True)
    from garminconnect.exceptions import GarminConnectAuthenticationError

    account = tokens_dir() / ACCOUNT_FILE
    conn = sqlite3.connect(db_path)
    try:
        garmin = login()
        # Settings reads this file as "connected": keep it in step with whether the token works,
        # including a token saved before Settings could connect.
        if not account.exists():
            account.write_text(json.dumps({"name": garmin.get_full_name()}))
        # Runs first, so a failing wellness or details call never costs the runs.
        activities = fetch(garmin, args.days)
        count = save(conn, activities)
        nights = save_wellness(conn, fetch_wellness(garmin, args.wellness_days))
        # One run at a time, so each run's details are kept even if a later one fails.
        for activity_id in missing_details(conn, activities):
            save_details(conn, fetch_details(garmin, activity_id))
    except GarminConnectAuthenticationError as error:
        account.unlink(missing_ok=True)
        print(f"Garmin isn't connected (connect it in Settings): {error}", file=sys.stderr)
        sys.exit(NOT_CONNECTED)
    finally:
        conn.close()
    print(
        f"Synced {count} runs from the last {args.days} days and {nights} days of wellness to {db_path}"
    )


if __name__ == "__main__":
    main()
