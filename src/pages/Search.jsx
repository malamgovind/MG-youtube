import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { searchVideos, fetchVideosByIds, isRateLimited } from "../api/youtube";
import VideoList from "../components/VideoList";

function Search() {
    const [searchParams] = useSearchParams();
    const query = searchParams.get("q");

    const [videos, setVideos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState(null);
    const [pageToken, setPageToken] = useState(null);
    const [hasMore, setHasMore] = useState(true);

    const loaderRef = useRef(null);
    const isMountedRef = useRef(true);
    const loadingMoreRef = useRef(false);
    const pageTokenRef = useRef(null);
    const seenIdsRef = useRef(new Set());

    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    // Reset all state when query changes
    useEffect(() => {
        if (!query || !query.trim()) {
            setVideos([]);
            setLoading(false);
            setError(null);
            setPageToken(null);
            setHasMore(false);
            pageTokenRef.current = null;
            seenIdsRef.current = new Set();
            return;
        }

        setVideos([]);
        setLoading(true);
        setError(null);
        setPageToken(null);
        setHasMore(true);
        pageTokenRef.current = null;
        seenIdsRef.current = new Set();
        loadingMoreRef.current = false;

        let isMounted = true;

        const fetchFirstPage = () => {
            if (isRateLimited()) {
                if (isMounted) {
                    setError("YouTube API rate limit reached. Please try again in a moment.");
                    setLoading(false);
                }
                return;
            }

            searchVideos(query)
                .then((res) => {
                    if (!isMounted) return;
                    const items = res.data.items || [];
                    const token = res.data.nextPageToken || null;
                    const ids = items
                        .map((item) => item.id?.videoId)
                        .filter((id) => id && !seenIdsRef.current.has(id));

                    ids.forEach((id) => seenIdsRef.current.add(id));
                    pageTokenRef.current = token;
                    setPageToken(token);
                    setHasMore(!!token);

                    if (ids.length === 0) {
                        setLoading(false);
                        return;
                    }

                    return fetchVideosByIds(ids)
                        .then((detailsRes) => {
                            if (!isMounted) return;
                            const detailsMap = new Map(
                                (detailsRes.data.items || []).map((d) => [d.id, d])
                            );
                            const normalized = items
                                .map((item) => {
                                    const videoId = item.id?.videoId;
                                    if (!videoId || !seenIdsRef.current.has(videoId)) return null;
                                    const details = detailsMap.get(videoId);
                                    return {
                                        ...item,
                                        id: videoId,
                                        contentDetails: details?.contentDetails,
                                        statistics: details?.statistics,
                                        snippet: details?.snippet || item.snippet,
                                    };
                                })
                                .filter(Boolean);
                            if (isMounted) setVideos(normalized);
                        })
                        .catch(() => {
                            if (!isMounted) return;
                            // Fallback: show search results without details
                            const fallback = items
                                .map((item) => {
                                    const videoId = item.id?.videoId;
                                    return videoId ? { ...item, id: videoId } : null;
                                })
                                .filter(Boolean);
                            setVideos(fallback);
                        });
                })
                .catch((err) => {
                    if (isMounted) setError(err.message);
                })
                .finally(() => {
                    if (isMounted) setLoading(false);
                });
        };

        fetchFirstPage();

        return () => { isMounted = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query]);

    const fetchMoreResults = useCallback(() => {
        if (loadingMoreRef.current || !hasMore || !pageTokenRef.current || !query) return;
        if (isRateLimited()) return;

        loadingMoreRef.current = true;
        setLoadingMore(true);

        searchVideos(query, "relevance", pageTokenRef.current)
            .then((res) => {
                if (!isMountedRef.current) return;
                const items = res.data.items || [];
                const token = res.data.nextPageToken || null;
                const newIds = items
                    .map((item) => item.id?.videoId)
                    .filter((id) => id && !seenIdsRef.current.has(id));

                newIds.forEach((id) => seenIdsRef.current.add(id));
                pageTokenRef.current = token;
                setPageToken(token);
                setHasMore(!!token);

                if (newIds.length === 0) return;

                return fetchVideosByIds(newIds)
                    .then((detailsRes) => {
                        if (!isMountedRef.current) return;
                        const detailsMap = new Map(
                            (detailsRes.data.items || []).map((d) => [d.id, d])
                        );
                        const normalized = items
                            .map((item) => {
                                const videoId = item.id?.videoId;
                                if (!videoId || !newIds.includes(videoId)) return null;
                                const details = detailsMap.get(videoId);
                                return {
                                    ...item,
                                    id: videoId,
                                    contentDetails: details?.contentDetails,
                                    statistics: details?.statistics,
                                    snippet: details?.snippet || item.snippet,
                                };
                            })
                            .filter(Boolean);
                        if (isMountedRef.current) {
                            setVideos((prev) => [...prev, ...normalized]);
                        }
                    })
                    .catch(() => {
                        const fallback = items
                            .map((item) => {
                                const videoId = item.id?.videoId;
                                return (videoId && newIds.includes(videoId)) ? { ...item, id: videoId } : null;
                            })
                            .filter(Boolean);
                        if (isMountedRef.current) {
                            setVideos((prev) => [...prev, ...fallback]);
                        }
                    });
            })
            .catch((err) => {
                if (isMountedRef.current) setError(err.message);
            })
            .finally(() => {
                loadingMoreRef.current = false;
                if (isMountedRef.current) setLoadingMore(false);
            });
    }, [query, hasMore]);

    // IntersectionObserver for infinite scroll
    useEffect(() => {
        const node = loaderRef.current;
        if (!node) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore && !loadingMore) {
                    fetchMoreResults();
                }
            },
            { rootMargin: "300px" }
        );

        observer.observe(node);
        return () => observer.disconnect();
    }, [fetchMoreResults, hasMore, loadingMore, videos.length]);

    if (!query || !query.trim()) {
        return (
            <p className="text-center mt-10 text-gray-500 dark:text-gray-400">
                Please enter a search term.
            </p>
        );
    }

    return (
        <div className="pb-10 px-1 sm:px-0">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 mt-2 mb-4">
                Search results for:{" "}
                <span className="font-normal text-gray-600 dark:text-gray-400">"{query}"</span>
            </h2>

            {loading && (
                <p className="text-center mt-10 text-gray-500 dark:text-gray-400">Searching...</p>
            )}

            {!loading && error && videos.length === 0 && (
                <p className="text-center mt-10 text-red-600 dark:text-red-400">
                    {error}
                </p>
            )}

            {!loading && !error && videos.length === 0 && (
                <p className="text-center mt-10 text-gray-500 dark:text-gray-400">
                    No results found for "{query}".
                </p>
            )}

            {videos.length > 0 && <VideoList videos={videos} />}

            {/* Infinite scroll trigger */}
            <div ref={loaderRef} className="h-10" />

            {loadingMore && (
                <p className="text-center text-gray-500 dark:text-gray-400 text-sm mt-2">
                    Loading more results...
                </p>
            )}

            {!loading && !hasMore && videos.length > 0 && (
                <p className="text-center text-gray-400 dark:text-gray-500 text-sm mt-4">
                    No more results for "{query}".
                </p>
            )}

            {error && videos.length > 0 && (
                <p className="text-center text-red-600 dark:text-red-400 text-sm mt-4">{error}</p>
            )}
        </div>
    );
}

export default Search;