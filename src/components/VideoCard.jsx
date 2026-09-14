import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { fetchChannelDetails } from "../api/youtube";

// NOTE: Per-component channel logo fetching is intentionally kept here, but
// the actual HTTP deduplication happens inside fetchChannelDetails() via the
// shared in-flight Map in youtube.js. Multiple VideoCards with the same
// channelId will share a single network request — no local cache needed.

function formatDuration(isoDuration) {
    if (!isoDuration) return null;
    const match = isoDuration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
    if (!match) return null;
    const hours = parseInt(match[1] || "0", 10);
    const minutes = parseInt(match[2] || "0", 10);
    const seconds = parseInt(match[3] || "0", 10);
    const pad = (n) => String(n).padStart(2, "0");
    if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
    return `${minutes}:${pad(seconds)}`;
}

function formatViewCount(count) {
    if (!count) return null;
    const n = Number(count);
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B views`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M views`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K views`;
    return `${n} views`;
}

function formatTimeAgo(publishedAt) {
    if (!publishedAt) return null;
    const publishedTime = new Date(publishedAt).getTime();
    if (Number.isNaN(publishedTime)) return null;
    const diffSeconds = Math.floor((Date.now() - publishedTime) / 1000);
    if (diffSeconds < 60) return "just now";
    const units = [
        { label: "year", seconds: 31536000 },
        { label: "month", seconds: 2592000 },
        { label: "week", seconds: 604800 },
        { label: "day", seconds: 86400 },
        { label: "hour", seconds: 3600 },
        { label: "minute", seconds: 60 },
    ];
    for (const unit of units) {
        const value = Math.floor(diffSeconds / unit.seconds);
        if (value >= 1) return `${value} ${unit.label}${value > 1 ? "s" : ""} ago`;
    }
    return "just now";
}

function VideoCard({ video }) {
    const { snippet, statistics, contentDetails } = video;
    const navigate = useNavigate();

    const [channelLogo, setChannelLogo] = useState(null);

    useEffect(() => {
        const channelId = snippet.channelId;
        if (!channelId) return;

        let isMounted = true;
        // fetchChannelDetails() handles deduplication internally —
        // multiple cards with the same channelId share one request.
        fetchChannelDetails(channelId)
            .then((res) => {
                // res can be null if the channel was previously not found
                if (!res) return;
                const url = res.data?.items?.[0]?.snippet?.thumbnails?.default?.url || null;
                if (isMounted) setChannelLogo(url);
            })
            .catch(() => {
                // Silent — placeholder avatar is shown instead
            });

        return () => {
            isMounted = false;
        };
    }, [snippet.channelId]);

    const handleChannelClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        navigate(`/channel?id=${snippet.channelId}`);
    };

    const isLive = snippet.liveBroadcastContent === "live";
    const duration = formatDuration(contentDetails?.duration);
    const timeAgo = formatTimeAgo(snippet.publishedAt);
    const viewCount = formatViewCount(statistics?.viewCount);

    const thumbnailUrl =
        snippet?.thumbnails?.medium?.url ||
        snippet?.thumbnails?.default?.url ||
        "";

    return (
        <Link to={`/watch?v=${video.id}`} className="cursor-pointer block group">
            <div className="relative w-full aspect-video overflow-hidden rounded-xl bg-gray-200 dark:bg-gray-800">
                <img
                    src={thumbnailUrl}
                    alt={snippet.title}
                    className="w-full h-full object-cover transition-transform duration-300 ease-in-out group-hover:scale-105"
                    loading="lazy"
                />
                {isLive ? (
                    <span className="absolute bottom-1 right-1 bg-red-600 text-white text-xs font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                        🔴 LIVE
                    </span>
                ) : (
                    duration && (
                        <span className="absolute bottom-1 right-1 bg-black/80 text-white text-xs font-semibold px-1.5 py-0.5 rounded">
                            {duration}
                        </span>
                    )
                )}
            </div>
            <div className="mt-3 flex gap-2">
                {/* Channel avatar */}
                <div
                    onClick={handleChannelClick}
                    className="shrink-0 mt-0.5 cursor-pointer"
                >
                    {channelLogo ? (
                        <img
                            src={channelLogo}
                            alt={snippet.channelTitle}
                            className="w-8 h-8 rounded-full object-cover"
                            loading="lazy"
                        />
                    ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center text-[10px] font-bold text-white">
                            {(snippet.channelTitle || "?").charAt(0).toUpperCase()}
                        </div>
                    )}
                </div>

                {/* Text info */}
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100 line-clamp-2 leading-snug">
                        {snippet.title}
                    </h3>
                    <div
                        onClick={handleChannelClick}
                        className="mt-1 cursor-pointer group/channel w-fit"
                    >
                        <p className="text-xs text-gray-500 dark:text-gray-400 group-hover/channel:text-gray-800 dark:group-hover/channel:text-gray-200 group-hover/channel:underline">
                            {snippet.channelTitle}
                        </p>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {viewCount && <span>{viewCount}</span>}
                        {viewCount && timeAgo && " · "}
                        {timeAgo && <span>{timeAgo}</span>}
                    </p>
                </div>
            </div>
        </Link>
    );
}

export default VideoCard;