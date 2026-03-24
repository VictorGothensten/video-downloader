import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Download, Loader2, ArrowLeft, ExternalLink } from "lucide-react";

const API_BASE = "https://weapp-cobalt.fly.dev";

type ViewState = "input" | "loading" | "quality" | "downloading" | "done" | "error";

interface FormatInfo {
  height: number;
  label: string;
  filesize: number | null;
}

interface VideoInfo {
  title: string;
  thumbnail: string;
  duration: number;
  formats: FormatInfo[];
}

const DAVID_FACTS = [
  "David has really nice biceps...",
  "David's hair looks excellent today.",
  "David just checked himself out in a spoon.",
  "David declined a Zoom call — bad lighting.",
  "David's jawline could cut glass.",
  "David moisturizes twice a day. Minimum.",
  "David has never taken a bad photo. Ever.",
  "David's skincare routine has 14 steps.",
  "David walked past a mirror and winked at it.",
  "David's teeth are whiter than this background.",
];

const extractYouTubeId = (url: string): string | null => {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
};

function formatBytes(bytes: number | null): string {
  if (!bytes) return "~unknown";
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + " GB";
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(0) + " MB";
  return (bytes / 1024).toFixed(0) + " KB";
}

const Index = () => {
  const [url, setUrl] = useState("");
  const [view, setView] = useState<ViewState>("input");
  const [error, setError] = useState("");
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [filename, setFilename] = useState("");
  const [filesize, setFilesize] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [davidIndex, setDavidIndex] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // David facts rotation
  useEffect(() => {
    if (view !== "downloading") return;
    setDavidIndex(Math.floor(Math.random() * DAVID_FACTS.length));
    const interval = setInterval(() => {
      setDavidIndex((prev) => (prev + 1) % DAVID_FACTS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [view]);

  // Cleanup poll on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").trim();
    if (pasted.startsWith("http")) {
      setTimeout(() => fetchInfo(pasted), 100);
    }
  };

  const handleSubmit = () => {
    if (!url.trim()) return;
    fetchInfo(url.trim());
  };

  const fetchInfo = async (videoUrl: string) => {
    setView("loading");
    setError("");

    try {
      const res = await fetch(`${API_BASE}/api/info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: videoUrl }),
      });
      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setVideoInfo(data);
      setView("quality");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch video info");
      setView("error");
    }
  };

  const handleDownload = async (quality: string) => {
    setView("downloading");
    setError("");
    setProgress(0);

    try {
      const res = await fetch(`${API_BASE}/api/download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), videoQuality: quality }),
      });
      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Poll for status
      const taskId = data.task_id;
      pollRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`${API_BASE}/api/status/${taskId}`);
          const status = await statusRes.json();

          setProgress(status.progress || 0);

          if (status.status === "done") {
            if (pollRef.current) clearInterval(pollRef.current);
            setDownloadUrl(`${API_BASE}/api/file/${taskId}`);
            setFilename(status.filename || "video.mp4");
            setFilesize(status.filesize || null);
            setView("done");
          } else if (status.status === "error") {
            if (pollRef.current) clearInterval(pollRef.current);
            throw new Error(status.error || "Download failed");
          }
        } catch (err) {
          if (pollRef.current) clearInterval(pollRef.current);
          setError(err instanceof Error ? err.message : "Download failed");
          setView("error");
        }
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start download");
      setView("error");
    }
  };

  const reset = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setUrl("");
    setView("input");
    setError("");
    setVideoInfo(null);
    setDownloadUrl("");
    setFilename("");
    setFilesize(null);
    setProgress(0);
  };

  return (
    <div className="min-h-screen flex flex-col items-center px-6 py-16">
      <div className="w-full max-w-[560px]">
        {/* Brand */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            weapp <span className="text-primary">video</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Download videos from YouTube, Vimeo, and more
          </p>
        </div>

        {/* URL Input */}
        {view === "input" && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <Input
                  placeholder="Paste a video URL..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onPaste={handlePaste}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  autoFocus
                  className="h-12 text-sm"
                />
                <Button
                  onClick={handleSubmit}
                  disabled={!url.trim()}
                  className="h-12 px-6 font-semibold"
                >
                  Fetch
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Loading */}
        {view === "loading" && (
          <Card>
            <CardContent className="py-12 flex flex-col items-center gap-4">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground font-medium">
                Fetching video info...
              </span>
            </CardContent>
          </Card>
        )}

        {/* Quality Selection */}
        {view === "quality" && videoInfo && (() => {
          const videoId = extractYouTubeId(url);
          const thumbnailUrl = videoInfo.thumbnail || (videoId
            ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
            : null);

          return (
            <>
              <Card className="mb-4">
                <CardContent className="pt-6">
                  {thumbnailUrl && (
                    <div className="mb-5 rounded-lg overflow-hidden">
                      <img
                        src={thumbnailUrl}
                        alt="Video thumbnail"
                        className="w-full h-auto object-cover"
                      />
                    </div>
                  )}

                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">
                    Video
                  </p>
                  <p className="text-sm font-medium text-foreground mb-1">{videoInfo.title}</p>
                  <p className="text-xs text-muted-foreground mb-5">
                    {videoInfo.duration ? `${Math.floor(videoInfo.duration / 60)}:${String(videoInfo.duration % 60).padStart(2, "0")}` : ""}
                  </p>

                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">
                    Select Quality
                  </p>
                  <div className="space-y-1">
                    {videoInfo.formats.map((f) => (
                      <div
                        key={f.height}
                        className="flex items-center justify-between py-3.5 border-b last:border-b-0"
                      >
                        <div>
                          <span className="font-semibold text-sm">
                            {f.label}
                          </span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {f.filesize ? `~${formatBytes(f.filesize)}` : ""}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          className="font-semibold text-xs"
                          onClick={() => handleDownload(String(f.height))}
                        >
                          <Download className="h-3.5 w-3.5 mr-1" />
                          Download
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <div className="text-center">
                <Button variant="outline" onClick={reset}>
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              </div>
            </>
          );
        })()}

        {/* Downloading */}
        {view === "downloading" && (
          <Card>
            <CardContent className="py-12 flex flex-col items-center gap-5">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground font-medium italic transition-opacity duration-300">
                {DAVID_FACTS[davidIndex]}
              </span>
              <Progress value={progress} className="w-48" />
              <span className="text-xs text-muted-foreground">{progress}%</span>
            </CardContent>
          </Card>
        )}

        {/* Done */}
        {view === "done" && (
          <Card>
            <CardContent className="py-8 flex flex-col items-center gap-4">
              <div className="text-center">
                <h2 className="font-semibold text-sm mb-1 leading-relaxed">
                  {filename}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {filesize ? formatBytes(filesize) + " — " : ""}Ready to download
                </p>
              </div>
              <div className="flex gap-3">
                <Button asChild className="font-semibold">
                  <a href={downloadUrl} download>
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Save File
                  </a>
                </Button>
                <Button variant="outline" onClick={reset}>
                  Download Another
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error */}
        {view === "error" && (
          <Card>
            <CardContent className="py-8 flex flex-col items-center gap-4">
              <p className="text-sm text-destructive font-medium text-center">
                {error}
              </p>
              <div className="flex gap-3">
                <Button onClick={() => setView("quality")}>
                  Try Again
                </Button>
                <Button variant="outline" onClick={reset}>
                  Start Over
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center mt-10">
          <p className="text-xs text-muted-foreground">
            Built by{" "}
            <a
              href="https://weapp.se"
              className="text-primary font-medium hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              weapp.se
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
