import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getLikes, toggleLike } from "../api/userData";
import { FaThumbsUp, FaTrash } from "react-icons/fa";

function Liked() {
    const { user, authLoading } = useAuth();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setItems([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        getLikes(user.uid)
            .then((data) => {
                setItems(data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [user]);

    const handleRemoveLike = async (e, video) => {
        e.preventDefault();
        e.stopPropagation();
        if (!user) return;
        // toggleLike with a minimal video object to remove the like
        const fakeVideo = {
            id: video.videoId,
            snippet: {
                title: video.title,
                thumbnails: { medium: { url: video.thumbnail } },
                channelTitle: video.channelTitle,
            },
        };
        await toggleLike(user.uid, fakeVideo);
        setItems((prev) => prev.filter((v) => v.videoId !== video.videoId));
    };

    if (authLoading || loading) {
        return <p className="text-center mt-10 text-gray-500 dark:text-gray-400">Loading...</p>;
    }
    if (!user) {
        return (
            <div className="text-center mt-16">
                <FaThumbsUp className="text-4xl text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">Login to see your liked videos.</p>
            </div>
        );
    }
    if (items.length === 0) {
        return (
            <div className="text-center mt-16">
                <FaThumbsUp className="text-4xl text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">No liked videos yet.</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Videos you like will appear here.</p>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto pb-10 pt-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
                Liked Videos <span className="text-gray-400 font-normal text-lg">({items.length})</span>
            </h1>
            <div className="space-y-3">
                {items.map((v) => (
                    <Link
                        key={v.videoId}
                        to={`/watch?v=${v.videoId}`}
                        className="flex gap-3 items-center group rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 p-2 -mx-2 transition-colors duration-150"
                    >
                        <div className="relative shrink-0 w-36 aspect-video rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-800">
                            <img
                                src={v.thumbnail}
                                alt={v.title}
                                className="w-full h-full object-cover"
                                loading="lazy"
                            />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                                {v.title}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{v.channelTitle}</p>
                        </div>
                        <button
                            type="button"
                            onClick={(e) => handleRemoveLike(e, v)}
                            className="shrink-0 p-2 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-150"
                            aria-label="Remove like"
                        >
                            <FaTrash className="text-sm" />
                        </button>
                    </Link>
                ))}
            </div>
        </div>
    );
}

export default Liked;