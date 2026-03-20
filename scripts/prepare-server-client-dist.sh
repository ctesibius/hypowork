#!/usr/bin/env bash
set -euo pipefail

# prepare-server-client-dist.sh — Build the client and copy it into server/client-dist.
# This keeps @paperclipai/server publish artifacts self-contained for static UI serving.

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLIENT_DIST="$REPO_ROOT/client/dist"
SERVER_CLIENT_DIST="$REPO_ROOT/server/client-dist"

echo "  -> Building @hypowork/client..."
pnpm --dir "$REPO_ROOT" --filter @hypowork/client build

if [ ! -f "$CLIENT_DIST/index.html" ]; then
  echo "Error: Client build output missing at $CLIENT_DIST/index.html"
  exit 1
fi

rm -rf "$SERVER_CLIENT_DIST"
cp -r "$CLIENT_DIST" "$SERVER_CLIENT_DIST"
echo "  -> Copied client/dist to server/client-dist"
