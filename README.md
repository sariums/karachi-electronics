# Northline installment admin panel

React + Vite admin dashboard for the phone installment/lock business.
Connected to Supabase (auth + database).

## Local development
```
npm install
npm run dev
```

## Deploying on Railway
1. Push this whole folder to a GitHub repository.
2. In Railway: New Project > Deploy from GitHub repo > select this repo.
3. Railway auto-detects the Node app and runs `npm install`, `npm run build`,
   then `npm run preview` (see railway.json). It assigns a public URL automatically.
4. No environment variables are required — Supabase URL/key are already set in
   src/supabaseClient.js.

## Creating your first admin login
There is no public sign-up page restriction removed yet — the login screen
supports sign-up. Use it once to create your own admin account, or create a
user directly in Supabase: Authentication > Users > Add user.
