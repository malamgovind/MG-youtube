import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
    fetchChannelDetails,
    fetchChannelVideos,
    fetchVideosByIds,
} from "../api/youtube";
import VideoList from "../components/VideoList";
import { useAuth } from "../context/AuthContext";
import { toggleSubscription, isSubscribed } from "../api/userData";
import { FaBell } from "react-icons/fa";

function Channel() {
    const [searchParams] = useSearchParams();
    const channelId = searchParams.get("id");
    const { user } = useAuth();

    const [channel, setChannel] = useState(null);
    const [videos, setVideos] = useState([]);
    const [nextPageToken, setNextPageToken] = useState(null);

    const [loading, setLoading] = useState(true);
    const [videosLoading, setVideosLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState(null);

    const [subscribed, setSubscribed] = useState(false);

    const loaderRef = useRef(null);
    const isMountedRef = useRef(true);
    const loadingMoreRef = useRef(false);
    const uploadsPlaylistIdRef = useRef(null);
    const nextPageTokenRef = useRef(null);

    const normalizeAndEnrich = useCallback((items = []) => {
        const normalized = items
            .map((item) => ({ ...item, id: item?.snippet?.resourceId?.videoId }))
            .filter((video) => video.id);

        if (normalized.length === 0) return Promise.resolve([]);

        return fetchVideosByIds(normalized.map((v) => v.id)).then((res) => {
            const detailsMap = new Map((res.data.items || []).map((d) => [d.id, d]));
            return normalized.map((v) => {
                const details = detailsMap.get(v.id);
                return details
                    ? { ...v, contentDetails: details.contentDetails, statistics: details.statistics, snippet: details.snippet || v.snippet }
                    : v;
            });
        });
    }, []);

    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    // Effect 1: Fetch channel details + videos. Depends only on channelId.
    // NOT on user — prevents re-fetching channel data on auth state changes.
    useEffect(() => {
        if (!channelId) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);
        setChannel(null);
        setVideos([]);
        setNextPageToken(null);
        setSubscribed(false);

        uploadsPlaylistIdRef.current = null;
        nextPageTokenRef.current = null;

        let isMounted = true;

        // fetchChannelDetails uses centralized cache — no repeated requests
        fetchChannelDetails(channelId)
            .then((res) => {
                if (!isMounted) return;
                const channelData = res?.data?.items?.[0] || null;
                setChannel(channelData);

                const playlistId = channelData?.contentDetails?.relatedPlaylists?.uploads;
                uploadsPlaylistIdRef.current = playlistId || null;

                if (playlistId) {
                    setVideosLoading(true);
                    return fetchChannelVideos(playlistId)
                        .then((videoRes) => {
                            if (!isMounted) return;
                            const token = videoRes.data.nextPageToken || null;
                            setNextPageToken(token);
                            nextPageTokenRef.current = token;
                            return normalizeAndEnrich(videoRes.data.items);
                        })
                        .then((enriched) => {
                            if (isMounted && enriched) setVideos(enriched);
                        })
                        .finally(() => {
                            if (isMounted) setVideosLoading(false);
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
    }, [channelId, normalizeAndEnrich]);

    // Effect 2: Load subscription status. Depends on channelId + user?.uid.
    useEffect(() => {
        if (!user || !channelId) return;
        isSubscribed(user.uid, channelId)
            .then((val) => {
                if (isMountedRef.current) setSubscribed(val);
            })
            .catch(() => {});
    }, [channelId, user]);

    const fetchMoreVideos = useCallback(() => {
        if (loadingMoreRef.current) return;
        if (!uploadsPlaylistIdRef.current || !nextPageTokenRef.current) return;

        loadingMoreRef.current = true;
        setLoadingMore(true);
        setError(null);

        fetchChannelVideos(uploadsPlaylistIdRef.current, nextPageTokenRef.current)
            .then((res) => {
                const token = res.data.nextPageToken || null;
                nextPageTokenRef.current = token;
                if (isMountedRef.current) setNextPageToken(token);
                return normalizeAndEnrich(res.data.items);
            })
            .then((enriched) => {
                if (isMountedRef.current) {
                    setVideos((prev) => {
                        const existingIds = new Set(prev.map((v) => v.id));
                        const deduped = enriched.filter((v) => !existingIds.has(v.id));
                        return [...prev, ...deduped];
                    });
                }
            })
            .catch((err) => {
                if (isMountedRef.current) setError(err.message);
            })
            .finally(() => {
                loadingMoreRef.current = false;
                if (isMountedRef.current) setLoadingMore(false);
            });
    }, [normalizeAndEnrich]);

    useEffect(() => {
        const node = loaderRef.current;
        if (!node) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) fetchMoreVideos();
            },
            { rootMargin: "300px" }
        );

        observer.observe(node);
        return () => observer.disconnect();
    }, [fetchMoreVideos, videos.length]);

    const handleSubscribeClick = async () => {
        if (!user) {
            setSubscribed((prev) => !prev);
            return;
        }
        const newState = await toggleSubscription(user.uid, {
            channelId,
            channelTitle: channel?.snippet?.title,
            channelLogo: channel?.snippet?.thumbnails?.default?.url,
        });
        setSubscribed(newState);
    };

    if (!channelId) {
        return <p className="text-center mt-10 text-gray-500 dark:text-gray-400">No channel selected.</p>;
    }
    if (loading) {
        return (
            <div className="max-w-6xl mx-auto pb-10 px-1 sm:px-0 animate-pulse">
                <div className="flex gap-6 mt-4">
                    <div className="w-24 h-24 rounded-full bg-gray-200 dark:bg-gray-800" />
                    <div className="flex-1">
                        <div className="h-6 bg-gray-200 dark:bg-gray-800 rounded w-1/3 mb-2" />
                        <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/4" />
                    </div>
                </div>
            </div>
        );
    }
    if (error && !channel) {
        return <p className="text-center mt-10 text-red-600 dark:text-red-400">{error}</p>;
    }
    if (!channel) {
        return <p className="text-center mt-10 text-gray-500 dark:text-gray-400">Channel not found.</p>;
    }

    const { snippet = {}, statistics = {} } = channel;

    const subscriberCount = statistics?.subscriberCount
        ? Number(statistics.subscriberCount).toLocaleString()
        : null;
    const videoCount = statistics?.videoCount
        ? Number(statistics.videoCount).toLocaleString()
        : null;

    const logoUrl =
        snippet?.thumbnails?.high?.url ||
        snippet?.thumbnails?.medium?.url ||
        snippet?.thumbnails?.default?.url ||
        null;

    // Banner (channels may have a banner thumbnail in brandingSettings but
    // the basic API response doesn't include it — use a gradient fallback)
    return (
        <div className="max-w-6xl mx-auto pb-10 px-1 sm:px-0">
            {/* Channel header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-6 mt-4">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
                    {logoUrl ? (
                        <img
                            src={logoUrl}
                            onError={(e) => {
                                e.target.onerror = null;
                                e.target.style.display = "none";
                            }}
                            alt={snippet?.title || "Channel"}
                            className="w-24 h-24 sm:w-32 sm:h-32 rounded-full object-cover shadow-sm ring-2 ring-gray-200 dark:ring-gray-700"
                        />
                    ) : (
                        <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-3xl font-bold text-white shadow-sm">
                            {(snippet?.title || "?").charAt(0).toUpperCase()}
                        </div>
                    )}

                    <div className="text-center sm:text-left">
                        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
                            {snippet?.title || "Channel"}
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            {subscriberCount && <span>{subscriberCount} subscribers</span>}
                            {subscriberCount && videoCount && " · "}
                            {videoCount && <span>{videoCount} videos</span>}
                        </p>
                        {snippet?.customUrl && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                                {snippet.customUrl}
                            </p>
                        )}
                    </div>
                </div>

                <button
                    type="button"
                    onClick={handleSubscribeClick}
                    className={`flex items-center gap-2 px-6 py-2 rounded-full text-sm font-semibold transition-colors duration-150 shrink-0
                        ${subscribed
                            ? "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
                            : "bg-black dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-white"
                        }`}
                >
                    {subscribed && <FaBell className="text-xs" />}
                    {subscribed ? "Subscribed" : "Subscribe"}
                </button>
            </div>

            {/* About */}
            {snippet?.description && (
                <div className="mt-6 border-t dark:border-gray-800 pt-4">
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">About</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line leading-relaxed line-clamp-3">
                        {snippet.description}
                    </p>
                </div>
            )}

            {/* Videos */}
            <div className="mt-8 border-t dark:border-gray-800 pt-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Videos</h2>

                {videosLoading && (
                    <p className="text-center mt-6 text-gray-500 dark:text-gray-400">Loading videos...</p>
                )}
                {!videosLoading && videos.length === 0 && (
                    <p className="text-center mt-6 text-gray-500 dark:text-gray-400">
                        No videos found for this channel.
                    </p>
                )}
                {!videosLoading && videos.length > 0 && (
                    <>
                        <VideoList videos={videos} />
                        {error && (
                            <p className="text-center text-red-600 dark:text-red-400 text-sm mt-4">{error}</p>
                        )}
                        <div ref={loaderRef} className="h-10" />
                        {loadingMore && (
                            <p className="text-center text-gray-500 dark:text-gray-400 text-sm mt-2">
                                Loading more videos...
                            </p>
                        )}
                        {!nextPageToken && !loadingMore && (
                            <p className="text-center text-gray-400 dark:text-gray-500 text-sm mt-4">
                                You've reached the end of this channel's videos.
                            </p>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

export default Channel;