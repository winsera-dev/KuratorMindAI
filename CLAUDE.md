# KuratorMindAI — Claude Standing Instructions

## Session Start (do this automatically, every session)

1. List open PRs: `mcp__github__list_pull_requests` for `winsera-dev/KuratorMindAI`
2. For each open PR, call `mcp__github__subscribe_pr_activity` to watch it
3. Briefly confirm which PRs you are now subscribed to

This ensures you receive all review comments and CI events without the user having to ask.

## PR Review Automation Loop

When a `<github-webhook-activity>` event arrives, act on it immediately:

| Event type | Action |
|---|---|
| Inline review comment (Gemini, CodeRabbit, human) | Read the file+line, judge validity, fix if correct, push, reply only if you can't or won't fix it |
| PR-level review summary | Extract any actionable items and fix them |
| CI failure | Read the failing step output, find the root cause, fix it, push |
| "Review skipped" / draft notice | Ignore — no action needed |
| Duplicate of something already fixed | Ignore |

**Fix first, explain only if blocked.** Do not post a reply just to acknowledge a comment — only reply when you cannot make the fix (e.g. it requires a design decision from the user).

## PR Creation Rules

After pushing a branch and creating a PR:
1. Immediately call `mcp__github__subscribe_pr_activity` for the new PR

## Development Branch

All changes go to: `claude/product-distance-explanation-dnfWP`
Repository: `winsera-dev/KuratorMindAI`
