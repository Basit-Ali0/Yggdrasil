# Project Setup: Yggdrasil

**Project:** Yggdrasil

> **NOTE FOR LLMs:** If you need a condensed overview of this project, read [../../gist.md](../../gist.md). That file contains a plain-text summary of the entire project context.

---

## 📋 Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 18+ | Runtime |
| npm | 9+ | Package manager |
| Git | 2.30+ | Version control |
| Supabase Account | - | Auth + Database |
| Gemini API Key | - | AI for rule extraction |

---

## 🚀 Quick Start

### 1. Clone & Install

```bash
# Clone repository
git clone <repo-url>
cd hackfest-2

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local
```

### 2. Setup Supabase

1. Go to https://supabase.com
2. Create new project
3. Get credentials from Settings → API
4. Run SQL below in Supabase SQL Editor

### 3. Configure Environment

Edit `.env.local`:

```env
# Supabase (from Settings → API)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Gemini (from Google AI Studio)
GEMINI_API_KEY=your_gemini_api_key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Run Development

```bash
# Start development server
npm run dev
```

Open http://localhost:3000

---

## 🗄️ Supabase Schema

> ⚠️ **Use `docs/schema.md` for the correct SQL.** The schema defined there 
> is the single source of truth. Do not use the SQL that was previously in 
> this file — it has been removed because it conflicted with schema.md on 
> severity values, table structure, and RLS policies.

Run the SQL from `docs/schema.md` in your Supabase SQL Editor.

## 📁 Project Structure

```
hackfest-2/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── (auth)/           # Auth pages
│   └── ...
├── components/             # React components
│   ├── ui/               # shadcn/ui components
│   └── ...
├── lib/                   # Utilities & services
│   ├── supabase.ts       # Supabase client
│   ├── gemini.ts         # Gemini AI client
│   └── ...
├── docs/                   # Documentation
└── package.json
```

---

## 🔧 Common Tasks

### Add a New API Endpoint

1. Create route file: `app/api/feature/route.ts`
2. Export handler functions (GET, POST, etc.)
3. Use existing types from `lib/types.ts`

### Add a New Component

```bash
# Using shadcn/ui
npx shadcn@latest add button

# Custom component
# Create in components/feature/
```

### Run Tests

```bash
npm run test
```

### Lint Code

```bash
npm run lint
```

---

## 🐛 Troubleshooting

### "Module not found" errors

```bash
npm install
```

### Build fails

```bash
npm run clean
npm run build
```

### Supabase connection errors

- Check credentials in `.env.local`
- Verify project is active in Supabase dashboard

### Gemini API errors

- Check API key is set in `.env.local`
- Verify API key has quota available

---

## 📦 Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Components | shadcn/ui |
| Icons | Lucide |
| Charts | shadcn/ui |
| Auth + DB | Supabase |
| AI | Gemini API |
| PDF| unpdf (NOT pdf-parse — pdf-parse breaks on Vercel serverless) |
| CSV | Papa Parse |

---

## 🎨 Design System

The app uses a refined, professional design:

- **Display Font:** Playfair Display (page titles, scores)
- **Body Font:** Inter (descriptions, content)
- **Mono Font:** JetBrains Mono (code, data)

See [DesignGuide.md](./DesignGuide.md) for full color palette and component styles.

---

## 🚀 Deploy to Vercel

```bash
# Push to GitHub - Vercel auto-deploys
git add .
git commit -m "feat: description"
git push origin develop  # or main for production
```

**Vercel Setup:**
1. Go to https://vercel.com → Add Project → Import GitHub repo
2. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `GEMINI_API_KEY`
3. Deploy automatically on every push

