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
}

interface GmgnCardProps {
  data: GmgnCardData;
  scale?: number;
}

const GmgnCard = forwardRef<HTMLDivElement, GmgnCardProps>(({ data, scale = 1 }, ref) => {
  const isNegative = data.pnlValue.startsWith("-");
  const pnlBgColor = isNegative ? "rgb(242,102,130)" : "rgb(134,217,159)";

  // Base dimensions for preview (750x420)
  const baseWidth = 750;
  const baseHeight = 420;

  return (
    <div
      ref={ref}
      className="relative overflow-hidden border border-[hsl(var(--gmgn-line-200))]"
      style={{
        width: `${baseWidth * scale}px`,
        height: `${baseHeight * scale}px`,
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
        {/* Header */}
        <div className="flex justify-between items-center" style={{ padding: `${20 * scale}px ${68 * scale}px` }}>
          <GmgnLogo style={{ height: `${36 * scale}px`, width: 'auto' }} />

          <div className="flex items-center" style={{ gap: `${60 * scale}px` }}>
            <div className="flex items-center" style={{ gap: `${8 * scale}px` }}>
              <XIcon style={{ width: `${20 * scale}px`, height: `${20 * scale}px` }} />
              <span className="font-normal" style={{ fontSize: `${16 * scale}px` }}>{data.twitterHandle}</span>
            </div>
            <div className="flex items-center" style={{ gap: `${8 * scale}px` }}>
              <GlobeIcon style={{ width: `${20 * scale}px`, height: `${20 * scale}px` }} />
              <span className="font-normal" style={{ fontSize: `${16 * scale}px` }}>{data.websiteUrl}</span>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div
          className="bg-[hsl(var(--gmgn-text-100)/0.5)]"
          style={{
            height: `${1 * scale}px`,
            marginLeft: `${68 * scale}px`,
            marginRight: `${68 * scale}px`
          }}
        />

        {/* Main Content */}
        <div className="flex-1 flex flex-col justify-center" style={{ padding: `${24 * scale}px ${68 * scale}px` }}>
          {/* Date Range */}
          <p style={{ fontSize: `${28 * scale}px`, marginBottom: `${8 * scale}px` }}>{data.dateRange}</p>

          {/* Profit Type */}
          <p style={{ fontSize: `${28 * scale}px`, marginBottom: `${24 * scale}px` }}>{data.profitType}</p>

          {/* PNL Value */}
          <div style={{ marginBottom: `${24 * scale}px` }}>
            {(() => {
              const h = 55 * scale;
              const fontSize = 43 * scale;
              const px = 10 * scale;
              const textWidth = fontSize * 0.62 * data.pnlValue.length;
              const w = Math.max(230 * scale, textWidth + px * 2);

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
                    // "Cut-out" text: PNL bg stays, digits are holes revealing the card background
                    <svg
                      width={w}
                      height={h}
                      viewBox={`0 0 ${w} ${h}`}
                      preserveAspectRatio="none"
                      style={{ position: "absolute", inset: 0 }}
                    >
                      <defs>
                        <mask id="pnlMask" maskUnits="userSpaceOnUse">
                          {/* White = visible, Black = transparent */}
                          <rect x="0" y="0" width={w} height={h} fill="white" />
                          <text
                            x={px}
                            y={h / 2}
                            dominantBaseline="middle"
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
                      className="flex h-full items-center"
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

          {/* TXs Stats */}
          <div className="flex items-center" style={{ gap: `${12 * scale}px`, fontSize: `${20 * scale}px` }}>
            <span className="text-[hsl(var(--gmgn-text-100)/0.5)]" style={{ minWidth: `${60 * scale}px` }}>TXs</span>
            <div className="flex items-center">
              <span className="text-[rgb(134,217,159)]">{data.txWin}</span>
              <span className="text-[hsl(var(--gmgn-text-300))]">/</span>
              <span className="text-[rgb(242,102,130)]">{data.txLoss}</span>
            </div>
          </div>
        </div>

        {/* Footer - absolute positioned at bottom right */}
        <div
          className="absolute flex flex-col items-end"
          style={{
            bottom: `${28 * scale}px`,
            right: `${68 * scale}px`,
            gap: `${18 * scale}px`
          }}
        >
          {/* User Profile - conditionally shown */}
          {data.showUserProfile && (
            <div
              className="flex items-center bg-black rounded-full"
              style={{
                paddingLeft: `${10 * scale}px`,
                paddingRight: `${20 * scale}px`,
                height: `${36 * scale}px`,
              }}
            >
              <img
                src={data.avatarUrl}
                alt="User avatar"
                crossOrigin="anonymous"
                className="rounded-full object-cover"
                style={{ width: `${24 * scale}px`, height: `${24 * scale}px` }}
                draggable={false}
              />
              <span
                className="font-semibold"
                style={{ fontSize: `${16 * scale}px`, marginLeft: `${8 * scale}px` }}
              >
                {data.username}
              </span>
              <div
                className="bg-[hsl(var(--gmgn-text-100))]"
                style={{
                  width: `${1 * scale}px`,
                  height: `${16 * scale}px`,
                  marginLeft: `${12 * scale}px`,
                  marginRight: `${8 * scale}px`
                }}
              />
              <XIcon style={{ width: `${14 * scale}px`, height: `${14 * scale}px` }} />
              <span
                className="font-medium"
                style={{ fontSize: `${14 * scale}px`, marginLeft: `${4 * scale}px` }}
              >
                {data.followers}
              </span>
            </div>
          )}

          {/* Invite Code */}
          <div className="flex items-center" style={{ gap: `${16 * scale}px`, fontSize: `${14 * scale}px` }}>
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
