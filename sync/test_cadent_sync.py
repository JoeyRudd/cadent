import io
import json
import sqlite3
from datetime import date, timedelta
from pathlib import Path

import pytest

from cadent_sync import (
    NOT_CONNECTED,
    fetch_wellness,
    is_run,
    main,
    save,
    save_wellness,
    to_row,
    to_wellness_row,
)


def activity(**overrides) -> dict:
    a = {
        "activityId": 21234567890,
        "startTimeLocal": "2026-10-25 07:12:03",
        "activityType": {"typeKey": "running"},
        "distance": 8046.72,
        "duration": 2701.6,
        "movingDuration": 2655.4,
        "averageHR": 148.0,
    }
    a.update(overrides)
    return a


def test_to_row_maps_garmin_fields():
    assert to_row(activity()) == {
        "id": "21234567890",
        "date": "2026-10-25",
        "type": "running",
        "distance_m": 8047,
        "duration_s": 2655,
        "avg_hr": 148,
    }


def test_to_row_falls_back_to_elapsed_duration_and_allows_missing_hr():
    row = to_row(activity(movingDuration=None, averageHR=None))
    assert row["duration_s"] == 2702
    assert row["avg_hr"] is None


def test_is_run_keeps_every_running_type():
    for key in ("running", "treadmill_running", "trail_running", "track_running"):
        assert is_run(activity(activityType={"typeKey": key}))
    for key in ("cycling", "walking", "strength_training"):
        assert not is_run(activity(activityType={"typeKey": key}))


def test_save_is_idempotent_and_skips_non_runs():
    conn = sqlite3.connect(":memory:")
    activities = [
        activity(),
        activity(activityId=2, activityType={"typeKey": "trail_running"}),
        activity(activityId=3, activityType={"typeKey": "cycling"}),
    ]
    assert save(conn, activities) == 2
    assert save(conn, activities) == 2
    assert conn.execute("SELECT id FROM activities ORDER BY id").fetchall() == [
        ("2",),
        ("21234567890",),
    ]


def test_save_updates_an_edited_activity():
    conn = sqlite3.connect(":memory:")
    save(conn, [activity()])
    save(conn, [activity(distance=10000.4)])
    assert conn.execute("SELECT distance_m FROM activities").fetchall() == [(10000,)]


def test_to_wellness_row_maps_garmin_fields():
    hrv = {"hrvSummary": {"lastNightAvg": 57.6, "weeklyAvg": 55.2, "status": "BALANCED"}}
    sleep = {"dailySleepDTO": {"sleepTimeSeconds": 26400}}
    stats = {"restingHeartRate": 52}
    assert to_wellness_row("2026-10-29", hrv, sleep, stats) == {
        "date": "2026-10-29",
        "hrv_ms": 58,
        "hrv_week_ms": 55,
        "hrv_status": "BALANCED",
        "sleep_s": 26400,
        "rhr": 52,
    }


def test_to_wellness_row_allows_a_night_without_data():
    no_sleep = {"dailySleepDTO": {"sleepTimeSeconds": 0}}
    assert to_wellness_row("2026-10-29", None, no_sleep, {}) == {
        "date": "2026-10-29",
        "hrv_ms": None,
        "hrv_week_ms": None,
        "hrv_status": None,
        "sleep_s": None,
        "rhr": None,
    }


def test_save_wellness_upserts_by_date_and_keeps_values_a_resync_lacks():
    conn = sqlite3.connect(":memory:")
    sleep = {"dailySleepDTO": {"sleepTimeSeconds": 26400}}
    save_wellness(conn, [to_wellness_row("2026-10-29", None, sleep, {"restingHeartRate": 55})])
    save_wellness(conn, [to_wellness_row("2026-10-29", None, {}, {"restingHeartRate": 52})])
    assert conn.execute("SELECT date, sleep_s, rhr FROM wellness").fetchall() == [
        ("2026-10-29", 26400, 52)
    ]


