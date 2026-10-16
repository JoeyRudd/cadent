"""PreToolUse hook: block agent edits Joey makes by hand, and edits that weaken protected tests.

Protected tests may grow (new rules are added test-first) but never lose a test, lose an assertion
or gain a skip. Subtler weakening (a changed threshold, an early return) is left to CODEOWNERS and
the safety-auditor.
"""

import json
import re
import subprocess
import sys
from pathlib import Path

PROTECTED = (
    "core/tests/MIN_TEST_COUNT",
    "core/tests/conftest.py",
    "core/tests/fixtures/golden/",
    ".github/CODEOWNERS",
)
MIGRATIONS = "migrations/versions/"
PROTECTED_TESTS = "core/tests/"
PATTERNS = {
    "a test": re.compile(r"^\s*def test_", re.MULTILINE),
    "an assertion": re.compile(r"\bassert\b"),
}
SKIP = re.compile(r"pytest\.mark\.skip|@skip|xfail|pytest\.skip\(|importorskip")


def block(reason: str) -> None:
    print(reason, file=sys.stderr)
    sys.exit(2)


def is_committed(path: str) -> bool:
    """True once the file is in a commit; a new migration stays editable until then."""
    log = subprocess.run(
        ["git", "log", "-1", "--format=%H", "--", path], check=False, capture_output=True, text=True
    )
    return bool(log.stdout.strip())


def file_after(tool: dict[str, object], before: str) -> str:
    """The whole file as it will be once the Edit, MultiEdit or Write is applied."""
    if "content" in tool:
        return str(tool["content"])
    after = before
    for edit in tool.get("edits") or [tool]:  # type: ignore[union-attr]
        old, new = str(edit.get("old_string", "")), str(edit.get("new_string", ""))
        after = after.replace(old, new, -1 if edit.get("replace_all") else 1)
    return after


def check_protected_test(tool: dict[str, object], path: str) -> None:
    before = Path(path).read_text() if Path(path).exists() else ""
    after = file_after(tool, before)
    for name, pattern in PATTERNS.items():
        if len(pattern.findall(after)) < len(pattern.findall(before)):
            block(f"{path} is protected: this edit removes {name}. Ask Joey (see CLAUDE.md).")
    if len(SKIP.findall(after)) > len(SKIP.findall(before)):
        block(f"{path} is protected: tests here are never skipped or marked xfail.")


tool = json.load(sys.stdin).get("tool_input", {})
path = tool.get("file_path", "")
if any(p in path for p in PROTECTED):
    block(f"{path} is protected. Ask Joey to change it.")
if MIGRATIONS in path and is_committed(path):
    block(f"{path} is an applied migration. Add a new migration instead.")
if PROTECTED_TESTS in path and path.endswith(".py"):
    check_protected_test(tool, path)
