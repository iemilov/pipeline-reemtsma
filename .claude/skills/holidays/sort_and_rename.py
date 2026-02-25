#!/usr/bin/env python3
"""
Sort and rename raw holiday media into chronological order.

Usage: python3 sort_and_rename.py <project-folder>
Example: python3 sort_and_rename.py projects/holidays/2026-gran-canaria

Scans 'raw input/' for photos and videos, extracts timestamps from
EXIF/ffprobe metadata, and copies them to input/photos/ and input/videos/
with the naming convention: NNN_YYYYMMDD_HHMMSS.ext
"""

import os
import sys
import json
import shutil
import subprocess
from datetime import datetime
from collections import defaultdict
from PIL import Image
from PIL.ExifTags import Base as ExifBase


PHOTO_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.heic'}
VIDEO_EXTENSIONS = {'.mp4', '.mov', '.m4v', '.avi'}


def get_photo_timestamp(path):
    """Extract timestamp from photo EXIF data."""
    try:
        img = Image.open(path)
        exif = img.getexif()
        img.close()

        # Try DateTimeOriginal first, then DateTime
        for tag in [ExifBase.DateTimeOriginal, ExifBase.DateTime]:
            if tag in exif:
                dt_str = exif[tag]
                # EXIF format: "YYYY:MM:DD HH:MM:SS"
                return datetime.strptime(dt_str, "%Y:%m:%d %H:%M:%S")

        # Try EXIF IFD for DateTimeOriginal
        ifd = exif.get_ifd(0x8769)  # ExifIFD
        if ifd:
            for tag in [36867, 36868]:  # DateTimeOriginal, DateTimeDigitized
                if tag in ifd:
                    return datetime.strptime(ifd[tag], "%Y:%m:%d %H:%M:%S")
    except Exception:
        pass
    return None


def get_video_timestamp(path):
    """Extract creation timestamp from video using ffprobe."""
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
            fmt = data.get('format', {})
            tags = fmt.get('tags', {})

            # Try creation_time or com.apple.quicktime.creationdate
            for key in ['creation_time', 'com.apple.quicktime.creationdate']:
                if key in tags:
                    dt_str = tags[key]
                    # Handle various ISO formats
                    for pattern in [
                        "%Y-%m-%dT%H:%M:%S.%fZ",
                        "%Y-%m-%dT%H:%M:%SZ",
                        "%Y-%m-%dT%H:%M:%S%z",
                        "%Y-%m-%d %H:%M:%S",
                    ]:
                        try:
                            dt = datetime.strptime(dt_str[:26].replace('+', '+'), pattern)
                            return dt.replace(tzinfo=None)
                        except ValueError:
                            continue
                    # Fallback: try parsing just the date portion
                    try:
                        return datetime.strptime(dt_str[:19], "%Y-%m-%dT%H:%M:%S")
                    except ValueError:
                        pass
    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass
    return None


def get_file_timestamp(path):
    """Get file modification timestamp as fallback."""
    mtime = os.path.getmtime(path)
    return datetime.fromtimestamp(mtime)


def classify_file(filename):
    """Classify a file as photo, video, or unknown."""
    ext = os.path.splitext(filename)[1].lower()
    if ext in PHOTO_EXTENSIONS:
        return 'photo'
    elif ext in VIDEO_EXTENSIONS:
        return 'video'
    return None


def scan_raw_input(raw_dir):
    """Scan raw input directory and extract timestamps for all media files."""
    items = []
    skipped = []

    for fname in os.listdir(raw_dir):
        if fname.startswith('.'):
            continue

        fpath = os.path.join(raw_dir, fname)
        if not os.path.isfile(fpath):
            continue

        media_type = classify_file(fname)
        if media_type is None:
            skipped.append(fname)
            continue

        # Extract timestamp
        timestamp = None
        if media_type == 'photo':
            timestamp = get_photo_timestamp(fpath)
        elif media_type == 'video':
            timestamp = get_video_timestamp(fpath)

        if timestamp is None:
            timestamp = get_file_timestamp(fpath)
            source = 'file_mtime'
        else:
            source = 'metadata'

        items.append({
            'filename': fname,
            'path': fpath,
            'type': media_type,
            'timestamp': timestamp,
            'source': source,
        })

    return items, skipped


def build_destination_name(seq, timestamp, media_type):
    """Build the destination filename: NNN_YYYYMMDD_HHMMSS.ext"""
    date_str = timestamp.strftime("%Y%m%d_%H%M%S")
    ext = '.jpeg' if media_type == 'photo' else '.mp4'
    return f"{seq:03d}_{date_str}{ext}"


