"""Tests for the PreToolUse protect hook: each case is a tool call and the exit code it must get."""

import json
import subprocess
import sys
from pathlib import Path

import pytest

HOOK = Path(__file__).with_name("protect_files.py")
ROOT = HOOK.parents[2]
TESTS = str(ROOT / "core/tests/test_rules.py")
FIRST_TEST = "def test_long_run_within_ten_percent_passes"


def exit_code(tool_input: dict[str, object]) -> int:
    payload = json.dumps({"tool_input": tool_input})
    return subprocess.run(
        [sys.executable, HOOK], input=payload, text=True, capture_output=True, cwd=ROOT, check=False
    ).returncode


@pytest.mark.parametrize(
    ("tool_input", "expected"),
    [
        (
            {
                "file_path": TESTS,
                "old_string": "DAY0 = ",
                "new_string": "def test_x() -> None:\n    assert True\n\n\nDAY0 = ",
            },
            0,
        ),
        ({"file_path": TESTS, "old_string": FIRST_TEST, "new_string": "def helper_long_run"}, 2),
        (
            {
                "file_path": TESTS,
                "old_string": "test_long_run_within_ten_percent_passes(",
                "new_string": "helper(",
            },
            2,
        ),
        (
            {
                "file_path": TESTS,
                "old_string": "    assert ",
                "new_string": "    _ = ",
                "replace_all": True,
            },
            2,
        ),
        (
            {
                "file_path": TESTS,
                "old_string": FIRST_TEST,
                "new_string": f"@pytest.mark.skip\n{FIRST_TEST}",
            },
            2,
        ),
        (
            {
                "file_path": TESTS,
                "old_string": "    history = [run(-7, 14",
                "new_string": "    pytest.skip()\n    history = [run(-7, 14",
            },
            2,
        ),
        (
            {
                "file_path": TESTS,
                "edits": [
                    {"old_string": "DAY0", "new_string": "DAY0"},
                    {"old_string": "    assert ", "new_string": "    _ = "},
                ],
            },
            2,
        ),
        ({"file_path": TESTS, "content": '"""Empty."""\n'}, 2),
        (
            {
                "file_path": str(ROOT / "core/tests/conftest.py"),
                "content": "collect_ignore = ['test_rules.py']\n",
            },
            2,
        ),
        (
            {
                "file_path": str(ROOT / "core/tests/fixtures/golden/toronto_half.json"),
                "content": "{}",
            },
            2,
        ),
        ({"file_path": str(ROOT / "core/tests/MIN_TEST_COUNT"), "content": "1"}, 2),
        ({"file_path": str(ROOT / "db/migrations/versions/0002_new.py"), "content": "x"}, 0),
        (
            {
                "file_path": str(ROOT / "core/src/cadent_core/models.py"),
                "old_string": "a",
                "new_string": "b",
            },
            0,
        ),
    ],
    ids=[
        "adding a test is allowed",
        "renaming a test away is blocked",
        "renaming part of a line is blocked",
        "removing every assertion is blocked",
        "a skip marker is blocked",
        "pytest.skip in a body is blocked",
        "a multi-edit dropping an assertion is blocked",
        "overwriting the file is blocked",
        "a conftest in protected tests is blocked",
        "golden fixtures are blocked",
        "the test-count floor is blocked",
        "a new uncommitted migration is allowed",
        "source files are allowed",
    ],
)
def test_protect_hook(tool_input: dict[str, object], expected: int) -> None:
    assert exit_code(tool_input) == expected
