# Supabase Setup Instructions

## Initial Setup

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in/up
2. Click "New Project"
3. Choose your organization
4. Enter project details:
   - Name: `linkstack` (or your preferred name)
   - Database Password: (save this securely)
   - Region: (choose closest to your users)
5. Click "Create new project"

### 2. Run Database Schema

1. Go to your Supabase dashboard
2. Click on "SQL Editor" in the left sidebar
3. Click "New query"
4. Copy the entire contents of `supabase/schema.sql`
5. Paste into the SQL editor
6. Click "Run" or press Cmd/Ctrl + Enter
7. Verify success (you should see "Success. No rows returned")

### 3. Configure Authentication Providers

#### Google OAuth

1. In Supabase dashboard, go to Authentication → Providers
2. Enable Google provider
3. Follow the instructions to create OAuth credentials in Google Cloud Console
4. Add your redirect URL: `https://[YOUR-PROJECT-REF].supabase.co/auth/v1/callback`
5. Enter Client ID and Client Secret in Supabase
6. Save

#### GitHub OAuth

1. In Supabase dashboard, go to Authentication → Providers
2. Enable GitHub provider
3. Create OAuth App in GitHub Settings → Developer settings → OAuth Apps
4. Set callback URL: `https://[YOUR-PROJECT-REF].supabase.co/auth/v1/callback`
5. Enter Client ID and Client Secret in Supabase
6. Save

### 4. Get Your API Keys

1. In Supabase dashboard, go to Settings → API
2. Copy your **Project URL** and **anon/public** key
3. Create a `.env` file in your project root (copy from `.env.example`)
4. Fill in your credentials:

```env
VITE_SUPABASE_URL=https://[YOUR-PROJECT-REF].supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 5. Test the Connection

Run the development server:

```bash
npm run dev
```

Check the browser console - you should not see any Supabase connection errors.

## Verifying Setup

### Check Database

1. Go to Supabase dashboard → Table Editor
2. You should see the core tables:
   - `resources`
   - `bookmarks`
   - `public_listings`
   - `public_stacks`
   - `public_stack_items`
3. Click into each table to verify the schema loaded correctly

### Check RLS Policies

1. Go to Supabase dashboard → Authentication → Policies
2. You should see policies for:
   - `bookmarks`: owners manage their own private library rows
   - `public_listings`: approved standalone public links are public, owners/admins manage submissions
   - `public_stacks`: approved stack roots are public, owners/admins manage submissions
   - `public_stack_items`: approved stack membership rows are public, owners/admins manage submissions

## Public Stack Notes

- `public_listings` remain the standalone public catalog for individual resources.
- `public_stacks` represent moderated public stack roots tied to top-level bookmarks.
- `public_stack_items` represent membership inside a public stack.
- If a child resource is already approved in `public_listings`, adding it to a public stack should create a membership/reference row, not duplicate the resource or the standalone listing.
- Public rendering must come from public tables and snapshots, never from private bookmark fields such as notes or read status.

## Migration Safety

- The public-stack rollout is additive-first.
- The migration in `supabase/migrations/20260409_add_public_stacks.sql` creates new tables, indexes, triggers, and policies without mutating or deleting existing bookmark/public data.
- Existing environments that already applied the public stack rollout also need `supabase/migrations/20260409_alter_public_stack_items_display_order_bigint.sql` to widen `public_stack_items.display_order` from `INTEGER` to `BIGINT`.
- Existing `bookmarks`, parent-child relationships, and `public_listings` rows are the canonical pre-existing data and must remain unchanged after migration.
- Before and after running migrations, verify:
  - bookmark counts are unchanged
  - parent-child bookmark counts are unchanged
  - `public_listings` counts and statuses are unchanged
  - no unexpected rows were created in `public_stacks` or `public_stack_items`

## Migration from localStorage (Optional)

If you have existing bookmarks in localStorage, you can migrate them:

1. Open your current app in the browser
2. Open browser console
3. Run: `localStorage.getItem('bookmarks:linkstack')`
4. Copy the JSON output
5. After logging into the new app, you can import this data

(Migration script will be provided in future update)

## Troubleshooting

### "Invalid API Key" Error

- Check that your `.env` file is in the project root
- Verify the keys match those in Supabase dashboard → Settings → API
- Restart the dev server after changing `.env`

### Authentication Not Working

- Verify OAuth provider is enabled in Supabase dashboard
- Check redirect URLs match exactly
- Check browser console for specific error messages

### RLS Errors (Row Level Security)

- If you get "permission denied" errors, check your RLS policies
- Ensure you're authenticated (check `supabase.auth.getSession()`)
- Verify the policy conditions match your use case
