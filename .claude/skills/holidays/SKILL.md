---
name: holidays
description: Sort, rename, and organize raw holiday media into a video-ready structure, propose favorites, and generate the highlight video
argument-hint: "<project-folder>"
---

## Configuration

Before executing, read `projects/holidays/instructions.md` for the video editing guidelines, mood, structure, and output requirements.

## Workflow: Process Holiday Media

Process raw holiday photos and videos from a project folder (`$ARGUMENTS`) into a sorted, renamed, video-ready structure. The project folder is located under `projects/holidays/`.

### Step 1: Validate Project Structure

1. Resolve the project path: `projects/holidays/$ARGUMENTS/`
2. Verify these directories exist:
   - `raw input/` — unsorted source media
   - `input/photos/` — destination for sorted photos
   - `input/videos/` — destination for sorted videos
   - `input/audio/` — background music tracks, played in filename order (use `NN-Title.mp3` naming, e.g. `01-Tycho - Awake.mp3`, `02-Better Together.mp3`)
   - `output/` — destination for final video
3. Create `input/photos/favorites/` and `input/videos/favorites/` if they don't exist
4. Count files in `raw input/` and report to the user
5. If `raw input/` is empty, inform the user and abort

### Step 2: Sort & Rename Raw Media

Run the sorting script to process all files from `raw input/`:

```bash
python3 .claude/skills/holidays/sort_and_rename.py "projects/holidays/$ARGUMENTS"
```

This script will:
- Scan `raw input/` for all `.jpg`, `.jpeg`, `.mp4`, `.mov` files (case-insensitive)
- Extract timestamps: EXIF `DateTimeOriginal` for photos, `ffprobe` creation_time for videos
- Fall back to file modification date if no metadata is available
- Sort all files chronologically (photos and videos share one global sequence)
- Copy to `input/photos/` or `input/videos/` with naming: `NNN_YYYYMMDD_HHMMSS.ext`
- Skip files that already exist in the destination (by matching timestamp)
- Print a day-by-day summary

### Step 3: Present Summary to User

After sorting, present the results:

```
Day-by-Day Summary:
DATE          PHOTOS  VIDEOS  TOTAL
─────────────────────────────────────
2025-12-27       1       0       1
2025-12-28      45      18      63
2025-12-29      30      12      42
...
─────────────────────────────────────
TOTAL          401     129     530
```

Ask the user via `AskUserQuestion` whether to proceed with:
1. **Propose favorites** — Analyze and select the best photos and videos
2. **Skip to video generation** — Go directly to generating the highlight video
3. **Stop here** — Only sorting was needed

### Step 4: Propose Favorites

Run the favorites analysis script:

```bash
python3 .claude/skills/holidays/propose_favorites.py "projects/holidays/$ARGUMENTS"
```

This script will:
- Read all sorted photos from `input/photos/` and videos from `input/videos/`
- Score photos by: resolution (megapixels), time spread (avoids clustering from same moment), and day coverage (ensures each day is represented)
- Score videos by: duration (prefers 5-15s clips over very short or very long), time spread, and day coverage
- Select the top ~20% of photos and ~20% of videos as favorites
- Print the proposed favorites list with scores

### Step 5: Review & Copy Favorites

Present the proposed favorites to the user:

```
Proposed Photo Favorites (80 of 401):
  001_20251227_202104.jpeg  ★★★★★  (4032x3024, day opener)
  010_20251228_110123.jpeg  ★★★★☆  (4032x3024, morning)
  ...

Proposed Video Favorites (26 of 129):
  005_20251228_074302.mp4   ★★★★★  (12.3s, sunrise)
  017_20251228_163226.mp4   ★★★★☆  (8.7s, afternoon)
  ...
```

Ask the user via `AskUserQuestion`:
1. **Accept all proposed favorites** — Copy them to the favorites folders
2. **Review and adjust** — User specifies files to add/remove
3. **Skip favorites** — Don't create favorites

Move approved favorites to `input/photos/favorites/` and `input/videos/favorites/`. Files are **moved, not copied** — the video generator scans both main directories and favorites subdirectories, so all files are included in the video regardless of location.

### Step 6: Generate Video

Ask the user if they want to generate the highlight video now.

If yes:
1. Read `projects/holidays/instructions.md` for the full editing guidelines
2. Verify `projects/holidays/generate_video.py` exists
3. Run the video generator:
   ```bash
   python3 projects/holidays/generate_video.py "projects/holidays/$ARGUMENTS"
   ```
4. Report the output file path and size when complete

**Cover images:** Place images in `input/photos/cover/` to create a title sequence at the start of the video. All images in this folder are shown for 10 seconds each (with Ken Burns effect) before the chronological content begins. Images are played in filename sort order — use numbered prefixes to control the sequence (e.g., `01-title.jpg`, `02-arrival.jpg`).

**Favorites integration:** The video generator (`generate_video.py`) automatically reads `input/photos/favorites/` and `input/videos/favorites/` and guarantees that:
- **Favorite photos are never subsampled away** — when the generator trims photos to fit the target duration, all favorites are kept regardless
- **Favorite photos get longer screen time** — 4.5 seconds instead of the standard 3 seconds
- **Favorite videos get longer clips** — up to 10 seconds instead of the standard 6 seconds
- Favorites are marked with ★ in the processing log for visibility

**Labels/captions:** Place an `input/labels.json` file to add text overlays on specific photos or videos. Supports two formats:

```json
{
  "015_20251228_143502.jpeg": "Maspalomas Dunes",
  "017_20251228_160000.mp4": {
    "text": "Sunset Walk\nPlaya del Inglés",
    "position": "top"
  }
}
```

- **Simple string value** — renders as a lower-third label (bottom of frame)
- **Object value** — `text` (required) and `position` (optional: `"bottom"` default, or `"top"`)
- Multi-line text supported with `\n`
- Labels appear as white text on a semi-transparent dark bar, with fade-in/fade-out animation
- Labeled clips are marked with a tag icon in the processing log

**Audio track ordering:** Background music files in `input/audio/` are played in **filename sort order**. Use a numbered prefix to control the playlist sequence:
- `01-Tycho - Awake.mp3` — plays first
- `02-Better Together.mp3` — plays second
- Tracks are concatenated and looped to fill the full video duration
- Audio fades in/out with the video

## Important Rules

- **Never overwrite** existing files in `input/photos/` or `input/videos/` — skip duplicates
- **Preserve raw input** — always copy, never move files from `raw input/`
- **Global sequence** — photos and videos share one continuous sequence number so chronological interleaving is clear
- **Timestamp fallback chain**: EXIF DateTimeOriginal → EXIF DateTime → ffprobe creation_time → file modification date
- **Favorites are moved** — favorites folders contain the originals (moved from the parent dir); the video generator scans both locations so nothing is lost
- **Favorites drive video quality** — the video generator uses favorites to prioritize content; always run favorites selection before video generation for best results
- ALWAYS create a log file named `<YYYY-MM-DD>-holidays-$ARGUMENTS-holidays.txt` in `.claude/skills/holidays/logs/` — copy the complete output as text into this file

## Error Handling

- If `ffprobe` is not available, warn the user and skip video timestamp extraction (use file modification date)
- If a photo has no EXIF data, fall back to file modification date and log a warning
- If `raw input/` contains unsupported file types, list them and skip
- If the project folder doesn't exist, list available project folders under `projects/holidays/` and ask the user to choose
