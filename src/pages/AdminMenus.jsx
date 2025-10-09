import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { ID, Query } from "appwrite";
import { databases } from "../lib/appwrite.js";

const databaseId = import.meta.env.VITE_APPWRITE_DATABASE_ID;
const productsCollectionId =
  import.meta.env.VITE_APPWRITE_PRODUCTS_COLLECTION_ID;
const menusCollectionId = import.meta.env.VITE_APPWRITE_MENUS_COLLECTION_ID;

const defaultMenuForm = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return {
    servingDate: tomorrow.toISOString().slice(0, 10),
    productIds: [],
    isPublished: true,
  };
};

export default function AdminMenus({
  onNavigate = () => {},
  onLogout = () => {},
}) {
  const [products, setProducts] = useState([]);
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(defaultMenuForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingMenu, setEditingMenu] = useState(null);
  const [editError, setEditError] = useState("");

  const isConfigReady = useMemo(
    () => Boolean(databaseId && productsCollectionId && menusCollectionId),
    []
  );

  const fetchProducts = async () => {
    try {
      const response = await databases.listDocuments(
        databaseId,
        productsCollectionId,
        [Query.orderAsc("name")]
      );
      setProducts(response.documents);
    } catch (err) {
      const message =
        err?.message ||
        "Unable to load products. Verify collection permissions and IDs.";
      setError(message);
    }
  };

  const fetchMenus = async () => {
    try {
      const response = await databases.listDocuments(
        databaseId,
        menusCollectionId,
        [Query.orderAsc("servingDate")]
      );
      setMenus(response.documents);
    } catch (err) {
      const message =
        err?.message ||
        "Unable to load menus. Confirm collection permissions and IDs.";
      setError(message);
    }
  };

  const bootstrap = async () => {
    if (!isConfigReady) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    await Promise.all([fetchProducts(), fetchMenus()]);

    setLoading(false);
  };

  useEffect(() => {
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const availableProducts = useMemo(
    () => products.filter((product) => product.isActive !== false),
    [products]
  );

  const toggleFormProduct = (productId) => {
    setFormError("");
    setForm((current) => {
      const exists = current.productIds.includes(productId);
      return {
        ...current,
        productIds: exists
          ? current.productIds.filter((id) => id !== productId)
          : [...current.productIds, productId],
      };
    });
  };

  const toggleEditProduct = (productId) => {
    setEditError("");
    setEditingMenu((current) => {
      if (!current) return current;
      const exists = current.productIds.includes(productId);
      return {
        ...current,
        productIds: exists
          ? current.productIds.filter((id) => id !== productId)
          : [...current.productIds, productId],
      };
    });
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    setFormError("");

    if (!form.servingDate) {
      setFormError("Pick a serving date.");
      return;
    }

    if (new Date(form.servingDate) < new Date().setHours(0, 0, 0, 0)) {
      setFormError("Menu date must be today or later.");
      return;
    }

    if (form.productIds.length === 0) {
      setFormError("Select at least one active product.");
      return;
    }

    setSaving(true);

    try {
      await databases.createDocument(
        databaseId,
        menusCollectionId,
        ID.unique(),
        {
          servingDate: form.servingDate,
          productIds: form.productIds,
          isPublished: Boolean(form.isPublished),
        }
      );
      setForm(defaultMenuForm());
      await fetchMenus();
    } catch (err) {
      const message =
        err?.message ||
        "Unable to create menu. Check permissions and avoid duplicate dates.";
      setFormError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleEditStart = (menu) => {
    setEditingMenu({
      id: menu.$id,
      servingDate: menu.servingDate ?? "",
      productIds: Array.isArray(menu.productIds) ? menu.productIds : [],
      isPublished: menu.isPublished !== false,
    });
    setEditError("");
  };

  const handleEditChange = (field) => (event) => {
    const value =
      field === "isPublished" ? event.target.checked : event.target.value;
    setEditingMenu((current) => (current ? { ...current, [field]: value } : current));
  };

  const handleEditCancel = () => {
    setEditingMenu(null);
    setEditError("");
  };

  const handleUpdate = async (event) => {
    event.preventDefault();
    if (!editingMenu) return;

    if (!editingMenu.servingDate) {
      setEditError("Serving date is required.");
      return;
    }

    if (editingMenu.productIds.length === 0) {
      setEditError("Select at least one product.");
      return;
    }

    setSaving(true);

    try {
      await databases.updateDocument(
        databaseId,
        menusCollectionId,
        editingMenu.id,
        {
          servingDate: editingMenu.servingDate,
          productIds: editingMenu.productIds,
          isPublished: Boolean(editingMenu.isPublished),
        }
      );
      setEditingMenu(null);
      await fetchMenus();
    } catch (err) {
      const message =
        err?.message ||
        "Unable to update the menu. Confirm permissions and try again.";
      setEditError(message);
    } finally {
      setSaving(false);
    }
  };

  if (!isConfigReady) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-900 text-slate-100">
        <div className="max-w-md space-y-4 rounded-2xl border border-white/10 bg-slate-900/80 p-6 text-center shadow-2xl backdrop-blur">
          <h1 className="text-2xl font-semibold text-white">Missing setup</h1>
          <p className="text-sm text-slate-300">
            Define `VITE_APPWRITE_DATABASE_ID`,
            `VITE_APPWRITE_PRODUCTS_COLLECTION_ID`, and
            `VITE_APPWRITE_MENUS_COLLECTION_ID` in your environment before
            managing daily menus.
          </p>
          <div className="flex justify-center gap-3">
            <button
              type="button"
              className="rounded-md border border-white/20 px-3 py-2 text-sm text-white"
              onClick={() => onNavigate("dashboard")}
            >
              Back to dashboard
            </button>
            <button
              type="button"
              className="rounded-md border border-pink-400/40 bg-pink-500/10 px-3 py-2 text-sm text-pink-100"
              onClick={onLogout}
            >
              Log out
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-900/95 py-16 text-slate-100">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 sm:px-10">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Daily Menus
            </h1>
            <p className="mt-2 text-sm text-slate-300 sm:text-base">
              Curate tomorrow’s offerings by selecting from the active product
              catalog.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => onNavigate("dashboard")}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white transition hover:border-white/30"
            >
              Back to dashboard
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white shadow hover:bg-slate-700"
            >
              Log out
            </button>
          </div>
        </header>

        {error ? (
          <section className="rounded-2xl border border-pink-500/40 bg-pink-500/10 p-6 text-sm text-pink-200 shadow-2xl backdrop-blur">
            {error}
          </section>
        ) : null}

        <section className="rounded-2xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-white">Create menu</h2>
            <button
              type="button"
              onClick={bootstrap}
              className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-slate-200 transition hover:border-white/30"
            >
              Refresh
            </button>
          </div>
          <form className="mt-4 space-y-6" onSubmit={handleCreate}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-slate-200">Serving date</span>
                <input
                  type="date"
                  value={form.servingDate}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      servingDate: event.target.value,
                    }))
                  }
                  className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/40"
                  required
                />
              </label>

              <label className="flex items-center gap-2 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={form.isPublished}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      isPublished: event.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-white/20 bg-slate-800 text-indigo-500 focus:ring-indigo-500/40"
                />
                Publish immediately
              </label>
            </div>

            <div>
              <span className="text-sm font-medium text-slate-200">
                Active products
              </span>
              {availableProducts.length === 0 ? (
                <p className="mt-2 text-xs text-slate-400">
                  No active products found. Enable items in the product catalog
                  first.
                </p>
              ) : (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {availableProducts.map((product) => (
                    <label
                      key={product.$id}
                      className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-800/80 p-3 text-sm text-slate-100"
                    >
                      <input
                        type="checkbox"
                        checked={form.productIds.includes(product.$id)}
                        onChange={() => toggleFormProduct(product.$id)}
                        className="h-4 w-4 rounded border-white/20 bg-slate-800 text-pink-500 focus:ring-pink-500/40"
                      />
                      <span>
                        <span className="block font-medium text-white">
                          {product.name}
                        </span>
                        <span className="text-xs text-slate-400">
                          {typeof product.price === "number"
                            ? `$${product.price.toFixed(2)}`
                            : product.price}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {formError ? (
              <div className="rounded-lg border border-pink-500/40 bg-pink-500/10 px-4 py-3 text-sm text-pink-200">
                {formError}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={saving || availableProducts.length === 0}
              className="inline-flex items-center justify-center rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow shadow-indigo-500/30 transition hover:bg-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-200 disabled:cursor-not-allowed disabled:bg-indigo-500/50"
            >
              {saving ? "Saving…" : "Save menu"}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl backdrop-blur">
          <h2 className="text-lg font-semibold text-white">Upcoming menus</h2>
          {loading ? (
            <p className="mt-4 text-sm text-slate-300">Loading menus…</p>
          ) : menus.length === 0 ? (
            <p className="mt-4 text-sm text-slate-300">
              No menus available yet. Create one above.
            </p>
          ) : (
            <div className="mt-6 space-y-4">
              {menus.map((menu) => {
                const productBadges = (menu.productIds || []).map((productId) => {
                  const product = products.find((item) => item.$id === productId);
                  return product
                    ? product.name
                    : `Unmapped product (${productId.slice(0, 6)}…)`;
                });

                return (
                  <div
                    key={menu.$id}
                    className="rounded-2xl border border-white/10 bg-slate-900/70 p-6"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="text-xl font-semibold text-white">
                          {menu.servingDate}
                        </h3>
                        <p className="text-xs uppercase tracking-wide text-slate-400">
                          {menu.isPublished === false ? "Draft" : "Published"}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="self-start rounded-md border border-white/20 px-3 py-1 text-xs text-pink-200 transition hover:border-white/40"
                        onClick={() => handleEditStart(menu)}
                      >
                        Edit
                      </button>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {productBadges.length === 0 ? (
                        <span className="text-sm text-slate-400">
                          No products linked.
                        </span>
                      ) : (
                        productBadges.map((name) => (
                          <span
                            key={name}
                            className="rounded-full border border-white/10 bg-slate-800 px-3 py-1 text-xs text-slate-200"
                          >
                            {name}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {editingMenu ? (
          <section className="rounded-2xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl backdrop-blur">
            <h2 className="text-lg font-semibold text-white">Edit menu</h2>
            <form className="mt-4 space-y-6" onSubmit={handleUpdate}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-slate-200">Serving date</span>
                  <input
                    type="date"
                    value={editingMenu.servingDate}
                    onChange={handleEditChange("servingDate")}
                    className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/40"
                    required
                  />
                </label>

                <label className="flex items-center gap-2 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={editingMenu.isPublished}
                    onChange={handleEditChange("isPublished")}
                    className="h-4 w-4 rounded border-white/20 bg-slate-800 text-emerald-500 focus:ring-emerald-500/40"
                  />
                  Published
                </label>
              </div>

              <div>
                <span className="text-sm font-medium text-slate-200">
                  Active products
                </span>
                {availableProducts.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-400">
                    No active products found. Enable items in the product catalog
                    first.
                  </p>
                ) : (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {availableProducts.map((product) => (
                      <label
                        key={product.$id}
                        className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-800/80 p-3 text-sm text-slate-100"
                      >
                        <input
                          type="checkbox"
                          checked={editingMenu.productIds.includes(product.$id)}
                          onChange={() => toggleEditProduct(product.$id)}
                          className="h-4 w-4 rounded border-white/20 bg-slate-800 text-emerald-500 focus:ring-emerald-500/40"
                        />
                        <span>
                          <span className="block font-medium text-white">
                            {product.name}
                          </span>
                          <span className="text-xs text-slate-400">
                            {typeof product.price === "number"
                              ? `$${product.price.toFixed(2)}`
                              : product.price}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {editError ? (
                <div className="rounded-lg border border-pink-500/40 bg-pink-500/10 px-4 py-3 text-sm text-pink-200">
                  {editError}
                </div>
              ) : null}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow shadow-emerald-500/30 transition hover:bg-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200 disabled:cursor-not-allowed disabled:bg-emerald-500/50"
                >
                  {saving ? "Updating…" : "Save changes"}
                </button>
                <button
                  type="button"
                  onClick={handleEditCancel}
                  className="rounded-lg border border-white/20 px-4 py-2 text-sm text-slate-200 transition hover:border-white/40"
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        ) : null}
      </div>
    </main>
  );
}

AdminMenus.propTypes = {
  onNavigate: PropTypes.func,
  onLogout: PropTypes.func,
};