def test_fetch_wellness_covers_today_and_the_days_before():
    class FakeGarmin:
        def get_hrv_data(self, day):
            return None

        def get_sleep_data(self, day):
            return {}

        def get_stats(self, day):
            return {"restingHeartRate": 50}

    today = date.today()
    rows = fetch_wellness(FakeGarmin(), 7)
    assert [r["date"] for r in rows] == [(today - timedelta(days=n)).isoformat() for n in range(8)]


def run_main(monkeypatch, tmp_path, *args: str, stdin: str = "") -> int:
    monkeypatch.setenv("GARMINTOKENS", str(tmp_path / "tokens"))
    monkeypatch.setenv("CADENT_DB", str(tmp_path / "cadent.db"))
    monkeypatch.setattr("sys.argv", ["cadent_sync.py", *args])
    monkeypatch.setattr("sys.stdin", io.StringIO(stdin))
    try:
        main()
    except SystemExit as exit:
        return exit.code
    return 0


def test_sync_without_a_token_exits_not_connected(monkeypatch, tmp_path):
    assert run_main(monkeypatch, tmp_path) == NOT_CONNECTED


class FakeConnectGarmin:
    def __init__(self, email=None, password=None, prompt_mfa=None):
        self.password, self.prompt_mfa = password, prompt_mfa
        self.client = self

    def login(self, tokenstore=None):
        from garminconnect.exceptions import GarminConnectAuthenticationError

        if self.prompt_mfa() != "123456" or self.password != "right":
            raise GarminConnectAuthenticationError("401")

    def dump(self, path):
        Path(path).mkdir(parents=True)
        (Path(path) / "garmin_tokens.json").write_text("{}")

    def get_full_name(self):
        return "Joey Rudd"


@pytest.mark.parametrize(
    ("password", "code", "reply"),
    [("right", 0, "connected"), ("wrong", 1, "bad-login")],
)
def test_connect_saves_the_token_but_never_the_password(
    monkeypatch, tmp_path, capsys, password, code, reply
):
    monkeypatch.setattr("garminconnect.Garmin", FakeConnectGarmin)
    login = json.dumps({"email": "joey@example.com", "password": password}) + "\n123456\n"
    assert run_main(monkeypatch, tmp_path, "--connect", stdin=login) == code
    assert capsys.readouterr().out.split() == ["mfa", reply]
    tokens = tmp_path / "tokens"
    saved = "".join(p.read_text() for p in tokens.iterdir()) if tokens.exists() else ""
    assert password not in saved
    assert ("Joey Rudd" in saved) == (reply == "connected")


def test_disconnect_deletes_the_token_and_account(monkeypatch, tmp_path):
    monkeypatch.setattr("garminconnect.Garmin", FakeConnectGarmin)
    login = '{"email": "joey@example.com", "password": "right"}\n123456\n'
    run_main(monkeypatch, tmp_path, "--connect", stdin=login)
    assert run_main(monkeypatch, tmp_path, "--disconnect") == 0
    assert list((tmp_path / "tokens").iterdir()) == []


class FakeSyncGarmin:
    def login(self, tokenstore=None):
        pass

    def get_full_name(self):
        return "Joey Rudd"

    def get_activities_by_date(self, start, end):
        from garminconnect.exceptions import GarminConnectAuthenticationError

        raise GarminConnectAuthenticationError("token rejected")


def test_sync_marks_a_hand_saved_token_connected_and_clears_it_once_garmin_rejects_it(
    monkeypatch, tmp_path
):
    monkeypatch.setattr("garminconnect.Garmin", FakeSyncGarmin)
    seen = []
    monkeypatch.setattr(
        "cadent_sync.fetch",
        lambda garmin, days: (
            seen.append((tmp_path / "tokens" / "account.json").exists())
            or garmin.get_activities_by_date("", "")
        ),
    )
    (tmp_path / "tokens").mkdir()
    assert run_main(monkeypatch, tmp_path) == NOT_CONNECTED
    assert seen == [True]
    assert not (tmp_path / "tokens" / "account.json").exists()
