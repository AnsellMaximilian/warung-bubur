import { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router";
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

const getPostLoginPath = (adminStatus) => (adminStatus ? "/dashboard" : "/menu");

function RequireAuth({ user, children }) {
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function RequireAdmin({ user, isAdmin, children }) {
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

const userPropType = PropTypes.shape({
  $id: PropTypes.string,
  name: PropTypes.string,
  email: PropTypes.string,
});

RequireAuth.propTypes = {
  user: userPropType,
  children: PropTypes.node.isRequired,
};

RequireAdmin.propTypes = {
  user: userPropType,
  isAdmin: PropTypes.bool.isRequired,
  children: PropTypes.node.isRequired,
};

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [rememberedEmail, setRememberedEmail] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  const refreshAuthState = useCallback(async () => {
    setCheckingSession(true);
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
      return { user, adminStatus };
    } catch {
      setCurrentUser(null);
      setIsAdmin(false);
      return { user: null, adminStatus: false };
    } finally {
      setCheckingSession(false);
    }
  }, []);

  useEffect(() => {
    refreshAuthState();
  }, [refreshAuthState]);

  useEffect(() => {
    if (checkingSession) {
      return;
    }
    if (!currentUser) {
      return;
    }
    if (!isAdmin && location.pathname.startsWith("/admin")) {
      navigate("/dashboard", { replace: true });
    }
  }, [checkingSession, currentUser, isAdmin, location.pathname, navigate]);

  const handleRegistrationSuccess = async () => {
    const { user: refreshedUser, adminStatus } = await refreshAuthState();
    if (refreshedUser) {
      navigate(getPostLoginPath(adminStatus), { replace: true });
    }
  };

  const handleLoginSuccess = async () => {
    const { user: refreshedUser, adminStatus } = await refreshAuthState();
    if (refreshedUser) {
      navigate(getPostLoginPath(adminStatus), { replace: true });
    }
  };

  const handleLogout = async () => {
    try {
      await account.deleteSession("current");
    } catch {
      // Ignore logout errors; session may already be invalidated.
    } finally {
      setCurrentUser(null);
      setIsAdmin(false);
      setCheckingSession(false);
      navigate("/login", { replace: true });
    }
  };

  if (checkingSession) {
    return <LoadingScreen />;
  }

  const defaultAuthenticatedPath = getPostLoginPath(isAdmin);

  return (
    <Routes>
      <Route
        path="/"
        element={
          currentUser ? (
            <Navigate to={defaultAuthenticatedPath} replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      <Route
        path="/login"
        element={
          currentUser ? (
            <Navigate to={defaultAuthenticatedPath} replace />
          ) : (
            <Login
              onSuccess={handleLoginSuccess}
              onSwitchToRegister={() => navigate("/register")}
              defaultEmail={rememberedEmail}
            />
          )
        }
      />

      <Route
        path="/register"
        element={
          currentUser ? (
            <Navigate to={defaultAuthenticatedPath} replace />
          ) : (
            <Register
              onSuccess={handleRegistrationSuccess}
              onSwitchToLogin={() => navigate("/login")}
            />
          )
        }
      />

      <Route
        path="/dashboard"
        element={
          <RequireAuth user={currentUser}>
            {isAdmin ? (
              <Dashboard user={currentUser} isAdmin={isAdmin} onLogout={handleLogout} />
            ) : (
              <CustomerMenu
                user={currentUser}
                isAdmin={isAdmin}
                onLogout={handleLogout}
              />
            )}
          </RequireAuth>
        }
      />

      <Route
        path="/menu"
        element={
          <RequireAuth user={currentUser}>
            <CustomerMenu user={currentUser} isAdmin={isAdmin} onLogout={handleLogout} />
          </RequireAuth>
        }
      />

      <Route
        path="/admin/products"
        element={
          <RequireAdmin user={currentUser} isAdmin={isAdmin}>
            <AdminProducts onLogout={handleLogout} />
          </RequireAdmin>
        }
      />

      <Route
        path="/admin/menus"
        element={
          <RequireAdmin user={currentUser} isAdmin={isAdmin}>
            <AdminMenus onLogout={handleLogout} />
          </RequireAdmin>
        }
      />

      <Route
        path="/admin/order-items"
        element={
          <RequireAdmin user={currentUser} isAdmin={isAdmin}>
            <AdminOrderItems onLogout={handleLogout} />
          </RequireAdmin>
        }
      />

      <Route
        path="/admin/orders"
        element={
          <RequireAdmin user={currentUser} isAdmin={isAdmin}>
            <AdminOrders onLogout={handleLogout} />
          </RequireAdmin>
        }
      />

      <Route
        path="*"
        element={
          currentUser ? (
            <Navigate to={defaultAuthenticatedPath} replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
}
