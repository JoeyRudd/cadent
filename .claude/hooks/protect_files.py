"""PreToolUse hook: block agent edits to protected files. Joey edits these by hand."""

import json
import sys

PROTECTED = ("core/tests/MIN_TEST_COUNT", "migrations/versions/", ".github/CODEOWNERS")

path = json.load(sys.stdin).get("tool_input", {}).get("file_path", "")
if any(p in path for p in PROTECTED):
    print(f"{path} is protected. Ask Joey to change it.", file=sys.stderr)
    sys.exit(2)
