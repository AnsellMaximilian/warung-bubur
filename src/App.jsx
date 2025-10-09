import { useEffect, useState } from "react";
import "./App.css";
import { account } from "./lib/appwrite.js";
import Register from "./pages/Register.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";

const LoadingScreen = () => (
  <main className="grid min-h-screen place-items-center bg-slate-900 text-slate-100">
    <div className="flex flex-col items-center gap-3">
      <svg
        className="h-10 w-10 animate-spin text-pink-400"
        viewBox="0 0 24 24"
        fill="none"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
        />
      </svg>
      <p className="text-sm text-slate-300">Checking session…</p>
    </div>
  </main>
);

export default function App() {
  const [activeView, setActiveView] = useState("register");
  const [currentUser, setCurrentUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [fallbackEmailHint, setFallbackEmailHint] = useState(null);
  const [rememberedEmail, setRememberedEmail] = useState("");

  useEffect(() => {
    let mounted = true;

    const loadSession = async () => {
      try {
        const user = await account.get();
        if (!mounted) return;
        setCurrentUser(user);
        setFallbackEmailHint(null);
        setRememberedEmail(user.email || "");
        setActiveView("dashboard");
      } catch {
        if (!mounted) return;
        setCurrentUser(null);
      } finally {
        if (mounted) setCheckingSession(false);
      }
    };

    loadSession();

    return () => {
      mounted = false;
    };
  }, []);

  const handleRegistrationSuccess = ({ user, fallbackEmail }) => {
    setCurrentUser(user);
    setFallbackEmailHint(fallbackEmail);
    setRememberedEmail(fallbackEmail || user.email || "");
    setActiveView("dashboard");
  };

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    setFallbackEmailHint(null);
    setRememberedEmail(user.email || "");
    setActiveView("dashboard");
  };

  const handleLogout = async () => {
    try {
      await account.deleteSession("current");
    } catch {
      // If session deletion fails, proceed with local cleanup.
    } finally {
      setCurrentUser(null);
      setActiveView("login");
    }
  };

  if (checkingSession) {
    return <LoadingScreen />;
  }

  if (currentUser) {
    return (
      <Dashboard
        user={currentUser}
        onLogout={handleLogout}
        fallbackEmailHint={fallbackEmailHint}
      />
    );
  }

  if (activeView === "login") {
    return (
      <Login
        onSuccess={handleLoginSuccess}
        onSwitchToRegister={() => setActiveView("register")}
        defaultEmail={rememberedEmail}
      />
    );
  }

  return (
    <Register
      onSuccess={handleRegistrationSuccess}
      onSwitchToLogin={() => setActiveView("login")}
    />
  );
}
