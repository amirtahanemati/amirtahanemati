# AMIRTAHA Profile V6 — Install

## 1) Replace the contents of your profile repository
Repository:

`https://github.com/amirtahanemati/amirtahanemati`

Copy **everything inside this V6 folder** into the root of that repository.

## 2) Push

```powershell
git add .
git commit -m "feat: redesign profile to premium v6"
git push origin main
```

## 3) Run the live sync once
Open the repository on GitHub:

**Actions → Refresh premium profile → Run workflow**

The workflow will:
- generate the real animated contribution snake;
- read your public repositories;
- refresh live GitHub numbers;
- choose four selected repositories automatically;
- commit the generated assets back to the profile repository.

## Repository workflow permission
If the final commit step is denied:

**Settings → Actions → General → Workflow permissions → Read and write permissions**

Then run the workflow again.

## Optional: private contribution visibility
Public repositories and the public contribution snake require no custom secret beyond GitHub Actions' own token.

If you later want the dashboard to access contribution information that requires user-level access, create a fine-grained/personal token with only the minimum read access needed and save it as:

`PROFILE_TOKEN`

under:

**Settings → Secrets and variables → Actions → New repository secret**

Never put the token inside `README.md`, JavaScript files, or a commit.

## Portrait
V6 uses a clean square crop of your original photo at:

`assets/amirtaha-photo-square.jpg`

No facial retouching or identity changes were applied. The separate vector portrait can replace this file later without redesigning the README.
