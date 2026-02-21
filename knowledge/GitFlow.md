# Git Flow: PolicyGuard AI

**Project:** PolicyGuard AI
**Team Size:** 2 developers

---

## 🏗️ Branch Strategy

### Branch Types

| Branch | Purpose | Naming |
|--------|---------|--------|
| `main` | Production-ready code | N/A |
| `develop` | Integration branch | N/A |
| `feature/*` | New features | `feature/dashboard`, `feature/pdf-upload` |
| `bugfix/*` | Bug fixes | `bugfix/violation-sort` |
| `hotfix/*` | Urgent production fixes | `hotfix/scan-timeout` |

---

## 🔄 Workflow

### Daily Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                    Daily Git Flow                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Start of day:                                          │
│     git checkout develop                                     │
│     git pull origin develop                                  │
│                                                              │
│  2. Create feature branch:                                  │
│     git checkout -b feature/my-feature                      │
│                                                              │
│  3. Work on feature (commit regularly):                     │
│     git add .                                               │
│     git commit -m "feat: add component X"                   │
│                                                              │
│  4. Push branch to remote:                                  │
│     git push -u origin feature/my-feature                   │
│                                                              │
│  5. When feature is done:                                   │
│     git checkout develop                                    │
│     git pull origin develop                                  │
│     git merge feature/my-feature                             │
│     git push origin develop                                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Commit Messages

Follow Conventional Commits:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation |
| `style` | Formatting |
| `refactor` | Code restructure |
| `test` | Tests |
| `chore` | Maintenance |

**Examples:**

```
feat(dashboard): add compliance score card component
fix(scanning): resolve timeout issue on large CSV files
docs(api): update violation endpoint response schema
```

---

## 👥 Person A & Person B Workflow

### Person A (Frontend)

```bash
# Start of day
git checkout develop
git pull

# Create frontend feature branch
git checkout -b feature/frontend-dashboard

# Work... commit... work... commit...

# Done with feature
git checkout develop
git pull
git merge feature/frontend-dashboard
git push origin develop

# Delete old branch
git branch -d feature/frontend-dashboard
git push origin --delete feature/frontend-dashboard
```

### Person B (Backend)

```bash
# Start of day
git checkout develop
git pull

# Create backend feature branch
git checkout -b feature/backend-scan-engine

# Work... commit... work... commit...

# Done with feature
git checkout develop
git pull
git merge feature/backend-scan-engine
git push origin develop

# Delete old branch
git branch -d feature/backend-scan-engine
git push origin --delete feature/backend-scan-feature
```

---

## ⚠️ Rules

### Do

- ✅ Pull `develop` before starting work each day
- ✅ Create new branch for each feature
- ✅ Write meaningful commit messages
- ✅ Push branch to remote regularly (backup)
- ✅ Merge `develop` into your branch before merging to `develop`

### Don't

- ❌ Never push directly to `main`
- ❌ Never merge your branch without pulling latest `develop` first
- ❌ Don't work on same files without coordination
- ❌ Don't force push

---

## 🔧 Coordination

### File Ownership (Reduce Conflicts)

| Files | Owner |
|-------|-------|
| `app/*/page.tsx` | Person A |
| `components/*` | Person A |
| `app/api/*/route.ts` | Person B |
| `lib/*` | Person B |

### Before Working on Shared Files

1. Check with partner
2. Create a branch
3. Make small, focused commits
4. Merge promptly after review

---

## 🚀 Release Flow

```
feature branches → develop → main (deploys automatically)

# When ready to deploy:
git checkout main
git merge develop
git push origin main
```

**Vercel Auto-Deploy:**
- Connect GitHub repo to Vercel
- `main` branch = production deployment
- `develop` branch = preview deployment (optional)

---

## 🆘 Conflict Resolution

### If you have merge conflicts:

1. Don't panic
2. Pull latest develop: `git pull origin develop`
3. Open the conflicting files
4. Look for `<<<<<<< HEAD`, `=======`, `>>>>>>>`
5. Keep the code you need, remove markers
6. `git add .`
7. `git commit -m "fix: resolve merge conflicts"`
8. Push and merge

### If stuck:

1. Don't force push
2. Ask your partner for help
3. Worst case: delete branch and start fresh

---

## 📋 Quick Reference

### Daily Commands

```bash
# Start of day
git checkout develop && git pull

# New feature
git checkout -b feature/feature-name

# Save work
git add . && git commit -m "feat: description"

# Push to remote
git push -u origin feature/feature-name

# Merge to develop
git checkout develop && git pull
git merge feature/feature-name
git push origin develop
```

### Emergency

```bash
# Abandon changes and start fresh
git checkout .
git checkout develop
git pull
```
