import os
import uuid
import threading
import subprocess
import json
import time
import glob as globmod

from flask import Flask, render_template, request, jsonify, send_file

app = Flask(__name__)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DOWNLOAD_DIR = os.path.join(BASE_DIR, 'downloads')
COOKIE_FILE = os.path.join(BASE_DIR, 'cookies.txt')
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

import shutil
import sys
import argparse

YT_DLP = shutil.which('yt-dlp') or '/opt/homebrew/bin/yt-dlp'

# In-memory task tracker
tasks = {}


def cleanup_old_files():
    cutoff = time.time() - 3600
    for f in globmod.glob(os.path.join(DOWNLOAD_DIR, '*')):
        try:
            if os.path.getmtime(f) < cutoff:
                os.remove(f)
        except OSError:
            pass


def refresh_cookies():
    """Re-export cookies from Chrome. Call before each session."""
    cmd = [
        YT_DLP,
        '--cookies-from-browser', 'chrome',
        '--cookies', COOKIE_FILE,
        '--skip-download',
        'https://www.youtube.com',
    ]
    subprocess.run(cmd, capture_output=True, text=True, timeout=30)


def estimate_size(tbr, duration):
    if tbr and duration:
        return int((tbr * 1000 / 8) * duration)
    return None


def format_selector_string(height):
    return f'best[height<={height}][ext=mp4]/best[height<={height}]/bestvideo[height<={height}]+bestaudio/best'


def run_ytdlp_json(url):
    """Use the Homebrew yt-dlp CLI to extract info as JSON."""
    cmd = [
        YT_DLP,
        '--dump-json',
        '--no-download',
        '--cookies', COOKIE_FILE,
        '--extractor-args', 'youtube:player_client=web',
        url,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or 'yt-dlp failed')
    return json.loads(result.stdout)


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/info', methods=['POST'])
def video_info():
    cleanup_old_files()

    url = request.json.get('url', '').strip()
    if not url:
        return jsonify({'error': 'No URL provided'}), 400

    try:
        info = run_ytdlp_json(url)
    except Exception as e:
        return jsonify({'error': str(e)}), 400

    duration = info.get('duration', 0) or 0
    title = info.get('title', 'Unknown')
    thumbnail = info.get('thumbnail', '')

    raw_formats = info.get('formats', [])

    # Find best audio track size
    best_audio_size = 0
    for f in raw_formats:
        if f.get('acodec', 'none') != 'none' and f.get('vcodec', 'none') == 'none':
            size = f.get('filesize') or f.get('filesize_approx') or estimate_size(f.get('tbr'), duration)
            if size and size > best_audio_size:
                best_audio_size = size

    # Group by resolution tiers
    tiers = {}
    for f in raw_formats:
        height = f.get('height')
        if not height or f.get('vcodec', 'none') == 'none':
            continue

        size = f.get('filesize') or f.get('filesize_approx') or estimate_size(f.get('tbr'), duration)
        if f.get('acodec', 'none') == 'none' and size:
            size += best_audio_size

        if height >= 2160:
            tier = 2160
        elif height >= 1440:
            tier = 1440
        elif height >= 1080:
            tier = 1080
        elif height >= 720:
            tier = 720
        elif height >= 480:
            tier = 480
        else:
            tier = 360

        if tier not in tiers or (size and (not tiers[tier]['filesize'] or size > tiers[tier]['filesize'])):
            tiers[tier] = {
                'height': tier,
                'label': f'{tier}p',
                'filesize': size,
                'ext': 'mp4',
                'format_string': format_selector_string(tier),
            }

    formats = sorted(tiers.values(), key=lambda x: x['height'], reverse=True)

    best_size = formats[0]['filesize'] if formats and formats[0]['filesize'] else None

    compression_options = []
    if best_size:
        compression_options = [
            {'label': 'High Quality', 'crf': 23, 'estimated_size': int(best_size * 0.55)},
            {'label': 'Medium Quality', 'crf': 28, 'estimated_size': int(best_size * 0.30)},
            {'label': 'Compact', 'crf': 33, 'estimated_size': int(best_size * 0.15)},
        ]

    return jsonify({
        'title': title,
        'thumbnail': thumbnail,
        'duration': duration,
        'formats': formats,
        'compression_options': compression_options,
    })


