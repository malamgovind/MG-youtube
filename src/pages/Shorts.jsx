import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaThumbsUp, FaThumbsDown, FaShareAlt, FaCommentDots, FaTimes } from "react-icons/fa";
import {
    searchVideos,
    fetchChannelDetails,
    fetchComments,
    isRateLimited,
    getRateLimitRemainingMs,
} from "../api/youtube";
import { useAuth } from "../context/AuthContext";
import { toggleSubscription, isSubscribed, getVideoComments, addVideoComment } from "../api/userData";

const SHORTS_QUERIES = [
    "shorts", "funny shorts", "trending shorts", "viral shorts",
    "comedy shorts", "gaming shorts", "music shorts", "dance shorts",
];
const ORDERS = ["relevance", "date", "viewCount"];

const SEEN_SHORTS_KEY = "yt_clone_seen_shorts_ids";
const SEEN_IDS_CAP = 300;

const MIN_NEW_FOR_INITIAL = 2;
const MIN_NEW_FOR_SCROLL = 6;
const MAX_ATTEMPTS_PER_BATCH = 4;
const ATTEMPT_DELAY_MS = 250;
const RATE_LIMIT_RETRY_BUFFER_MS = 500;

const LOAD_RADIUS = 3;
const KEEP_ALIVE_RADIUS = 6;

const READY_TIMEOUT_MS = 10000;
const MAX_READY_RETRIES = 1;

let shortsSessionCache = null;

function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function loadSeenIds() {
    try {
        const raw = localStorage.getItem(SEEN_SHORTS_KEY);
        return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
        return new Set();
    }
}

function saveSeenIds(idsSet) {
    try {
        const arr = Array.from(idsSet);
        const trimmed = arr.slice(Math.max(0, arr.length - SEEN_IDS_CAP));
        localStorage.setItem(SEEN_SHORTS_KEY, JSON.stringify(trimmed));
    } catch {
        // non-critical
    }
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

let ytApiPromise = null;
function loadYouTubeIframeAPI() {
    if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
    if (ytApiPromise) return ytApiPromise;
    ytApiPromise = new Promise((resolve) => {
        const previous = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
            if (typeof previous === "function") previous();
            resolve(window.YT);
        };
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(tag);
    });
    return ytApiPromise;
}

