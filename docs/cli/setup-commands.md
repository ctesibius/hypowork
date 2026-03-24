---
title: Setup Commands
summary: Onboard, run, doctor, and configure
---

Instance setup and diagnostics commands.

## `hypowork run`

One-command bootstrap and start:

```sh
pnpm hypowork run
```

Does:

1. Auto-onboards if config is missing
2. Runs `hypowork doctor` with repair enabled
3. Starts the server when checks pass

Choose a specific instance:

```sh
pnpm hypowork run --instance dev
```

## `hypowork onboard`

Interactive first-time setup:

```sh
pnpm hypowork onboard
```

First prompt:

1. `Quickstart` (recommended): local defaults (embedded database, no LLM provider, local disk storage, default secrets)
2. `Advanced setup`: full interactive configuration

Start immediately after onboarding:

```sh
pnpm hypowork onboard --run
```

Non-interactive defaults + immediate start (opens browser on server listen):

```sh
pnpm hypowork onboard --yes
```

## `hypowork doctor`

Health checks with optional auto-repair:

```sh
pnpm hypowork doctor
pnpm hypowork doctor --repair
```

Validates:

- Server configuration
- Database connectivity
- Secrets adapter configuration
- Storage configuration
- Missing key files

## `hypowork configure`

Update configuration sections:

```sh
pnpm hypowork configure --section server
pnpm hypowork configure --section secrets
pnpm hypowork configure --section storage
```

## `hypowork env`

Show resolved environment configuration:

```sh
pnpm hypowork env
```

## `hypowork allowed-hostname`

Allow a private hostname for authenticated/private mode:

```sh
pnpm hypowork allowed-hostname my-tailscale-host
```

## Local Storage Paths

| Data | Default Path |
|------|-------------|
| Config | `~/.paperclip/instances/default/config.json` |
| Database | `~/.paperclip/instances/default/db` |
| Logs | `~/.paperclip/instances/default/logs` |
| Storage | `~/.paperclip/instances/default/data/storage` |
| Secrets key | `~/.paperclip/instances/default/secrets/master.key` |

Override with:

```sh
PAPERCLIP_HOME=/custom/home PAPERCLIP_INSTANCE_ID=dev pnpm hypowork run
```

Or pass `--data-dir` directly on any command:

```sh
pnpm hypowork run --data-dir ./tmp/paperclip-dev
pnpm hypowork doctor --data-dir ./tmp/paperclip-dev
```
