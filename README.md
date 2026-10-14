# Gülçin's Reading List

Static site (no build step): `index.html` (stats, homepage), `list.html` (reading list), `stats.html` (redirect), `books.html`, `style.css`, `data.json` (Notion), `books.json` (Goodreads).
`export.py` produces `data.json` from the Notion Reading List and (optionally) Goodreads.

## Local
    python3 export.py            # notion_raw.json if present; else keeps data.json when NOTION_TOKEN is unset
    python3 -m http.server 8000  # open http://localhost:8000

## GitHub Pages setup
1. Push this folder to a GitHub repo.
2. Notion: create an internal integration (https://www.notion.so/my-integrations), copy its token,
   and share the Reading List database with it (••• → Connections).
3. Repo → Settings → Secrets and variables → Actions:
   - `NOTION_TOKEN` (optional; without it the committed data.json is kept)
   - `GOODREADS_USER_ID` (optional; defaults to 22282914. Shelves must be public.)
   - optionally `NOTION_DATA_SOURCE_ID` if the data source changes (default is built in).
4. Repo → Settings → Pages → Source: **GitHub Actions**.
5. Actions → "Build and deploy reading list" → Run workflow. It then runs daily at 05:00 UTC.

## Data rules
- Notion Type → tab: Blog/Article/Post/Newsletter → Articles, Paper → Papers, Podcast/Talk/Video → Podcasts / Talks. Rows without a URL are skipped.
- Read vs backlog: Status `Read` = read; `To read`/`Picked`/`Reading` = backlog; `Skip` excluded.
- Books: Goodreads `read` shelf (dated by read_at) + `currently-reading`. Defaults to user 22282914 when `GOODREADS_USER_ID` is unset.
- Private fields (My notes, For, Why it matters, Added by) are never exported.
