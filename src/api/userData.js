import {
    doc,
    setDoc,
    deleteDoc,
    getDoc,
    getDocs,
    collection,
    serverTimestamp,
    query,
    orderBy,
    limit,
} from "firebase/firestore";
import { db } from "../firebase";

// --- History ---
export const recordHistory = (uid, video) => {
    const ref = doc(db, "users", uid, "history", video.id);
    return setDoc(ref, {
        videoId: video.id,
        title: video.snippet.title,
        thumbnail: video.snippet.thumbnails?.medium?.url || video.snippet.thumbnails?.default?.url || "",
        channelTitle: video.snippet.channelTitle,
        viewedAt: serverTimestamp(),
    });
};

export const getHistory = async (uid) => {
    try {
        const q = query(collection(db, "users", uid, "history"), orderBy("viewedAt", "desc"), limit(200));
        const snap = await getDocs(q);
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch {
        const snap = await getDocs(collection(db, "users", uid, "history"));
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        return items.sort((a, b) => {
            const ta = a.viewedAt?.toMillis ? a.viewedAt.toMillis() : 0;
            const tb = b.viewedAt?.toMillis ? b.viewedAt.toMillis() : 0;
            return tb - ta;
        });
    }
};

// --- Likes ---
export const toggleLike = async (uid, video) => {
    const ref = doc(db, "users", uid, "likes", video.id);
    const existing = await getDoc(ref);
    if (existing.exists()) {
        await deleteDoc(ref);
        return false;
    }
    await setDoc(ref, {
        videoId: video.id,
        title: video.snippet.title,
        thumbnail: video.snippet.thumbnails?.medium?.url || video.snippet.thumbnails?.default?.url || "",
        channelTitle: video.snippet.channelTitle,
        likedAt: serverTimestamp(),
    });
    return true;
};

export const isLiked = async (uid, videoId) => {
    const ref = doc(db, "users", uid, "likes", videoId);
    const snap = await getDoc(ref);
    return snap.exists();
};

export const getLikes = async (uid) => {
    try {
        const q = query(collection(db, "users", uid, "likes"), orderBy("likedAt", "desc"), limit(200));
        const snap = await getDocs(q);
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch {
        const snap = await getDocs(collection(db, "users", uid, "likes"));
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        return items.sort((a, b) => {
            const ta = a.likedAt?.toMillis ? a.likedAt.toMillis() : 0;
            const tb = b.likedAt?.toMillis ? b.likedAt.toMillis() : 0;
            return tb - ta;
        });
    }
};

// --- Subscriptions ---
export const toggleSubscription = async (uid, channel) => {
    const ref = doc(db, "users", uid, "subscriptions", channel.channelId);
    const existing = await getDoc(ref);
    if (existing.exists()) {
        await deleteDoc(ref);
        return false;
    }
    await setDoc(ref, {
        channelId: channel.channelId,
        channelTitle: channel.channelTitle,
        channelLogo: channel.channelLogo || "",
        subscribedAt: serverTimestamp(),
    });
    return true;
};

export const isSubscribed = async (uid, channelId) => {
    const ref = doc(db, "users", uid, "subscriptions", channelId);
    const snap = await getDoc(ref);
    return snap.exists();
};

export const getSubscriptions = async (uid) => {
    try {
        const q = query(collection(db, "users", uid, "subscriptions"), orderBy("subscribedAt", "desc"), limit(200));
        const snap = await getDocs(q);
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch {
        const snap = await getDocs(collection(db, "users", uid, "subscriptions"));
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        return items.sort((a, b) => {
            const ta = a.subscribedAt?.toMillis ? a.subscribedAt.toMillis() : 0;
            const tb = b.subscribedAt?.toMillis ? b.subscribedAt.toMillis() : 0;
            return tb - ta;
        });
    }
};

// --- Watch Later ---
export const toggleWatchLater = async (uid, video) => {
    const ref = doc(db, "users", uid, "watchLater", video.id);
    const existing = await getDoc(ref);
    if (existing.exists()) {
        await deleteDoc(ref);
        return false;
    }
    await setDoc(ref, {
        videoId: video.id,
        title: video.snippet.title,
        thumbnail: video.snippet.thumbnails?.medium?.url || video.snippet.thumbnails?.default?.url || "",
        channelTitle: video.snippet.channelTitle,
        savedAt: serverTimestamp(),
    });
    return true;
};

export const isInWatchLater = async (uid, videoId) => {
    const ref = doc(db, "users", uid, "watchLater", videoId);
    const snap = await getDoc(ref);
    return snap.exists();
};

export const getWatchLater = async (uid) => {
    try {
        const q = query(collection(db, "users", uid, "watchLater"), orderBy("savedAt", "desc"), limit(200));
        const snap = await getDocs(q);
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch {
        const snap = await getDocs(collection(db, "users", uid, "watchLater"));
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        return items.sort((a, b) => {
            const ta = a.savedAt?.toMillis ? a.savedAt.toMillis() : 0;
            const tb = b.savedAt?.toMillis ? b.savedAt.toMillis() : 0;
            return tb - ta;
        });
    }
};

// --- Local (website) video comments ---
// Stored under a top-level /videoComments/{videoId}/comments collection so
// they're shared across all users viewing that video — separate from the
// per-user /users/{uid}/** tree. Requires the Firestore rule documented
// alongside this change.
export const getVideoComments = async (videoId) => {
    try {
        const q = query(
            collection(db, "videoComments", videoId, "comments"),
            orderBy("createdAt", "desc"),
            limit(100)
        );
        const snap = await getDocs(q);
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch {
        const snap = await getDocs(collection(db, "videoComments", videoId, "comments"));
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        return items.sort((a, b) => {
            const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return tb - ta;
        });
    }
};

export const addVideoComment = async (videoId, uid, authorName, authorPhoto, text) => {
    const ref = doc(collection(db, "videoComments", videoId, "comments"));
    await setDoc(ref, {
        uid,
        authorName: authorName || "User",
        authorPhoto: authorPhoto || "",
        text,
        createdAt: serverTimestamp(),
    });
    return { id: ref.id, uid, authorName, authorPhoto, text, createdAt: new Date() };
};