def run_ffmpeg_with_progress(task_id, cmd, duration_secs):
    full_cmd = cmd[:-1] + ['-progress', 'pipe:1', '-nostats'] + [cmd[-1]]
    proc = subprocess.Popen(
        full_cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    for line in proc.stdout:
        line = line.strip()
        if line.startswith('out_time_us='):
            try:
                us = int(line.split('=')[1])
                if duration_secs > 0:
                    pct = min(us / (duration_secs * 1_000_000), 1.0)
                    tasks[task_id]['progress'] = 50 + int(pct * 45)
            except (ValueError, IndexError):
                pass
    proc.wait()
    return proc.returncode


def download_worker(task_id, data):
    url = data['url']
    format_string = data.get('format_string', 'best[ext=mp4]/best/bestvideo+bestaudio')
    compress = data.get('compress', False)
    crf = data.get('crf', 28)

    output_template = os.path.join(DOWNLOAD_DIR, f'{task_id}_%(title).80s.%(ext)s')

    cmd = [
        YT_DLP,
        '-f', format_string,
        '-o', output_template,
        '--merge-output-format', 'mp4',
        '--cookies', COOKIE_FILE,
        '--extractor-args', 'youtube:player_client=web',
        '--newline',
        url,
    ]

    try:
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )

        for line in proc.stdout:
            line = line.strip()
            if '[download]' in line and '%' in line:
                try:
                    pct_str = line.split('%')[0].split()[-1]
                    pct = float(pct_str)
                    max_pct = 50 if compress else 95
                    tasks[task_id]['progress'] = int((pct / 100) * max_pct)
                except (ValueError, IndexError):
                    pass

        stderr_output = proc.stderr.read()
        proc.wait()

        if proc.returncode != 0:
            raise RuntimeError(stderr_output.strip() or 'Download failed')

        # Find the downloaded file
        matches = globmod.glob(os.path.join(DOWNLOAD_DIR, f'{task_id}_*'))
        if not matches:
            raise FileNotFoundError('Downloaded file not found')
        downloaded_file = matches[0]

        duration = data.get('duration', 0) or 0

        # Get clean title from filename
        basename = os.path.basename(downloaded_file)
        clean_title = basename.split('_', 1)[-1]
        clean_title = os.path.splitext(clean_title)[0]

    except Exception as e:
        tasks[task_id].update({'status': 'error', 'error': str(e)})
        return

    # Phase 2: Compress if requested
    if compress:
        tasks[task_id].update({'status': 'compressing', 'progress': 50})
        compressed_file = os.path.join(
            DOWNLOAD_DIR,
            f'{task_id}_compressed_{os.path.basename(downloaded_file).split("_", 1)[-1]}'
        )
        cmd = [
            'ffmpeg', '-i', downloaded_file,
            '-c:v', 'libx264', '-crf', str(crf),
            '-preset', 'medium',
            '-c:a', 'aac', '-b:a', '128k',
            '-movflags', '+faststart',
            '-y', compressed_file,
        ]
        rc = run_ffmpeg_with_progress(task_id, cmd, duration)
        if rc != 0:
            tasks[task_id].update({'status': 'error', 'error': 'Compression failed'})
            return

        try:
            os.remove(downloaded_file)
        except OSError:
            pass
        downloaded_file = compressed_file

    ext = os.path.splitext(downloaded_file)[1]
    suffix = ' (compressed)' if compress else ''
    clean_filename = f'{clean_title}{suffix}{ext}'

    tasks[task_id].update({
        'status': 'done',
        'progress': 100,
        'filename': clean_filename,
        'filepath': downloaded_file,
        'filesize': os.path.getsize(downloaded_file),
    })


@app.route('/api/download', methods=['POST'])
def start_download():
    data = request.json
    url = data.get('url', '').strip()
    if not url:
        return jsonify({'error': 'No URL provided'}), 400

    task_id = str(uuid.uuid4())[:8]
    tasks[task_id] = {
        'status': 'downloading',
        'progress': 0,
        'filename': None,
        'filepath': None,
        'error': None,
    }

    thread = threading.Thread(target=download_worker, args=(task_id, data), daemon=True)
    thread.start()

    return jsonify({'task_id': task_id})


@app.route('/api/status/<task_id>')
def task_status(task_id):
    task = tasks.get(task_id)
    if not task:
        return jsonify({'status': 'not_found'}), 404
    return jsonify(task)


@app.route('/api/file/<task_id>')
def get_file(task_id):
    task = tasks.get(task_id)
    if not task or task['status'] != 'done':
        return jsonify({'error': 'Not ready'}), 404
    return send_file(
        task['filepath'],
        as_attachment=True,
        download_name=task['filename'],
    )


@app.route('/api/refresh-cookies', methods=['POST'])
def refresh_cookies_endpoint():
    """Manually refresh cookies from Chrome."""
    try:
        refresh_cookies()
        return jsonify({'status': 'ok'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8080)
    args = parser.parse_args()

    # Refresh cookies in background on startup
    def _startup_cookies():
        try:
            if not os.path.exists(COOKIE_FILE):
                print('  Exporting cookies from Chrome...')
            refresh_cookies()
            print('  Cookies ready.')
        except Exception:
            print('  Cookie export skipped (Chrome may not be available).')

    threading.Thread(target=_startup_cookies, daemon=True).start()

    print(f'\n  Video Downloader running at http://127.0.0.1:{args.port}\n')
    app.run(debug=False, host='127.0.0.1', port=args.port)