def copy_files(items, photos_dir, videos_dir):
    """Copy sorted files to their destination directories."""
    copied = 0
    skipped_existing = 0

    for item in items:
        dest_dir = photos_dir if item['type'] == 'photo' else videos_dir
        dest_name = item['dest_name']
        dest_path = os.path.join(dest_dir, dest_name)

        if os.path.exists(dest_path):
            skipped_existing += 1
            continue

        shutil.copy2(item['path'], dest_path)
        copied += 1

    return copied, skipped_existing


def print_summary(items):
    """Print a day-by-day summary table."""
    by_day = defaultdict(lambda: {'photo': 0, 'video': 0})

    for item in items:
        day = item['timestamp'].strftime("%Y-%m-%d")
        by_day[day][item['type']] += 1

    print("\nDay-by-Day Summary:")
    print(f"{'DATE':<14} {'PHOTOS':>7} {'VIDEOS':>7} {'TOTAL':>7}")
    print("─" * 40)

    total_photos = 0
    total_videos = 0

    for day in sorted(by_day.keys()):
        counts = by_day[day]
        p = counts['photo']
        v = counts['video']
        total_photos += p
        total_videos += v
        print(f"{day:<14} {p:>7} {v:>7} {p+v:>7}")

    print("─" * 40)
    print(f"{'TOTAL':<14} {total_photos:>7} {total_videos:>7} {total_photos+total_videos:>7}")

    # Metadata source stats
    meta_count = sum(1 for i in items if i['source'] == 'metadata')
    fallback_count = sum(1 for i in items if i['source'] == 'file_mtime')
    print(f"\nTimestamp sources: {meta_count} from metadata, {fallback_count} from file modification date")


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 sort_and_rename.py <project-folder>")
        print("Example: python3 sort_and_rename.py projects/holidays/2026-gran-canaria")
        sys.exit(1)

    project_dir = sys.argv[1]
    if not os.path.isabs(project_dir):
        project_dir = os.path.join(os.getcwd(), project_dir)

    raw_dir = os.path.join(project_dir, "raw input")
    photos_dir = os.path.join(project_dir, "input", "photos")
    videos_dir = os.path.join(project_dir, "input", "videos")

    # Validate
    if not os.path.isdir(raw_dir):
        print(f"ERROR: 'raw input/' not found at {raw_dir}")
        sys.exit(1)

    os.makedirs(photos_dir, exist_ok=True)
    os.makedirs(videos_dir, exist_ok=True)
    os.makedirs(os.path.join(photos_dir, "favorites"), exist_ok=True)
    os.makedirs(os.path.join(videos_dir, "favorites"), exist_ok=True)

    print("=" * 50)
    print("Holiday Media — Sort & Rename")
    print("=" * 50)
    print(f"Project: {project_dir}")
    print(f"Raw input: {raw_dir}")

    # Scan
    print("\nScanning raw input...")
    items, skipped = scan_raw_input(raw_dir)

    if not items:
        print("ERROR: No supported media files found in raw input/")
        sys.exit(1)

    print(f"Found: {len(items)} media files ({sum(1 for i in items if i['type'] == 'photo')} photos, {sum(1 for i in items if i['type'] == 'video')} videos)")

    if skipped:
        print(f"Skipped {len(skipped)} unsupported files: {', '.join(skipped[:5])}{'...' if len(skipped) > 5 else ''}")

    # Sort chronologically
    items.sort(key=lambda x: x['timestamp'])

    # Assign sequence numbers (global across photos and videos)
    for seq, item in enumerate(items, start=1):
        item['seq'] = seq
        item['dest_name'] = build_destination_name(seq, item['timestamp'], item['type'])

    # Print summary
    print_summary(items)

    # Copy files
    print("\nCopying files...")
    copied, skipped_existing = copy_files(items, photos_dir, videos_dir)

    print(f"\nDone! Copied {copied} files.")
    if skipped_existing > 0:
        print(f"Skipped {skipped_existing} files (already exist in destination).")

    # List first and last few files
    print(f"\nFirst 5 files:")
    for item in items[:5]:
        print(f"  {item['dest_name']}  ← {item['filename']} ({item['source']})")

    print(f"\nLast 5 files:")
    for item in items[-5:]:
        print(f"  {item['dest_name']}  ← {item['filename']} ({item['source']})")


if __name__ == "__main__":
    main()
