# LinkStack Quick Start Guide

## 🎯 5-Minute Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase (5 minutes)

1. Go to [supabase.com](https://supabase.com) → Create account → New project
2. Wait for database to initialize (~2 minutes)
3. Go to SQL Editor → Run the contents of `supabase/schema.sql`
4. Go to Settings → API → Copy your credentials

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env and paste your Supabase URL and anon key
```

### 4. Start Development

```bash
npm run dev
```

Visit `http://localhost:3000` 🎉

## ⚡ Quick Commands

```bash
npm run dev              # Start dev server
npm test                 # Run tests
npm run test:ui          # Visual test runner
npm run build            # Build for production
```

## 🔑 OAuth Setup (Optional - Do Later)

For Google/GitHub sign in, follow the detailed instructions in `supabase/README.md`.

You can develop locally without OAuth - just use the test data.

## 📖 Full Documentation

- **Phase 1 Setup**: See `PHASE1_SETUP.md` for complete details
- **Supabase Setup**: See `supabase/README.md` for database setup
- **Project Guide**: See `CLAUDE.MD` for architecture and roadmap

## 🧪 Running Tests

```bash
# All tests
npm test

# With UI
npm run test:ui

# E2E tests
npm run test:e2e

# E2E with UI
npm run test:e2e:ui
```

## 🐛 Troubleshooting

**"Missing Supabase environment variables"**
→ Make sure `.env` file exists and has correct values

**"Invalid API Key"**
→ Check that your Supabase anon key is correct
→ Restart dev server after changing `.env`

**Tests failing**
→ Run `npm install` to ensure all dependencies are installed
→ Check that you're on Node.js 18 or higher

## 💬 Need Help?

Check the detailed guides:

- `PHASE1_SETUP.md` - What's been done and what's next
- `supabase/README.md` - Database and auth setup
- `CLAUDE.MD` - Full project documentation

Happy coding! 🚀
