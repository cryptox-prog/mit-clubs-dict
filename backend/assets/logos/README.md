Put verified club/team logos in this directory, named after the **slug** in
`../../data/directory-seed.json`. Examples:

- `acm-manipal.png`
- `cryptonite.png`
- `formula-manipal.webp`
- `mars-rover.jpg`

Use an image supplied by the organization or downloaded from its official page.
Source URLs, dimensions and SHA-256 hashes for collected images are recorded in
`../../data/logo-sources.json`; these do not assert a license grant. Do not save a social-profile HTML page as a PNG.
PNG/JPEG/WebP/GIF/AVIF are supported, max 5 MiB each; one image per slug.
`logo_file` in the manifest gives the collected filename when available; another supported extension
with the same slug also works. 67 logos are now bundled, sourced from institutional club listings, official team
sites and the older student-council directory. Some archive logos may be older
branding. The 12 missing entries are listed in `../../data/logo-sources.json`.

After running `supabase/seed_directory.sql`, from `backend/`:

```sh
npm run seed:logos                # preview only; no remote writes
npm run seed:logos -- --apply     # upload bytes, then link icon_path
```

The uploader reads `backend/.env`, validates files and entity IDs first, and sends
bytes through Supabase Storage API. It never prints credentials. Repeating the
same import reuses the content-hash path; missing files don't clear database logos.
Changed images get new paths; old files are retained for explicit cleanup through
Storage API. The upload and DB update are not one atomic transaction; failed links
can be retried by rerunning. This local admin script is not a public upload route.

The bucket is private. The eventual API must stream icons through Node; the
frontend must not use `getPublicUrl()` or receive the service-role key. Until then,
render initials/a generic fallback when `icon_path` is null. An absent logo does
not prevent importing the directory.
