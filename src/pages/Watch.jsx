import { useEffect, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { FaThumbsUp, FaThumbsDown, FaShareAlt, FaBookmark, FaBell } from "react-icons/fa";
import { fetchVideoDetails, fetchChannelDetails } from "../api/youtube";
import { useAuth } from "../context/AuthContext";
import { recordHistory, toggleLike, isLiked, toggleWatchLater, isInWatchLater, toggleSubscription, isSubscribed } from "../api/userData";

function formatViewCount(count) {
    if (!count) return "0";
    return Number(count).toLocaleString();
}

function formatPublishedDate(dateStr) {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function Watch() {
    const [searchParams] = useSearchParams();
    const videoId = searchParams.get("v");
    const { user } = useAuth();

    const [video, setVideo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [channel, setChannel] = useState(null);
    const [channelLoading, setChannelLoading] = useState(false);

    const [subscribed, setSubscribed] = useState(false);
    const [reaction, setReaction] = useState(null); // "like" | "dislike" | null
    const [saved, setSaved] = useState(false);
    const [descExpanded, setDescExpanded] = useState(false);

    // Track which videoId we've recorded history for to avoid duplicates
    const historyRecordedRef = useRef(null);

    // Effect 1: Fetch video + channel data. Depends only on videoId.
    // NOT on user — prevents re-fetching the video every time auth state settles.
    useEffect(() => {
        if (!videoId) return;

        setLoading(true);
        setError(null);
        setVideo(null);
        setChannel(null);
        setSubscribed(false);
        setReaction(null);
        setSaved(false);
        setDescExpanded(false);

        let isMounted = true;

        fetchVideoDetails(videoId)
            .then((res) => {
                if (!isMounted) return;
                const videoData = res.data.items?.[0] || null;
                setVideo(videoData);

                const channelId = videoData?.snippet?.channelId;
                if (channelId) {
                    setChannelLoading(true);
                    // fetchChannelDetails uses centralized cache — no duplicate requests
                    return fetchChannelDetails(channelId)
                        .then((chRes) => {
                            if (!isMounted) return;
                            setChannel(chRes?.data?.items?.[0] || null);
                        })
                        .finally(() => {
                            if (isMounted) setChannelLoading(false);
                        });
                }
            })
            .catch((err) => {
                if (isMounted) setError(err.message);
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });

        return () => { isMounted = false; };
    }, [videoId]);

    // Effect 2: Load user-specific data (likes, watch later, subscription, history).
    // Depends on videoId + user?.uid so it re-runs only when the user actually changes.
    useEffect(() => {
        if (!videoId || !user) return;

        // Record history (deduplicate: only once per videoId per session)
        if (historyRecordedRef.current !== videoId) {
            historyRecordedRef.current = videoId;
            // We need the video data for history — it might still be loading.
            // Fetch lightweight video details just for history record if needed.
            fetchVideoDetails(videoId)
                .then((res) => {
                    const videoData = res.data.items?.[0];
                    if (videoData) {
                        recordHistory(user.uid, videoData).catch(() => {});
                    }
                })
                .catch(() => {});
        }

        // Load like/save/subscription state
        isLiked(user.uid, videoId)
            .then((liked) => setReaction(liked ? "like" : null))
            .catch(() => {});

        isInWatchLater(user.uid, videoId)
            .then(setSaved)
            .catch(() => {});

    }, [videoId, user]);

    // Effect 3: Load subscription state when channel is known
    useEffect(() => {
        if (!user || !channel?.id) return;
        isSubscribed(user.uid, channel.id)
            .then(setSubscribed)
            .catch(() => {});
    }, [user, channel?.id]);

    const handleShare = async () => {
        const url = window.location.href;
        if (navigator.share) {
            try {
                await navigator.share({ title: video?.snippet?.title, url });
            } catch {
                // cancelled
            }
        } else {
            try {
                await navigator.clipboard.writeText(url);
                alert("Link copied to clipboard!");
            } catch {
                alert("Could not copy link.");
            }
        }
    };

    const handleLikeClick = async () => {
        if (!user) {
            setReaction((prev) => (prev === "like" ? null : "like"));
            return;
        }
        if (!video) return;
        const newState = await toggleLike(user.uid, video);
        setReaction(newState ? "like" : null);
    };

    const handleDislikeClick = () => {
        setReaction((prev) => (prev === "dislike" ? null : "dislike"));
    };

    const handleSaveClick = async () => {
        if (!user) {
            setSaved((prev) => !prev);
            return;
        }
        if (!video) return;
        const newState = await toggleWatchLater(user.uid, video);
        setSaved(newState);
    };

    const handleSubscribeClick = async () => {
        if (!user) {
            setSubscribed((prev) => !prev);
            return;
        }
        if (!channel) return;
        const newState = await toggleSubscription(user.uid, {
            channelId: channel.id,
            channelTitle: channel.snippet?.title,
            channelLogo: channel.snippet?.thumbnails?.default?.url,
        });
        setSubscribed(newState);
    };

    if (!videoId) {
        return <p className="text-center mt-10 text-gray-500 dark:text-gray-400">No video selected.</p>;
    }
    if (loading) {
        return (
            <div className="max-w-4xl mx-auto pb-10 animate-pulse">
                <div className="w-full aspect-video bg-gray-200 dark:bg-gray-800 rounded-xl" />
                <div className="mt-4 h-6 bg-gray-200 dark:bg-gray-800 rounded w-3/4" />
                <div className="mt-2 h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/4" />
            </div>
        );
    }
    if (error) {
        return <p className="text-center mt-10 text-red-600 dark:text-red-400">Error: {error}</p>;
    }
    if (!video) {
        return <p className="text-center mt-10 text-gray-500 dark:text-gray-400">Video not found.</p>;
    }

    const { snippet, statistics } = video;
    const description = snippet.description || "";
    const isLongDescription = description.length > 200;
    const publishedDate = formatPublishedDate(snippet.publishedAt);

    const likeCount = statistics?.likeCount !== undefined
        ? Number(statistics.likeCount).toLocaleString()
        : null;

    return (
        <div className="max-w-4xl mx-auto pb-10">
            {/* Video Player */}
            <div className="w-full aspect-video overflow-hidden rounded-xl bg-black shadow-sm">
                <iframe
                    className="w-full h-full"
                    src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
                    title={snippet.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                />
            </div>

            <div className="mt-4 px-1 sm:px-0">
                {/* Title */}
                <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 leading-snug">
                    {snippet.title}
                </h1>

                {/* Views + date */}
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {formatViewCount(statistics?.viewCount)} views
                    {publishedDate && <span> · {publishedDate}</span>}
                </p>

                {/* Channel row + action buttons */}
                <div className="flex flex-wrap items-center justify-between gap-4 mt-4 border-t border-b dark:border-gray-800 py-4">
                    {/* Channel info */}
                    <div className="flex items-center gap-3 flex-wrap">
                        {channelLoading && (
                            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
                        )}
                        {!channelLoading && channel && (
                            <Link to={`/channel?id=${channel.id}`} className="flex items-center gap-3 group">
                                {channel.snippet?.thumbnails?.default?.url ? (
                                    <img
                                        src={channel.snippet.thumbnails.default.url}
                                        alt={channel.snippet.title}
                                        className="w-10 h-10 rounded-full object-cover"
                                    />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center font-bold text-white">
                                        {(channel.snippet?.title || "?").charAt(0)}
                                    </div>
                                )}
                                <div>
                                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:underline">
                                        {channel.snippet?.title}
                                    </p>
                                    {channel.statistics?.subscriberCount && (
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {Number(channel.statistics.subscriberCount).toLocaleString()} subscribers
                                        </p>
                                    )}
                                </div>
                            </Link>
                        )}
                        {!channelLoading && !channel && (
                            <p className="text-sm text-gray-500 dark:text-gray-400">{snippet.channelTitle}</p>
                        )}

                        <button
                            type="button"
                            onClick={handleSubscribeClick}
                            className={`flex items-center gap-1.5 ml-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors duration-150
                                ${subscribed
                                    ? "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
                                    : "bg-black dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-white"
                                }`}
                        >
                            {subscribed && <FaBell className="text-xs" />}
                            {subscribed ? "Subscribed" : "Subscribe"}
                        </button>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Like/Dislike */}
                        <div className="flex items-center rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                            <button
                                type="button"
                                onClick={handleLikeClick}
                                className={`flex items-center gap-2 px-4 py-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-150
                                    ${reaction === "like" ? "text-blue-600 dark:text-blue-400" : "text-gray-700 dark:text-gray-300"}`}
                            >
                                <FaThumbsUp />
                                {likeCount && (
                                    <span className="text-sm font-semibold">{likeCount}</span>
                                )}
                            </button>
                            <div className="w-px h-5 bg-gray-300 dark:bg-gray-600" />
                            <button
                                type="button"
                                onClick={handleDislikeClick}
                                className={`px-4 py-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-150
                                    ${reaction === "dislike" ? "text-blue-600 dark:text-blue-400" : "text-gray-700 dark:text-gray-300"}`}
                            >
                                <FaThumbsDown />
                            </button>
                        </div>

                        {/* Share */}
                        <button
                            type="button"
                            onClick={handleShare}
                            className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-150"
                        >
                            <FaShareAlt />
                            <span className="text-sm font-semibold hidden sm:inline">Share</span>
                        </button>

                        {/* Save / Watch Later */}
                        <button
                            type="button"
                            onClick={handleSaveClick}
                            className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors duration-150
                                ${saved
                                    ? "bg-gray-800 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-white"
                                    : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                                }`}
                        >
                            <FaBookmark />
                            <span className="text-sm font-semibold hidden sm:inline">
                                {saved ? "Saved" : "Save"}
                            </span>
                        </button>
                    </div>
                </div>

                {/* Description */}
                <div className="mt-4 bg-gray-50 dark:bg-gray-800/60 rounded-xl p-4">
                    <p
                        className={`text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed ${descExpanded ? "" : "line-clamp-3"}`}
                    >
                        {description || "No description available."}
                    </p>
                    {isLongDescription && (
                        <button
                            type="button"
                            onClick={() => setDescExpanded((prev) => !prev)}
                            className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-2 hover:underline"
                        >
                            {descExpanded ? "Show less" : "Show more"}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Watch;