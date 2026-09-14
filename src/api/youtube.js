import axios from "axios";

const BASE_URL = "https://www.googleapis.com/youtube/v3";
const API_KEY = process.env.REACT_APP_YOUTUBE_API_KEY;

const youtubeApi = axios.create({
    baseURL: BASE_URL,
    params: {
        key: API_KEY,
    },
});

let rateLimitedUntil = 0;
let consecutive429Count = 0;
const BASE_COOLDOWN_MS = 30000;
const MAX_COOLDOWN_MS = 5 * 60 * 1000;

export const isRateLimited = () => Date.now() < rateLimitedUntil;
export const getRateLimitRemainingMs = () => Math.max(0, rateLimitedUntil - Date.now());

const RATE_LIMIT_MESSAGE =
    "YouTube API rate limit reached. Please wait a moment before more videos load.";

youtubeApi.interceptors.request.use((config) => {
    if (Date.now() < rateLimitedUntil) {
        const err = new Error(RATE_LIMIT_MESSAGE);
        err.isRateLimited = true;
        return Promise.reject(err);
    }
    return config;
});

youtubeApi.interceptors.response.use(
    (response) => {
        consecutive429Count = 0;
        return response;
    },
    (error) => {
        if (error?.response?.status === 429) {
            consecutive429Count += 1;
            const cooldown = Math.min(
                BASE_COOLDOWN_MS * Math.pow(2, consecutive429Count - 1),
                MAX_COOLDOWN_MS
            );
            rateLimitedUntil = Date.now() + cooldown;
            error.isRateLimited = true;
            error.message = RATE_LIMIT_MESSAGE;
        }
        return Promise.reject(error);
    }
);

const inFlightRequests = new Map();
function dedupedGet(url, config) {
    const key = url + "::" + JSON.stringify(config?.params || {});
    if (inFlightRequests.has(key)) return inFlightRequests.get(key);
    const promise = youtubeApi.get(url, config).finally(() => inFlightRequests.delete(key));
    inFlightRequests.set(key, promise);
    return promise;
}

export const fetchTrending = (regionCode = "US", pageToken = null) => {
    const params = { part: "snippet,statistics", chart: "mostPopular", regionCode, maxResults: 24 };
    if (pageToken) params.pageToken = pageToken;
    return dedupedGet("/videos", { params });
};

export const searchVideos = (query, order = "relevance", pageToken = null, videoDuration = null, eventType = null) => {
    const params = { part: "snippet", q: query, type: "video", order, maxResults: 24 };
    if (pageToken) params.pageToken = pageToken;
    if (videoDuration) params.videoDuration = videoDuration;
    if (eventType) params.eventType = eventType;
    return dedupedGet("/search", { params });
};

export const fetchVideoDetails = (videoId) =>
    dedupedGet("/videos", { params: { part: "snippet,statistics", id: videoId } });

const channelDetailsCache = new Map();
const channelInFlight = new Map();

export const fetchChannelDetails = (channelId) => {
    if (channelDetailsCache.has(channelId)) return Promise.resolve(channelDetailsCache.get(channelId));
    if (channelInFlight.has(channelId)) return channelInFlight.get(channelId);

    const promise = youtubeApi
        .get("/channels", { params: { part: "snippet,statistics,contentDetails", id: channelId } })
        .then((res) => {
            channelDetailsCache.set(channelId, res);
            return res;
        })
        .catch((err) => {
            channelDetailsCache.set(channelId, null);
            throw err;
        })
        .finally(() => channelInFlight.delete(channelId));

    channelInFlight.set(channelId, promise);
    return promise;
};

export const fetchChannelVideos = (uploadsPlaylistId, pageToken = null) => {
    const params = { part: "snippet", playlistId: uploadsPlaylistId, maxResults: 50 };
    if (pageToken) params.pageToken = pageToken;
    return dedupedGet("/playlistItems", { params });
};

const videoDetailsCache = new Map();
export const fetchVideosByIds = (videoIds = []) => {
    const uniqueIds = [...new Set(videoIds.filter(Boolean))];
    const uncachedIds = uniqueIds.filter((id) => !videoDetailsCache.has(id));

    const buildResultFromCache = () => ({
        data: { items: uniqueIds.map((id) => videoDetailsCache.get(id)).filter(Boolean) },
    });

    if (uniqueIds.length === 0) return Promise.resolve({ data: { items: [] } });
    if (uncachedIds.length === 0) return Promise.resolve(buildResultFromCache());

    return dedupedGet("/videos", {
        params: { part: "snippet,statistics,contentDetails", id: uncachedIds.join(",") },
    }).then((res) => {
        (res.data.items || []).forEach((item) => videoDetailsCache.set(item.id, item));
        return buildResultFromCache();
    });
};

// ---------------------------------------------------------------------------
// YouTube comments (read-only — commentThreads.list). Some videos have
// comments disabled by the uploader, or the API returns 403/404 for them —
// callers must handle that as "no YouTube comments available", not a
// fatal error.
// ---------------------------------------------------------------------------
export const fetchComments = (videoId, pageToken = null) => {
    const params = {
        part: "snippet",
        videoId,
        maxResults: 20,
        order: "relevance",
        textFormat: "plainText",
    };
    if (pageToken) params.pageToken = pageToken;
    return dedupedGet("/commentThreads", { params });
};

export default youtubeApi;