import { useCallback, useEffect, useRef, useState } from "react";
import {
    searchVideos,
    fetchVideosByIds,
    isRateLimited,
    getRateLimitRemainingMs,
} from "../api/youtube";
import VideoList from "../components/VideoList";
import { FaSyncAlt } from "react-icons/fa";

const ALL_FEED_CATEGORIES = [
    "technology", "gaming", "music", "news", "education", "entertainment",
    "sports", "coding", "comedy", "vlog", "travel", "cooking",
    "science", "movies", "fitness",
];

const ORDERS = ["relevance", "date", "viewCount"];
const DURATIONS_WEIGHTED = ["medium", "medium", "medium", "long", "long"];
const MIN_LONG_FORM_SECONDS = 300;
const MOVIES_MIN_SECONDS = 2400;
const MOVIE_EXCLUDE_KEYWORDS = [
    "trailer", "teaser", "song", "clip", "scene", "spoof", "review",
    "reaction", "status", "promo", "making of", "behind the scenes",
];

const CATEGORY_CHIPS = [
    { id: "all", label: "All" },
    { id: "music", label: "Music", query: "music", order: "relevance" },
    { id: "gaming", label: "Gaming", query: "gaming", order: "relevance" },
    { id: "trending", label: "Trending", query: "trending", order: "viewCount" },
    {
        id: "live", label: "Live", query: "live", order: "date",
        eventType: "live", applyLongFormFilter: false, requireLiveNow: true,
    },
    {
        id: "movies", label: "Movies", query: "full movie", order: "relevance",
        forceDuration: "long", minDurationSeconds: MOVIES_MIN_SECONDS, excludeKeywords: MOVIE_EXCLUDE_KEYWORDS,
    },
    { id: "tarak_mehta", label: "Tarak Mehta", query: "Tarak Mehta Ka Ooltah Chashmah full episode", order: "date" },
];

const SEEN_IDS_KEY = "yt_clone_seen_video_ids";
const SEEN_IDS_CAP = 500;
const MIN_NEW_VIDEOS_PER_BATCH = 12;
const MAX_ATTEMPTS_PER_BATCH = 8;
const ATTEMPT_DELAY_MS = 300;
const RATE_LIMIT_RETRY_BUFFER_MS = 500;

// Module-level cache — survives Home unmount/remount (browser Back/Forward)
// since it lives outside React entirely. sessionStorage is a secondary,
// serialized backup of the same data: it protects against the rarer case
// where the module cache itself got reset (e.g. a dev-server hot reload),
// while the module cache is the fast, primary path for normal navigation.
let lastSelectedCategory = "all";
const homeCategoryCache = new Map();
const SESSION_CACHE_KEY = "yt_home_session_cache_v1";
const SESSION_CACHE_VIDEO_CAP = 150; // keep sessionStorage payload bounded

