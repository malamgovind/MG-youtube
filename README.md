# MG-youtube
 A YouTube Clone Website built using Cloud AI, featuring a modern UI and video browsing experience.
🎬 YouTube Clone

A modern YouTube Clone Website built using React.js, Tailwind CSS, React Router, YouTube Data API v3, Firebase Authentication, Firestore, and Axios, with development assistance from Cloud AI.

The project recreates the core YouTube experience with real YouTube data, authentication, personalized user features, infinite scrolling, Shorts-style vertical videos, dark/light mode, and responsive UI.

Disclaimer: This is an educational and portfolio project. It is not affiliated with, endorsed by, or officially connected to YouTube. Likes, subscriptions, comments, watch history, and Watch Later data are stored in the project's own Firestore database and are not synced to the user's actual YouTube account.

✨ Features
🏠 Category-based Home feed
🔍 Video search with pagination
🎥 Video watch page with YouTube player
📺 Channel pages with channel information and videos
🎬 YouTube Shorts-style vertical video feed
♾️ Infinite scrolling
🔐 Google Authentication using Firebase
❤️ Like / Dislike functionality
🔔 Subscribe functionality
💾 Watch Later functionality
📜 Watch History
👍 Liked Videos section
📺 Subscriptions section
💬 YouTube comments display
📝 Local Firestore-based comments
🌙 Dark / Light mode
📱 Fully responsive design
🔄 Browser back-navigation state preservation
⚡ API request caching and duplicate-video prevention
🛡️ YouTube API rate-limit handling with exponential backoff
🛠️ Technologies

Technologies: React.js, Tailwind CSS, React Router, YouTube Data API v3, Firebase Authentication, Firestore, Axios, React Icons

📂 Project Structure
src/
├── api/
│   ├── youtube.js
│   └── userData.js
│
├── context/
│   └── AuthContext.jsx
│
├── components/
│   ├── Navbar.jsx
│   ├── Sidebar.jsx
│   ├── VideoCard.jsx
│   └── VideoList.jsx
│
├── pages/
│   ├── Home.jsx
│   ├── Search.jsx
│   ├── Watch.jsx
│   ├── Channel.jsx
│   ├── Shorts.jsx
│   ├── History.jsx
│   ├── Liked.jsx
│   ├── WatchLater.jsx
│   └── Subscriptions.jsx
│
├── firebase.js
└── App.js

🔄 Application Flow
User Opens Website
        ↓
      App.js
        ↓
  AuthProvider
        ↓
 Navbar + Sidebar
        ↓
     Home Page
        ↓
 YouTube Data API v3
        ↓
 Video Data
        ↓
 VideoList → VideoCard
        ↓
    Watch Video
        ↓
 Firebase / Firestore
        ↓
 User-specific Data

🎥 YouTube Data API

The application uses YouTube Data API v3 to retrieve real YouTube data.

API features used include:

Video search
Video details
Channel details
Channel videos
Video comments
Pagination
Video duration filtering

Axios is used as the HTTP client for communicating with the YouTube API.

🔐 Authentication

Firebase Authentication is used for Google Sign-In.

Authentication Flow
Login
  ↓
Firebase Authentication
  ↓
Google Account Selection
  ↓
Firebase User
  ↓
AuthContext
  ↓
User available throughout application


The application uses onAuthStateChanged() to keep track of authentication state.

🔥 Firestore

Firestore stores user-specific application data.

Collections
users/{uid}/history/{videoId}
users/{uid}/likes/{videoId}
users/{uid}/subscriptions/{channelId}
users/{uid}/watchLater/{videoId}

videoComments/{videoId}/comments/{commentId}


This allows each authenticated user to have their own:

Watch History
Liked Videos
Subscriptions
Watch Later videos
🎬 Shorts Architecture

The Shorts section uses the YouTube IFrame Player API with a vertical scrolling interface.

A rolling three-state preload system is implemented:

Active
  ↓
Preload
  ↓
Idle


Only videos around the currently active Short create actual YouTube players. This reduces unnecessary player creation and improves scrolling performance.

The implementation also uses:

IntersectionObserver
CSS scroll-snap
Player lifecycle management
Retry handling
Loading timeout
Stale callback protection
Dynamic preload window
Important Technical Challenge

One of the major challenges was handling the YouTube IFrame Player API because YT.Player() replaces its target DOM element.

The solution was to create a fresh, non-React-managed DOM node inside a stable wrapper whenever a player needs to be created.

This prevents stale DOM references and fixes player recreation/loading issues during Shorts scrolling.

💬 Comments

The project uses a hybrid comment system.

YouTube Comments

YouTube comments are fetched using the YouTube Data API and displayed as read-only comments.

