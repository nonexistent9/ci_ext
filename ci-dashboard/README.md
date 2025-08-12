## Environment variables

This app requires Supabase credentials to be provided at runtime. There are no hardcoded defaults.

Create a `.env.local` (or configure your deployment environment) with:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

Both variables are required. The app will throw an error on startup if either is missing.

You can copy the template below into a new `.env.local` file:

```
# .env.local
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```


