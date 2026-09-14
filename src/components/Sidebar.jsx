// import { Link, useLocation } from "react-router-dom";
// import {
//     FaHome,
//     FaVideo,
//     FaHistory,
//     FaClock,
//     FaThumbsUp,
//     FaBell,
// } from "react-icons/fa";
// import { useAuth } from "../context/AuthContext";

// const menuItems = [
//     { label: "Home", icon: <FaHome />, path: "/" },
//     { label: "Shorts", icon: <FaVideo />, path: "/shorts" },
//     { label: "Subscriptions", icon: <FaBell />, path: "/subscriptions" },
//     { label: "History", icon: <FaHistory />, path: "/history" },
//     { label: "Watch Later", icon: <FaClock />, path: "/watch-later" },
//     { label: "Liked Videos", icon: <FaThumbsUp />, path: "/liked" },
// ];

// function Sidebar({ isOpen, onClose }) {
//     const { user, login } = useAuth();
//     const location = useLocation();

//     const handleItemClick = () => {
//         if (onClose) onClose();
//     };

//     const isActive = (path) => {
//         if (path === "/") return location.pathname === "/";
//         return location.pathname.startsWith(path);
//     };

//     return (
//         <aside
//             className={`fixed top-16 left-0 h-[calc(100vh-4rem)] w-60 bg-white dark:bg-gray-900 border-r dark:border-gray-800
//                 transform transition-transform duration-300 ease-in-out z-40 flex flex-col justify-between overflow-y-auto
//                 ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
//         >
//             <nav className="py-2">
//                 {menuItems.map((item) => {
//                     const active = isActive(item.path);
//                     return (
//                         <Link
//                             key={item.label}
//                             to={item.path}
//                             onClick={handleItemClick}
//                             className={`flex items-center gap-4 px-6 py-3 transition-colors duration-150 rounded-r-full mr-4
//                                 ${active
//                                     ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-semibold"
//                                     : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
//                                 }`}
//                         >
//                             <span className={`text-lg ${active ? "text-red-600 dark:text-red-500" : ""}`}>
//                                 {item.icon}
//                             </span>
//                             <span className="text-sm">{item.label}</span>
//                         </Link>
//                     );
//                 })}
//             </nav>

//             {/* User profile / login section at bottom */}
//             <div className="border-t dark:border-gray-800 p-4 mt-auto">
//                 {user ? (
//                     <div className="flex items-center gap-3">
//                         {user.photoURL ? (
//                             <img
//                                 src={user.photoURL}
//                                 alt={user.displayName || "Profile"}
//                                 className="w-9 h-9 rounded-full object-cover shrink-0"
//                             />
//                         ) : (
//                             <div className="w-9 h-9 rounded-full bg-gray-400 flex items-center justify-center text-white text-xs font-bold shrink-0">
//                                 {(user.displayName || "?").charAt(0).toUpperCase()}
//                             </div>
//                         )}
//                         <div className="flex-1 min-w-0">
//                             <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
//                                 {user.displayName}
//                             </p>
//                             <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
//                                 {user.email}
//                             </p>
//                         </div>
//                     </div>
//                 ) : (
//                     <button
//                         type="button"
//                         onClick={() => { login(); handleItemClick(); }}
//                         className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-full border border-gray-300 dark:border-gray-700 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-gray-800 transition-colors duration-150"
//                     >
//                         Sign in
//                     </button>
//                 )}
//             </div>
//         </aside>
//     );
// }

// export default Sidebar;


import { Link, useLocation } from "react-router-dom";
import {
    FaHome,
    FaVideo,
    FaHistory,
    FaClock,
    FaThumbsUp,
    FaBell,
} from "react-icons/fa";
import { useAuth } from "../context/AuthContext";

const menuItems = [
    { label: "Home", icon: <FaHome />, path: "/" },
    { label: "Shorts", icon: <FaVideo />, path: "/shorts" },
    { label: "Subscriptions", icon: <FaBell />, path: "/subscriptions" },
    { label: "History", icon: <FaHistory />, path: "/history" },
    { label: "Watch Later", icon: <FaClock />, path: "/watch-later" },
    { label: "Liked Videos", icon: <FaThumbsUp />, path: "/liked" },
];

function Sidebar({ isOpen, onClose }) {
    const { user, login } = useAuth();
    const location = useLocation();

    const handleItemClick = () => {
        if (onClose) onClose();
    };

    const isActive = (path) => {
        if (path === "/") return location.pathname === "/";
        return location.pathname.startsWith(path);
    };

    return (
        <aside
            className={`fixed top-16 left-0 h-[calc(100vh-4rem)] w-60 bg-white dark:bg-gray-900 border-r dark:border-gray-800
                transform transition-transform duration-300 ease-in-out z-40 flex flex-col overflow-hidden
                ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
        >
            <nav className="py-2 shrink-0">
                {menuItems.map((item) => {
                    const active = isActive(item.path);

                    return (
                        <Link
                            key={item.label}
                            to={item.path}
                            onClick={handleItemClick}
                            className={`flex items-center gap-4 px-6 py-3 transition-colors duration-150 rounded-r-full mr-4
                                ${active
                                    ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-semibold"
                                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
                                }`}
                        >
                            <span
                                className={`text-lg ${active
                                        ? "text-red-600 dark:text-red-500"
                                        : ""
                                    }`}
                            >
                                {item.icon}
                            </span>

                            <span className="text-sm">{item.label}</span>
                        </Link>
                    );
                })}
            </nav>

            {/* Photo in the middle empty space */}
            <div className="flex-1 flex items-center justify-center p-4 min-h-0">
                <img
                    src="/yt-logo.jpg"
                    alt="YT Logo"
                    className="w-full h-32 object-cover rounded-xl"
                />
            </div>

            {/* User profile / login section at very bottom */}
            <div className="border-t dark:border-gray-800 p-4 shrink-0">
                {user ? (
                    <div className="flex items-center gap-3">
                        {user.photoURL ? (
                            <img
                                src={user.photoURL}
                                alt={user.displayName || "Profile"}
                                className="w-9 h-9 rounded-full object-cover shrink-0"
                            />
                        ) : (
                            <div className="w-9 h-9 rounded-full bg-gray-400 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                {(user.displayName || "?")
                                    .charAt(0)
                                    .toUpperCase()}
                            </div>
                        )}

                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                                {user.displayName}
                            </p>

                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {user.email}
                            </p>
                        </div>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={() => {
                            login();
                            handleItemClick();
                        }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-full border border-gray-300 dark:border-gray-700 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-gray-800 transition-colors duration-150"
                    >
                        Sign in
                    </button>
                )}
            </div>
        </aside>
    );
}

export default Sidebar;