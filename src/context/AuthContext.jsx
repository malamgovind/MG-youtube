import { createContext, useContext, useEffect, useState } from "react";
import {
    onAuthStateChanged,
    signInWithPopup,
    signOut as firebaseSignOut,
} from "firebase/auth";
import { auth, googleProvider } from "../firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            setUser(firebaseUser);
            setAuthLoading(false);
        });
        return unsubscribe;
    }, []);

    const login = async () => {
        await signInWithPopup(auth, googleProvider);
    };

    // IMPORTANT: do NOT sign out before opening the picker. Calling
    // signOut() first, then awaiting signInWithPopup(), breaks the
    // synchronous "user gesture" chain in several browsers — the popup
    // gets silently blocked, and the user is left simply logged out with
    // no new sign-in window ever appearing.
    //
    // Firebase's web SDK only ever holds one current user at a time: a
    // successful signInWithPopup() with a different Google account
    // automatically replaces the previous session — no explicit signOut
    // needed. The provider's prompt: "select_account" (set in firebase.js)
    // still forces the account chooser to appear even while already
    // signed in.
    const switchAccount = async () => {
        await signInWithPopup(auth, googleProvider);
    };

    const logout = async () => {
        await firebaseSignOut(auth);
    };

    return (
        <AuthContext.Provider value={{ user, authLoading, login, logout, switchAccount }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}