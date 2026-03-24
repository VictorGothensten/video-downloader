import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Download, Loader2, ArrowLeft, ExternalLink } from "lucide-react";

type ViewState = "input" | "loading" | "quality" | "downloading" | "done" | "error";

interface CobaltResult {
  status: string;
  url?: string;
  filename?: string;
  error?: { code: string };
  picker?: Array<{ type: string; url: string; thumb?: string }>;
}

const QUALITY_OPTIONS = [
  { value: "2160", label: "4K", desc: "2160p - Best quality" },
  { value: "1080", label: "1080p", desc: "Full HD" },
  { value: "720", label: "720p", desc: "HD - Good balance" },
  { value: "480", label: "480p", desc: "SD - Smaller file" },
  { value: "360", label: "360p", desc: "Low - Smallest file" },
];

const Index = () => {
  const [url, setUrl] = useState("");
  const [view, setView] = useState<ViewState>("input");
  const [error, setError] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [filename, setFilename] = useState("");

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").trim();
    if (pasted.startsWith("http")) {
      setTimeout(() => setView("quality"), 100);
    }
  };

  const handleSubmit = () => {
    if (!url.trim()) return;
    setView("quality");
  };

  const handleDownload = async (quality: string) => {
    setView("downloading");
    setError("");

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "download-video",
        {
          body: {
            url: url.trim(),
            videoQuality: quality,
            downloadMode: "auto",
          },
        }
      );

      if (fnError) {
        throw new Error(fnError.message);
      }

      const result = data as CobaltResult;

      if (result.status === "error") {
        const code = result.error?.code || "Unknown error";
        throw new Error(code);
      }

      if (result.status === "redirect" || result.status === "tunnel") {
        setDownloadUrl(result.url || "");
        setFilename(result.filename || "video.mp4");
        setView("done");
      } else if (result.status === "picker" && result.picker?.length) {
        setDownloadUrl(result.picker[0].url);
        setFilename("video.mp4");
        setView("done");
      } else {
        throw new Error("Unexpected response from server");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
      setView("error");
    }
  };

  const reset = () => {
    setUrl("");
    setView("input");
    setError("");
    setDownloadUrl("");
    setFilename("");
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
        {view === "quality" && (
          <>
            <Card className="mb-4">
              <CardContent className="pt-6">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">
                  Video URL
                </p>
                <p className="text-sm text-foreground truncate mb-5">{url}</p>

                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">
                  Select Quality
                </p>
                <div className="space-y-1">
                  {QUALITY_OPTIONS.map((q) => (
                    <div
                      key={q.value}
                      className="flex items-center justify-between py-3.5 border-b last:border-b-0"
                    >
                      <div>
                        <span className="font-semibold text-sm">
                          {q.label}
                        </span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {q.desc}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        className="font-semibold text-xs"
                        onClick={() => handleDownload(q.value)}
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
        )}

        {/* Downloading */}
        {view === "downloading" && (
          <Card>
            <CardContent className="py-12 flex flex-col items-center gap-5">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground font-medium">
                Preparing your download...
              </span>
              <Progress value={33} className="w-48" />
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
                  Ready to download
                </p>
              </div>
              <div className="flex gap-3">
                <Button asChild className="font-semibold">
                  <a href={downloadUrl} target="_blank" rel="noopener noreferrer" download>
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
