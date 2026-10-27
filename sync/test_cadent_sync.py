import sqlite3

from cadent_sync import is_run, save, to_row


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


def test_is_run_keeps_only_running_types():
    for key in ("running", "treadmill_running", "trail_running"):
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