function formatCommentTime(raw) {
    let date;
    if (raw?.toDate) date = raw.toDate();
    else if (raw?.seconds) date = new Date(raw.seconds * 1000);
    else if (typeof raw === "string") date = new Date(raw);
    else date = new Date();
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

const youtubeCommentsCache = new Map();

function CommentsPanel({ video, user, onClose }) {
    const [youtubeComments, setYoutubeComments] = useState(null);
    const [localComments, setLocalComments] = useState([]);
    const [text, setText] = useState("");
    const [posting, setPosting] = useState(false);

    useEffect(() => {
        let isMounted = true;

        if (youtubeCommentsCache.has(video.id)) {
            setYoutubeComments(youtubeCommentsCache.get(video.id));
        } else {
            fetchComments(video.id)
                .then((res) => {
                    const items = (res.data.items || []).map((item) => {
                        const s = item.snippet.topLevelComment.snippet;
                        return { id: item.id, author: s.authorDisplayName, text: s.textDisplay, publishedAt: s.publishedAt };
                    });
                    youtubeCommentsCache.set(video.id, items);
                    if (isMounted) setYoutubeComments(items);
                })
                .catch(() => {
                    youtubeCommentsCache.set(video.id, []);
                    if (isMounted) setYoutubeComments([]);
                });
        }

        getVideoComments(video.id)
            .then((items) => { if (isMounted) setLocalComments(items); })
            .catch(() => { });

        return () => { isMounted = false; };
    }, [video.id]);

    const handlePost = async () => {
        const trimmed = text.trim();
        if (!trimmed || posting) return;
        setPosting(true);

        if (user) {
            try {
                const saved = await addVideoComment(video.id, user.uid, user.displayName, user.photoURL, trimmed);
                setLocalComments((prev) => [saved, ...prev]);
                setText("");
            } catch {
                alert("Could not post comment. Please try again.");
            }
        } else {
            const guestKey = `yt_clone_guest_comments_${video.id}`;
            const entry = { id: `guest_${Date.now()}`, authorName: "You (guest)", text: trimmed, createdAt: new Date().toISOString() };
            try {
                const raw = localStorage.getItem(guestKey);
                const arr = raw ? JSON.parse(raw) : [];
                arr.unshift(entry);
                localStorage.setItem(guestKey, JSON.stringify(arr.slice(0, 50)));
            } catch {
                // ignore
            }
            setLocalComments((prev) => [entry, ...prev]);
            setText("");
        }

        setPosting(false);
    };

    return (
        <div
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-x-0 bottom-0 top-1/3 bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl flex flex-col z-20"
        >
            <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-800 shrink-0">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Comments</h3>
                <button type="button" onClick={onClose} aria-label="Close comments">
                    <FaTimes className="text-gray-500 dark:text-gray-400" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
                {localComments.map((c) => (
                    <div key={c.id} className="flex gap-2">
                        {c.authorPhoto ? (
                            <img src={c.authorPhoto} alt="" className="w-8 h-8 rounded-full shrink-0" />
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                {(c.authorName || "?").charAt(0).toUpperCase()}
                            </div>
                        )}
                        <div className="min-w-0">
                            <p className="text-sm">
                                <span className="font-semibold text-gray-900 dark:text-gray-100">{c.authorName}</span>{" "}
                                <span className="text-xs text-gray-400">{formatCommentTime(c.createdAt)}</span>
                            </p>
                            <p className="text-sm text-gray-700 dark:text-gray-300 break-words">{c.text}</p>
                        </div>
                    </div>
                ))}

                {youtubeComments === null && (
                    <p className="text-sm text-gray-400 text-center py-2">Loading YouTube comments...</p>
                )}
                {youtubeComments !== null && youtubeComments.length === 0 && localComments.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-2">No comments yet. Be the first!</p>
                )}
                {youtubeComments?.map((c) => (
                    <div key={c.id} className="flex gap-2">
                        <div className="w-8 h-8 rounded-full bg-gray-400 flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {(c.author || "?").charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm">
                                <span className="font-semibold text-gray-900 dark:text-gray-100">{c.author}</span>{" "}
                                <span className="text-xs text-gray-400">{formatCommentTime(c.publishedAt)}</span>
                            </p>
                            <p className="text-sm text-gray-700 dark:text-gray-300 break-words">{c.text}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex items-center gap-2 px-4 py-3 border-t dark:border-gray-800 shrink-0">
                <input
                    type="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handlePost()}
                    placeholder="Write a comment..."
                    className="flex-1 min-w-0 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
                <button
                    type="button"
                    onClick={handlePost}
                    disabled={posting || !text.trim()}
                    className="px-4 py-2 rounded-full bg-blue-600 text-white text-sm font-semibold disabled:opacity-50"
                >
                    Post
                </button>
            </div>
        </div>
    );
}

function ShortCard({ video, isActive, loadState, subscribeState, onToggleSubscribe, reaction, onReact, user, onSkip }) {
    const navigate = useNavigate();

    // This wrapper div is the ONLY thing React ever manages here. It has no
    // JSX children, so React never touches its childNodes on re-render.
    // We NEVER pass this node itself to YT.Player — see the root-cause note
    // in createPlayer() below for why that was the actual bug.
    const wrapperRef = useRef(null);

    const playerRef = useRef(null);
    const playerReadyRef = useRef(false);
    const desiredActiveRef = useRef(false);
    const readyTimeoutRef = useRef(null);
    const retryCountRef = useRef(0);
    const creationTokenRef = useRef(0);

    const [isPlaying, setIsPlaying] = useState(false);
    const [playerReady, setPlayerReady] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [channelInfo, setChannelInfo] = useState(null);
    const [commentsOpen, setCommentsOpen] = useState(false);

    useEffect(() => {
        const channelId = video.snippet.channelId;
        if (!channelId) return;
        let isMounted = true;
        fetchChannelDetails(channelId)
            .then((res) => {
                if (!res) return;
                const data = res.data?.items?.[0] || null;
                const info = data
                    ? { logo: data.snippet?.thumbnails?.default?.url || null, title: data.snippet?.title || video.snippet.channelTitle }
                    : null;
                if (isMounted) setChannelInfo(info);
            })
            .catch(() => { });
        return () => { isMounted = false; };
    }, [video.snippet.channelId, video.snippet.channelTitle]);

    const applyState = useCallback((active) => {
        const p = playerRef.current;
        if (!p) return;
        try {
            if (active) { p.unMute(); p.playVideo(); }
            else { p.pauseVideo(); p.mute(); }
        } catch {
            // player may not be fully ready yet
        }
    }, []);

    const clearReadyTimeout = () => {
        if (readyTimeoutRef.current) {
            clearTimeout(readyTimeoutRef.current);
            readyTimeoutRef.current = null;
        }
    };

    // ROOT CAUSE FIX: new YT.Player(node, ...) does not render INSIDE node —
    // it REPLACES node in the DOM with an <iframe>. If that node were the
    // React-managed wrapper itself, the wrapper would silently vanish from
    // the live DOM while React still thinks it's there; any later attempt
    // to create a player again would target a detached, dead node and fail
    // with no error and no onReady — exactly the "stuck loading forever"
    // symptom, and it only ever hit cards that got destroyed/recreated
    // (retries, scroll back into range) which is why the first few Shorts
    // (never recreated) looked fine while later ones died silently.
    //
    // Fix: never give YT.Player the React-managed node. Each creation makes
    // a brand-new plain <div> (created via document.createElement, entirely
    // outside React's tree) inside the stable wrapper, and hands THAT to
    // YT.Player. The wrapper itself is never replaced, so it's always valid
    // to create fresh children in it, every single time.
    const destroyPlayer = useCallback(() => {
        clearReadyTimeout();
        if (playerRef.current) {
            try { playerRef.current.destroy(); } catch { /* ignore */ }
            playerRef.current = null;
        }
        if (wrapperRef.current) {
            wrapperRef.current.innerHTML = "";
        }
        playerReadyRef.current = false;
        setPlayerReady(false);
        setIsPlaying(false);
    }, []);

    const createPlayer = useCallback(() => {
        const wrapper = wrapperRef.current;
        if (!wrapper || playerRef.current) return;

        // Fresh target every time — never reused, never stale.
        wrapper.innerHTML = "";
        const target = document.createElement("div");
        target.style.width = "100%";
        target.style.height = "100%";
        wrapper.appendChild(target);

        const myToken = ++creationTokenRef.current;

        loadYouTubeIframeAPI().then((YT) => {
            // Stale: this card's loadState moved on (or was destroyed again)
            // while the (possibly shared, first-load) API script was still
            // loading. wrapper.isConnected also guards against the card
            // having unmounted entirely in the meantime.
            if (myToken !== creationTokenRef.current || !wrapper.isConnected || playerRef.current) return;

            setHasError(false);

            playerRef.current = new YT.Player(target, {
                videoId: video.id,
                playerVars: {
                    autoplay: 1, mute: 1, controls: 0, modestbranding: 1, rel: 0,
                    iv_load_policy: 3, disablekb: 1, fs: 0, playsinline: 1,
                    origin: window.location.origin,
                },
                events: {
                    onReady: () => {
                        if (myToken !== creationTokenRef.current) return;
                        clearReadyTimeout();
                        retryCountRef.current = 0;
                        playerReadyRef.current = true;
                        setPlayerReady(true);
                        setHasError(false);
                        applyState(desiredActiveRef.current);
                    },
                    onStateChange: (e) => {
                        if (myToken !== creationTokenRef.current) return;
                        if (e.data === window.YT.PlayerState.ENDED) {
                            e.target.seekTo(0);
                            e.target.playVideo();
                        } else if (e.data === window.YT.PlayerState.PLAYING) {
                            setIsPlaying(true);
                        } else if (e.data === window.YT.PlayerState.PAUSED) {
                            setIsPlaying(false);
                        }
                    },
                    onError: (e) => {
                        if (myToken !== creationTokenRef.current) return;
                        clearReadyTimeout();
                        const code = e?.data;
                        if (code === 101 || code === 150 || code === 100) {
                            setHasError(true);
                        } else if (retryCountRef.current < MAX_READY_RETRIES) {
                            retryCountRef.current += 1;
                            destroyPlayer();
                            setTimeout(() => createPlayer(), 300);
                        } else {
                            setHasError(true);
                        }
                    },
                },
            });

            readyTimeoutRef.current = setTimeout(() => {
                if (myToken !== creationTokenRef.current || playerReadyRef.current) return;
                if (retryCountRef.current < MAX_READY_RETRIES) {
                    retryCountRef.current += 1;
                    destroyPlayer();
                    createPlayer();
                } else {
                    setHasError(true);
                }
            }, READY_TIMEOUT_MS);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [video.id, applyState, destroyPlayer]);

    useEffect(() => {
        desiredActiveRef.current = isActive;
        if (playerReadyRef.current) applyState(isActive);
    }, [isActive, applyState]);

    useEffect(() => {
        const shouldHavePlayer = loadState !== "idle";

        if (shouldHavePlayer && !playerRef.current) {
            createPlayer();
        }
        if (!shouldHavePlayer && playerRef.current) {
            creationTokenRef.current += 1;
            destroyPlayer();
            retryCountRef.current = 0;
            setHasError(false);
        }
    }, [loadState, createPlayer, destroyPlayer]);

    useEffect(() => {
        return () => {
            creationTokenRef.current += 1;
            clearReadyTimeout();
            if (playerRef.current) {
                try { playerRef.current.destroy(); } catch { /* ignore */ }
                playerRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (hasError && isActive && onSkip) {
            const t = setTimeout(() => onSkip(), 1500);
            return () => clearTimeout(t);
        }
    }, [hasError, isActive, onSkip]);

    const handleChannelClick = (e) => {
        e.stopPropagation();
        navigate(`/channel?id=${video.snippet.channelId}`);
    };

    const handleSubscribeClick = (e) => {
        e.stopPropagation();
        onToggleSubscribe(video.snippet.channelId, {
            channelId: video.snippet.channelId,
            channelTitle: channelInfo?.title || video.snippet.channelTitle,
            channelLogo: channelInfo?.logo || "",
        });
    };

    const handleReactClick = (e, type) => {
        e.stopPropagation();
        onReact(video.id, type);
    };

    const handleCommentClick = (e) => {
        e.stopPropagation();
        setCommentsOpen((prev) => !prev);
    };

    const handleShare = async (e) => {
        e.stopPropagation();
        const url = `${window.location.origin}/watch?v=${video.id}`;
        if (navigator.share) {
            try { await navigator.share({ title: video.snippet.title, url }); } catch { /* cancelled */ }
        } else {
            try { await navigator.clipboard.writeText(url); alert("Link copied to clipboard!"); }
            catch { alert("Could not copy link."); }
        }
    };

    const handleVideoAreaClick = () => {
        const p = playerRef.current;
        if (!p || hasError) return;
        if (isPlaying) p.pauseVideo();
        else { p.unMute(); p.playVideo(); }
    };

    const handleRetryClick = (e) => {
        e.stopPropagation();
        retryCountRef.current = 0;
        setHasError(false);
        createPlayer();
    };

    const channelName = channelInfo?.title || video.snippet.channelTitle;
    const isSubscribed_ = subscribeState === true;
    const posterUrl = video.snippet.thumbnails?.high?.url || video.snippet.thumbnails?.medium?.url || video.snippet.thumbnails?.default?.url || "";

    const ChannelBlock = ({ compact }) => (
        <>
            <div onClick={handleChannelClick} className={`flex items-center gap-2 cursor-pointer ${compact ? "mb-2" : "mb-3"}`}>
                {channelInfo?.logo ? (
                    <img src={channelInfo.logo} alt={channelName} className="w-9 h-9 rounded-full object-cover border-2 border-white/30" />
                ) : (
                    <div className="w-9 h-9 rounded-full bg-gray-500 flex items-center justify-center text-xs font-bold border-2 border-white/30">
                        {(channelName || "?").charAt(0).toUpperCase()}
                    </div>
                )}
                <span className="text-sm font-semibold drop-shadow-sm">{channelName}</span>
            </div>
            <button
                type="button"
                onClick={handleSubscribeClick}
                className={`mb-3 px-4 py-1.5 rounded-full text-xs font-semibold transition-colors duration-150
                    ${isSubscribed_ ? "bg-gray-200 text-gray-800" : "bg-white text-black hover:bg-gray-100"}`}
            >
                {isSubscribed_ ? "Subscribed" : "Subscribe"}
            </button>
            <p className={`text-sm font-semibold leading-snug drop-shadow-sm ${compact ? "line-clamp-2" : "line-clamp-3"}`}>
                {video.snippet.title}
            </p>
            {video.snippet.description ? (
                <p className={`text-xs text-gray-300 mt-1 drop-shadow-sm ${compact ? "line-clamp-2" : "line-clamp-4"}`}>
                    {video.snippet.description}
                </p>
            ) : null}
        </>
    );

    const ActionButtons = () => (
        <div className="flex flex-col items-center gap-5">
            <button type="button" onClick={(e) => handleReactClick(e, "like")} className={`flex flex-col items-center gap-1 ${reaction === "like" ? "text-blue-400" : "text-white"}`}>
                <FaThumbsUp size={22} />
                <span className="text-xs">Like</span>
            </button>
            <button type="button" onClick={(e) => handleReactClick(e, "dislike")} className={`flex flex-col items-center gap-1 ${reaction === "dislike" ? "text-blue-400" : "text-white"}`}>
                <FaThumbsDown size={22} />
                <span className="text-xs">Dislike</span>
            </button>
            <button type="button" onClick={handleCommentClick} className="flex flex-col items-center gap-1 text-white">
                <FaCommentDots size={22} />
                <span className="text-xs">Comment</span>
            </button>
            <button type="button" onClick={handleShare} className="flex flex-col items-center gap-1 text-white">
                <FaShareAlt size={22} />
                <span className="text-xs">Share</span>
            </button>
        </div>
    );

    return (
        <div className="relative w-full h-[calc(100vh-4rem)] snap-start flex items-center justify-center gap-4 md:gap-8 bg-black px-2">
            <div className="hidden md:flex flex-col justify-center w-48 lg:w-64 shrink-0 text-white">
                <ChannelBlock compact={false} />
            </div>

            <div className="relative h-full max-h-[85vh] my-auto aspect-[9/16] bg-black rounded-lg overflow-hidden shrink-0">
                {/* Stable, React-owned wrapper — NEVER passed to YT.Player
                    directly. See createPlayer()/destroyPlayer() above. */}
                <div ref={wrapperRef} className="w-full h-full pointer-events-none" />

                {!playerReady && !hasError && (
                    <img src={posterUrl} alt={video.snippet.title} className="absolute inset-0 w-full h-full object-cover" />
                )}

                {!playerReady && !hasError && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-8 h-8 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    </div>
                )}

                {hasError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white px-6 text-center gap-3">
                        <p className="text-sm text-gray-300">This video can't be played here.</p>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={handleRetryClick}
                                className="px-4 py-1.5 rounded-full bg-white text-black text-xs font-semibold"
                            >
                                Retry
                            </button>
                            {onSkip && (
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); onSkip(); }}
                                    className="px-4 py-1.5 rounded-full bg-gray-700 text-white text-xs font-semibold"
                                >
                                    Skip
                                </button>
                            )}
                        </div>
                    </div>
                )}

                <div onClick={handleVideoAreaClick} className="absolute inset-0" />

                {playerReady && !isPlaying && !hasError && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="bg-black/40 rounded-full p-4">
                            <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                            </svg>
                        </div>
                    </div>
                )}

                <div className="md:hidden absolute left-3 bottom-6 right-16 text-white pointer-events-none">
                    <div className="pointer-events-auto"><ChannelBlock compact={true} /></div>
                </div>
                <div className="md:hidden absolute right-2 bottom-24 text-white pointer-events-auto">
                    <ActionButtons />
                </div>

                {commentsOpen && <CommentsPanel video={video} user={user} onClose={() => setCommentsOpen(false)} />}
            </div>

            <div className="hidden md:flex flex-col justify-center shrink-0">
                <ActionButtons />
            </div>
        </div>
    );
}

function Shorts() {
    const { user } = useAuth();

    const [videos, setVideos] = useState(() => shortsSessionCache?.videos || []);
    const [loading, setLoading] = useState(() => !shortsSessionCache);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState(null);
    const [feedEnded, setFeedEnded] = useState(() => shortsSessionCache?.feedEnded || false);
    const [activeIndex, setActiveIndex] = useState(() => shortsSessionCache?.activeIndex || 0);
    const [subscribeStates, setSubscribeStates] = useState(() => shortsSessionCache?.subscribeStates || {});
    const [reactions, setReactions] = useState(() => shortsSessionCache?.reactions || {});

    const scrollContainerRef = useRef(null);
    const loaderRef = useRef(null);
    const loadingMoreRef = useRef(false);
    const hasFetchedInitialRef = useRef(false);
    const isMountedRef = useRef(true);
    const activeObserverRef = useRef(null);
    const cardNodesRef = useRef(new Map());
    const videosRef = useRef(videos);
    const activeIndexRef = useRef(activeIndex);
    const pendingScrollRestoreRef = useRef(
        shortsSessionCache ? shortsSessionCache.scrollTop || 0 : null
    );

    const queueRef = useRef(
        shortsSessionCache?.queue ||
        shuffle(SHORTS_QUERIES).map((query) => ({ query, order: ORDERS[Math.floor(Math.random() * ORDERS.length)] }))
    );
    const queueIndexRef = useRef(shortsSessionCache?.queueIndex || 0);
    const pageTokenRef = useRef(shortsSessionCache?.pageToken || null);
    const seenIdsRef = useRef(loadSeenIds());

    const lastErrorMessageRef = useRef(null);
    const showErrorOnce = (message) => {
        if (lastErrorMessageRef.current === message) return;
        lastErrorMessageRef.current = message;
        setError(message);
    };
    const clearError = () => { lastErrorMessageRef.current = null; setError(null); };

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

    const appendUnique = (items) => {
        const fresh = [];
        for (const item of items) {
            const videoId = item?.id?.videoId;
            if (videoId && !seenIdsRef.current.has(videoId)) {
                seenIdsRef.current.add(videoId);
                fresh.push({ ...item, id: videoId });
            }
        }
        if (fresh.length > 0) { saveSeenIds(seenIdsRef.current); setVideos((prev) => [...prev, ...fresh]); }
        return fresh.length;
    };

    const fetchOnePage = useCallback(() => {
        if (queueIndexRef.current >= queueRef.current.length) return Promise.resolve({ addedCount: 0, exhausted: true });

        const { query, order } = queueRef.current[queueIndexRef.current];

        return searchVideos(query, order, pageTokenRef.current, "short").then((res) => {
            const items = res.data.items || [];
            const token = res.data.nextPageToken || null;
            const addedCount = appendUnique(items);

            if (token) pageTokenRef.current = token;
            else { queueIndexRef.current += 1; pageTokenRef.current = null; }

            const exhausted = queueIndexRef.current >= queueRef.current.length;
            return { addedCount, exhausted };
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchNextBatch = useCallback((isInitial = false) => {
        if (loadingMoreRef.current) return;

        if (isRateLimited()) {
            showErrorOnce("YouTube API rate limit reached. Please wait a moment before more Shorts load.");
            scheduleRetryAfterCooldown(isInitial);
            return;
        }

        loadingMoreRef.current = true;
        if (isInitial) setLoading(true); else setLoadingMore(true);
        clearError();

        let totalAdded = 0;
        let attempts = 0;
        const minNeeded = isInitial ? MIN_NEW_FOR_INITIAL : MIN_NEW_FOR_SCROLL;

        const finish = () => {
            loadingMoreRef.current = false;
            if (!isMountedRef.current) return;
            if (isInitial) setLoading(false); else setLoadingMore(false);
        };

        const step = () => {
            attempts += 1;
            fetchOnePage()
                .then(({ addedCount, exhausted }) => {
                    if (!isMountedRef.current) return;
                    totalAdded += addedCount;
                    if (exhausted) { setFeedEnded(true); finish(); return; }
                    if (totalAdded >= minNeeded || attempts >= MAX_ATTEMPTS_PER_BATCH) { finish(); return; }
                    delay(ATTEMPT_DELAY_MS).then(() => { if (isMountedRef.current) step(); });
                })
                .catch((err) => {
                    if (!isMountedRef.current) return;
                    showErrorOnce(err.message);
                    if (err?.isRateLimited) scheduleRetryAfterCooldown(isInitial);
                    finish();
                });
        };

        step();
    }, [fetchOnePage, scheduleRetryAfterCooldown]);

    useEffect(() => { fetchNextBatchRef.current = fetchNextBatch; }, [fetchNextBatch]);
    useEffect(() => { videosRef.current = videos; }, [videos]);
    useEffect(() => { activeIndexRef.current = activeIndex; }, [activeIndex]);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            shortsSessionCache = {
                videos: videosRef.current,
                activeIndex: activeIndexRef.current,
                subscribeStates,
                reactions,
                queue: queueRef.current,
                queueIndex: queueIndexRef.current,
                pageToken: pageTokenRef.current,
                feedEnded,
                scrollTop: scrollContainerRef.current?.scrollTop || 0,
            };
            if (retryTimeoutRef.current) { clearTimeout(retryTimeoutRef.current); retryTimeoutRef.current = null; }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (hasFetchedInitialRef.current) return;
        hasFetchedInitialRef.current = true;

        if (shortsSessionCache && shortsSessionCache.videos.length > 0) {
            return;
        }

        fetchNextBatch(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (pendingScrollRestoreRef.current != null && videos.length > 0 && scrollContainerRef.current) {
            const y = pendingScrollRestoreRef.current;
            pendingScrollRestoreRef.current = null;
            requestAnimationFrame(() => {
                if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = y;
            });
        }
    }, [videos.length]);

    useEffect(() => {
        const node = loaderRef.current;
        if (!node) return;
        const observer = new IntersectionObserver(
            (entries) => { if (entries[0].isIntersecting && !feedEnded) fetchNextBatch(false); },
            { rootMargin: "600px" }
        );
        observer.observe(node);
        return () => observer.disconnect();
    }, [fetchNextBatch, videos.length, feedEnded]);

    useEffect(() => {
        activeObserverRef.current = new IntersectionObserver(
            (entries) => {
                let best = null;
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        if (!best || entry.intersectionRatio > best.intersectionRatio) best = entry;
                    }
                });
                if (best) {
                    const idx = Number(best.target.dataset.index);
                    if (!Number.isNaN(idx)) setActiveIndex(idx);
                }
            },
            { threshold: [0.6], root: scrollContainerRef.current }
        );
        return () => activeObserverRef.current?.disconnect();
    }, []);

    const registerCardRef = useCallback((node, index) => {
        if (!node) return;
        node.dataset.index = index;
        cardNodesRef.current.set(index, node);
        activeObserverRef.current?.observe(node);
    }, []);

    const scrollToIndex = useCallback((index) => {
        const node = cardNodesRef.current.get(index);
        if (node) node.scrollIntoView({ behavior: "smooth", block: "start" });
    }, []);

    useEffect(() => {
        if (!user) return;
        const uniqueChannelIds = [...new Set(videos.map((v) => v.snippet.channelId).filter(Boolean))];
        const unknownIds = uniqueChannelIds.filter((id) => subscribeStates[id] === undefined);
        if (unknownIds.length === 0) return;
        unknownIds.forEach((channelId) => {
            isSubscribed(user.uid, channelId)
                .then((val) => { if (isMountedRef.current) setSubscribeStates((prev) => ({ ...prev, [channelId]: val })); })
                .catch(() => { });
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, videos.length]);

    const handleToggleSubscribe = useCallback(async (channelId, channelData) => {
        if (!user) {
            setSubscribeStates((prev) => ({ ...prev, [channelId]: !prev[channelId] }));
            return;
        }
        try {
            const newState = await toggleSubscription(user.uid, channelData);
            setSubscribeStates((prev) => ({ ...prev, [channelId]: newState }));
        } catch {
            // silent
        }
    }, [user]);

    const handleReact = useCallback((videoId, type) => {
        setReactions((prev) => ({ ...prev, [videoId]: prev[videoId] === type ? null : type }));
    }, []);

    const getLoadState = (index) => {
        const diff = Math.abs(index - activeIndex);
        if (diff <= LOAD_RADIUS) return "active";
        if (diff <= KEEP_ALIVE_RADIUS) return "preload";
        return "idle";
    };

    if (loading) {
        return <div className="flex items-center justify-center h-[calc(100vh-4rem)]"><p className="text-gray-400 text-sm">Loading Shorts...</p></div>;
    }
    if (error && videos.length === 0) {
        return <div className="flex items-center justify-center h-[calc(100vh-4rem)]"><p className="text-center text-red-500 text-sm px-4">{error}</p></div>;
    }

    return (
        <div className="-mx-4">
            <div ref={scrollContainerRef} className="h-[calc(100vh-4rem)] overflow-y-scroll snap-y snap-mandatory">
                {videos.map((video, index) => (
                    <div key={video.id} ref={(node) => registerCardRef(node, index)}>
                        <ShortCard
                            video={video}
                            user={user}
                            isActive={index === activeIndex}
                            loadState={getLoadState(index)}
                            subscribeState={subscribeStates[video.snippet.channelId]}
                            onToggleSubscribe={handleToggleSubscribe}
                            reaction={reactions[video.id] || null}
                            onReact={handleReact}
                            onSkip={index + 1 < videos.length ? () => scrollToIndex(index + 1) : null}
                        />
                    </div>
                ))}

                {error && videos.length > 0 && <p className="text-center text-red-500 text-sm py-4 bg-black">{error}</p>}

                <div ref={loaderRef} className="h-2" />

                {loadingMore && <p className="text-center text-gray-400 text-sm py-4 bg-black">Loading more Shorts...</p>}

                {feedEnded && !loadingMore && videos.length > 0 && (
                    <p className="text-center text-gray-500 text-sm py-4 bg-black">You've reached the end.</p>
                )}
            </div>
        </div>
    );
}

export default Shorts;