# Video Downloader

A local macOS app for downloading videos from YouTube, Vimeo, and 1000+ other sites. Paste a URL, pick quality, download. Supports video compression and audio-only MP3 extraction.

## Install

Open **Terminal** and paste:

```
bash <(curl -fsSL https://raw.githubusercontent.com/VictorGothensten/video-downloader/main/installer/install.command)
```

This installs everything automatically (Homebrew, ffmpeg, yt-dlp, Python packages) and creates a **Video Downloader** app in your Applications folder.

## Usage

1. Open **Video Downloader** from Applications or Spotlight
2. Your browser opens automatically
3. Paste a video URL
4. Pick a quality — original, compressed, or audio-only MP3
5. Click download

## Requirements

- macOS
- Chrome (used for YouTube authentication cookies)

## Updating

Re-run the install command above. It will download the latest version and replace the app.
