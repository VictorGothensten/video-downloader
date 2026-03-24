# Video Downloader

A local app for downloading videos from YouTube, Vimeo, and 1000+ other sites. Paste a URL, pick quality, download. Supports video compression and audio-only MP3 extraction.

## Install

### macOS

Open **Terminal** and paste:

```
bash <(curl -fsSL https://raw.githubusercontent.com/VictorGothensten/video-downloader/main/installer/install.command)
```

Creates a **Video Downloader** app in your Applications folder.

### Windows

Open **PowerShell** (right-click Start → Terminal) and paste:

```
irm https://raw.githubusercontent.com/VictorGothensten/video-downloader/main/installer/install.ps1 | iex
```

Creates a **Video Downloader** shortcut on your Desktop and in the Start Menu.

## Usage

1. Open **Video Downloader** (Applications/Spotlight on Mac, Desktop/Start Menu on Windows)
2. Your browser opens automatically
3. Paste a video URL
4. Pick a quality — original, compressed, or audio-only MP3
5. Click download

## Requirements

- macOS or Windows 10/11
- Chrome (used for YouTube authentication cookies)

## Updating

Re-run the install command for your platform. It will download the latest version and replace the app.
