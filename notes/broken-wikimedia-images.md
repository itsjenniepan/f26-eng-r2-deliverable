# Broken species images: diagnosis and fix

A debugging write-up from the Biodiversity Hub deliverable, kept here so I can walk through it in the interview.

## Symptom

On the Species page, many cards had no image (a blank area or a broken-image icon), while a few loaded normally.

## Investigation

Question I started with: is this a **code** problem or a **data** problem?

1. **Checked the code path first.** `species-card.tsx` and the detail dialog render `<Image src={species.image} />`.
   `next.config.js` sets `images.unoptimized: true`, so Next.js does not proxy the image or enforce a host allowlist.
   The browser fetches each stored URL directly. That ruled out the usual `next/image` "hostname not configured" error.
2. **Tested the data.** I extracted every URL in `seed.sql` and requested each with `curl`.
   - 16 image URLs in total.
   - 5 returned `200 image/jpeg` (National Geographic, Smithsonian, Fine Art America, one Wikimedia full-size file).
   - **11 returned `400 text/html`.** All 11 were Wikimedia thumbnails ending in `/440px-<file>.jpg`.
3. **Isolated the variable.** I requested the same tiger image at several widths:

   | Width     | Result |
   | --------- | ------ |
   | 440px     | 400    |
   | 330px     | 200    |
   | 500px     | 200    |
   | 960px     | 200    |
   | full-size | 200    |

## Root cause

Wikimedia only serves thumbnails at a fixed set of widths (e.g. 330, 500, 960). It rejects other widths, including 440px,
with HTTP 400. The starter data (and the "Add Species" form's placeholder URL) used `440px`, so those images could never load.
The browser fails silently on the 400, which is why the UI just showed empty image areas.

**It was a data issue, not a code issue.** The starter's `seed.sql` (initial commit `7fea32a`) contained the bad URLs; none of the
features I built create or change image URLs.

## Fix

Change `/440px-` to `/500px-` in the affected URLs.

- `seed.sql`: updated the 11 URLs, so anyone re-seeding gets working images.
- `app/species/add-species-dialog.tsx`: updated the placeholder example URL (line 241), so people copying it get a working link.
- **Already-seeded database rows must be fixed separately**, because editing `seed.sql` does not change existing data.
  Run this once in the Supabase SQL editor:

```sql
update species
set image = replace(image, '/440px-', '/500px-')
where image like '%upload.wikimedia.org%/440px-%';
```

After the changes, all 16 seed URLs and the placeholder return `200` (re-checked with `curl`).

## Verification checklist

- [x] Run the SQL above in Supabase (SQL editor). (11 rows updated; re-read the table afterwards and all 16 stored URLs return 200.)
- [ ] Reload `/species` and confirm the previously blank cards show images.
- [ ] Spot-check a species you add yourself using the form's placeholder URL.

## Takeaways / what I'd say in the interview

- Started by narrowing where the bug lived (code vs. data) before changing anything. The `next.config.js` setting told me the browser was hitting the URLs directly, so I tested the URLs themselves.
- Changed one variable at a time (image width) to find the real cause.
- Corrected my own miscount along the way (11 broken URLs, not 12), and re-tested after the fix rather than assuming it worked.
- Possible follow-up: show a neutral placeholder tile when an image fails to load, so user-supplied URLs that break later never leave empty boxes.
- Longer term: store uploaded images in Supabase Storage instead of hot-linking third-party URLs, which can change or block requests.
