import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { account } from "../lib/appwrite.js";

const blankForm = {
  email: "",
  password: "",
};

export default function Login({
  onSuccess = () => {},
  onSwitchToRegister = () => {},
  defaultEmail,
}) {
  const [formData, setFormData] = useState({
    ...blankForm,
    email: defaultEmail || "",
  });
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setFormData((current) => ({
      ...current,
      email: defaultEmail || "",
    }));
  }, [defaultEmail]);

  const updateField = (field) => (event) => {
    setFormData((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");

    if (!formData.email.trim() || !formData.password) {
      setFormError("Email and password are required.");
      return;
    }

    setSubmitting(true);
    try {
      await account.createEmailPasswordSession(
        formData.email.trim(),
        formData.password
      );
      const user = await account.get();
      setFormData(blankForm);
      onSuccess(user);
    } catch (error) {
      const message =
        error?.message ||
        "Login failed. Confirm your credentials or recreate the account.";
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-rose-50 py-16 text-slate-900">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-8 px-4 sm:px-8">
        <header className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Welcome back
          </h1>
          <p className="mt-3 text-sm text-slate-600 sm:text-base">
            Sign in with the credentials you used during registration.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-lg">
          <form
            className="relative flex flex-col gap-6 p-6 sm:p-10"
            onSubmit={handleSubmit}
          >          {submitting && (
            <div className="absolute inset-0 grid place-items-center rounded-2xl bg-white/60">
              <svg className="h-8 w-8 animate-spin text-rose-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            </div>
          )}
            {formError ? (
              <div className="rounded-lg border border-pink-500/40 bg-pink-500/10 px-4 py-3 text-sm text-pink-200">
                {formError}
              </div>
            ) : null}

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={updateField("email")}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-rose-300 focus:ring-2 focus:ring-rose-300/40"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                className="text-sm font-medium text-slate-700"
                htmlFor="password"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="Your password"
                value={formData.password}
                onChange={updateField("password")}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-rose-300 focus:ring-2 focus:ring-rose-300/40"
                required
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 inline-flex items-center justify-center rounded-lg bg-rose-200 px-5 py-2.5 text-sm font-semibold text-rose-900 shadow-lg shadow-rose-200/40 transition hover:bg-rose-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300 disabled:cursor-not-allowed disabled:bg-rose-200/70"
            >
              {submitting ? "Signing in..." : "Sign In"}
            </button>

            <p className="text-xs text-slate-400">
              Need an account?{" "}
              <button
                type="button"
                className="font-medium text-pink-300 underline-offset-4 hover:underline"
                onClick={onSwitchToRegister}
              >
                Register now
              </button>
            </p>
          </form>
        </section>
      </div>
    </main>
  );
}

Login.propTypes = {
  onSuccess: PropTypes.func,
  onSwitchToRegister: PropTypes.func,
  defaultEmail: PropTypes.string,
};



