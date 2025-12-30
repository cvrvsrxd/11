import { useState, useRef, useCallback } from "react";
import GmgnCard from "@/components/GmgnCard";
import defaultBg from "@/assets/gmgn-default-bg.jpg";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Download, Loader2 } from "lucide-react";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
const Index = () => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordProgress, setRecordProgress] = useState<number | null>(null);
  const [cardData, setCardData] = useState({
    dateRange: "25/11/01 - 25/12/30",
    profitType: "Realized Profit",
    pnlValue: "-$9,164.45",
    txWin: "1,213",
    txLoss: "1,119",
    username: "Esee",
    // Default to local placeholder to avoid CORS issues during export
    avatarUrl: "/placeholder.svg",
    followers: "8.03K",
    inviteCode: "2xf0NZRc",
    // Local default background (safe for canvas export)
    backgroundUrl: defaultBg,
    backgroundType: "image" as "image" | "video",
    backgroundFileName: "",
    twitterHandle: "gmgnai",
    websiteUrl: "gmgn.ai",
    showUserProfile: true,
    showGradientOverlay: true,
    transparentPnlText: false,
  });

  const handleChange = (field: string, value: string | boolean) => {
    setCardData((prev) => ({ ...prev, [field]: value }));
  };

  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const isVideo = file.type.startsWith("video/");
      const reader = new FileReader();
      reader.onloadend = () => {
        setCardData((prev) => ({
          ...prev,
          backgroundUrl: reader.result as string,
          backgroundType: isVideo ? "video" : "image",
          backgroundFileName: file.name,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageUpload = (field: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCardData((prev) => ({ ...prev, [field]: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const isSafeCanvasUrl = (url: string) => {
    if (!url) return true;
    if (url.startsWith("data:") || url.startsWith("blob:")) return true;
    if (url.startsWith("/")) return true;
    try {
      return new URL(url, window.location.href).origin === window.location.origin;
    } catch {
      return false;
    }
  };

  const handleDownloadPng = async () => {
    if (!cardRef.current) return;

    try {
      const exportScale = 1280 / 750;

      const dataUrl = await toPng(cardRef.current, {
        width: 1280,
        height: 720,
        pixelRatio: exportScale,
        style: {
          transform: `scale(${exportScale})`,
          transformOrigin: "top left",
        },
        filter: (node) => {
          if (node instanceof HTMLImageElement) {
            const src = node.getAttribute("src") || "";
            return isSafeCanvasUrl(src);
          }
          return true;
        },
      });

      const link = document.createElement("a");
      link.download = `gmgn-pnl-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("PNG downloaded successfully!");
    } catch (error) {
      console.error("Error downloading PNG:", error);
      toast.error("Export failed due to CORS. Upload images/videos instead of hotlinking.");
    }
  };

  const handleDownloadVideo = useCallback(async () => {
    if (!cardRef.current || cardData.backgroundType !== "video") return;

    const card = cardRef.current;
    const video = card.querySelector("#bg-video") as HTMLVideoElement | null;

    if (!video) {
      toast.error("Video background not found in card");
      return;
    }

    if (!isSafeCanvasUrl(cardData.backgroundUrl)) {
      toast.error("Video export blocked by CORS. Please upload the video file.");
      return;
    }

    setIsRecording(true);

    try {
      // Use a cloned/hidden video element for export so we can capture audio (the UI video is muted for autoplay)
      const exportVideo = document.createElement("video");
      exportVideo.src = video.currentSrc || cardData.backgroundUrl;
      exportVideo.muted = false;
      exportVideo.playsInline = true;
      exportVideo.preload = "auto";
      exportVideo.crossOrigin = "anonymous";
      exportVideo.style.position = "fixed";
      exportVideo.style.left = "-9999px";
      exportVideo.style.top = "-9999px";
      exportVideo.style.width = "1px";
      exportVideo.style.height = "1px";
      document.body.appendChild(exportVideo);

      const cleanupExportVideo = () => {
        try {
          exportVideo.pause();
        } catch {
          // ignore
        }
        exportVideo.remove();
      };

      // Ensure metadata loaded for duration
      if (exportVideo.readyState < 1) {
        await new Promise<void>((resolve, reject) => {
          const onLoaded = () => {
            cleanup();
            resolve();
          };
          const onError = () => {
            cleanup();
            reject(new Error("Could not load video metadata"));
          };
          const cleanup = () => {
            exportVideo.removeEventListener("loadedmetadata", onLoaded);
            exportVideo.removeEventListener("error", onError);
          };
          exportVideo.addEventListener("loadedmetadata", onLoaded);
          exportVideo.addEventListener("error", onError);
        });
      }

      if (!Number.isFinite(exportVideo.duration) || exportVideo.duration <= 0) {
        toast.error("Cannot export: video duration unknown");
        cleanupExportVideo();
        setIsRecording(false);
        return;
      }

      // Capture overlay once (everything except bg-video, skip unsafe images, and skip export-ignored nodes)
      const exportScale = 1280 / 750;
      const overlayDataUrl = await toPng(card, {
        width: 1280,
        height: 720,
        pixelRatio: exportScale,
        backgroundColor: "transparent",
        style: {
          transform: `scale(${exportScale})`,
          transformOrigin: "top left",
        },
        filter: (node) => {
          if (node instanceof HTMLElement) {
            if (node.id === "export-fallback-bg") return false;
            if (node.dataset.exportIgnore === "true") return false;
            if (node.getAttribute("data-export-ignore") === "true") return false;
          }
          if (node instanceof HTMLVideoElement) return false;
          if (node instanceof HTMLImageElement) {
            const src = node.getAttribute("src") || "";
            return isSafeCanvasUrl(src);
          }
          return true;
        },
      });

      const overlayImg = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Failed to load overlay image"));
        img.src = overlayDataUrl;
      });

      const canvas = document.createElement("canvas");
      canvas.width = 1280;
      canvas.height = 720;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not get canvas context");

      const canvasStream = canvas.captureStream(30);
      const combinedStream = new MediaStream();
      canvasStream.getVideoTracks().forEach((t) => combinedStream.addTrack(t));

      // Add audio track (best-effort). Many browsers only allow this for same-origin/data: videos.
      let audioAdded = false;

      // 1) Prefer WebAudio -> MediaStreamDestination (works even when captureStream audio is missing)
      try {
        const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
        const audioCtx = new AudioCtx();
        await audioCtx.resume();
        const source = audioCtx.createMediaElementSource(exportVideo);
        const dest = audioCtx.createMediaStreamDestination();
        source.connect(dest);
        dest.stream.getAudioTracks().forEach((t) => {
          combinedStream.addTrack(t);
          audioAdded = true;
        });
      } catch (e) {
        console.warn("WebAudio capture failed:", e);
      }

      // 2) Fallback: element.captureStream (if available)
      if (!audioAdded) {
        const exportVideoStream: MediaStream | undefined =
          (exportVideo as any).captureStream?.() || (exportVideo as any).mozCaptureStream?.();
        exportVideoStream?.getAudioTracks().forEach((t: MediaStreamTrack) => {
          combinedStream.addTrack(t);
          audioAdded = true;
        });
      }

      if (!audioAdded) toast.warning("Аудио не удалось захватить (ограничение браузера/видео)");

      const preferredTypes = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
      ];
      const mimeType = preferredTypes.find((t) => MediaRecorder.isTypeSupported(t)) || "video/webm";

      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 8_000_000, // Higher bitrate for better quality
      });

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      let stopTimer = 0;

      const onEnded = () => {
        if (mediaRecorder.state !== "inactive") mediaRecorder.stop();
      };

      const cleanupAll = () => {
        exportVideo.removeEventListener("ended", onEnded);
        clearTimeout(stopTimer);
        cleanupExportVideo();
        setRecordProgress(null);
        setIsRecording(false);
      };

      const finalize = async () => {
        try {
          toast.info("Converting to MP4... Please wait");
          
          const webmBlob = new Blob(chunks, { type: mimeType });
          
          // Initialize FFmpeg with single-threaded core (no SharedArrayBuffer needed)
          const ffmpeg = new FFmpeg();
          await ffmpeg.load({
            coreURL: "https://unpkg.com/@ffmpeg/core-st@0.12.6/dist/esm/ffmpeg-core.js",
            wasmURL: "https://unpkg.com/@ffmpeg/core-st@0.12.6/dist/esm/ffmpeg-core.wasm",
          });
          
          // Write WebM to FFmpeg virtual filesystem
          const webmData = await fetchFile(webmBlob);
          await ffmpeg.writeFile("input.webm", webmData);
          
          // Convert to MP4 with high quality settings
          await ffmpeg.exec([
            "-i", "input.webm",
            "-c:v", "libx264",
            "-preset", "slow",
            "-crf", "18",
            "-c:a", "aac",
            "-b:a", "192k",
            "-movflags", "+faststart",
            "-pix_fmt", "yuv420p",
            "output.mp4"
          ]);
          
          // Read the output MP4
          const mp4Data = await ffmpeg.readFile("output.mp4");
          const bytes = new Uint8Array(mp4Data as Uint8Array);
          const buffer = new ArrayBuffer(bytes.length);
          new Uint8Array(buffer).set(bytes);
          const mp4Blob = new Blob([buffer], { type: "video/mp4" });
          
          const url = URL.createObjectURL(mp4Blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `gmgn-card-${Date.now()}.mp4`;
          a.click();
          URL.revokeObjectURL(url);
          toast.success("MP4 downloaded successfully!");
        } catch (err) {
          console.error("FFmpeg conversion error:", err);
          toast.error("MP4 conversion failed, downloading WebM instead");
          const webmBlob = new Blob(chunks, { type: mimeType });
          const url = URL.createObjectURL(webmBlob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `gmgn-card-${Date.now()}.webm`;
          a.click();
          URL.revokeObjectURL(url);
        } finally {
          cleanupAll();
        }
      };

      mediaRecorder.onstop = finalize;

      toast.info("Exporting full card video… this takes as long as the BG video");

      exportVideo.currentTime = 0;
      exportVideo.addEventListener("ended", onEnded);

      // Safety stop
      stopTimer = window.setTimeout(() => {
        if (mediaRecorder.state !== "inactive") mediaRecorder.stop();
      }, Math.ceil(exportVideo.duration * 1000) + 500);

      mediaRecorder.start();
      await exportVideo.play();

      const draw = () => {
        try {
          ctx.clearRect(0, 0, 1280, 720);
          ctx.drawImage(exportVideo, 0, 0, 1280, 720);
          ctx.drawImage(overlayImg, 0, 0, 1280, 720);
          if (Number.isFinite(exportVideo.duration) && exportVideo.duration > 0) {
            setRecordProgress(Math.min(1, Math.max(0, exportVideo.currentTime / exportVideo.duration)));
          }
        } catch (e) {
          console.error("Canvas draw error:", e);
          toast.error("Export failed (likely CORS or browser limitation)");
          if (mediaRecorder.state !== "inactive") mediaRecorder.stop();
          return;
        }

        if (!exportVideo.ended && !exportVideo.paused) requestAnimationFrame(draw);
      };
      draw();
    } catch (error) {
      console.error("Error exporting video:", error);
      toast.error("Failed to export video");
      setIsRecording(false);
    }
  }, [cardData.backgroundType, cardData.backgroundUrl]);

  return (
    <main className="min-h-screen bg-[hsl(var(--gmgn-bg-100))] py-8 px-4">
      <div className="max-w-[1200px] mx-auto">
        <h1 className="text-2xl font-bold text-[hsl(var(--gmgn-text-100))] mb-8 text-center">
          GMGN PnL Card Generator
        </h1>

        <div className="flex flex-col xl:flex-row gap-8 items-start">
          {/* Card Preview */}
          <div className="flex flex-col gap-4 items-center w-full xl:w-auto xl:sticky xl:top-8">
            <div className="overflow-x-auto">
              <GmgnCard ref={cardRef} data={cardData} />
            </div>
            {cardData.backgroundType === "video" ? (
              <div className="flex gap-3 flex-wrap justify-center">
                <Button 
                  onClick={handleDownloadVideo} 
                  className="font-semibold px-6"
                  disabled={isRecording}
                >
                  {isRecording ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {recordProgress === null ? "Exporting…" : `Exporting ${Math.round(recordProgress * 100)}%`}
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Download Video
                    </>
                  )}
                </Button>
                <Button onClick={handleDownloadPng} variant="outline" className="font-semibold px-6">
                  <Download className="w-4 h-4 mr-2" />
                  Download PNG
                </Button>
              </div>
            ) : (
              <Button onClick={handleDownloadPng} className="font-semibold px-6">
                <Download className="w-4 h-4 mr-2" />
                Download PNG (1280x720)
              </Button>
            )}
          </div>

          {/* Editor Panel */}
          <div className="w-full xl:w-[380px] bg-[hsl(var(--gmgn-card-100))] rounded-xl p-6 border border-[hsl(var(--gmgn-line-100))] space-y-4 flex-shrink-0">
            <h2 className="text-lg font-semibold text-[hsl(var(--gmgn-text-100))] mb-4">Edit Data</h2>

            <div className="flex items-center justify-between">
              <Label htmlFor="showUserProfile" className="text-[hsl(var(--gmgn-text-200))]">
                Show Avatar & Username
              </Label>
              <Switch
                id="showUserProfile"
                checked={cardData.showUserProfile}
                onCheckedChange={(checked) => handleChange("showUserProfile", checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="showGradientOverlay" className="text-[hsl(var(--gmgn-text-200))]">
                Show Left Gradient Overlay
              </Label>
              <Switch
                id="showGradientOverlay"
                checked={cardData.showGradientOverlay}
                onCheckedChange={(checked) => handleChange("showGradientOverlay", checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="transparentPnlText" className="text-[hsl(var(--gmgn-text-200))]">
                Transparent PnL Text (Knockout)
              </Label>
              <Switch
                id="transparentPnlText"
                checked={cardData.transparentPnlText}
                onCheckedChange={(checked) => handleChange("transparentPnlText", checked)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateRange" className="text-[hsl(var(--gmgn-text-200))]">Date Range</Label>
              <Input
                id="dateRange"
                value={cardData.dateRange}
                onChange={(e) => handleChange("dateRange", e.target.value)}
                className="bg-[hsl(var(--gmgn-bg-200))] border-[hsl(var(--gmgn-line-100))] text-[hsl(var(--gmgn-text-100))]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="profitType" className="text-[hsl(var(--gmgn-text-200))]">Profit Type</Label>
              <Input
                id="profitType"
                value={cardData.profitType}
                onChange={(e) => handleChange("profitType", e.target.value)}
                className="bg-[hsl(var(--gmgn-bg-200))] border-[hsl(var(--gmgn-line-100))] text-[hsl(var(--gmgn-text-100))]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pnlValue" className="text-[hsl(var(--gmgn-text-200))]">PnL Value</Label>
              <Input
                id="pnlValue"
                value={cardData.pnlValue}
                onChange={(e) => handleChange("pnlValue", e.target.value)}
                placeholder="-$9,164.45 or +$5,000"
                className="bg-[hsl(var(--gmgn-bg-200))] border-[hsl(var(--gmgn-line-100))] text-[hsl(var(--gmgn-text-100))]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="txWin" className="text-[hsl(var(--gmgn-text-200))]">Win TXs</Label>
                <Input
                  id="txWin"
                  value={cardData.txWin}
                  onChange={(e) => handleChange("txWin", e.target.value)}
                  className="bg-[hsl(var(--gmgn-bg-200))] border-[hsl(var(--gmgn-line-100))] text-[hsl(var(--gmgn-text-100))]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="txLoss" className="text-[hsl(var(--gmgn-text-200))]">Loss TXs</Label>
                <Input
                  id="txLoss"
                  value={cardData.txLoss}
                  onChange={(e) => handleChange("txLoss", e.target.value)}
                  className="bg-[hsl(var(--gmgn-bg-200))] border-[hsl(var(--gmgn-line-100))] text-[hsl(var(--gmgn-text-100))]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="username" className="text-[hsl(var(--gmgn-text-200))]">Username</Label>
              <Input
                id="username"
                value={cardData.username}
                onChange={(e) => handleChange("username", e.target.value)}
                className="bg-[hsl(var(--gmgn-bg-200))] border-[hsl(var(--gmgn-line-100))] text-[hsl(var(--gmgn-text-100))]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="followers" className="text-[hsl(var(--gmgn-text-200))]">Followers</Label>
              <Input
                id="followers"
                value={cardData.followers}
                onChange={(e) => handleChange("followers", e.target.value)}
                className="bg-[hsl(var(--gmgn-bg-200))] border-[hsl(var(--gmgn-line-100))] text-[hsl(var(--gmgn-text-100))]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="inviteCode" className="text-[hsl(var(--gmgn-text-200))]">Invite Code</Label>
              <Input
                id="inviteCode"
                value={cardData.inviteCode}
                onChange={(e) => handleChange("inviteCode", e.target.value)}
                className="bg-[hsl(var(--gmgn-bg-200))] border-[hsl(var(--gmgn-line-100))] text-[hsl(var(--gmgn-text-100))]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="twitterHandle" className="text-[hsl(var(--gmgn-text-200))]">Twitter</Label>
                <Input
                  id="twitterHandle"
                  value={cardData.twitterHandle}
                  onChange={(e) => handleChange("twitterHandle", e.target.value)}
                  className="bg-[hsl(var(--gmgn-bg-200))] border-[hsl(var(--gmgn-line-100))] text-[hsl(var(--gmgn-text-100))]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="websiteUrl" className="text-[hsl(var(--gmgn-text-200))]">Website</Label>
                <Input
                  id="websiteUrl"
                  value={cardData.websiteUrl}
                  onChange={(e) => handleChange("websiteUrl", e.target.value)}
                  className="bg-[hsl(var(--gmgn-bg-200))] border-[hsl(var(--gmgn-line-100))] text-[hsl(var(--gmgn-text-100))]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="avatarUrl" className="text-[hsl(var(--gmgn-text-200))]">Avatar Image</Label>
              <Input
                id="avatarUrl"
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload("avatarUrl", e)}
                className="bg-[hsl(var(--gmgn-bg-200))] border-[hsl(var(--gmgn-line-100))] text-[hsl(var(--gmgn-text-100))] cursor-pointer file:bg-[hsl(var(--gmgn-hover-100))] file:text-[hsl(var(--gmgn-text-100))] file:border-0 file:mr-3"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="backgroundUrl" className="text-[hsl(var(--gmgn-text-200))]">
                Background (Image or Video)
              </Label>
              <Input
                id="backgroundUrl"
                type="file"
                accept="image/*,video/mp4,video/webm,video/ogg"
                onChange={handleMediaUpload}
                className="bg-[hsl(var(--gmgn-bg-200))] border-[hsl(var(--gmgn-line-100))] text-[hsl(var(--gmgn-text-100))] cursor-pointer file:bg-[hsl(var(--gmgn-hover-100))] file:text-[hsl(var(--gmgn-text-100))] file:border-0 file:mr-3"
              />
              <p className="text-xs text-[hsl(var(--gmgn-text-300))]">
                Supports PNG, JPEG, GIF, MP4, WebM (1280x720 recommended)
              </p>
            </div>

            {cardData.backgroundType === "video" && (
              <div className="text-xs text-[rgb(134,217,159)] bg-[hsl(148_55%_69%/0.1)] px-3 py-2 rounded-lg">
                Download Video exports the full card video (same duration as BG video)
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
};

export default Index;
