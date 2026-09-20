#!/usr/bin/env bash
#
# Pushes every variable in vercel-env.txt to Vercel, for all three
# environments.
#
#   npx vercel login      once, in a browser
#   npx vercel link       once, to point this folder at the project
#   bash scripts/push-env.sh
#
# Run by you, under your own Vercel session. The values go straight from
# your machine to your account.
#
# Safe to re-run: --force overwrites an existing variable rather than
# failing on it, which is what went wrong doing this through the dashboard.

set -uo pipefail

FILE="${1:-vercel-env.txt}"

if [ ! -f "$FILE" ]; then
  echo "  $FILE not found. Run this from the project root." >&2
  exit 1
fi

if ! npx --yes vercel whoami >/dev/null 2>&1; then
  echo "  Not signed in to Vercel. Run: npx vercel login" >&2
  exit 1
fi

if [ ! -f .vercel/project.json ]; then
  echo "  This folder is not linked to a project. Run: npx vercel link" >&2
  exit 1
fi

ok=0
failed=0

while IFS= read -r line || [ -n "$line" ]; do
  # Skip blanks and comments.
  case "$line" in "" | \#*) continue ;; esac
  # Skip anything that is not NAME=value.
  case "$line" in *=*) ;; *) continue ;; esac

  name="${line%%=*}"
  value="${line#*=}"

  for target in production preview development; do
    if printf '%s' "$value" |
      npx --yes vercel env add "$name" "$target" --force >/dev/null 2>&1; then
      echo "  set    $name  ($target)"
      ok=$((ok + 1))
    else
      # Older CLIs have no --force. Remove, then add.
      npx --yes vercel env rm "$name" "$target" --yes >/dev/null 2>&1
      if printf '%s' "$value" |
        npx --yes vercel env add "$name" "$target" >/dev/null 2>&1; then
        echo "  set    $name  ($target)"
        ok=$((ok + 1))
      else
        echo "  FAILED $name  ($target)"
        failed=$((failed + 1))
      fi
    fi
  done
done <"$FILE"

echo
echo "  $ok set, $failed failed"
echo
if [ "$failed" -eq 0 ]; then
  echo "  Now redeploy so the NEXT_PUBLIC_ ones reach the browser bundle:"
  echo "    npx vercel --prod"
  echo
  echo "  Then check: https://taslaafa.vercel.app/api/health"
fi
