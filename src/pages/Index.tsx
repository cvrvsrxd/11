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

      // Preload SVG icons as images
      const loadSvgAsImage = (svgString: string): Promise<HTMLImageElement | null> => {
        return new Promise((resolve) => {
          const svg = new Blob([svgString], { type: "image/svg+xml" });
          const url = URL.createObjectURL(svg);
          const img = new Image();
          img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
          };
          img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(null);
          };
          img.src = url;
        });
      };

      // GMGN Logo SVG
      const gmgnLogoSvg = `<svg viewBox="0 0 265 72" fill="none" xmlns="http://www.w3.org/2000/svg" width="265" height="72">
        <g clip-path="url(#clip0_gmgn)">
          <path d="M31.5 22.5H27V13.5H22.5V9H31.5V22.5ZM54 13.5H49.5V9H58.5V22.5H54V13.5Z" fill="white"/>
          <path d="M13.5 27H22.5V31.5H9V27H4.5V22.5H13.5V27Z" fill="#D5F86B"/>
          <path d="M31.5 9H22.5V4.5H31.5V9Z" fill="#D5F86B"/>
          <path d="M58.5 9H49.5V4.5H58.5V9Z" fill="#D5F86B"/>
          <path d="M27 36V40.5H13.5V36H27ZM27 22.5H22.5V13.5H27V22.5ZM54 22.5H49.5V13.5H54V22.5Z" fill="black"/>
          <path d="M40.5 49.5H36V54H40.5V49.5Z" fill="#DFC855"/>
          <path d="M45 49.5H40.5V54H45V49.5Z" fill="#DFC855"/>
          <path d="M36 54H31.5V58.5H36V54Z" fill="#DFC855"/>
          <path d="M40.5 54H36V58.5H40.5V54Z" fill="#DFC855"/>
          <path d="M45 54H40.5V58.5H45V54Z" fill="#DFC855"/>
          <path d="M49.5 54H45V58.5H49.5V54Z" fill="#DFC855"/>
          <path d="M36 58.5H31.5V63H36V58.5Z" fill="#DFC855"/>
          <path d="M40.5 58.5H36V63H40.5V58.5Z" fill="#DFC855"/>
          <path d="M45 58.5H40.5V63H45V58.5Z" fill="#DFC855"/>
          <path d="M49.5 58.5H45V63H49.5V58.5Z" fill="#DFC855"/>
          <path d="M63 58.5H58.5V63H63V58.5Z" fill="#457F2C"/>
          <path d="M31.5 63H27V67.5H31.5V63Z" fill="#A3E050"/>
          <path d="M36 63H31.5V67.5H36V63Z" fill="#DFC855"/>
          <path d="M40.5 63H36V67.5H40.5V63Z" fill="#DFC855"/>
          <path d="M45 63H40.5V67.5H45V63Z" fill="#DFC855"/>
          <path d="M49.5 63H45V67.5H49.5V63Z" fill="#DFC855"/>
          <path d="M31.5 67.5H27V72H31.5V67.5Z" fill="#A3E050"/>
          <path d="M36 67.5H31.5V72H36V67.5Z" fill="#DFC855"/>
          <path d="M40.5 67.5H36V72H40.5V67.5Z" fill="#DFC855"/>
          <path d="M45 67.5H40.5V72H45V67.5Z" fill="#DFC855"/>
          <path d="M49.5 67.5H45V72H49.5V67.5Z" fill="#DFC855"/>
          <path d="M54 63H58.5V72H49.5V54H54V63Z" fill="#A3E050"/>
          <path d="M49.5 54H45V49.5H49.5V54Z" fill="#A3E050"/>
          <path d="M36 18H45V22.5H67.5V27H63V36H58.5V40.5H54V45H45V49.5H36V45H31.5V40.5H27V36H4.5V27H9V31.5H22.5V22.5H31.5V4.5H36V18Z" fill="#A3E050"/>
          <path d="M63 9H58.5V4.5H63V9Z" fill="#A3E050"/>
          <path d="M31.5 4.5H22.5V0H31.5V4.5Z" fill="#A3E050"/>
          <path d="M58.5 4.5H49.5V0H58.5V4.5Z" fill="#A3E050"/>
          <path d="M27 72H22.5V63H27V72Z" fill="#5DA040"/>
          <path d="M58.5 63H63V72H58.5V63Z" fill="#5DA040"/>
          <path d="M31.5 63H27V54H31.5V63Z" fill="#5DA040"/>
          <path d="M58.5 63H54V54H58.5V63Z" fill="#5DA040"/>
          <path d="M31.5 45H36V54H31.5V49.5H27V45H18V40.5H31.5V45Z" fill="#5DA040"/>
          <path d="M67.5 40.5H63V45H58.5V49.5H54V54H49.5V49.5H45V45H54V40.5H58.5V36H63V27H67.5V40.5Z" fill="#5DA040"/>
          <path d="M13.5 40.5H4.5V36H13.5V40.5Z" fill="#5DA040"/>
          <path d="M22.5 27H18V22.5H22.5V27Z" fill="#5DA040"/>
          <path d="M49.5 22.5H45V18H49.5V22.5Z" fill="#5DA040"/>
          <path d="M63 22.5H58.5V9H63V22.5Z" fill="#5DA040"/>
          <path d="M22.5 72H18V63H22.5V72Z" fill="#457F2C"/>
          <path d="M63 63H67.5V72H63V63Z" fill="#457F2C"/>
          <path d="M27 63H22.5V54H27V63Z" fill="#457F2C"/>
          <path d="M63 58.5H58.5V54H63V58.5Z" fill="#457F2C"/>
          <path d="M31.5 54H27V49.5H31.5V54Z" fill="#457F2C"/>
          <path d="M58.5 54H54V49.5H58.5V54Z" fill="#457F2C"/>
          <path d="M27 49.5H18V45H27V49.5Z" fill="#457F2C"/>
          <path d="M63 49.5H58.5V45H63V49.5Z" fill="#457F2C"/>
          <path d="M18 45H4.5V40.5H18V45Z" fill="#457F2C"/>
          <path d="M67.5 45H63V40.5H67.5V45Z" fill="#457F2C"/>
          <path d="M4.5 40.5H0V22.5H4.5V40.5Z" fill="#457F2C"/>
          <path d="M72 40.5H67.5V22.5H72V40.5Z" fill="#457F2C"/>
          <path d="M18 27H13.5V22.5H18V27Z" fill="#457F2C"/>
          <path d="M13.5 22.5H4.5V18H13.5V22.5Z" fill="#457F2C"/>
          <path d="M22.5 22.5H18V4.5H22.5V22.5Z" fill="#457F2C"/>
          <path d="M67.5 22.5H63V4.5H67.5V22.5Z" fill="#457F2C"/>
          <path d="M40.5 13.5H45V4.5H49.5V18H36V4.5H40.5V13.5Z" fill="#457F2C"/>
          <path d="M36 4.5H31.5V0H36V4.5Z" fill="#457F2C"/>
          <path d="M63 4.5H58.5V0H63V4.5Z" fill="#457F2C"/>
        </g>
        <path d="M225 54.9805V15.6055H236.25V21.2305H241.875V26.8555H247.5V32.4805H253.125V15.6055H264.375V54.9805H253.125V43.7305H247.5V38.1055H241.875V32.4805H236.25V54.9805H225Z" fill="white"/>
        <path d="M191.25 54.9805V49.3555H185.625V43.7305H180V26.8555H185.625V21.2305H191.25V15.6055H219.375V21.2305H196.875V26.8555H191.25V43.7305H196.875V49.3555H208.125V38.1055H202.5V32.4805H219.375V54.9805H191.25Z" fill="white"/>
        <path d="M135 54.9805V15.6055H146.25V21.2305H151.875V26.8555H157.5V21.2305H163.125V15.6055H174.375V54.9805H163.125V32.4805H157.5V43.7305H151.875V32.4805H146.25V54.9805H135Z" fill="white"/>
        <path d="M101.25 54.9805V49.3555H95.625V43.7305H90V26.8555H95.625V21.2305H101.25V15.6055H129.375V21.2305H106.875V26.8555H101.25V43.7305H106.875V49.3555H118.125V38.1055H112.5V32.4805H129.375V54.9805H101.25Z" fill="white"/>
        <defs>
          <clipPath id="clip0_gmgn">
            <rect width="72" height="72" fill="white"/>
          </clipPath>
        </defs>
      </svg>`;

      // X (Twitter) Icon SVG
      const xIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" fill="white" width="32" height="32">
        <path d="M8.9695 2h1.357L7.3619 5.3884l3.4877 4.6108H8.1188L5.9799 7.2028 3.5326 9.9992H2.1748l3.171-3.6243L2 2h2.8001l1.9334 2.556zm-.4762 7.187h.752L4.3914 2.7695h-.8068z"/>
      </svg>`;

      // Globe Icon SVG
      const globeIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" fill="white" width="32" height="32">
        <path d="M1.2805 5.4972h2.2257c.0871-1.7077.6106-3.102 1.2575-4.0795-1.865.5015-3.2758 2.1111-3.4832 4.0795M6.02 1.4314c-.6827.7522-1.398 2.1522-1.5066 4.0658h3.063c-.1038-2.021-.826-3.352-1.5564-4.0658m1.555 5.0715H4.517c.0602.8633.27 1.707.5648 2.4398.2683.6668.5967 1.2165.9246 1.6007.7603-.814 1.4615-2.1564 1.5686-4.0405m-2.7784 4.0882c-.2429-.3799-.4623-.8115-.648-1.273-.338-.8403-.578-1.8126-.6396-2.8152H1.2805c.2086 1.98 1.6349 3.5969 3.516 4.0882m2.4763-.0193c1.8457-.5132 3.2385-2.1141 3.4445-4.0689h-2.135c-.0876 1.718-.619 3.0805-1.3094 4.0689m3.4445-5.0746C10.514 3.5666 9.1529 1.981 7.3411 1.4478c.6597.9513 1.161 2.305 1.2422 4.0494zM.2484 6C.2484 2.8242 2.823.2496 5.999.2496s5.7506 2.5746 5.7506 5.7505c0 3.176-2.5746 5.7506-5.7505 5.7506C2.823 11.7506.2483 9.176.2483 6"/>
      </svg>`;

      const [gmgnLogoImg, xIconImg, globeIconImg] = await Promise.all([
        loadSvgAsImage(gmgnLogoSvg),
        loadSvgAsImage(xIconSvg),
        loadSvgAsImage(globeIconSvg),
      ]);

      // Create canvas - all rendering happens here
      const canvas = document.createElement("canvas");
      canvas.width = 1280;
      canvas.height = 720;
      const ctx = canvas.getContext("2d", { alpha: false })!;
      if (!ctx) throw new Error("Could not get canvas context");

      // Scale: 1280x720 output from 1642x932 design base
      const internalScale = 1280 / 1642;
      const s = (px: number) => px * internalScale;

      // Draw function - renders everything directly on canvas
      const drawFrame = () => {
        // Clear canvas each frame
        ctx.clearRect(0, 0, 1280, 720);
        
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

        // Header: height=152px, px=68px
        const headerHeight = s(152);
        const sideMargin = s(68);
        
        // GMGN Logo (left side of header)
        if (gmgnLogoImg) {
          const logoHeight = s(72);
          const logoWidth = (265 / 72) * logoHeight; // maintain aspect ratio
          const logoY = (headerHeight - logoHeight) / 2;
          ctx.drawImage(gmgnLogoImg, sideMargin, logoY, logoWidth, logoHeight);
        }

        // Header icons and text (right side)
        ctx.fillStyle = "#ffffff";
        ctx.font = `normal ${s(32)}px Geist, -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.textBaseline = "middle";
        const headerTextY = headerHeight / 2;
        const iconSize = s(40);

        // Layout from right: website text, globe icon, gap, twitter text, x icon
        const websiteText = cardData.websiteUrl;
        const twitterText = cardData.twitterHandle;
        const websiteWidth = ctx.measureText(websiteText).width;
        const twitterWidth = ctx.measureText(twitterText).width;
        const iconTextGap = s(8);
        const groupGap = s(60);

        // Draw website (rightmost)
        const websiteTextX = 1280 - sideMargin - websiteWidth;
        ctx.fillText(websiteText, websiteTextX, headerTextY);
        
        // Draw globe icon
        if (globeIconImg) {
          ctx.drawImage(globeIconImg, websiteTextX - iconTextGap - iconSize, headerTextY - iconSize / 2, iconSize, iconSize);
        }
        
        // Draw twitter text
        const twitterTextX = websiteTextX - iconTextGap - iconSize - groupGap - twitterWidth;
        ctx.fillText(twitterText, twitterTextX, headerTextY);
        
        // Draw X icon
        if (xIconImg) {
          ctx.drawImage(xIconImg, twitterTextX - iconTextGap - iconSize, headerTextY - iconSize / 2, iconSize, iconSize);
        }

        // Header divider (at bottom of header area)
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.fillRect(sideMargin, headerHeight, 1280 - sideMargin * 2, s(1));

        // Main content: pt=212 from top (which is 60 below header)
        const contentY = s(212);
        ctx.fillStyle = "#ffffff";
        ctx.font = `bold ${s(56)}px Geist, -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.textBaseline = "top";
        const contentLeft = s(64);
        
        if (cardVersion === 1) {
          // Version 1: Date Range + Profit Type
          ctx.fillText(cardData.dateRange, contentLeft, contentY);
          ctx.fillText(cardData.profitType, contentLeft, contentY + s(56 + 16));
        } else {
          // Version 2: Month + Win Streak
          ctx.fillText(cardData.month || "January 2026", contentLeft, contentY);
          const streakY = contentY + s(56 + 8);
          ctx.fillStyle = "rgb(134,217,159)";
          const streakDays = `${cardData.winStreak || "2"}Days`;
          ctx.fillText(streakDays, contentLeft, streakY);
          const streakDaysWidth = ctx.measureText(streakDays).width;
          ctx.fillStyle = "#ffffff";
          ctx.fillText(" Win Streak", contentLeft + streakDaysWidth, streakY);
        }

        // PNL Block: height=120, min-width=500, px=20
        const isNegative = cardData.pnlValue.startsWith("-");
        const pnlBgColor = isNegative ? "rgb(242,102,130)" : "rgb(134,217,159)";
        const pnlY =
          cardVersion === 1
            ? contentY + s(56 + 16 + 56 + 40) // dateRange mb=16, profitType mb=40
            : contentY + s(56 + 8 + 56 + 48); // month mb=8, winStreak mb=48
        const pnlH = s(120);
        const pnlFontSize = s(94);
        const pnlPx = s(20);
        const pnlMinW = s(500);

        ctx.font = `bold ${pnlFontSize}px Geist, -apple-system, BlinkMacSystemFont, sans-serif`;
        const textMetrics = ctx.measureText(cardData.pnlValue);
        const pnlW = Math.max(pnlMinW, textMetrics.width + pnlPx * 2);

        // Match DOM preview vertical centering (SVG uses y=50% + dy=0.35em)
        const pnlCenterY = pnlY + pnlH / 2;
        const hasBBox =
          Number.isFinite(textMetrics.actualBoundingBoxAscent) &&
          Number.isFinite(textMetrics.actualBoundingBoxDescent) &&
          textMetrics.actualBoundingBoxAscent > 0;
        const pnlTextY = hasBBox
          ? pnlCenterY + (textMetrics.actualBoundingBoxAscent - textMetrics.actualBoundingBoxDescent) / 2
          : pnlCenterY + pnlFontSize * 0.35;

        if (cardData.transparentPnlText) {
          ctx.fillStyle = pnlBgColor;
          ctx.fillRect(contentLeft, pnlY, pnlW, pnlH);
          ctx.globalCompositeOperation = "destination-out";
          ctx.fillStyle = "#000";
          ctx.textBaseline = "alphabetic";
          ctx.fillText(cardData.pnlValue, contentLeft + pnlPx, pnlTextY);
          ctx.globalCompositeOperation = "source-over";
        } else {
          ctx.fillStyle = pnlBgColor;
          ctx.fillRect(contentLeft, pnlY, pnlW, pnlH);
          ctx.fillStyle = "#000000";
          ctx.textBaseline = "alphabetic";
          ctx.fillText(cardData.pnlValue, contentLeft + pnlPx, pnlTextY);
        }


        // Stats below PNL
        ctx.textBaseline = "top";
        const statsY = pnlY + pnlH + s(40);
        ctx.font = `bold ${s(42)}px Geist, -apple-system, BlinkMacSystemFont, sans-serif`;

        if (cardVersion === 1) {
          // Version 1: TXs
          ctx.fillStyle = "rgba(255,255,255,0.5)";
          ctx.fillText("TXs", contentLeft, statsY);
          
          const txLabelWidth = s(120) + s(12);
          ctx.fillStyle = "rgb(134,217,159)";
          ctx.fillText(cardData.txWin, contentLeft + txLabelWidth, statsY);
          
          const winWidth = ctx.measureText(cardData.txWin).width;
          ctx.fillStyle = "rgba(255,255,255,0.5)";
          ctx.fillText("/", contentLeft + txLabelWidth + winWidth, statsY);
          
          const slashWidth = ctx.measureText("/").width;
          ctx.fillStyle = "rgb(242,102,130)";
          ctx.fillText(cardData.txLoss, contentLeft + txLabelWidth + winWidth + slashWidth, statsY);
        } else {
          // Version 2: Profit, Loss, Profit Days
          const labelWidth = s(240);
          const rowGap = s(24 + 56);
          
          // Profit row
          ctx.fillStyle = "rgba(255,255,255,0.5)";
          ctx.fillText("Profit", contentLeft, statsY);
          ctx.fillStyle = "rgb(134,217,159)";
          ctx.fillText("+" + (cardData.profitAmount || "$2,730.46"), contentLeft + labelWidth, statsY);
          
          // Loss row
          ctx.fillStyle = "rgba(255,255,255,0.5)";
          ctx.fillText("Loss", contentLeft, statsY + rowGap);
          ctx.fillStyle = "rgb(242,102,130)";
          ctx.fillText("-" + (cardData.lossAmount || "$214.15"), contentLeft + labelWidth, statsY + rowGap);
          
          // Profit Days row
          ctx.fillStyle = "rgba(255,255,255,0.5)";
          ctx.fillText("Profit Days", contentLeft, statsY + rowGap * 2);
          ctx.fillStyle = "rgb(134,217,159)";
          const profitDaysWin = cardData.profitDaysWin || "2";
          ctx.fillText(profitDaysWin, contentLeft + labelWidth, statsY + rowGap * 2);
          const pdWinWidth = ctx.measureText(profitDaysWin).width;
          ctx.fillStyle = "rgba(255,255,255,0.5)";
          ctx.fillText("/", contentLeft + labelWidth + pdWinWidth, statsY + rowGap * 2);
          const pdSlashWidth = ctx.measureText("/").width;
          ctx.fillStyle = "rgb(242,102,130)";
          ctx.fillText(cardData.profitDaysLoss || "1", contentLeft + labelWidth + pdWinWidth + pdSlashWidth, statsY + rowGap * 2);
        }

        // Footer - bottom=28px, px=68px
        const footerRight = 1280 - sideMargin;
        const footerBottom = 720 - s(28);

        // Invite code
        ctx.font = `normal ${s(28)}px Geist, -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.textBaseline = "bottom";
        const inviteCodeWidth = ctx.measureText(cardData.inviteCode).width;
        ctx.fillStyle = "#ffffff";
        ctx.fillText(cardData.inviteCode, footerRight - inviteCodeWidth, footerBottom);
        
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        const inviteLabelWidth = ctx.measureText("Invite Code").width;
        ctx.fillText("Invite Code", footerRight - inviteCodeWidth - s(16) - inviteLabelWidth, footerBottom);

        // User profile pill
        if (cardData.showUserProfile) {
          const pillH = s(64);
          const pillY = footerBottom - s(18) - pillH - s(28); // gap + height + text line height
          const pillPadLeft = s(10);
          const pillPadRight = s(20);
          const avatarSize = s(48);
          
          ctx.font = `600 ${s(36)}px Geist, -apple-system, BlinkMacSystemFont, sans-serif`;
          const usernameWidth = ctx.measureText(cardData.username).width;
           ctx.font = `500 ${s(36)}px Geist, -apple-system, BlinkMacSystemFont, sans-serif`;
           const followersWidth = ctx.measureText(cardData.followers).width;
           const xSmallSize = s(32);
           
           const pillContentWidth = avatarSize + s(12) + usernameWidth + s(12) + s(3) + s(8) + xSmallSize + s(4) + followersWidth;
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
           ctx.font = `600 ${s(36)}px Geist, -apple-system, BlinkMacSystemFont, sans-serif`;
           ctx.textBaseline = "middle";
           ctx.fillText(cardData.username, pillX + pillPadLeft + avatarSize + s(12), pillY + pillH / 2);

           // Divider
           const divX = pillX + pillPadLeft + avatarSize + s(12) + usernameWidth + s(12);
           ctx.fillStyle = "#ffffff";
           ctx.fillRect(divX, pillY + (pillH - s(32)) / 2, s(3), s(32));

           // X icon (followers)
           const xSmallX = divX + s(3) + s(8);
           if (xIconImg) {
             ctx.drawImage(xIconImg, xSmallX, pillY + (pillH - xSmallSize) / 2, xSmallSize, xSmallSize);
           }

           // Followers
           ctx.font = `500 ${s(36)}px Geist, -apple-system, BlinkMacSystemFont, sans-serif`;
           ctx.fillText(cardData.followers, xSmallX + xSmallSize + s(4), pillY + pillH / 2);
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
