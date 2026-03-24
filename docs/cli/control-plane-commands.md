---
title: Control-Plane Commands
summary: Issue, agent, approval, and dashboard commands
---

Client-side commands for managing issues, agents, approvals, and more.

## Issue Commands

```sh
# List issues
pnpm hypowork issue list [--status todo,in_progress] [--assignee-agent-id <id>] [--match text]

# Get issue details
pnpm hypowork issue get <issue-id-or-identifier>

# Create issue
pnpm hypowork issue create --title "..." [--description "..."] [--status todo] [--priority high]

# Update issue
pnpm hypowork issue update <issue-id> [--status in_progress] [--comment "..."]

# Add comment
pnpm hypowork issue comment <issue-id> --body "..." [--reopen]

# Checkout task
pnpm hypowork issue checkout <issue-id> --agent-id <agent-id>

# Release task
pnpm hypowork issue release <issue-id>
```

## Company Commands

```sh
pnpm hypowork company list
pnpm hypowork company get <company-id>

# Export to portable folder package (writes manifest + markdown files)
pnpm hypowork company export <company-id> --out ./exports/acme --include company,agents

# Preview import (no writes)
pnpm hypowork company import \
  --from https://github.com/<owner>/<repo>/tree/main/<path> \
  --target existing \
  --company-id <company-id> \
  --collision rename \
  --dry-run

# Apply import
pnpm hypowork company import \
  --from ./exports/acme \
  --target new \
  --new-company-name "Acme Imported" \
  --include company,agents
```

## Agent Commands

```sh
pnpm hypowork agent list
pnpm hypowork agent get <agent-id>
```

## Approval Commands

```sh
# List approvals
pnpm hypowork approval list [--status pending]

# Get approval
pnpm hypowork approval get <approval-id>

# Create approval
pnpm hypowork approval create --type hire_agent --payload '{"name":"..."}' [--issue-ids <id1,id2>]

# Approve
pnpm hypowork approval approve <approval-id> [--decision-note "..."]

# Reject
pnpm hypowork approval reject <approval-id> [--decision-note "..."]

# Request revision
pnpm hypowork approval request-revision <approval-id> [--decision-note "..."]

# Resubmit
pnpm hypowork approval resubmit <approval-id> [--payload '{"..."}']

# Comment
pnpm hypowork approval comment <approval-id> --body "..."
```

## Activity Commands

```sh
pnpm hypowork activity list [--agent-id <id>] [--entity-type issue] [--entity-id <id>]
```

## Dashboard

```sh
pnpm hypowork dashboard get
```

## Heartbeat

```sh
pnpm hypowork heartbeat run --agent-id <agent-id> [--api-base http://localhost:3100]
```
