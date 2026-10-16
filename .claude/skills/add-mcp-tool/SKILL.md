---
name: add-mcp-tool
description: Add an MCP tool to the /mcp server: handler, input schema, scope, contract test, cross-user test and docs entry. Use when adding or changing an MCP tool.
---
# Add an MCP tool

Tools are read-only unless the spec gives them the `plans:draft` scope. No tool edits or activates a plan.

1. Find the tool in the Tools table of the spec's "Web app & MCP" tab. Confirm its name, inputs, returns and scope with Joey.
   A tool that is not in that table needs Joey's approval first.
2. Write the tests first, next to the existing MCP tests, using the SDK's in-memory client:
   - a contract test that checks the tool's input schema, output fields and required scope;
   - a cross-user test: a token for user A asks for user B's data and must get nothing;
   - a test that a token without the scope is refused.
3. Run `make check` and confirm the new tests FAIL.
4. Write the handler following the existing tools (see `docs/patterns.md`; the first tool sets the pattern there):
   - take `user_id` only from the access token, never from tool input, and scope every query by it;
   - return compact JSON with units in field names (`distance_m`, `pace_s_per_km`);
   - cap date ranges and paginate rows, as the spec's limits say;
   - include safety context where the spec asks (an open pain flag in `get_today` and `compare_run_to_plan`);
   - plan drafts go through `cadent_core.rules.validate`, like every other plan source.
5. Write the tool description: what it returns and its limits, so any AI picks the right tool. No push-through wording.
6. Add the tool to the MCP docs entry and run `make check`. All green.
7. Ask the `code-reviewer` subagent to review the diff.
