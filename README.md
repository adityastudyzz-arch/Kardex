Kardex — Flashcard drawers
=========================

This folder contains the static Kardex app ready for GitHub and Vercel deployment.

Quick local run
---------------
- Using Python (built-in):

```bash
python -m http.server 8000
# open http://localhost:8000/
```

- Using Node (optional):

```bash
npx serve .
# or
npm install -g serve
serve .
```

Deploy to Vercel
----------------
1. Push this repository to GitHub.
2. In Vercel, click "Import Project" → connect your GitHub repo. Vercel will detect a static site and deploy.

Or using the Vercel CLI:

```bash
npm i -g vercel
vercel
```

Notes
-----
- The app stores images locally in IndexedDB and text in localStorage by default. To enable Supabase sync, open `kardex.html` and set `SUPABASE_URL` and `SUPABASE_ANON_KEY` at the top of the script.
- Backups: use the Export/Import buttons in the app to produce a .zip bundle including image files and the snapshot manifest.
