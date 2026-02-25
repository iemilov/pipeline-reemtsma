#!/usr/bin/env python3
"""
Propose favorite photos and videos from sorted holiday media.

Usage: python3 propose_favorites.py <project-folder> [--move]
Example: python3 propose_favorites.py projects/holidays/2026-gran-canaria --move

Analyzes sorted media in input/fotos/ and input/videos/, scores them
by quality metrics, and proposes ~20% as favorites. Use --move to
move the favorites into the favorites/ subfolders (the video generator
scans both main dirs and favorites dirs, so all files are included).
"""

import os
import sys
import json
import shutil
import subprocess
from datetime import datetime
from collections import defaultdict
from PIL import Image


def parse_filename(fname):
    """Parse NNN_YYYYMMDD_HHMMSS.ext into (seq, datetime)."""
    try:
        name = os.path.splitext(fname)[0]
        parts = name.split('_', 1)
        seq = int(parts[0])
        dt = datetime.strptime(parts[1], "%Y%m%d_%H%M%S")
        return seq, dt
    except (ValueError, IndexError):
        return None, None


def get_photo_resolution(path):
    """Get photo resolution in megapixels."""
    try:
        img = Image.open(path)
        w, h = img.size
        img.close()
        return (w * h) / 1_000_000
    except Exception:
        return 0


