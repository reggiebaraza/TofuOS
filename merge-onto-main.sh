#!/bin/bash
set -e
cd "$(dirname "$0")"

echo "Checking GitHub login..."
if ! gh auth status &>/dev/null; then
  echo "Not logged in. Run: gh auth login -h github.com -p https -w"
  echo "Then run this script again."
  exit 1
fi

REPO="reggiebaraza/TofuOS"
BRANCH="update-from-upstream"

echo "Creating PR: $BRANCH -> main..."
PR_NUM=$(gh pr create -R "$REPO" -B main -H "$BRANCH" -t "Update from upstream" -b "Merge latest code onto main" 2>/dev/null | grep -oE '[0-9]+' | head -1)

if [ -n "$PR_NUM" ]; then
  echo "Merging PR #$PR_NUM..."
  gh pr merge "$PR_NUM" -R "$REPO" --merge
  echo "Done! Your code is on main: https://github.com/$REPO"
else
  echo "Could not create PR (branch may already be merged or up to date)."
  echo "Your fork: https://github.com/$REPO"
fi