function readSessionCache() {
    try {
        const raw = sessionStorage.getItem(SESSION_CACHE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

function writeSessionSnapshot(categoryId, snapshot) {
    try {
        const all = readSessionCache();
        all[categoryId] = {
            ...snapshot,
            videos: snapshot.videos.slice(0, SESSION_CACHE_VIDEO_CAP),
        };
        sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(all));
    } catch {
        // sessionStorage full/unavailable — module cache still covers the common case
    }
}

function readSessionSnapshot(categoryId) {
    try {
        const all = readSessionCache();
        return all[categoryId] || null;
    } catch {
        return null;
    }
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function pickWeightedDuration() {
    return DURATIONS_WEIGHTED[Math.floor(Math.random() * DURATIONS_WEIGHTED.length)];
}

function parseDurationToSeconds(isoDuration) {
    if (!isoDuration) return null;
    const match = isoDuration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
    if (!match) return null;
    const hours = parseInt(match[1] || "0", 10);
    const minutes = parseInt(match[2] || "0", 10);
    const seconds = parseInt(match[3] || "0", 10);
    return hours * 3600 + minutes * 60 + seconds;
}

function loadSeenIds() {
    try {
        const raw = localStorage.getItem(SEEN_IDS_KEY);
        return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
        return new Set();
    }
}

function saveSeenIds(idsSet) {
    try {
        const arr = Array.from(idsSet);
        const trimmed = arr.slice(Math.max(0, arr.length - SEEN_IDS_CAP));
        localStorage.setItem(SEEN_IDS_KEY, JSON.stringify(trimmed));
    } catch {
        // non-critical
    }
}

function getFilterContext(categoryId) {
    if (categoryId === "all") {
        return { applyDurationFilter: true, minDurationSeconds: MIN_LONG_FORM_SECONDS, excludeKeywords: [], requireLiveNow: false };
    }
    const chip = CATEGORY_CHIPS.find((c) => c.id === categoryId);
    if (!chip) {
        return { applyDurationFilter: true, minDurationSeconds: MIN_LONG_FORM_SECONDS, excludeKeywords: [], requireLiveNow: false };
    }
    return {
        applyDurationFilter: chip.applyLongFormFilter !== false,
        minDurationSeconds: chip.minDurationSeconds || MIN_LONG_FORM_SECONDS,
        excludeKeywords: chip.excludeKeywords || [],
        requireLiveNow: !!chip.requireLiveNow,
    };
}

function Home() {
    const [selectedCategory, setSelectedCategory] = useState(lastSelectedCategory);

    const [videos, setVideos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState(null);
    const [feedEnded, setFeedEnded] = useState(false);

    const loaderRef = useRef(null);
    const loadingMoreRef = useRef(false);
    const hasFetchedInitialRef = useRef(false);
    const isFirstCategoryRenderRef = useRef(true);
    const isMountedRef = useRef(true);
    const selectedCategoryRef = useRef(selectedCategory);

    const videosRef = useRef(videos);
    const feedEndedRef = useRef(feedEnded);
    const prevCategoryForCacheRef = useRef(selectedCategory);
    const pendingScrollRestoreRef = useRef(null);

    const allQueueRef = useRef(
        shuffle(ALL_FEED_CATEGORIES).map((query) => ({
            query, order: ORDERS[Math.floor(Math.random() * ORDERS.length)], videoDuration: pickWeightedDuration(),
        }))
    );
    const allQueueIndexRef = useRef(0);
    const allPageTokenRef = useRef(null);
    const singlePageTokenRef = useRef(null);
    const singleExhaustedRef = useRef(false);
    const seenIdsRef = useRef(loadSeenIds());

    const lastErrorMessageRef = useRef(null);
    const showErrorOnce = (message) => {
        if (lastErrorMessageRef.current === message) return;
        lastErrorMessageRef.current = message;
        setError(message);
    };
    const clearError = () => {
        lastErrorMessageRef.current = null;
        setError(null);
    };

    const retryTimeoutRef = useRef(null);
    const fetchNextBatchRef = useRef(null);

    const scheduleRetryAfterCooldown = useCallback((isInitial) => {
        if (retryTimeoutRef.current) return;
        const wait = getRateLimitRemainingMs() + RATE_LIMIT_RETRY_BUFFER_MS;
        retryTimeoutRef.current = setTimeout(() => {
            retryTimeoutRef.current = null;
            if (isMountedRef.current && fetchNextBatchRef.current) fetchNextBatchRef.current(isInitial);
        }, wait);
    }, []);

    const saveCategoryToCache = useCallback((categoryId, videosSnapshot, feedEndedSnapshot) => {
        if (!categoryId) return;
        const snapshot = { videos: videosSnapshot, feedEnded: feedEndedSnapshot, scrollY: window.scrollY };
        if (categoryId === "all") {
            snapshot.allQueue = allQueueRef.current;
            snapshot.allQueueIndex = allQueueIndexRef.current;
            snapshot.allPageToken = allPageTokenRef.current;
        } else {
            snapshot.singlePageToken = singlePageTokenRef.current;
            snapshot.singleExhausted = singleExhaustedRef.current;
        }
        homeCategoryCache.set(categoryId, snapshot);
        writeSessionSnapshot(categoryId, snapshot);
    }, []);

    const restoreFromCache = useCallback((categoryId, cached) => {
        setVideos(cached.videos);
        setFeedEnded(cached.feedEnded);
        setLoading(false);

        if (categoryId === "all") {
            if (cached.allQueue) allQueueRef.current = cached.allQueue;
            allQueueIndexRef.current = cached.allQueueIndex || 0;
            allPageTokenRef.current = cached.allPageToken || null;
        } else {
            singlePageTokenRef.current = cached.singlePageToken || null;
            singleExhaustedRef.current = !!cached.singleExhausted;
        }

        pendingScrollRestoreRef.current = cached.scrollY || 0;
    }, []);

    const getCachedSnapshot = useCallback((categoryId) => {
        const fromModule = homeCategoryCache.get(categoryId);
        if (fromModule && fromModule.videos?.length > 0) return fromModule;
        const fromSession = readSessionSnapshot(categoryId);
        if (fromSession && fromSession.videos?.length > 0) return fromSession;
        return null;
    }, []);

    const appendUnique = (items, filterContext) => {
        const { applyDurationFilter, minDurationSeconds, excludeKeywords, requireLiveNow } = filterContext;

        const candidates = [];
        for (const item of items) {
            const videoId = item?.id?.videoId;
            if (!videoId || seenIdsRef.current.has(videoId)) continue;
            if (requireLiveNow && item?.snippet?.liveBroadcastContent !== "live") continue;
            const title = (item?.snippet?.title || "").toLowerCase();
            if (excludeKeywords.length > 0 && excludeKeywords.some((kw) => title.includes(kw))) continue;
            seenIdsRef.current.add(videoId);
            candidates.push({ ...item, id: videoId });
        }

        if (candidates.length === 0) return Promise.resolve(0);

        return fetchVideosByIds(candidates.map((v) => v.id))
            .then((res) => {
                const detailsMap = new Map((res.data.items || []).map((d) => [d.id, d]));
                const merged = candidates.map((v) => {
                    const details = detailsMap.get(v.id);
                    return details ? { ...v, contentDetails: details.contentDetails, statistics: details.statistics } : v;
                });
                const filtered = applyDurationFilter
                    ? merged.filter((v) => {
                        const secs = parseDurationToSeconds(v.contentDetails?.duration);
                        return secs === null || secs >= minDurationSeconds;
                    })
                    : merged;

                saveSeenIds(seenIdsRef.current);
                if (isMountedRef.current && filtered.length > 0) setVideos((prev) => [...prev, ...filtered]);
                return filtered.length;
            })
            .catch(() => {
                saveSeenIds(seenIdsRef.current);
                if (isMountedRef.current) setVideos((prev) => [...prev, ...candidates]);
                return candidates.length;
            });
    };

    const fetchOnePage = useCallback(() => {
        const categoryId = selectedCategoryRef.current;

        if (categoryId === "all") {
            if (allQueueIndexRef.current >= allQueueRef.current.length) return Promise.resolve({ addedCount: 0, exhausted: true });

            const { query, order, videoDuration } = allQueueRef.current[allQueueIndexRef.current];
            const filterContext = getFilterContext("all");

            return searchVideos(query, order, allPageTokenRef.current, videoDuration).then((res) => {
                const items = res.data.items || [];
                const token = res.data.nextPageToken || null;

                return appendUnique(items, filterContext).then((addedCount) => {
                    if (token) allPageTokenRef.current = token;
                    else { allQueueIndexRef.current += 1; allPageTokenRef.current = null; }
                    const exhausted = allQueueIndexRef.current >= allQueueRef.current.length;
                    return { addedCount, exhausted };
                });
            });
        }

        const chip = CATEGORY_CHIPS.find((c) => c.id === categoryId);
        if (!chip || singleExhaustedRef.current) return Promise.resolve({ addedCount: 0, exhausted: true });

        const filterContext = getFilterContext(categoryId);
        const videoDuration = chip.forceDuration ? chip.forceDuration : (filterContext.applyDurationFilter ? pickWeightedDuration() : null);

        return searchVideos(chip.query, chip.order || "relevance", singlePageTokenRef.current, videoDuration, chip.eventType || null).then((res) => {
            const items = res.data.items || [];
            const token = res.data.nextPageToken || null;

            return appendUnique(items, filterContext).then((addedCount) => {
                if (token) singlePageTokenRef.current = token;
                else { singleExhaustedRef.current = true; singlePageTokenRef.current = null; }
                return { addedCount, exhausted: singleExhaustedRef.current };
            });
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchNextBatch = useCallback((isInitial = false) => {
        if (loadingMoreRef.current) return;

        if (isRateLimited()) {
            showErrorOnce("YouTube API rate limit reached. Please wait a moment before more videos load.");
            scheduleRetryAfterCooldown(isInitial);
            return;
        }

        loadingMoreRef.current = true;
        if (isInitial) setLoading(true); else setLoadingMore(true);
        clearError();

        let totalAdded = 0;
        let attempts = 0;

        const finish = () => {
            loadingMoreRef.current = false;
            if (!isMountedRef.current) return;
            if (isInitial) setLoading(false); else setLoadingMore(false);
        };

        const handleFetchError = (err) => {
            if (!isMountedRef.current) return;
            showErrorOnce(err.message);
            if (err?.isRateLimited) scheduleRetryAfterCooldown(isInitial);
            finish();
        };

        const step = () => {
            attempts += 1;
            fetchOnePage()
                .then(({ addedCount, exhausted }) => {
                    if (!isMountedRef.current) return;
                    totalAdded += addedCount;
                    if (exhausted) { setFeedEnded(true); finish(); return; }
                    const shouldStop = totalAdded >= MIN_NEW_VIDEOS_PER_BATCH || attempts >= MAX_ATTEMPTS_PER_BATCH;
                    if (shouldStop) { finish(); return; }
                    delay(ATTEMPT_DELAY_MS).then(() => { if (isMountedRef.current) step(); });
                })
                .catch(handleFetchError);
        };

        step();
    }, [fetchOnePage, scheduleRetryAfterCooldown]);

    useEffect(() => { fetchNextBatchRef.current = fetchNextBatch; }, [fetchNextBatch]);
    useEffect(() => { videosRef.current = videos; }, [videos]);
    useEffect(() => { feedEndedRef.current = feedEnded; }, [feedEnded]);
    useEffect(() => {
        selectedCategoryRef.current = selectedCategory;
        lastSelectedCategory = selectedCategory;
    }, [selectedCategory]);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            saveCategoryToCache(selectedCategoryRef.current, videosRef.current, feedEndedRef.current);
            if (retryTimeoutRef.current) { clearTimeout(retryTimeoutRef.current); retryTimeoutRef.current = null; }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Mount: restore from cache (module first, sessionStorage fallback) —
    // only hits the API when there's genuinely nothing to restore.
    useEffect(() => {
        if (hasFetchedInitialRef.current) return;
        hasFetchedInitialRef.current = true;

        const cached = getCachedSnapshot(selectedCategory);
        if (cached) {
            restoreFromCache(selectedCategory, cached);
            return;
        }

        fetchNextBatch(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (pendingScrollRestoreRef.current != null && videos.length > 0) {
            const y = pendingScrollRestoreRef.current;
            pendingScrollRestoreRef.current = null;
            requestAnimationFrame(() => window.scrollTo({ top: y, behavior: "auto" }));
        }
    }, [videos.length]);

    useEffect(() => {
        if (isFirstCategoryRenderRef.current) {
            isFirstCategoryRenderRef.current = false;
            prevCategoryForCacheRef.current = selectedCategory;
            return;
        }

        saveCategoryToCache(prevCategoryForCacheRef.current, videos, feedEnded);

        clearError();
        loadingMoreRef.current = false;
        if (retryTimeoutRef.current) { clearTimeout(retryTimeoutRef.current); retryTimeoutRef.current = null; }

        const cached = getCachedSnapshot(selectedCategory);
        if (cached) {
            restoreFromCache(selectedCategory, cached);
            prevCategoryForCacheRef.current = selectedCategory;
            return;
        }

        setVideos([]);
        setFeedEnded(false);

        if (selectedCategory === "all") {
            allPageTokenRef.current = null;
            allQueueIndexRef.current = 0;
        } else {
            singlePageTokenRef.current = null;
            singleExhaustedRef.current = false;
        }

        window.scrollTo({ top: 0, behavior: "smooth" });
        fetchNextBatch(true);
        prevCategoryForCacheRef.current = selectedCategory;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedCategory]);

    useEffect(() => {
        const node = loaderRef.current;
        if (!node) return;
        const observer = new IntersectionObserver(
            (entries) => { if (entries[0].isIntersecting && !feedEnded) fetchNextBatch(false); },
            { rootMargin: "300px" }
        );
        observer.observe(node);
        return () => observer.disconnect();
    }, [fetchNextBatch, videos.length, feedEnded]);

    // The ONLY thing that explicitly invalidates the cache and refetches.
    const handleRefresh = () => {
        const categoryId = selectedCategory;
        homeCategoryCache.delete(categoryId);
        try {
            const all = readSessionCache();
            delete all[categoryId];
            sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(all));
        } catch {
            // non-critical
        }

        setVideos([]);
        setFeedEnded(false);
        clearError();
        loadingMoreRef.current = false;
        if (retryTimeoutRef.current) { clearTimeout(retryTimeoutRef.current); retryTimeoutRef.current = null; }

        if (categoryId === "all") {
            allQueueRef.current = shuffle(ALL_FEED_CATEGORIES).map((query) => ({
                query, order: ORDERS[Math.floor(Math.random() * ORDERS.length)], videoDuration: pickWeightedDuration(),
            }));
            allQueueIndexRef.current = 0;
            allPageTokenRef.current = null;
        } else {
            singlePageTokenRef.current = null;
            singleExhaustedRef.current = false;
        }

        window.scrollTo({ top: 0, behavior: "smooth" });
        fetchNextBatch(true);
    };

    return (
        <div className="pb-10 pt-2">
            <div className="flex items-center gap-2 mb-4 mt-1">
                <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-3 -mx-1 px-1 flex-1 scrollbar-hide">
                    {CATEGORY_CHIPS.map((chip) => (
                        <button
                            key={chip.id}
                            type="button"
                            onClick={() => setSelectedCategory(chip.id)}
                            className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors duration-150
                                ${selectedCategory === chip.id
                                    ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                                    : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"}`}
                        >
                            {chip.label}
                        </button>
                    ))}
                </div>

                <button
                    type="button"
                    onClick={handleRefresh}
                    title="Refresh feed"
                    aria-label="Refresh feed"
                    className="shrink-0 p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-150"
                >
                    <FaSyncAlt className="text-sm" />
                </button>
            </div>

            {loading && videos.length === 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8">
                    {Array.from({ length: 12 }).map((_, i) => (
                        <div key={i} className="animate-pulse">
                            <div className="w-full aspect-video bg-gray-200 dark:bg-gray-800 rounded-xl" />
                            <div className="mt-3 flex gap-2">
                                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-800 shrink-0" />
                                <div className="flex-1">
                                    <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded mb-1.5" />
                                    <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-2/3" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {!loading && error && videos.length === 0 && (
                <div className="text-center mt-16">
                    <p className="text-red-600 dark:text-red-400 font-medium">{error}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">The app will automatically retry in a moment.</p>
                </div>
            )}

            {!loading && !error && videos.length === 0 && feedEnded && (
                <p className="text-center mt-10 text-gray-500 dark:text-gray-400">No videos found for this category.</p>
            )}

            {videos.length > 0 && <VideoList videos={videos} />}

            {!loading && error && videos.length > 0 && (
                <p className="text-center text-red-600 dark:text-red-400 text-sm mt-4">{error}</p>
            )}

            <div ref={loaderRef} className="h-10" />

            {loadingMore && (
                <p className="text-center text-gray-500 dark:text-gray-400 text-sm mt-2">Loading more videos...</p>
            )}

            {feedEnded && !loadingMore && videos.length > 0 && (
                <p className="text-center text-gray-400 dark:text-gray-500 text-sm mt-4">
                    You've reached the end — no more videos available right now.
                </p>
            )}
        </div>
    );
}

export default Home;