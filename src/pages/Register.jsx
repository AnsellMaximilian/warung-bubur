import { useState } from "react";
import { ID } from "appwrite";
import { account } from "../lib/appwrite.js";

const blankForm = {
  name: "",
  phone: "",
  email: "",
  password: "",
  confirmPassword: "",
};

const fallbackEmailFromPhone = (phone) => {
  const digits = phone.replace(/\D/g, "") || `user-${Date.now()}`;
  return `user-${digits}@appwrite.local`;
};

export default function Register({
  onSuccess = () => {},
  onSwitchToLogin = () => {},
}) {
  const [formData, setFormData] = useState(blankForm);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const updateField = (field) => (event) => {
    setFormData((current) => ({ ...current, [field]: event.target.value }));
    if (errors[field]) {
      setErrors((current) => {
        const next = { ...current };
        delete next[field];
        return next;
      });
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = {};

    if (!formData.name.trim()) {
      nextErrors.name = "Name is required.";
    }
    if (!formData.phone.trim()) {
      nextErrors.phone = "Phone number is required.";
    }
    if (!formData.password) {
      nextErrors.password = "Password is required.";
    }
    if (formData.password && formData.password.length < 8) {
      nextErrors.password = "Password must be at least 8 characters.";
    }
    if (formData.password !== formData.confirmPassword) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setFormError("");
    setSubmitting(true);

    const trimmedEmail = formData.email.trim();
    const emailToUse = trimmedEmail || fallbackEmailFromPhone(formData.phone);
    const usedFallback = !trimmedEmail;

    try {
      await account.create(
        ID.unique(),
        emailToUse,
        formData.password,
        formData.name.trim()
      );

      await account.createEmailPasswordSession(emailToUse, formData.password);

      if (formData.phone.trim()) {
        try {
          await account.updatePreferences({ phone: formData.phone.trim() });
        } catch {
          // Ignore preference update failures; user can retry later.
        }
      }

      const user = await account.get();
      setFormData(blankForm);
      onSuccess({
        user,
        fallbackEmail: usedFallback ? emailToUse : null,
      });
    } catch (error) {
      const message =
        error?.message ||
        "Registration failed. Check your Appwrite configuration and try again.";
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-900/95 py-16 text-slate-100">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 sm:px-8">
        <header className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Create an Appwrite Account
          </h1>
          <p className="mt-3 text-sm text-slate-300 sm:text-base">
            Provide your details below. Email is optional; phone verification
            is required to activate access.
          </p>
        </header>

        <section className="rounded-2xl border border-white/10 bg-slate-900/80 shadow-2xl backdrop-blur">
          <form
            className="flex flex-col gap-6 p-6 sm:p-10"
            onSubmit={handleSubmit}
            noValidate
          >
            {formError ? (
              <div className="rounded-lg border border-pink-500/40 bg-pink-500/10 px-4 py-3 text-sm text-pink-200">
                {formError}
              </div>
            ) : null}

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-200" htmlFor="name">
                Full Name
              </label>
              <input
                id="name"
                name="name"
                placeholder="Ada Lovelace"
                className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-500/40"
                value={formData.name}
                onChange={updateField("name")}
                required
              />
              {errors.name ? (
                <p className="text-xs text-pink-300">{errors.name}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-200" htmlFor="phone">
                Phone Number
              </label>
              <input
                id="phone"
                name="phone"
                placeholder="+1 555 123 4567"
                className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-500/40"
                value={formData.phone}
                onChange={updateField("phone")}
                required
              />
              {errors.phone ? (
                <p className="text-xs text-pink-300">{errors.phone}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-200" htmlFor="email">
                Email (optional)
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-500/40"
                value={formData.email}
                onChange={updateField("email")}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                className="text-sm font-medium text-slate-200"
                htmlFor="password"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                placeholder="At least 8 characters"
                className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-500/40"
                value={formData.password}
                onChange={updateField("password")}
                required
              />
              {errors.password ? (
                <p className="text-xs text-pink-300">{errors.password}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                className="text-sm font-medium text-slate-200"
                htmlFor="confirmPassword"
              >
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="Repeat your password"
                className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-500/40"
                value={formData.confirmPassword}
                onChange={updateField("confirmPassword")}
                required
              />
              {errors.confirmPassword ? (
                <p className="text-xs text-pink-300">{errors.confirmPassword}</p>
              ) : null}
            </div>

            <button
              type="submit"
              className="mt-2 inline-flex items-center justify-center rounded-lg bg-pink-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-pink-500/30 transition hover:bg-pink-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-300 disabled:cursor-not-allowed disabled:bg-pink-500/50"
              disabled={submitting}
            >
              {submitting ? "Creating account..." : "Create Account"}
            </button>

            <p className="text-xs text-slate-400">
              Already registered?{" "}
              <button
                type="button"
                className="font-medium text-pink-300 underline-offset-4 hover:underline"
                onClick={onSwitchToLogin}
              >
                Log in instead
              </button>
            </p>
          </form>
        </section>
      </div>
    </main>
  );
}
