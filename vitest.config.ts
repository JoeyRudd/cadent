import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Claude Code session worktrees are other checkouts of this repo; test them in their own folder.
    exclude: [...configDefaults.exclude, ".claude/worktrees/**"],
  },
});
