# AMIRTAHA Profile V4 — setup

## 1. Push the files
Copy everything in this folder to the public profile repository:

`https://github.com/amirtahanemati/amirtahanemati`

Then commit and push.

## 2. Enable Actions write access
The workflow declares `permissions: contents: write`. If your repository-level Actions settings are more restrictive, go to:

**Repository → Settings → Actions → General → Workflow permissions**

and allow the workflow to write repository contents.

## 3. First refresh
Open **Actions → Refresh profile dashboard → Run workflow**.

The first successful run replaces the placeholder SVGs with live GitHub data and builds clickable repository cards.

## 4. Optional: include private contribution totals
Public repository/activity data works with the workflow token. If you want the contribution calendar to include private/internal contribution totals where GitHub permits it, create a token with the minimum necessary `read:user` access and save it as the repository secret:

`PROFILE_TOKEN`

Do not hard-code a token in README, JavaScript, JSON or workflow YAML.

## 5. Projects not uploaded to GitHub
Edit:

`data/showcase.json`

These entries are rendered under **LAB — WORK NOT PUBLIC YET**. Do not place confidential details in this file because the profile repository is public.
