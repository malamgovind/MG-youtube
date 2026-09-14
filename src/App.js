import { useState } from "react";
import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import Home from "./pages/Home";
import Watch from "./pages/Watch";
import Search from "./pages/Search";
import Channel from "./pages/Channel";
import Shorts from "./pages/Shorts";
import History from "./pages/History";
import Liked from "./pages/Liked";
import WatchLater from "./pages/WatchLater";
import Subscriptions from "./pages/Subscriptions";

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-150">
        <Navbar onMenuClick={() => setIsSidebarOpen((prev) => !prev)} />
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

        {isSidebarOpen && (
          <div
            onClick={() => setIsSidebarOpen(false)}
            className="fixed top-16 left-0 right-0 bottom-0 bg-black/30 z-30"
          />
        )}

        <main className="pt-16 px-4">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/watch" element={<Watch />} />
            <Route path="/search" element={<Search />} />
            <Route path="/channel" element={<Channel />} />
            <Route path="/shorts" element={<Shorts />} />
            <Route path="/history" element={<History />} />
            <Route path="/liked" element={<Liked />} />
            <Route path="/watch-later" element={<WatchLater />} />
            <Route path="/subscriptions" element={<Subscriptions />} />
          </Routes>
        </main>
      </div>
    </AuthProvider>
  );
}

export default App;