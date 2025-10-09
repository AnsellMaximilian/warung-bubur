import PropTypes from "prop-types";

export default function Dashboard({
  user,
  isAdmin = false,
  onNavigate = () => {},
  onLogout = () => {},
}) {
  return (
    <main className="min-h-screen bg-slate-900/95 py-16 text-slate-100">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 sm:px-10">
        <header className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Welcome, {user.name || "Guest"}
            </h1>
            <p className="mt-2 text-sm text-slate-300 sm:text-base">
              {isAdmin
                ? "You have administrator access. Manage products and menus below."
                : "Review your details and preorder from tomorrow’s menu."}
            </p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center justify-center rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white shadow hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-300"
          >
            Log out
          </button>
        </header>

        <section className="grid gap-6 rounded-2xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl backdrop-blur sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-slate-400">
              Name
            </span>
            <span className="text-lg font-medium text-white">{user.name}</span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-slate-400">
              Email
            </span>
            <span className="text-lg font-medium text-white">
              {user.email || "Not provided"}
            </span>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          {isAdmin ? (
            <>
              <button
                type="button"
                onClick={() => onNavigate("admin-products")}
                className="flex flex-col gap-2 rounded-2xl border border-pink-500/30 bg-pink-500/10 p-6 text-left transition hover:border-pink-400 hover:bg-pink-500/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-300"
              >
                <span className="text-lg font-semibold text-white">
                  Manage Products
                </span>
                <span className="text-sm text-pink-100">
                  Create, edit, or deactivate items available for daily menus.
                </span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate("admin-menus")}
                className="flex flex-col gap-2 rounded-2xl border border-indigo-400/30 bg-indigo-400/10 p-6 text-left transition hover:border-indigo-300 hover:bg-indigo-400/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-200"
              >
                <span className="text-lg font-semibold text-white">
                  Configure Menus
                </span>
                <span className="text-sm text-indigo-100">
                  Build tomorrow’s menu by selecting active products and publish
                  updates.
                </span>
              </button>
            </>
          ) : (
            <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-6 text-sm text-amber-100">
              You have customer access. Menu creation is handled by admins. Head
              to the daily menu to place your order.
            </div>
          )}

          <button
            type="button"
            onClick={() => onNavigate("menu")}
            className="flex flex-col gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-6 text-left transition hover:border-emerald-300 hover:bg-emerald-400/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200"
          >
            <span className="text-lg font-semibold text-white">
              View Daily Menu
            </span>
            <span className="text-sm text-emerald-100">
              Preview tomorrow’s offerings and place an order with the available
              products.
            </span>
          </button>
        </section>

        <section className="rounded-2xl border border-white/10 bg-slate-900/80 p-8 text-sm text-slate-300 shadow-2xl backdrop-blur">
          <h2 className="text-lg font-semibold text-white">Next steps</h2>
          <ul className="mt-3 space-y-2 text-slate-300">
            <li>
              Extend this view to show project resources fetched from Appwrite
              Databases or storage.
            </li>
            <li>
              Secure your `.env` file and configure Vite environment variables
              for production deployments.
            </li>
            <li>
              Add Vitest coverage for register/login flows once backend mocks
              are in place.
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}

Dashboard.propTypes = {
  user: PropTypes.shape({
    name: PropTypes.string,
    email: PropTypes.string,
    prefs: PropTypes.shape({
      phone: PropTypes.string,
    }),
    $id: PropTypes.string,
  }).isRequired,
  isAdmin: PropTypes.bool,
  onNavigate: PropTypes.func,
  onLogout: PropTypes.func,
};
