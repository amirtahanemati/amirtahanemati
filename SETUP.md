# AMIRTAHA Profile README — V5 Setup

## What changed in V5
- Main focus is now **Python + FastAPI + Web Development**.
- **Electron.js** is still included, but as a desktop capability, not the main identity.
- The profile is intentionally shorter and cleaner.
- Followers were removed.
- A custom **Commit Snake** SVG is generated from recent GitHub contribution activity.
- The README uses your direct photo right now.

## Quick setup
1. Create or open your public profile repository:
   `https://github.com/amirtahanemati/amirtahanemati`
2. Copy all files from this package into the repository root.
3. Commit and push.
4. Go to **Actions** and run **Refresh profile dashboard** once.

## Optional token
For live GitHub stats, add a repository secret named `PROFILE_TOKEN`.
Recommended scope:
- `read:user`
- `public_repo` is not required for public profile data

If you do not add a token, the README will still work but live GitHub sections may show placeholders until GitHub Actions has enough access.

## Workflow permissions
In the repository:
- **Settings → Actions → General → Workflow permissions**
- Set to **Read and write permissions**

The workflow needs write access so it can commit the generated SVG files back into the repository.

## Files used in README
- `assets/hero.svg`
- `assets/expertise.svg`
- `assets/amirtaha-photo.jpg`
- `generated/github-signal.svg`
- `generated/commit-snake.svg`
- `generated/repo-*.svg`

## Later improvement
The vectorized portrait step is still pending. This V5 package already uses your real photo directly, and you can replace `assets/amirtaha-photo.jpg` later with a vector portrait image when ready.
