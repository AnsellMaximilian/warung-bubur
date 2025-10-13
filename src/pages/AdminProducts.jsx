import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router";
import { ID, Query } from "appwrite";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { databases } from "../lib/appwrite.js";
import { formatRupiah } from "../lib/formatters.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const databaseId = import.meta.env.VITE_APPWRITE_DATABASE_ID;
const productsCollectionId = import.meta.env
  .VITE_APPWRITE_PRODUCTS_COLLECTION_ID;

const emptyProductForm = {
  name: "",
  price: "",
  status: true,
};

export default function AdminProducts({
  onLogout = () => {},
}) {
  const navigate = useNavigate();

  const queryClient = useQueryClient();
  const productsQueryKey = ["products", databaseId, productsCollectionId];
  const [saving, setSaving] = useState(false);
  const [createForm, setCreateForm] = useState(() => ({ ...emptyProductForm }));
  const [createError, setCreateError] = useState("");
  const [editingProduct, setEditingProduct] = useState(null);
  const [editError, setEditError] = useState("");

  const isConfigReady = useMemo(
    () => Boolean(databaseId && productsCollectionId),
    [],
  );

  const {
    data: products = [],
    isPending: productsPending,
    isFetching: productsFetching,
    error: productsError,
    refetch: refetchProducts,
  } = useQuery({
    queryKey: productsQueryKey,
    enabled: isConfigReady,
    queryFn: async () => {
      try {
        const response = await databases.listDocuments(
          databaseId,
          productsCollectionId,
          [Query.orderAsc("$createdAt")],
        );
        return response.documents;
      } catch (err) {
        const message =
          err?.message ||
          "Unable to load products. Verify collection permissions and IDs.";
        throw new Error(message);
      }
    },
  });

  const loading = productsPending || (productsFetching && products.length === 0);
  const refreshProducts = () => refetchProducts({ throwOnError: false });
  const loadError = productsError?.message ?? "";

  const normalizeStatusValue = (value) => {
    if (typeof value === "boolean") return value;
    if (value === "true" || value === "active") return true;
    if (value === "false" || value === "inactive") return false;
    return Boolean(value);
  };

  const updateCreateField = (field) => (event) => {
    const value =
      field === "status"
        ? normalizeStatusValue(event.target.value)
        : event.target.value;
    setCreateForm((current) => ({ ...current, [field]: value }));
  };

  const updateEditField = (field) => (event) => {
    const value =
      field === "status"
        ? normalizeStatusValue(event.target.value)
        : event.target.value;
    setEditingProduct((current) =>
      current ? { ...current, [field]: value } : current,
    );
  };

  const parsePrice = (price) => {
    const value = Number.parseInt(price, 10);
    if (Number.isNaN(value) || value < 0) {
      return null;
    }
    return value;
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    setCreateError("");

    const trimmedName = createForm.name.trim();
    const parsedPrice = parsePrice(createForm.price);

    if (!trimmedName) {
      setCreateError("Name is required.");
      return;
    }

    if (parsedPrice === null) {
      setCreateError("Enter a price of zero or more (whole rupiah).");
      return;
    }

    setSaving(true);

    try {
      const createdProduct = await databases.createDocument(
        databaseId,
        productsCollectionId,
        ID.unique(),
        {
          name: trimmedName,
          price: parsedPrice,
          status: Boolean(createForm.status),
        },
      );
      setCreateForm({ ...emptyProductForm });
      if (isConfigReady) {
        queryClient.setQueryData(productsQueryKey, (current) => {
          if (!current || !Array.isArray(current)) {
            return [createdProduct];
          }
          const exists = current.some(
            (product) => product.$id === createdProduct.$id,
          );
          if (exists) {
            return current.map((product) =>
              product.$id === createdProduct.$id ? createdProduct : product,
            );
          }
          return [...current, createdProduct];
        });
      }
    } catch (err) {
      const message =
        err?.message ||
        "Unable to create product. Confirm collection permissions.";
      setCreateError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleEditStart = (product) => {
    setEditingProduct({
      id: product.$id,
      name: product.name ?? "",
      price:
        typeof product.price === "number"
          ? product.price.toString()
          : (product.price ?? ""),
      status: normalizeStatusValue(product.status ?? true),
    });
    setEditError("");
  };

  const handleEditCancel = () => {
    setEditingProduct(null);
    setEditError("");
  };

  const handleUpdate = async (event) => {
    event.preventDefault();
    if (!editingProduct) return;

    const trimmedName = editingProduct.name.trim();
    const parsedPrice = parsePrice(editingProduct.price);

    if (!trimmedName) {
      setEditError("Name is required.");
      return;
    }

    if (parsedPrice === null) {
      setEditError("Enter a valid price in whole rupiah.");
      return;
    }

    setSaving(true);
    try {
      const updatedProduct = await databases.updateDocument(
        databaseId,
        productsCollectionId,
        editingProduct.id,
        {
          name: trimmedName,
          price: parsedPrice,
          status: Boolean(editingProduct.status),
        },
      );
      setEditingProduct(null);
      if (isConfigReady) {
        queryClient.setQueryData(productsQueryKey, (current) => {
          if (!current || !Array.isArray(current)) {
            return [updatedProduct];
          }
          return current.map((product) =>
            product.$id === updatedProduct.$id ? updatedProduct : product,
          );
        });
      }
    } catch (err) {
      const message =
        err?.message ||
        "Unable to update product. Check permissions and try again.";
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
            Define `VITE_APPWRITE_DATABASE_ID` and
            `VITE_APPWRITE_PRODUCTS_COLLECTION_ID` in your environment before
            managing products.
          </p>
          <div className="flex justify-center gap-3">
            <button
              type="button"
              className="rounded-md border border-white/20 px-3 py-2 text-sm text-white"
              onClick={() => navigate("/dashboard")}
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
              Product Catalog
            </h1>
            <p className="mt-2 text-sm text-slate-300 sm:text-base">
              Create, update, or deactivate products offered in the daily menu.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
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

        <section className="rounded-2xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl backdrop-blur">
          <h2 className="text-lg font-semibold text-white">Add product</h2>
          <form
            className="mt-4 grid gap-4 sm:grid-cols-[2fr_1fr_1fr]"
            onSubmit={handleCreate}
          >
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-200">Name</span>
              <input
                type="text"
                value={createForm.name}
                onChange={updateCreateField("name")}
                className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-500/40"
                placeholder="Iced Latte"
                required
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-200">Price</span>
              <input
                type="number"
                step="1"
                min="0"
                value={createForm.price}
                onChange={updateCreateField("price")}
                className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-500/40"
                placeholder="15000"
                required
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-200">Status</span>
              <select
                value={createForm.status ? "true" : "false"}
                onChange={updateCreateField("status")}
                className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-500/40"
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </label>

            {createError ? (
              <div className="sm:col-span-3 rounded-lg border border-pink-500/40 bg-pink-500/10 px-4 py-3 text-sm text-pink-200">
                {createError}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={saving}
              className="sm:col-span-3 inline-flex items-center justify-center rounded-lg bg-pink-500 px-4 py-2 text-sm font-semibold text-white shadow shadow-pink-500/30 transition hover:bg-pink-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-300 disabled:cursor-not-allowed disabled:bg-pink-500/50"
            >
              {saving ? "Saving..." : "Create product"}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-white">
              Existing products
            </h2>
            <button
              type="button"
              onClick={refreshProducts}
              className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-slate-200 transition hover:border-white/30"
            >
              Refresh
            </button>
          </div>

          {loadError ? (
            <p className="mt-4 rounded-lg border border-pink-500/40 bg-pink-500/10 px-4 py-3 text-sm text-pink-200">
              {loadError}
            </p>
          ) : null}

          {loading ? (
            <p className="mt-4 text-sm text-slate-300">Loading products…</p>
          ) : products.length === 0 ? (
            <p className="mt-4 text-sm text-slate-300">
              No products yet. Add your first item above.
            </p>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full divide-y divide-white/5 text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Price</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-200">
                  {products.map((product) => {
                    const isActive = normalizeStatusValue(
                      product.status ?? true,
                    );
                    return (
                      <tr key={product.$id}>
                        <td className="px-3 py-2">{product.name}</td>
                        <td className="px-3 py-2">
                          {formatRupiah(product.price)}
                        </td>
                        <td className="px-3 py-2">
                          {isActive ? (
                            <span className="rounded-md bg-emerald-500/20 px-2 py-1 text-xs text-emerald-200">
                              Active
                            </span>
                          ) : (
                            <span className="rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-300">
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            className="text-sm font-medium text-pink-300 underline-offset-4 hover:underline"
                            onClick={() => handleEditStart(product)}
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <Dialog
          open={Boolean(editingProduct)}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              handleEditCancel();
            }
          }}
        >
          <DialogContent className="border-white/10 bg-slate-900/95 text-slate-100 shadow-2xl backdrop-blur-lg sm:max-w-xl">
            <DialogHeader>
              <DialogTitle className="text-white">Edit product</DialogTitle>
              <DialogDescription className="text-slate-300">
                Update product details and save your changes.
              </DialogDescription>
            </DialogHeader>

            {editingProduct ? (
              <form className="mt-2 grid gap-4" onSubmit={handleUpdate}>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-slate-200">Name</span>
                  <input
                    type="text"
                    value={editingProduct.name}
                    onChange={updateEditField("name")}
                    className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/40"
                    required
                  />
                </label>

                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-slate-200">Price</span>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={editingProduct.price}
                    onChange={updateEditField("price")}
                    className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/40"
                    required
                  />
                </label>

                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-slate-200">Status</span>
                  <select
                    value={editingProduct.status ? "true" : "false"}
                    onChange={updateEditField("status")}
                    className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/40"
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </label>

                {editError ? (
                  <div className="rounded-lg border border-pink-500/40 bg-pink-500/10 px-4 py-3 text-sm text-pink-200">
                    {editError}
                  </div>
                ) : null}

                <DialogFooter className="flex-col gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center justify-center rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow shadow-indigo-500/30 transition hover:bg-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-200 disabled:cursor-not-allowed disabled:bg-indigo-500/50"
                  >
                    {saving ? "Updating..." : "Save changes"}
                  </button>
                  <button
                    type="button"
                    onClick={handleEditCancel}
                    className="rounded-lg border border-white/20 px-4 py-2 text-sm text-slate-200 transition hover:border-white/40"
                  >
                    Cancel
                  </button>
                </DialogFooter>
              </form>
            ) : null}
          </DialogContent>
        </Dialog>
      </div>
    </main>
  );
}

AdminProducts.propTypes = {
  onLogout: PropTypes.func,
};
