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
const Index = () => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordProgress, setRecordProgress] = useState<number | null>(null);
  const [exportFps, setExportFps] = useState<number>(30);
  const [cardVersion, setCardVersion] = useState<1 | 2>(1);
  const [cardData, setCardData] = useState({
    // Version 1 fields
    dateRange: "25/11/01 - 25/12/30",
    profitType: "Realized Profit",
    pnlValue: "-$9,164.45",
    txWin: "1,213",
    txLoss: "1,119",
    // Version 2 fields
    month: "January 2026",
    winStreak: "2",
    profitAmount: "+$2,730.46",
    lossAmount: "-$214.15",
    profitDaysWin: "2",
    profitDaysLoss: "1",
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
      // Create export video element (unmuted for audio capture)
      const exportVideo = document.createElement("video");
      exportVideo.src = video.currentSrc || cardData.backgroundUrl;
      exportVideo.muted = false;
      exportVideo.playsInline = true;
      exportVideo.preload = "auto";
      exportVideo.crossOrigin = "anonymous";
      exportVideo.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;";
      document.body.appendChild(exportVideo);

      const cleanupExportVideo = () => {
        try { exportVideo.pause(); } catch {}
        exportVideo.remove();
      };

      // Wait for metadata
      if (exportVideo.readyState < 1) {
        await new Promise<void>((resolve, reject) => {
          const onLoaded = () => { cleanup(); resolve(); };
          const onError = () => { cleanup(); reject(new Error("Could not load video metadata")); };
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

      // Preload avatar image
      let avatarImg: HTMLImageElement | null = null;
      if (cardData.showUserProfile && cardData.avatarUrl) {
        avatarImg = await new Promise<HTMLImageElement>((resolve) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null as any);
          img.src = cardData.avatarUrl;
        });
      }

      // Create canvas - all rendering happens here
      const canvas = document.createElement("canvas");
      canvas.width = 1280;
      canvas.height = 720;
      const ctx = canvas.getContext("2d", { alpha: false })!;
      if (!ctx) throw new Error("Could not get canvas context");

      // Scale factor for 1280x720 from base 750x420
      const scale = 1280 / 750;

      // Draw function - renders everything directly on canvas
      const drawFrame = () => {
        // 1. Video frame
        ctx.drawImage(exportVideo, 0, 0, 1280, 720);

        // 2. Gradient overlay (if enabled)
        if (cardData.showGradientOverlay) {
          const grad = ctx.createLinearGradient(0, 0, 1280, 0);
          grad.addColorStop(0, "rgba(0,0,0,0.9)");
          grad.addColorStop(0.45, "rgba(0,0,0,0.75)");
          grad.addColorStop(0.75, "rgba(0,0,0,0)");
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, 1280, 720);
        }

        // 3. Text and UI elements
        ctx.fillStyle = "#ffffff";
        ctx.textBaseline = "top";

        // Header divider
        const headerY = 20 * scale;
        const sideMargin = 68 * scale;
        const dividerY = headerY + 36 * scale + 20 * scale;
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.fillRect(sideMargin, dividerY, 1280 - sideMargin * 2, 1 * scale);

        // Version-specific content
        const contentY = dividerY + 24 * scale;
        ctx.fillStyle = "#ffffff";
        ctx.font = `bold ${28 * scale}px Geist, -apple-system, BlinkMacSystemFont, sans-serif`;
        
        if (cardVersion === 1) {
          // Version 1: Date Range + Profit Type
          ctx.fillText(cardData.dateRange, sideMargin, contentY);
          ctx.fillText(cardData.profitType, sideMargin, contentY + 36 * scale);
        } else {
          // Version 2: Month + Win Streak
          ctx.fillText(cardData.month || "January 2026", sideMargin, contentY);
          const streakY = contentY + 36 * scale;
          ctx.fillStyle = "rgb(134,217,159)";
          const streakDays = `${cardData.winStreak || "2"}Days`;
          ctx.fillText(streakDays, sideMargin, streakY);
          const streakDaysWidth = ctx.measureText(streakDays).width;
          ctx.fillStyle = "#ffffff";
          ctx.fillText(" Win Streak", sideMargin + streakDaysWidth, streakY);
        }

        // PNL Block
        const isNegative = cardData.pnlValue.startsWith("-");
        const pnlBgColor = isNegative ? "rgb(242,102,130)" : "rgb(134,217,159)";
        const pnlY = contentY + 80 * scale;
        const pnlH = 55 * scale;
        const pnlFontSize = 43 * scale;
        const pnlPx = 10 * scale;
        
        ctx.font = `bold ${pnlFontSize}px Geist, -apple-system, BlinkMacSystemFont, sans-serif`;
        const textMetrics = ctx.measureText(cardData.pnlValue);
        const pnlW = Math.max(230 * scale, textMetrics.width + pnlPx * 2);

        if (cardData.transparentPnlText) {
          ctx.fillStyle = pnlBgColor;
          ctx.fillRect(sideMargin, pnlY, pnlW, pnlH);
          ctx.globalCompositeOperation = "destination-out";
          ctx.fillStyle = "#000";
          ctx.textBaseline = "middle";
          ctx.fillText(cardData.pnlValue, sideMargin + pnlPx, pnlY + pnlH / 2);
          ctx.globalCompositeOperation = "source-over";
        } else {
          ctx.fillStyle = pnlBgColor;
          ctx.fillRect(sideMargin, pnlY, pnlW, pnlH);
          ctx.fillStyle = "#000000";
          ctx.textBaseline = "middle";
          ctx.fillText(cardData.pnlValue, sideMargin + pnlPx, pnlY + pnlH / 2);
        }

        // Stats below PNL
        ctx.textBaseline = "top";
        const statsY = pnlY + pnlH + 24 * scale;
        ctx.font = `bold ${20 * scale}px Geist, -apple-system, BlinkMacSystemFont, sans-serif`;

        if (cardVersion === 1) {
          // Version 1: TXs
          ctx.fillStyle = "rgba(255,255,255,0.5)";
          ctx.fillText("TXs", sideMargin, statsY);
          
          const txLabelWidth = 60 * scale + 12 * scale;
          ctx.fillStyle = "rgb(134,217,159)";
          ctx.fillText(cardData.txWin, sideMargin + txLabelWidth, statsY);
          
          const winWidth = ctx.measureText(cardData.txWin).width;
          ctx.fillStyle = "rgba(255,255,255,0.5)";
          ctx.fillText("/", sideMargin + txLabelWidth + winWidth, statsY);
          
          const slashWidth = ctx.measureText("/").width;
          ctx.fillStyle = "rgb(242,102,130)";
          ctx.fillText(cardData.txLoss, sideMargin + txLabelWidth + winWidth + slashWidth, statsY);
        } else {
          // Version 2: Profit, Loss, Profit Days
          const labelWidth = 120 * scale;
          const rowGap = 28 * scale;
          
          // Profit row
          ctx.fillStyle = "rgba(255,255,255,0.5)";
          ctx.fillText("Profit", sideMargin, statsY);
          ctx.fillStyle = "rgb(134,217,159)";
          ctx.fillText(cardData.profitAmount || "+$2,730.46", sideMargin + labelWidth, statsY);
          
          // Loss row
          ctx.fillStyle = "rgba(255,255,255,0.5)";
          ctx.fillText("Loss", sideMargin, statsY + rowGap);
          ctx.fillStyle = "rgb(242,102,130)";
          ctx.fillText(cardData.lossAmount || "-$214.15", sideMargin + labelWidth, statsY + rowGap);
          
          // Profit Days row
          ctx.fillStyle = "rgba(255,255,255,0.5)";
          ctx.fillText("Profit Days", sideMargin, statsY + rowGap * 2);
          ctx.fillStyle = "rgb(134,217,159)";
          const profitDaysWin = cardData.profitDaysWin || "2";
          ctx.fillText(profitDaysWin, sideMargin + labelWidth, statsY + rowGap * 2);
          const pdWinWidth = ctx.measureText(profitDaysWin).width;
          ctx.fillStyle = "rgba(255,255,255,0.5)";
          ctx.fillText("/", sideMargin + labelWidth + pdWinWidth, statsY + rowGap * 2);
          const pdSlashWidth = ctx.measureText("/").width;
          ctx.fillStyle = "rgb(242,102,130)";
          ctx.fillText(cardData.profitDaysLoss || "1", sideMargin + labelWidth + pdWinWidth + pdSlashWidth, statsY + rowGap * 2);
        }

        // Header icons and text (simplified - text only)
        ctx.fillStyle = "#ffffff";
        ctx.font = `normal ${16 * scale}px Geist, -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.textBaseline = "middle";
        const headerTextY = headerY + 18 * scale;
        
        // Twitter handle (right side)
        const twitterText = cardData.twitterHandle;
        const websiteText = cardData.websiteUrl;
        const websiteWidth = ctx.measureText(websiteText).width;
        const twitterWidth = ctx.measureText(twitterText).width;
        const gap = 60 * scale;
        
        ctx.fillText(websiteText, 1280 - sideMargin - websiteWidth, headerTextY);
        ctx.fillText(twitterText, 1280 - sideMargin - websiteWidth - gap - twitterWidth, headerTextY);

        // Footer - User profile and invite code
        const footerRight = 1280 - sideMargin;
        const footerBottom = 720 - 28 * scale;

        // Invite code
        ctx.font = `normal ${14 * scale}px Geist, -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.textBaseline = "bottom";
        const inviteCodeWidth = ctx.measureText(cardData.inviteCode).width;
        ctx.fillStyle = "#ffffff";
        ctx.fillText(cardData.inviteCode, footerRight - inviteCodeWidth, footerBottom);
        
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        const inviteLabelWidth = ctx.measureText("Invite Code").width;
        ctx.fillText("Invite Code", footerRight - inviteCodeWidth - 16 * scale - inviteLabelWidth, footerBottom);

        // User profile pill
        if (cardData.showUserProfile) {
          const pillY = footerBottom - 14 * scale - 18 * scale - 36 * scale;
          const pillH = 36 * scale;
          const pillPadLeft = 10 * scale;
          const pillPadRight = 20 * scale;
          const avatarSize = 24 * scale;
          
          ctx.font = `600 ${16 * scale}px Geist, -apple-system, BlinkMacSystemFont, sans-serif`;
          const usernameWidth = ctx.measureText(cardData.username).width;
          ctx.font = `500 ${14 * scale}px Geist, -apple-system, BlinkMacSystemFont, sans-serif`;
          const followersWidth = ctx.measureText(cardData.followers).width;
          
          const pillContentWidth = avatarSize + 8 * scale + usernameWidth + 12 * scale + 1 * scale + 8 * scale + 14 * scale + 4 * scale + followersWidth;
          const pillW = pillPadLeft + pillContentWidth + pillPadRight;
          const pillX = footerRight - pillW;

          // Pill background
          ctx.fillStyle = "#000000";
          ctx.beginPath();
          ctx.roundRect(pillX, pillY, pillW, pillH, pillH / 2);
          ctx.fill();

          // Avatar
          if (avatarImg) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(pillX + pillPadLeft + avatarSize / 2, pillY + pillH / 2, avatarSize / 2, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(avatarImg, pillX + pillPadLeft, pillY + (pillH - avatarSize) / 2, avatarSize, avatarSize);
            ctx.restore();
          }

          // Username
          ctx.fillStyle = "#ffffff";
          ctx.font = `600 ${16 * scale}px Geist, -apple-system, BlinkMacSystemFont, sans-serif`;
          ctx.textBaseline = "middle";
          ctx.fillText(cardData.username, pillX + pillPadLeft + avatarSize + 8 * scale, pillY + pillH / 2);

          // Divider
          const divX = pillX + pillPadLeft + avatarSize + 8 * scale + usernameWidth + 12 * scale;
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(divX, pillY + (pillH - 16 * scale) / 2, 1 * scale, 16 * scale);

          // Followers
          ctx.font = `500 ${14 * scale}px Geist, -apple-system, BlinkMacSystemFont, sans-serif`;
          ctx.fillText(cardData.followers, divX + 1 * scale + 8 * scale + 14 * scale + 4 * scale, pillY + pillH / 2);
        }
      };

      // Setup MediaRecorder with canvas stream at selected FPS
      const canvasStream = canvas.captureStream(exportFps);
      const combinedStream = new MediaStream();
      canvasStream.getVideoTracks().forEach((t) => combinedStream.addTrack(t));

      // Audio capture (best effort)
      let audioAdded = false;
      try {
        const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
        const audioCtx = new AudioCtx();
        await audioCtx.resume();
        const source = audioCtx.createMediaElementSource(exportVideo);
        const dest = audioCtx.createMediaStreamDestination();
        source.connect(dest);
        source.connect(audioCtx.destination); // Also play through speakers if needed
        dest.stream.getAudioTracks().forEach((t) => {
          combinedStream.addTrack(t);
          audioAdded = true;
        });
      } catch (e) {
        console.warn("WebAudio capture failed:", e);
      }

      if (!audioAdded) {
        const exportVideoStream: MediaStream | undefined =
          (exportVideo as any).captureStream?.() || (exportVideo as any).mozCaptureStream?.();
        exportVideoStream?.getAudioTracks().forEach((t: MediaStreamTrack) => {
          combinedStream.addTrack(t);
          audioAdded = true;
        });
      }

      if (!audioAdded) toast.warning("Audio capture failed (browser limitation)");

      const mimeType = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]
        .find((t) => MediaRecorder.isTypeSupported(t)) || "video/webm";

      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 12_000_000, // 12 Mbps for quality
      });

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      let stopTimer = 0;
      let drawIntervalId: number = 0;

      const cleanupAll = () => {
        clearInterval(drawIntervalId);
        clearTimeout(stopTimer);
        cleanupExportVideo();
        setRecordProgress(null);
        setIsRecording(false);
      };

      const finalize = () => {
        const webmBlob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(webmBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `gmgn-card-${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Video downloaded!");
        cleanupAll();
      };

      mediaRecorder.onstop = finalize;

      const onEnded = () => {
        if (mediaRecorder.state !== "inactive") mediaRecorder.stop();
      };

      exportVideo.currentTime = 0;
      exportVideo.addEventListener("ended", onEnded);

      // Safety timeout
      stopTimer = window.setTimeout(() => {
        if (mediaRecorder.state !== "inactive") mediaRecorder.stop();
      }, Math.ceil(exportVideo.duration * 1000) + 500);

      toast.info("Recording in real-time... please wait");

      mediaRecorder.start();
      await exportVideo.play();

      // FIXED FPS using setInterval (NOT requestAnimationFrame)
      const frameTime = 1000 / exportFps;
      
      drawIntervalId = window.setInterval(() => {
        if (exportVideo.ended || exportVideo.paused) {
          clearInterval(drawIntervalId);
          return;
        }
        
        drawFrame();
        
        if (Number.isFinite(exportVideo.duration) && exportVideo.duration > 0) {
          setRecordProgress(Math.min(1, exportVideo.currentTime / exportVideo.duration));
        }
      }, frameTime);

    } catch (error) {
      console.error("Error exporting video:", error);
      toast.error("Failed to export video");
      setIsRecording(false);
    }
  }, [cardData, exportFps, cardVersion]);

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
              <GmgnCard ref={cardRef} data={cardData} version={cardVersion} />
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

          <div className="w-full xl:w-[380px] bg-[hsl(var(--gmgn-card-100))] rounded-xl p-6 border border-[hsl(var(--gmgn-line-100))] space-y-4 flex-shrink-0">
            <h2 className="text-lg font-semibold text-[hsl(var(--gmgn-text-100))] mb-4">Edit Data</h2>

            {/* Version Switcher */}
            <div className="space-y-2">
              <Label className="text-[hsl(var(--gmgn-text-200))]">Card Version</Label>
              <div className="flex gap-2">
                <button
                  onClick={() => setCardVersion(1)}
                  className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                    cardVersion === 1
                      ? "bg-[hsl(var(--gmgn-accent-100))] text-black"
                      : "bg-[hsl(var(--gmgn-bg-200))] text-[hsl(var(--gmgn-text-200))] hover:bg-[hsl(var(--gmgn-hover-100))]"
                  }`}
                >
                  V1: Date Range
                </button>
                <button
                  onClick={() => setCardVersion(2)}
                  className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                    cardVersion === 2
                      ? "bg-[hsl(var(--gmgn-accent-100))] text-black"
                      : "bg-[hsl(var(--gmgn-bg-200))] text-[hsl(var(--gmgn-text-200))] hover:bg-[hsl(var(--gmgn-hover-100))]"
                  }`}
                >
                  V2: Monthly
                </button>
              </div>
            </div>

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

            {cardVersion === 1 ? (
              <>
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
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="month" className="text-[hsl(var(--gmgn-text-200))]">Month</Label>
                  <Input
                    id="month"
                    value={cardData.month}
                    onChange={(e) => handleChange("month", e.target.value)}
                    placeholder="January 2026"
                    className="bg-[hsl(var(--gmgn-bg-200))] border-[hsl(var(--gmgn-line-100))] text-[hsl(var(--gmgn-text-100))]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="winStreak" className="text-[hsl(var(--gmgn-text-200))]">Win Streak (Days)</Label>
                  <Input
                    id="winStreak"
                    value={cardData.winStreak}
                    onChange={(e) => handleChange("winStreak", e.target.value)}
                    placeholder="2"
                    className="bg-[hsl(var(--gmgn-bg-200))] border-[hsl(var(--gmgn-line-100))] text-[hsl(var(--gmgn-text-100))]"
                  />
                </div>
              </>
            )}

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

            {cardVersion === 1 ? (
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
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="profitAmount" className="text-[hsl(var(--gmgn-text-200))]">Profit</Label>
                    <Input
                      id="profitAmount"
                      value={cardData.profitAmount}
                      onChange={(e) => handleChange("profitAmount", e.target.value)}
                      placeholder="+$2,730.46"
                      className="bg-[hsl(var(--gmgn-bg-200))] border-[hsl(var(--gmgn-line-100))] text-[hsl(var(--gmgn-text-100))]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lossAmount" className="text-[hsl(var(--gmgn-text-200))]">Loss</Label>
                    <Input
                      id="lossAmount"
                      value={cardData.lossAmount}
                      onChange={(e) => handleChange("lossAmount", e.target.value)}
                      placeholder="-$214.15"
                      className="bg-[hsl(var(--gmgn-bg-200))] border-[hsl(var(--gmgn-line-100))] text-[hsl(var(--gmgn-text-100))]"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="profitDaysWin" className="text-[hsl(var(--gmgn-text-200))]">Profit Days (Win)</Label>
                    <Input
                      id="profitDaysWin"
                      value={cardData.profitDaysWin}
                      onChange={(e) => handleChange("profitDaysWin", e.target.value)}
                      placeholder="2"
                      className="bg-[hsl(var(--gmgn-bg-200))] border-[hsl(var(--gmgn-line-100))] text-[hsl(var(--gmgn-text-100))]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profitDaysLoss" className="text-[hsl(var(--gmgn-text-200))]">Profit Days (Loss)</Label>
                    <Input
                      id="profitDaysLoss"
                      value={cardData.profitDaysLoss}
                      onChange={(e) => handleChange("profitDaysLoss", e.target.value)}
                      placeholder="1"
                      className="bg-[hsl(var(--gmgn-bg-200))] border-[hsl(var(--gmgn-line-100))] text-[hsl(var(--gmgn-text-100))]"
                    />
                  </div>
                </div>
              </>
            )}

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
              <>
                <div className="space-y-2">
                  <Label className="text-[hsl(var(--gmgn-text-200))]">Export FPS (for testing)</Label>
                  <div className="flex gap-2 flex-wrap">
                    {[30, 40, 45, 50, 60].map((fps) => (
                      <button
                        key={fps}
                        onClick={() => setExportFps(fps)}
                        className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                          exportFps === fps
                            ? "bg-[hsl(var(--gmgn-accent-100))] text-black"
                            : "bg-[hsl(var(--gmgn-bg-200))] text-[hsl(var(--gmgn-text-200))] hover:bg-[hsl(var(--gmgn-hover-100))]"
                        }`}
                      >
                        {fps} FPS
                      </button>
                    ))}
                  </div>
                </div>
                <div className="text-xs text-[rgb(134,217,159)] bg-[hsl(148_55%_69%/0.1)] px-3 py-2 rounded-lg">
                  Export at {exportFps} FPS (30 FPS most stable)
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
};

export default Index;
