import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { FaYoutube, FaSearch, FaBars, FaSun, FaMoon, FaUser, FaSignOutAlt, FaExchangeAlt } from "react-icons/fa";
import { useAuth } from "../context/AuthContext";

const THEME_KEY = "yt_clone_theme";

function getInitialTheme() {
    try {
        const stored = localStorage.getItem(THEME_KEY);
        if (stored === "dark" || stored === "light") return stored;
    } catch {
        // ignore
    }
    // Respect system preference if no stored preference
    if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) return "dark";
    return "light";
}

function Navbar({ onMenuClick }) {
    const [query, setQuery] = useState("");
    const navigate = useNavigate();
    const location = useLocation();
    const { user, login, logout, switchAccount } = useAuth();

    const [theme, setTheme] = useState(getInitialTheme);
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        const root = document.documentElement;
        if (theme === "dark") root.classList.add("dark");
        else root.classList.remove("dark");
        try {
            localStorage.setItem(THEME_KEY, theme);
        } catch {
            // non-critical
        }
    }, [theme]);

    // Clear search when navigating to home
    useEffect(() => {
        if (location.pathname === "/") setQuery("");
    }, [location.pathname]);

    // Close menu when clicking outside
    useEffect(() => {
        const handleOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleOutside);
        return () => document.removeEventListener("mousedown", handleOutside);
    }, []);

    const handleSearch = (e) => {
        e.preventDefault();
        const trimmed = query.trim();
        if (trimmed) navigate(`/search?q=${encodeURIComponent(trimmed)}`);
    };

    const toggleTheme = () => setTheme((prev) => (prev === "dark" ? "light" : "dark"));

    const handleLogin = async () => {
        try {
            await login();
        } catch (err) {
            console.error("Login failed:", err);
        }
    };

    const handleLogout = async () => {
        setMenuOpen(false);
        try {
            await logout();
        } catch (err) {
            console.error("Logout failed:", err);
        }
    };

    const handleSwitchAccount = async () => {
        setMenuOpen(false);
        try {
            await switchAccount();
        } catch (err) {
            // Popup closed/cancelled by the user is normal — the current account
            // stays logged in either way.
            if (err?.code !== "auth/popup-closed-by-user" && err?.code !== "auth/cancelled-popup-request") {
                console.error("Switch account failed:", err);
            }
        }
    };

    return (
        <nav className="fixed top-0 left-0 right-0 h-16 flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-4 bg-white dark:bg-gray-900 shadow-sm dark:shadow-none dark:border-b dark:border-gray-800 z-50">
            {/* Left: menu + logo */}
            <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                <button
                    type="button"
                    onClick={onMenuClick}
                    aria-label="Toggle menu"
                    className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-150"
                >
                    <FaBars className="text-lg text-gray-700 dark:text-gray-200" />
                </button>

                <Link to="/" className="flex items-center gap-1.5 select-none">
                    <FaYoutube className="text-red-600 text-3xl" />
                    <span className="hidden sm:inline font-bold text-lg tracking-tight text-gray-900 dark:text-gray-100">
                        MG-Youtube
                    </span>
                </Link>
            </div>

            {/* Center: search */}
            <form onSubmit={handleSearch} className="flex flex-1 max-w-[520px] items-center">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search"
                    className="w-full min-w-0 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400 rounded-l-full pl-4 pr-2 py-2
                        text-sm sm:text-base focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                />
                <button
                    type="submit"
                    aria-label="Search"
                    className="bg-gray-50 dark:bg-gray-800 border border-l-0 border-gray-300 dark:border-gray-700
                        px-4 sm:px-5 py-2 rounded-r-full flex items-center justify-center
                        hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-150"
                >
                    <FaSearch className="text-gray-600 dark:text-gray-300 text-sm sm:text-base" />
                </button>
            </form>

            {/* Right: theme toggle + auth */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <button
                    type="button"
                    onClick={toggleTheme}
                    aria-label="Toggle dark mode"
                    className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-150"
                >
                    {theme === "dark" ? (
                        <FaSun className="text-yellow-400 text-sm sm:text-base" />
                    ) : (
                        <FaMoon className="text-gray-700 text-sm sm:text-base" />
                    )}
                </button>

                {!user && (
                    <button
                        type="button"
                        onClick={handleLogin}
                        className="px-3 sm:px-4 py-1.5 rounded-full border border-gray-300 dark:border-gray-700 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-gray-800 transition-colors duration-150 whitespace-nowrap flex items-center gap-1.5"
                    >
                        <FaUser className="text-xs" />
                        <span className="hidden sm:inline">Sign in</span>
                    </button>
                )}

                {user && (
                    <div className="relative" ref={menuRef}>
                        <button
                            type="button"
                            onClick={() => setMenuOpen((prev) => !prev)}
                            className="flex items-center gap-2 p-0.5 rounded-full ring-2 ring-transparent hover:ring-gray-300 dark:hover:ring-gray-600 transition-all duration-150"
                            aria-label="Account menu"
                        >
                            {user.photoURL ? (
                                <img
                                    src={user.photoURL}
                                    alt={user.displayName || "Profile"}
                                    className="w-8 h-8 rounded-full object-cover"
                                />
                            ) : (
                                <div className="w-8 h-8 rounded-full bg-gray-400 flex items-center justify-center text-white text-xs font-bold">
                                    {(user.displayName || "?").charAt(0).toUpperCase()}
                                </div>
                            )}
                            <span className="hidden md:inline text-sm font-medium text-gray-800 dark:text-gray-200 max-w-[100px] truncate">
                                {user.displayName}
                            </span>
                        </button>

                        {menuOpen && (
                            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-lg border dark:border-gray-700 py-2 z-50">
                                {/* User info header */}
                                <div className="px-4 py-2 border-b dark:border-gray-700 mb-1">
                                    <div className="flex items-center gap-2">
                                        {user.photoURL ? (
                                            <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full" />
                                        ) : (
                                            <div className="w-8 h-8 rounded-full bg-gray-400 flex items-center justify-center text-white text-xs font-bold">
                                                {(user.displayName || "?").charAt(0)}
                                            </div>
                                        )}
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                                                {user.displayName}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                                {user.email}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Switch Account */}
                                <button
                                    type="button"
                                    onClick={handleSwitchAccount}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors duration-150"
                                >
                                    <FaExchangeAlt className="text-gray-500 dark:text-gray-400 text-xs" />
                                    Switch account
                                </button>

                                {/* Logout */}
                                <button
                                    type="button"
                                    onClick={handleLogout}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors duration-150"
                                >
                                    <FaSignOutAlt className="text-gray-500 dark:text-gray-400 text-xs" />
                                    Sign out
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </nav>
    );
}

export default Navbar;