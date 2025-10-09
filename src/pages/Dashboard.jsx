export default function Dashboard({
  user,
  onLogout = () => {},
  fallbackEmailHint,
}) {
  return (
    <main className="min-h-screen bg-slate-900/95 py-16 text-slate-100">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 sm:px-10">
        <header className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Dashboard
            </h1>
            <p className="mt-2 text-sm text-slate-300 sm:text-base">
              You are authenticated with Appwrite. Use this space to manage
              upcoming features.
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

        {fallbackEmailHint ? (
          <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            <strong className="font-semibold">Heads up:</strong> You registered
            without an email. Use{" "}
            <span className="font-mono text-amber-50">{fallbackEmailHint}</span>{" "}
            as your sign-in email when logging in from another device.
          </div>
        ) : null}

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

          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-slate-400">
              Phone
            </span>
            <span className="text-lg font-medium text-white">
              {user.prefs?.phone || "Not captured"}
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-slate-400">
              User ID
            </span>
            <span className="text-lg font-medium text-white font-mono">
              {user.$id}
            </span>
          </div>
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
