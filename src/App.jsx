import { useCallback, useEffect, useState } from "react";
import "./App.css";
import { account, teams } from "./lib/appwrite.js";
import Register from "./pages/Register.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import AdminProducts from "./pages/AdminProducts.jsx";
import AdminMenus from "./pages/AdminMenus.jsx";
import AdminOrderItems from "./pages/AdminOrderItems.jsx";
import AdminOrders from "./pages/AdminOrders.jsx";
import CustomerMenu from "./pages/CustomerMenu.jsx";

const LoadingScreen = () => (
  <main className="grid min-h-screen place-items-center bg-rose-50 text-slate-100">
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
      <p className="text-sm text-slate-900">Checking session...</p>
    </div>
  </main>
);

const adminTeamId = import.meta.env.VITE_APPWRITE_ADMIN_TEAM_ID;

export default function App() {
  const [activeView, setActiveView] = useState("register");
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [rememberedEmail, setRememberedEmail] = useState("");

  const refreshAuthState = useCallback(async () => {
    try {
      const user = await account.get();
      let adminStatus = false;

      if (adminTeamId) {
        try {
          const memberships = await teams.listMemberships(adminTeamId);
          adminStatus =
            memberships?.memberships?.some(
              (membership) => membership.teamId === adminTeamId,
            ) ?? false;
        } catch {
          adminStatus = false;
        }
      }

      setCurrentUser(user);
      setIsAdmin(adminStatus);
      setRememberedEmail(user.email || "");
      setActiveView("dashboard");
    } catch {
      setCurrentUser(null);
      setIsAdmin(false);
    } finally {
      setCheckingSession(false);
    }
  }, []);

  useEffect(() => {
    refreshAuthState();
  }, [refreshAuthState]);

  useEffect(() => {
    const adminOnlyViews = [
      "admin-products",
      "admin-menus",
      "admin-order-items",
      "admin-orders",
    ];
    if (!isAdmin && adminOnlyViews.includes(activeView)) {
      setActiveView("dashboard");
    }
  }, [isAdmin, activeView]);

  const handleNavigate = (view) => {
    const adminOnlyViews = [
      "admin-products",
      "admin-menus",
      "admin-order-items",
      "admin-orders",
    ];
    if (!isAdmin && adminOnlyViews.includes(view)) {
      return;
    }
    setActiveView(view);
  };

  const handleRegistrationSuccess = async () => {
    setCheckingSession(true);
    await refreshAuthState();
  };

  const handleLoginSuccess = async () => {
    setCheckingSession(true);
    await refreshAuthState();
  };

  const handleLogout = async () => {
    try {
      await account.deleteSession("current");
    } catch {
      // Ignore logout errors; session may already be invalidated.
    } finally {
      setCurrentUser(null);
      setIsAdmin(false);
      setActiveView("login");
    }
  };

  if (checkingSession) {
    return <LoadingScreen />;
  }

  if (currentUser) {
    // Customers see the daily menu directly on dashboard
    if (!isAdmin && (activeView === "dashboard" || activeView === "menu")) {
      return (
        <CustomerMenu
          user={currentUser}
          isAdmin={isAdmin}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
        />
      );
    }
    if (activeView === "admin-products") {
      return (
        <AdminProducts onNavigate={handleNavigate} onLogout={handleLogout} />
      );
    }

    if (activeView === "admin-menus") {
      return <AdminMenus onNavigate={handleNavigate} onLogout={handleLogout} />;
    }

    if (activeView === "admin-order-items") {
      return (
        <AdminOrderItems
          onNavigate={handleNavigate}
          onLogout={handleLogout}
        />
      );
    }

    if (activeView === "admin-orders") {
      return (
        <AdminOrders onNavigate={handleNavigate} onLogout={handleLogout} />
      );
    }

    if (activeView === "menu") {
      return (
        <CustomerMenu
          user={currentUser}
          isAdmin={isAdmin}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
        />
      );
    }

    return (
      <Dashboard
        user={currentUser}
        isAdmin={isAdmin}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
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