def get_video_duration(path):
    """Get video duration in seconds using ffprobe."""
    try:
        result = subprocess.run(
            [
                'ffprobe', '-v', 'quiet',
                '-print_format', 'json',
                '-show_format',
                path
            ],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0:
            data = json.loads(result.stdout)
            return float(data.get('format', {}).get('duration', 0))
    except (subprocess.TimeoutExpired, FileNotFoundError, ValueError):
        pass
    return 0


def score_photos(photos_dir):
    """Score photos by resolution and time spread."""
    items = []

    for fname in sorted(os.listdir(photos_dir)):
        if fname.startswith('.') or os.path.isdir(os.path.join(photos_dir, fname)):
            continue
        seq, dt = parse_filename(fname)
        if dt is None:
            continue

        path = os.path.join(photos_dir, fname)
        mp = get_photo_resolution(path)

        items.append({
            'filename': fname,
            'path': path,
            'seq': seq,
            'datetime': dt,
            'day': dt.strftime("%Y-%m-%d"),
            'megapixels': mp,
            'score': 0,
        })

    if not items:
        return []

    # Score by resolution (normalize to 0-40 points)
    max_mp = max(i['megapixels'] for i in items) or 1
    for item in items:
        item['score'] += (item['megapixels'] / max_mp) * 40

    # Score by time spread — prefer photos that are temporally distant from neighbors
    for idx, item in enumerate(items):
        prev_gap = (item['datetime'] - items[idx-1]['datetime']).total_seconds() if idx > 0 else 3600
        next_gap = (items[idx+1]['datetime'] - item['datetime']).total_seconds() if idx < len(items)-1 else 3600
        min_gap = min(prev_gap, next_gap)
        # Normalize: >30min gap = max score, <1min = low score
        spread_score = min(min_gap / 1800, 1.0) * 30
        item['score'] += spread_score

    # Score by time of day — prefer golden hour (sunrise/sunset)
    for item in items:
        hour = item['datetime'].hour
        if 6 <= hour <= 8 or 17 <= hour <= 19:
            item['score'] += 20  # golden hour bonus
        elif 9 <= hour <= 16:
            item['score'] += 10  # daytime

    # Ensure day coverage — boost under-represented days
    day_counts = defaultdict(int)
    for item in items:
        day_counts[item['day']] += 1

    avg_per_day = len(items) / len(day_counts) if day_counts else 1
    for item in items:
        if day_counts[item['day']] < avg_per_day * 0.5:
            item['score'] += 10  # boost under-represented days

    return items


def score_videos(videos_dir):
    """Score videos by duration and time spread."""
    items = []

    for fname in sorted(os.listdir(videos_dir)):
        if fname.startswith('.') or os.path.isdir(os.path.join(videos_dir, fname)):
            continue
        seq, dt = parse_filename(fname)
        if dt is None:
            continue

        path = os.path.join(videos_dir, fname)
        duration = get_video_duration(path)

        items.append({
            'filename': fname,
            'path': path,
            'seq': seq,
            'datetime': dt,
            'day': dt.strftime("%Y-%m-%d"),
            'duration': duration,
            'score': 0,
        })

    if not items:
        return []

    # Score by duration — prefer 5-15s clips (ideal for highlights)
    for item in items:
        d = item['duration']
        if 5 <= d <= 15:
            item['score'] += 40  # ideal range
        elif 3 <= d < 5 or 15 < d <= 30:
            item['score'] += 25  # acceptable
        elif d > 30:
            item['score'] += 15  # long but usable
        else:
            item['score'] += 5   # very short

    # Score by time spread
    for idx, item in enumerate(items):
        prev_gap = (item['datetime'] - items[idx-1]['datetime']).total_seconds() if idx > 0 else 3600
        next_gap = (items[idx+1]['datetime'] - item['datetime']).total_seconds() if idx < len(items)-1 else 3600
        min_gap = min(prev_gap, next_gap)
        spread_score = min(min_gap / 1800, 1.0) * 30
        item['score'] += spread_score

    # Golden hour bonus
    for item in items:
        hour = item['datetime'].hour
        if 6 <= hour <= 8 or 17 <= hour <= 19:
            item['score'] += 20
        elif 9 <= hour <= 16:
            item['score'] += 10

    # Day coverage boost
    day_counts = defaultdict(int)
    for item in items:
        day_counts[item['day']] += 1

    avg_per_day = len(items) / len(day_counts) if day_counts else 1
    for item in items:
        if day_counts[item['day']] < avg_per_day * 0.5:
            item['score'] += 10

    return items


def select_favorites(items, ratio=0.20):
    """Select top N% as favorites, ensuring day coverage."""
    if not items:
        return []

    n_select = max(5, int(len(items) * ratio))

    # Sort by score descending
    ranked = sorted(items, key=lambda x: x['score'], reverse=True)

    # First pass: pick top scorers
    selected = set()
    for item in ranked:
        if len(selected) >= n_select:
            break
        selected.add(item['filename'])

    # Second pass: ensure every day has at least one representative
    days_covered = {items[i]['day'] for i, item in enumerate(items) if item['filename'] in selected}
    all_days = {item['day'] for item in items}
    for missing_day in all_days - days_covered:
        # Pick the highest-scored item from that day
        day_items = [i for i in ranked if i['day'] == missing_day]
        if day_items:
            selected.add(day_items[0]['filename'])

    return [item for item in items if item['filename'] in selected]


def stars(score, max_score=100):
    """Convert score to star rating."""
    ratio = score / max_score
    if ratio >= 0.8:
        return "★★★★★"
    elif ratio >= 0.6:
        return "★★★★☆"
    elif ratio >= 0.4:
        return "★★★☆☆"
    elif ratio >= 0.2:
        return "★★☆☆☆"
    else:
        return "★☆☆☆☆"


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 propose_favorites.py <project-folder> [--move]")
        sys.exit(1)

    project_dir = sys.argv[1]
    do_move = '--move' in sys.argv

    if not os.path.isabs(project_dir):
        project_dir = os.path.join(os.getcwd(), project_dir)

    fotos_dir = os.path.join(project_dir, "input", "fotos")
    videos_dir = os.path.join(project_dir, "input", "videos")
    fotos_fav = os.path.join(fotos_dir, "favorites")
    videos_fav = os.path.join(videos_dir, "favorites")

    os.makedirs(fotos_fav, exist_ok=True)
    os.makedirs(videos_fav, exist_ok=True)

    print("=" * 55)
    print("Holiday Media — Propose Favorites")
    print("=" * 55)

    # Score photos
    print("\nAnalyzing photos...")
    photo_items = score_photos(fotos_dir)
    photo_favs = select_favorites(photo_items, ratio=0.20)

    print(f"Scored {len(photo_items)} photos, proposing {len(photo_favs)} favorites")

    if photo_favs:
        print(f"\nProposed Photo Favorites ({len(photo_favs)} of {len(photo_items)}):")
        for item in sorted(photo_favs, key=lambda x: x['seq']):
            print(f"  {item['filename']}  {stars(item['score'])}  ({item['megapixels']:.1f}MP, {item['day']})")

    # Score videos
    print("\nAnalyzing videos...")
    video_items = score_videos(videos_dir)
    video_favs = select_favorites(video_items, ratio=0.20)

    print(f"Scored {len(video_items)} videos, proposing {len(video_favs)} favorites")

    if video_favs:
        print(f"\nProposed Video Favorites ({len(video_favs)} of {len(video_items)}):")
        for item in sorted(video_favs, key=lambda x: x['seq']):
            dur = f"{item['duration']:.1f}s" if item['duration'] > 0 else "?s"
            print(f"  {item['filename']}  {stars(item['score'])}  ({dur}, {item['day']})")

    # Summary
    print(f"\n{'─' * 55}")
    print(f"Total: {len(photo_favs)} photo favorites + {len(video_favs)} video favorites")
    print(f"       = {len(photo_favs) + len(video_favs)} of {len(photo_items) + len(video_items)} total media files")

    # Move if requested
    if do_move:
        print(f"\nMoving favorites...")
        moved = 0
        for item in photo_favs:
            dest = os.path.join(fotos_fav, item['filename'])
            if not os.path.exists(dest):
                shutil.move(item['path'], dest)
                moved += 1

        for item in video_favs:
            dest = os.path.join(videos_fav, item['filename'])
            if not os.path.exists(dest):
                shutil.move(item['path'], dest)
                moved += 1

        print(f"Moved {moved} files to favorites folders.")
    else:
        print("\nRun with --move to move favorites to their folders.")


if __name__ == "__main__":
    main()