Local Comments

User-created comments are stored in Firestore:

videoComments/
  └── videoId/
      └── comments/
          └── commentId


Comments posted through the application are not published to YouTube.

❤️ Like / Dislike / Subscribe

The project provides YouTube-style interaction features.

Like

Authenticated users can save liked videos to Firestore.

Dislike

Dislike is handled locally in the application because YouTube's public API does not provide public dislike-count functionality.

Subscribe

Subscriptions are stored inside the authenticated user's Firestore collection.

users/{uid}/subscriptions/{channelId}

📜 Watch History

When an authenticated user watches a video, the video information can be stored in:

users/{uid}/history/{videoId}


The History page reads this information from Firestore and displays the user's watch history.

♾️ Infinite Scrolling

Home, Search, and Channel pages support infinite scrolling.

The application uses YouTube API pagination through:

nextPageToken


New results are loaded when the user reaches the end of the current feed.

Client-side deduplication is also used to prevent duplicate videos.

⚡ Performance & API Optimization

Several techniques are used to reduce unnecessary API requests:

Client-side video ID deduplication
Request caching
Pagination
API cooldown handling
Exponential backoff for HTTP 429 errors
Shorts player preload window
Module-level cache
sessionStorage state preservation
API Rate Limit Handling

When the YouTube API returns a 429 response, the application applies an exponential cooldown strategy instead of continuously sending requests.

429 Error
   ↓
Cooldown
   ↓
Retry with Backoff
   ↓
Successful Request

🌙 Dark / Light Mode

The application supports both:

☀️ Light Mode
🌙 Dark Mode

Tailwind CSS's class-based dark mode is used for theme styling.

📱 Responsive Design

The UI is designed to work across:

💻 Desktop
📱 Mobile
📲 Tablet

Tailwind CSS responsive utilities are used throughout the application.

🧠 React Concepts Used

This project demonstrates several important React concepts:

Components
Props
useState
useEffect
useRef
useCallback
Context API
Custom Hooks
Conditional Rendering
Event Handling
React Router
Query Parameters
Component Lifecycle
API Integration
Custom Hook
useAuth()


is used to access authentication state throughout the application.

🚀 Getting Started
Prerequisites

Make sure you have installed:

Node.js
npm
A Google Cloud project
YouTube Data API v3
Firebase project
Installation

Clone the repository:

git clone <YOUR_REPOSITORY_URL>


Navigate to the project:

cd youtube-clone


Install dependencies:

npm install

🔑 Environment Variables

Create a .env file in the root directory.

REACT_APP_YOUTUBE_API_KEY=your_youtube_api_key

REACT_APP_FIREBASE_API_KEY=your_firebase_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
REACT_APP_FIREBASE_PROJECT_ID=your_firebase_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
REACT_APP_FIREBASE_APP_ID=your_firebase_app_id


⚠️ Never commit your .env file or private credentials to GitHub.

▶️ Run the Project

Start the development server:

npm start


The application will run locally in your browser.

⚙️ Firebase Setup
Create a Firebase project.
Enable Authentication.
Enable Google Sign-In.
Create a Firestore Database.
Register a Web App.
Add Firebase configuration values to .env.
Configure appropriate Firestore security rules.
🔵 YouTube API Setup
Open Google Cloud Console.
Create or select a project.
Enable YouTube Data API v3.
Create an API key.
Add the API key to your .env file.
📸 Screenshots

Add screenshots of your project here:

screenshots/
├── home.png
├── search.png
├── watch.png
├── channel.png
├── shorts.png
└── dark-mode.png

🔮 Future Improvements
Move YouTube API requests behind a backend proxy
Add server-side caching
Add automated tests
Improve API quota optimization
Add more advanced recommendation logic
Improve accessibility
Add real YouTube write-scope integration if required and approved
Add deployment with CI/CD
⚠️ Project Limitations
Likes are stored in Firestore and are not synced with YouTube.
Subscriptions are stored in Firestore and are not synced with YouTube.
Comments posted through the application are stored locally in Firestore.
Watch History is application-specific and is not YouTube watch history.
No custom backend server is currently used.
The YouTube API key is used from the frontend and should ideally be protected through a backend proxy for a production application.
Automated tests are not currently included.
📚 Learning Objectives

This project was created to practice and demonstrate:

React.js development
REST API integration
YouTube API integration
Firebase Authentication
Firestore database operations
React Router
Tailwind CSS
Infinite scrolling
API error handling
Client-side caching
Video player lifecycle management
Responsive UI development
👨‍💻 Author

Your Name

Built with ❤️ using React.js, Firebase, YouTube Data API v3, and Cloud AI.

📄 License

This project is created for educational and portfolio purposes.
