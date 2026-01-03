import { forwardRef } from "react";
import GmgnLogo from "./GmgnLogo";
import XIcon from "./XIcon";
import GlobeIcon from "./GlobeIcon";

interface GmgnCardData {
  dateRange: string;
  profitType: string;
  pnlValue: string;
  txWin: string;
  txLoss: string;
  username: string;
  avatarUrl: string;
  followers: string;
  inviteCode: string;
  backgroundUrl: string;
  backgroundType: "image" | "video";
  twitterHandle: string;
  websiteUrl: string;
  showUserProfile: boolean;
  showGradientOverlay: boolean;
  transparentPnlText: boolean;
  // Version 2 fields
  month?: string;
  winStreak?: string;
  profitAmount?: string;
  lossAmount?: string;
  profitDaysWin?: string;
  profitDaysLoss?: string;
}

interface GmgnCardProps {
  data: GmgnCardData;
  scale?: number;
  version?: 1 | 2;
}

interface GmgnCardProps {
  data: GmgnCardData;
  scale?: number;
}

const GmgnCard = forwardRef<HTMLDivElement, GmgnCardProps>(({ data, scale = 1, version = 1 }, ref) => {
  const isNegative = data.pnlValue.startsWith("-");
  const pnlBgColor = isNegative ? "rgb(242,102,130)" : "rgb(134,217,159)";

  // Internal scale: We work in 1642x932 "design" coordinates, then apply internalScale
  // to render at 750x420 base, then multiply by external scale prop
  const internalScale = 0.45676;
  const totalScale = internalScale * scale;

  // Design dimensions (before scaling)
  const designWidth = 1642;
  const designHeight = 932;

  // Scaled dimensions for display
  const displayWidth = designWidth * totalScale;
  const displayHeight = designHeight * totalScale;

  // Helper to scale design pixels
  const s = (px: number) => px * totalScale;

  return (
    <div
      ref={ref}
      className="relative overflow-hidden border border-[hsl(var(--gmgn-line-200))]"
      style={{
        width: `${displayWidth}px`,
        height: `${displayHeight}px`,
        borderRadius: `${s(16 / internalScale)}px`,
      }}
    >
      {/* Base fallback background (excluded from export overlay) */}
      <div id="export-fallback-bg" className="absolute inset-0 bg-black" data-export-ignore="true" />

      {/* Background Media */}
      {data.backgroundType === "video" ? (
        <video
          src={data.backgroundUrl}
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          id="bg-video"
        />
      ) : data.backgroundUrl ? (
        <img
          src={data.backgroundUrl}
          alt="PnL card background"
          crossOrigin="anonymous"
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />
      ) : null}

      {/* Dark overlay for left side - conditionally shown */}
      {data.showGradientOverlay && (
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to right, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.75) 45%, transparent 75%)'
          }}
        />
      )}

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col text-[hsl(var(--gmgn-text-100))] font-bold" style={{ fontFamily: '"Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        {/* Header - height: 152px, px: 68px */}
        <div 
          className="flex justify-between items-center"
          style={{ 
            height: `${s(152)}px`,
            paddingLeft: `${s(68)}px`,
            paddingRight: `${s(68)}px`,
          }}
        >
          <GmgnLogo style={{ height: `${s(72)}px`, width: 'auto' }} />

          <div className="flex items-center" style={{ gap: `${s(60)}px` }}>
            <div className="flex items-center" style={{ gap: `${s(8)}px` }}>
              <XIcon style={{ width: `${s(40)}px`, height: `${s(40)}px` }} />
              <span className="font-normal" style={{ fontSize: `${s(32)}px` }}>{data.twitterHandle}</span>
            </div>
            <div className="flex items-center" style={{ gap: `${s(8)}px` }}>
              <GlobeIcon style={{ width: `${s(40)}px`, height: `${s(40)}px` }} />
              <span className="font-normal" style={{ fontSize: `${s(32)}px` }}>{data.websiteUrl}</span>
            </div>
          </div>
        </div>

        {/* Divider - height: 0.5px, inside header px */}
        <div
          className="bg-[hsl(var(--gmgn-text-100)/0.5)]"
          style={{
            height: `${s(1)}px`,
            marginLeft: `${s(68)}px`,
            marginRight: `${s(68)}px`,
          }}
        />

        {/* Main Content - pl:64, pr:60, pt:212 from top, pb:88 */}
        {/* Since header is 152px + we need pt from header = 212-152 = 60px additional top padding in content */}
        <div 
          className="flex-1 flex flex-col"
          style={{ 
            paddingLeft: `${s(64)}px`,
            paddingRight: `${s(60)}px`,
            paddingTop: `${s(60)}px`,  // 212 - 152 header height
            paddingBottom: `${s(88)}px`,
          }}
        >
          {version === 1 ? (
            <>
              {/* Version 1: Date Range */}
              <p style={{ fontSize: `${s(56)}px`, marginBottom: `${s(16)}px` }}>{data.dateRange}</p>
              {/* Version 1: Profit Type */}
              <p style={{ fontSize: `${s(56)}px`, marginBottom: `${s(40)}px` }}>{data.profitType}</p>
            </>
          ) : (
            <>
              {/* Version 2: Month */}
              <p style={{ fontSize: `${s(56)}px`, marginBottom: `${s(8)}px` }}>{data.month}</p>
              {/* Version 2: Win Streak */}
              <p style={{ fontSize: `${s(56)}px`, marginBottom: `${s(48)}px` }}>
                <span className="text-[rgb(134,217,159)]">{data.winStreak}Days</span>
                <span> Win Streak</span>
              </p>
            </>
          )}

          {/* PNL Value - height: 120px, min-width: 500px, px: 20px */}
          <div style={{ marginBottom: `${s(40)}px` }}>
            {(() => {
              const h = s(120);
              const fontSize = s(94);
              const px = s(20);
              const minW = s(500);
              const textWidth = fontSize * 0.62 * data.pnlValue.length;
              const w = Math.max(minW, textWidth + px * 2);

              return (
                <div
                  className="relative overflow-hidden"
                  style={{
                    width: `${w}px`,
                    height: `${h}px`,
                    borderRadius: 0,
                    backgroundColor: data.transparentPnlText ? "transparent" : pnlBgColor,
                  }}
                >
                  {data.transparentPnlText ? (
                    <svg
                      width={w}
                      height={h}
                      viewBox={`0 0 ${w} ${h}`}
                      preserveAspectRatio="none"
                      style={{ position: "absolute", inset: 0 }}
                    >
                      <defs>
                        <mask id="pnlMask" maskUnits="userSpaceOnUse">
                          <rect x="0" y="0" width={w} height={h} fill="white" />
                          <text
                            x={px}
                            y="50%"
                            dy="0.35em"
                            textAnchor="start"
                            fill="black"
                            style={{
                              fontSize,
                              fontFamily: '"Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              fontWeight: 700,
                              whiteSpace: "pre",
                            }}
                          >
                            {data.pnlValue}
                          </text>
                        </mask>
                      </defs>
                      <rect x="0" y="0" width={w} height={h} fill={pnlBgColor} mask="url(#pnlMask)" />
                    </svg>
                  ) : (
                    <div
                      className="flex h-full items-center justify-start"
                      style={{
                        fontSize,
                        fontFamily: '"Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                        fontWeight: 700,
                        paddingLeft: px,
                        paddingRight: px,
                        color: "rgb(0,0,0)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {data.pnlValue}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {version === 1 ? (
            /* Version 1: TXs Stats */
            <div className="flex items-center" style={{ gap: `${s(12)}px`, fontSize: `${s(42)}px` }}>
              <span className="text-[hsl(var(--gmgn-text-100)/0.5)]" style={{ minWidth: `${s(120)}px` }}>TXs</span>
              <div className="flex items-center">
                <span className="text-[rgb(134,217,159)]">{data.txWin}</span>
                <span className="text-[hsl(var(--gmgn-text-300))]">/</span>
                <span className="text-[rgb(242,102,130)]">{data.txLoss}</span>
              </div>
            </div>
          ) : (
            /* Version 2: Profit, Loss, Profit Days */
            <div className="flex flex-col" style={{ gap: `${s(24)}px`, fontSize: `${s(42)}px` }}>
              <div className="flex items-center" style={{ gap: `${s(12)}px`, height: `${s(56)}px` }}>
                <span className="text-[hsl(var(--gmgn-text-100)/0.5)]" style={{ minWidth: `${s(240)}px` }}>Profit</span>
                <span className="text-[rgb(134,217,159)]">+{data.profitAmount}</span>
              </div>
              <div className="flex items-center" style={{ gap: `${s(12)}px`, height: `${s(56)}px` }}>
                <span className="text-[hsl(var(--gmgn-text-100)/0.5)]" style={{ minWidth: `${s(240)}px` }}>Loss</span>
                <span className="text-[rgb(242,102,130)]">-{data.lossAmount}</span>
              </div>
              <div className="flex items-center" style={{ gap: `${s(12)}px`, height: `${s(56)}px` }}>
                <span className="text-[hsl(var(--gmgn-text-100)/0.5)]" style={{ minWidth: `${s(240)}px` }}>Profit Days</span>
                <div className="flex items-center">
                  <span className="text-[rgb(134,217,159)]">{data.profitDaysWin}</span>
                  <span className="text-[hsl(var(--gmgn-text-300))]">/</span>
                  <span className="text-[rgb(242,102,130)]">{data.profitDaysLoss}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer - absolute positioned: bottom: 28px, px: 68px */}
        <div
          className="absolute flex flex-col items-end"
          style={{
            bottom: `${s(28)}px`,
            left: `${s(68)}px`,
            right: `${s(68)}px`,
            gap: `${s(18)}px`,
          }}
        >
          {/* User Profile - conditionally shown */}
          {data.showUserProfile && (
            <div
              className="flex items-center bg-black rounded-full"
              style={{
                paddingLeft: `${s(10)}px`,
                paddingRight: `${s(20)}px`,
                height: `${s(64)}px`,
              }}
            >
              <img
                src={data.avatarUrl}
                alt="User avatar"
                crossOrigin="anonymous"
                className="rounded-full object-cover"
                style={{ width: `${s(48)}px`, height: `${s(48)}px` }}
                draggable={false}
              />
              <span
                className="font-semibold"
                style={{ fontSize: `${s(36)}px`, marginLeft: `${s(12)}px` }}
              >
                {data.username}
              </span>
              <div
                className="bg-[hsl(var(--gmgn-text-100))]"
                style={{
                  width: `${s(3)}px`,
                  height: `${s(32)}px`,
                  marginLeft: `${s(12)}px`,
                  marginRight: `${s(8)}px`,
                }}
              />
              <XIcon style={{ width: `${s(32)}px`, height: `${s(32)}px` }} />
              <span
                className="font-medium"
                style={{ fontSize: `${s(36)}px`, marginLeft: `${s(4)}px` }}
              >
                {data.followers}
              </span>
            </div>
          )}

          {/* Invite Code */}
          <div className="flex items-center" style={{ gap: `${s(16)}px`, fontSize: `${s(28)}px` }}>
            <span className="text-[hsl(var(--gmgn-text-100)/0.5)] font-normal">Invite Code</span>
            <span className="font-medium">{data.inviteCode}</span>
          </div>
        </div>
      </div>
    </div>
  );
});
GmgnCard.displayName = "GmgnCard";

export default GmgnCard;
