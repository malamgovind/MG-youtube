import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getSubscriptions, toggleSubscription } from "../api/userData";
import { FaBell, FaTrash } from "react-icons/fa";

function Subscriptions() {
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
        getSubscriptions(user.uid)
            .then((data) => {
                setItems(data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [user]);

    const handleUnsubscribe = async (e, channel) => {
        e.preventDefault();
        e.stopPropagation();
        if (!user) return;
        await toggleSubscription(user.uid, {
            channelId: channel.channelId,
            channelTitle: channel.channelTitle,
            channelLogo: channel.channelLogo,
        });
        setItems((prev) => prev.filter((c) => c.channelId !== channel.channelId));
    };

    if (authLoading || loading) {
        return <p className="text-center mt-10 text-gray-500 dark:text-gray-400">Loading...</p>;
    }
    if (!user) {
        return (
            <div className="text-center mt-16">
                <FaBell className="text-4xl text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">Login to see your subscriptions.</p>
            </div>
        );
    }
    if (items.length === 0) {
        return (
            <div className="text-center mt-16">
                <FaBell className="text-4xl text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">No subscriptions yet.</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Subscribe to channels to see them here.</p>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto pb-10 pt-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
                Subscriptions <span className="text-gray-400 font-normal text-lg">({items.length})</span>
            </h1>
            <div className="space-y-2">
                {items.map((c) => (
                    <Link
                        key={c.channelId}
                        to={`/channel?id=${c.channelId}`}
                        className="flex items-center gap-4 group rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 p-3 -mx-3 transition-colors duration-150"
                    >
                        {c.channelLogo ? (
                            <img
                                src={c.channelLogo}
                                alt={c.channelTitle}
                                className="w-12 h-12 rounded-full object-cover shrink-0"
                                loading="lazy"
                            />
                        ) : (
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold shrink-0">
                                {(c.channelTitle || "?").charAt(0).toUpperCase()}
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                                {c.channelTitle}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Subscribed</p>
                        </div>
                        <button
                            type="button"
                            onClick={(e) => handleUnsubscribe(e, c)}
                            className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors duration-150 flex items-center gap-1.5"
                        >
                            <FaTrash className="text-[10px]" />
                            Unsubscribe
                        </button>
                    </Link>
                ))}
            </div>
        </div>
    );
}

export default Subscriptions;