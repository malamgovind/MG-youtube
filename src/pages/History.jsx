import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getHistory } from "../api/userData";
import { FaHistory } from "react-icons/fa";

function groupByDay(items) {
    const groups = {};
    items.forEach((item) => {
        // viewedAt is a Firestore Timestamp — use .toDate() if available
        const raw = item.viewedAt;
        let date;
        if (raw?.toDate) {
            date = raw.toDate();
        } else if (raw?.seconds) {
            date = new Date(raw.seconds * 1000);
        } else {
            date = new Date();
        }

        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);

        let label;
        if (date.toDateString() === today.toDateString()) label = "Today";
        else if (date.toDateString() === yesterday.toDateString()) label = "Yesterday";
        else label = date.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });

        if (!groups[label]) groups[label] = [];
        groups[label].push({ ...item, _date: date });
    });

    // Preserve insertion order — since items are already sorted newest-first,
    // the groups naturally appear in the right order.
    return groups;
}

function History() {
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
        getHistory(user.uid)
            .then((data) => {
                setItems(data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [user]);

    if (authLoading || loading) {
        return <p className="text-center mt-10 text-gray-500 dark:text-gray-400">Loading...</p>;
    }
    if (!user) {
        return (
            <div className="text-center mt-16">
                <FaHistory className="text-4xl text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">Login to see your watch history.</p>
            </div>
        );
    }
    if (items.length === 0) {
        return (
            <div className="text-center mt-16">
                <FaHistory className="text-4xl text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">No watch history yet.</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Videos you watch will appear here.</p>
            </div>
        );
    }

    const grouped = groupByDay(items);

    return (
        <div className="max-w-3xl mx-auto pb-10 pt-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Watch History</h1>
            {Object.entries(grouped).map(([label, videos]) => (
                <div key={label} className="mb-8">
                    <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                        {label}
                    </h2>
                    <div className="space-y-3">
                        {videos.map((v) => (
                            <Link
                                key={`${v.videoId}-${v._date?.getTime?.()}`}
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
                                    {v._date && (
                                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                                            {v._date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                                        </p>
                                    )}
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

export default History;