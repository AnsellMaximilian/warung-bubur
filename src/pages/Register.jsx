import { useState } from "react";
import PropTypes from "prop-types";
import { ID } from "appwrite";
import { account } from "../lib/appwrite.js";

const blankForm = {
  name: "",
  phone: "",
  email: "",
  password: "",
  confirmPassword: "",
};

const emailPattern =
  /^[^\s@]+@[a-zA-Z0-9._-]+\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})*$/;

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
    const trimmedEmail = formData.email.trim();
    if (!trimmedEmail) {
      nextErrors.email = "Email is required.";
    } else if (!emailPattern.test(trimmedEmail)) {
      nextErrors.email = "Enter a valid email with an active domain.";
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

    try {
      await account.create(
        ID.unique(),
        trimmedEmail,
        formData.password,
        formData.name.trim()
      );

      await account.createEmailPasswordSession(
        trimmedEmail,
        formData.password
      );

      if (formData.phone.trim()) {
        try {
          await account.updatePreferences({ phone: formData.phone.trim() });
        } catch {
          // Ignore optional preference update failures.
        }
      }

      const user = await account.get();
      setFormData(blankForm);
      onSuccess(user);
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
    <main className="min-h-screen bg-rose-50 py-16 text-slate-900">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 sm:px-8">
        <header className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Create an Appwrite Account
          </h1>
          <p className="mt-3 text-sm text-slate-600 sm:text-base">
            Provide your details below. Email is required to activate access;
            phone helps us contact you for order updates.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-lg">
          <form
            className="relative flex flex-col gap-6 p-6 sm:p-10"
            onSubmit={handleSubmit}
            noValidate
          >
            {formError ? (
              <div className="rounded-lg border border-pink-500/40 bg-pink-500/10 px-4 py-3 text-sm text-pink-200">
                {formError}
              </div>
            ) : null}

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700" htmlFor="name">
                Full Name
              </label>
              <input
                id="name"
                name="name"
                placeholder="Ada Lovelace"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-rose-300 focus:ring-2 focus:ring-rose-300/40"
                value={formData.name}
                onChange={updateField("name")}
                required
              />
              {errors.name ? (
                <p className="text-xs text-rose-700">{errors.name}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-rose-300 focus:ring-2 focus:ring-rose-300/40"
                value={formData.email}
                onChange={updateField("email")}
                required
              />
              {errors.email ? (
                <p className="text-xs text-rose-700">{errors.email}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700" htmlFor="phone">
                Phone Number (optional)
              </label>
              <input
                id="phone"
                name="phone"
                placeholder="+1 555 123 4567"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-rose-300 focus:ring-2 focus:ring-rose-300/40"
                value={formData.phone}
                onChange={updateField("phone")}
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
                placeholder="At least 8 characters"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-rose-300 focus:ring-2 focus:ring-rose-300/40"
                value={formData.password}
                onChange={updateField("password")}
                required
              />
              {errors.password ? (
                <p className="text-xs text-rose-700">{errors.password}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                className="text-sm font-medium text-slate-700"
                htmlFor="confirmPassword"
              >
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="Repeat your password"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-rose-300 focus:ring-2 focus:ring-rose-300/40"
                value={formData.confirmPassword}
                onChange={updateField("confirmPassword")}
                required
              />
              {errors.confirmPassword ? (
                <p className="text-xs text-rose-700">{errors.confirmPassword}</p>
              ) : null}
            </div>

            <button
              type="submit"
              className="mt-2 inline-flex items-center justify-center rounded-lg bg-pink-500 px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-lg shadow-pink-500/30 transition hover:bg-pink-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-300 disabled:cursor-not-allowed disabled:bg-pink-500/50"
              disabled={submitting}
            >
              {submitting ? "Creating account..." : "Create Account"}
            </button>

            <p className="text-xs text-slate-500">
              Already registered?{" "}
              <button
                type="button"
                className="font-medium text-rose-700 underline-offset-4 hover:underline"
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

Register.propTypes = {
  onSuccess: PropTypes.func,
  onSwitchToLogin: PropTypes.func,
};

