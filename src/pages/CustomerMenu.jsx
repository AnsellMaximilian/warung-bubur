import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { ID, Query } from "appwrite";
import { databases } from "../lib/appwrite.js";
import { formatRupiah } from "../lib/formatters.js";
import { formatMenuDate } from "../lib/utils.js";

const databaseId = import.meta.env.VITE_APPWRITE_DATABASE_ID;
const productsCollectionId = import.meta.env
  .VITE_APPWRITE_PRODUCTS_COLLECTION_ID;
const menusCollectionId = import.meta.env.VITE_APPWRITE_MENUS_COLLECTION_ID;
const ordersCollectionId = import.meta.env.VITE_APPWRITE_ORDERS_COLLECTION_ID;
const orderItemsCollectionId = import.meta.env
  .VITE_APPWRITE_ORDER_ITEMS_COLLECTION_ID;

export default function CustomerMenu({
  user,
  isAdmin = false,
  onNavigate = () => {},
  onLogout = () => {},
}) {
  const [products, setProducts] = useState([]);
  const [menu, setMenu] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [quantities, setQuantities] = useState({});
  const [orderError, setOrderError] = useState("");
  const [orderSuccess, setOrderSuccess] = useState("");
  const [savingOrder, setSavingOrder] = useState(false);
  const [orderItemsByProduct, setOrderItemsByProduct] = useState({});
  const [notesByProduct, setNotesByProduct] = useState({});

  const [unpaidOrders, setUnpaidOrders] = useState([]);
  const [unpaidLoading, setUnpaidLoading] = useState(false);
  const [unpaidError, setUnpaidError] = useState("");

  const configReady = useMemo(
    () =>
      Boolean(
        databaseId &&
          productsCollectionId &&
          menusCollectionId &&
          ordersCollectionId &&
          orderItemsCollectionId
      ),
    []
  );

  const loadProducts = async () => {
    const response = await databases.listDocuments(
      databaseId,
      productsCollectionId,
      [Query.orderAsc("name")]
    );
    setProducts(response.documents);
  };

  const loadMenu = async () => {
    const response = await databases.listDocuments(
      databaseId,
      menusCollectionId,
      [Query.equal("open", true), Query.limit(1)]
    );
    setMenu(response.documents[0] ?? null);
  };
  const loadUnpaidOrders = async () => {
    if (!configReady || !user?.$id) {
      setUnpaidOrders([]);
      return;
    }
    setUnpaidLoading(true);
    setUnpaidError("");
    try {
      const ordersResp = await databases.listDocuments(
        databaseId,
        ordersCollectionId,
        [
          Query.equal("userProfile", user.$id),
          Query.equal("payment", false),
          Query.orderDesc("$updatedAt"),
          Query.limit(50),
        ]
      );

      let results = ordersResp.documents.map((o) => ({
        ...o,
        summary: { quantity: 0, amount: 0 },
      }));

      if (orderItemsCollectionId && results.length > 0) {
        const ids = results.map((o) => o.$id);
        const itemsResp = await databases.listDocuments(
          databaseId,
          orderItemsCollectionId,
          [Query.equal("orderId", ids), Query.limit(500)]
        );
        const byOrder = itemsResp.documents.reduce((acc, item) => {
          const oid =
            item.orderId && typeof item.orderId === "object"
              ? item.orderId.$id
              : item.orderId;
          if (!oid) return acc;
          if (!acc.has(oid)) acc.set(oid, []);
          acc.get(oid).push(item);
          return acc;
        }, new Map());
        results = results.map((o) => {
          const its = byOrder.get(o.$id) ?? [];
          const totals = its.reduce(
            (t, it) => {
              const q = Number(it.quantity) || 0;
              const p = Number(it.price ?? it.unitPrice) || 0;
              t.quantity += q;
              t.amount += q * p;
              return t;
            },
            { quantity: 0, amount: 0 }
          );
          return { ...o, summary: totals };
        });
      }

      setUnpaidOrders(results);
    } catch (err) {
      setUnpaidError(err?.message || "Unable to load unpaid orders.");
      setUnpaidOrders([]);
    } finally {
      setUnpaidLoading(false);
    }
  };

  const bootstrap = async () => {
    if (!configReady) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      await Promise.all([loadProducts(), loadMenu(), loadUnpaidOrders()]);
    } catch (err) {
      const message =
        err?.message ||
        "Unable to load menu data. Confirm database IDs and permissions.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (menu && Array.isArray(menu.productIds)) {
      const defaultQuantities = menu.productIds.reduce((acc, id) => {
        acc[id] = 0;
        return acc;
      }, {});
      const defaultNotes = menu.productIds.reduce((acc, id) => {
        acc[id] = "";
        return acc;
      }, {});
      setQuantities(defaultQuantities);
      setNotesByProduct(defaultNotes);
    } else {
      setQuantities({});
      setNotesByProduct({});
      setOrderItemsByProduct({});
    }
  }, [menu]);

  const menuProducts = useMemo(() => {
    if (!menu) return [];

    return (menu.productIds || [])
      .map((productId) => products.find((product) => product.$id === productId))
      .filter(Boolean);
  }, [menu, products]);

  useEffect(() => {
    const loadExistingOrder = async () => {
      if (!configReady || !menu || !user?.$id) {
        setOrderItemsByProduct({});
        setNotesByProduct({});
        return;
      }

      try {
        const response = await databases.listDocuments(
          databaseId,
          ordersCollectionId,
          [
            Query.equal("menuDate", menu.menuDate),
            Query.equal("userProfile", user.$id),
            Query.limit(1),
          ]
        );

        if (response.total === 0) {
          setOrderItemsByProduct({});
          return;
        }

        const orderDoc = response.documents[0];

        const itemsResponse = await databases.listDocuments(
          databaseId,
          orderItemsCollectionId,
          [Query.equal("orderId", orderDoc.$id)]
        );

        const nextItemMap = {};
        const nextQuantities = (menu.productIds || []).reduce((acc, id) => {
          acc[id] = 0;
          return acc;
        }, {});
        const nextNotes = (menu.productIds || []).reduce((acc, id) => {
          acc[id] = "";
          return acc;
        }, {});

        itemsResponse.documents.forEach((item) => {
          nextItemMap[item.productId.$id] = item;
          if (item.productId.$id in nextQuantities) {
            const value = Number(item.quantity) || 0;
            nextQuantities[item.productId.$id] = value;
          }
          if (item.productId.$id in nextNotes) {
            nextNotes[item.productId.$id] = item.note || "";
          }
        });

        setOrderError("");
        setOrderItemsByProduct(nextItemMap);
        setQuantities((current) => ({ ...current, ...nextQuantities }));
        setNotesByProduct((current) => ({ ...current, ...nextNotes }));
      } catch (err) {
        const message =
          err?.message ||
          "Unable to retrieve existing order details. You can still create a new one.";
        setOrderError(message);
        setOrderItemsByProduct({});
        setNotesByProduct({});
      }
    };

    loadExistingOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configReady, menu?.menuDate, user?.$id]);

  const handleQuantityChange = (productId, value) => {
    const numeric = Number(value);
    if (Number.isNaN(numeric) || numeric < 0) {
      return;
    }
    setQuantities((current) => ({ ...current, [productId]: numeric }));
  };

  const adjustQuantity = (productId, delta) => {
    setQuantities((current) => {
      const existing = Number(current[productId]) || 0;
      const nextValue = Math.max(0, existing + delta);
      return { ...current, [productId]: nextValue };
    });
  };

  const handleNoteChange = (productId, value) => {
    setNotesByProduct((current) => ({ ...current, [productId]: value }));
  };

  const handleSubmitOrder = async (event) => {
    event.preventDefault();
    setOrderError("");
    setOrderSuccess("");

    if (!menu) {
      setOrderError("No published menu is available for tomorrow yet.");
      return;
    }

    const items = Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([productId, qty]) => ({
        productId,
        quantity: qty,
        note: notesByProduct[productId] || "",
      }));

    if (items.length === 0) {
      setOrderError("Select at least one product with a quantity above zero.");
      return;
    }

    setSavingOrder(true);

    let orderDocument = null;
    let createdItemIds = [];
    let isNewOrder = false;

    try {
      const existingOrderResponse = await databases.listDocuments(
        databaseId,
        ordersCollectionId,
        [
          Query.equal("menuDate", menu.menuDate),
          Query.equal("userProfile", user.$id),
          Query.limit(1),
        ]
      );

      if (existingOrderResponse.total > 0) {
        orderDocument = existingOrderResponse.documents[0];
      } else {
        orderDocument = await databases.createDocument(
          databaseId,
          ordersCollectionId,
          ID.unique(),
          {
            menuDate: menu.menuDate,
            userProfile: user.$id,
            payment: false,
          }
        );
        isNewOrder = true;
      }

      const productIndex = new Map(
        menuProducts.map((product) => [product.$id, product])
      );
      const nextItemsMap = { ...orderItemsByProduct };
      const processedProductIds = new Set();

      for (const { productId, quantity, note } of items) {
        processedProductIds.add(productId);
        const existingItem = orderItemsByProduct[productId];
        const product = productIndex.get(productId);
        const payload = {
          orderId: orderDocument.$id,
          productId,
          quantity,
          productName: product?.name ?? "",
          price: typeof product?.price === "number" ? product.price : 0,
          note: note,
        };

        if (!existingItem) {
          const itemDocument = await databases.createDocument(
            databaseId,
            orderItemsCollectionId,
            ID.unique(),
            payload
          );
          createdItemIds.push(itemDocument.$id);
          nextItemsMap[productId] = itemDocument;
        } else if (
          (Number(existingItem.quantity) || 0) !== quantity ||
          (existingItem.note || "") !== note
        ) {
          const updatedItem = await databases.updateDocument(
            databaseId,
            orderItemsCollectionId,
            existingItem.$id,
            payload
          );
          nextItemsMap[productId] = updatedItem;
        }
      }

      // No deletion to preserve existing selections; ensure map keeps previous items.

      setOrderSuccess(
        isNewOrder
          ? "Order recorded. Check the Appwrite console for details."
          : "Order updated successfully."
      );

      const updatedQuantities = (menu.productIds || []).reduce((acc, id) => {
        const item = nextItemsMap[id];
        acc[id] = item ? Number(item.quantity) || 0 : 0;
        return acc;
      }, {});
      setQuantities(updatedQuantities);
      const updatedNotes = (menu.productIds || []).reduce((acc, id) => {
        const item = nextItemsMap[id];
        acc[id] = item ? item.note || "" : "";
        return acc;
      }, {});
      setNotesByProduct(updatedNotes);
      setOrderItemsByProduct(nextItemsMap);
    } catch (err) {
      if (isNewOrder && orderDocument?.$id) {
        try {
          await databases.deleteDocument(
            databaseId,
            ordersCollectionId,
            orderDocument.$id
          );
        } catch {
          // ignore cleanup errors
        }
      }

      if (createdItemIds.length > 0) {
        await Promise.allSettled(
          createdItemIds.map((itemId) =>
            databases.deleteDocument(databaseId, orderItemsCollectionId, itemId)
          )
        );
      }

      const message =
        err?.message ||
        "Unable to submit your order. Confirm database permissions and try again.";
      setOrderError(message);
    } finally {
      setSavingOrder(false);
    }
  };

  if (!configReady) {
    return (
      <main className="grid min-h-screen place-items-center bg-white text-slate-900">
        <div className="max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-lg ">
          <h1 className="text-2xl font-semibold text-slate-900">
            Missing setup
          </h1>
          <p className="text-sm text-slate-600">
            Define `VITE_APPWRITE_DATABASE_ID`,
            `VITE_APPWRITE_PRODUCTS_COLLECTION_ID`,
            `VITE_APPWRITE_MENUS_COLLECTION_ID`,
            `VITE_APPWRITE_ORDERS_COLLECTION_ID`, and
            `VITE_APPWRITE_ORDER_ITEMS_COLLECTION_ID` in your environment to
            enable menu ordering.
          </p>
          <div className="flex justify-center gap-3">
            <button
              type="button"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              onClick={() => onNavigate("dashboard")}
            >
              Back to dashboard
            </button>
            <button
              type="button"
              className="rounded-md border border-pink-400/40 bg-rose-50 px-3 py-2 text-sm text-pink-100"
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
    <main className="min-h-screen bg-rose-50 py-16 text-slate-900">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 sm:px-10">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Tomorrow’s Menu
            </h1>
            <p className="mt-2 text-sm text-slate-600 sm:text-base">
              {isAdmin
                ? "You can preview what customers will see and place test orders."
                : "Pick from the available products below to place your order."}
            </p>
          </div>
          <div className="flex gap-3">
            {isAdmin ? (
              <button
                type="button"
                onClick={() => onNavigate("dashboard")}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-900 transition hover:border-white/30"
              >
                Back to dashboard
              </button>
            ) : null}
            <button
              type="button"
              onClick={onLogout}
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow hover:bg-slate-100"
            >
              Log out
            </button>
          </div>
        </header>

        {error ? (
          <section className="rounded-2xl border border-pink-500/40 bg-rose-50 p-6 text-sm text-pink-200 shadow-lg ">
            {error}
          </section>
        ) : null}

        {unpaidError ? (
          <section className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-6 text-sm text-amber-200 shadow-lg ">
            {unpaidError}
          </section>
        ) : null}

        {unpaidLoading ? null : unpaidOrders.length > 0 ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg ">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                Unpaid orders
              </h2>
              <button
                type="button"
                onClick={loadUnpaidOrders}
                className="rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-700 transition hover:border-white/30"
              >
                Refresh
              </button>
            </div>
            <ul className="mt-4 space-y-3">
              {unpaidOrders.map((o) => (
                <li
                  key={o.$id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white/60 px-4 py-3 text-sm text-slate-700"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {formatMenuDate(o.menuDate) || "Order"}
                    </p>
                    <p className="text-xs text-slate-400">
                      Updated:{" "}
                      {new Date(o.$updatedAt || o.$createdAt).toLocaleString(
                        "id-ID"
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-600">Amount</p>
                    <p className="text-sm text-slate-900">
                      {formatRupiah(o.summary?.amount || 0)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {Object.keys(orderItemsByProduct).length > 0 ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg ">
            <h2 className="text-lg font-semibold text-slate-900">
              Pesanan kamu untuk menu ini
            </h2>
            <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">
              Terakhir diperbarui:{" "}
              {(() => {
                const items = Object.values(orderItemsByProduct);
                const timestamps = items
                  .map((item) => item.$updatedAt || item.$createdAt)
                  .filter(Boolean);
                if (timestamps.length === 0) return "Baru dibuat";
                const newest = timestamps.reduce(
                  (latest, current) =>
                    new Date(current) > new Date(latest) ? current : latest,
                  timestamps[0]
                );
                return new Date(newest).toLocaleString("id-ID");
              })()}
            </p>

            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              {Object.values(orderItemsByProduct).map((item) => {
                const product = menuProducts.find(
                  (prod) => prod.$id === item.productId
                );
                return (
                  <li
                    key={item.productId.$id}
                    className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-white/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium text-slate-900">
                        {product?.name || item.productName || "Produk"}
                      </p>
                      <p className="text-xs text-slate-400">
                        {formatRupiah(
                          typeof product?.price === "number"
                            ? product.price
                            : typeof item.unitPrice === "number"
                              ? item.unitPrice
                              : item.price
                        )}
                      </p>
                      {item.note ? (
                        <p className="text-xs text-slate-400">
                          Catatan: {item.note}
                        </p>
                      ) : null}
                    </div>
                    <span className="text-sm text-slate-700">
                      x {item.quantity}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg ">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Serving on {formatMenuDate(menu?.menuDate)}
              </h2>
              <p className="text-xs uppercase tracking-wide text-slate-400">
                {menu?.open === false
                  ? "Draft menu"
                  : loading
                    ? "Loading menu…"
                    : menu
                      ? "Published"
                      : "Awaiting publication"}
              </p>
            </div>
            <button
              type="button"
              onClick={bootstrap}
              className="self-start rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-700 transition hover:border-white/30"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <p className="mt-4 text-sm text-slate-600">Loading menu…</p>
          ) : !menu ? (
            <p className="mt-4 text-sm text-slate-600">
              No published menu for tomorrow yet. Check back later.
            </p>
          ) : menuProducts.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">
              Products have not been linked to this menu. Reach out to an admin.
            </p>
          ) : (
            <form className="mt-6 space-y-6" onSubmit={handleSubmitOrder}>
              <div className="grid gap-4">
                {menuProducts.map((product) => (
                  <div
                    key={product.$id}
                    className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/80 p-4"
                  >
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">
                          {product.name}
                        </h3>
                        <p className="text-sm text-slate-600">
                          {formatRupiah(product.price)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-700">
                        <span className="sr-only sm:not-sr-only">Quantity</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => adjustQuantity(product.$id, -1)}
                            className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-lg text-slate-900 transition hover:border-emerald-400 hover:text-emerald-300"
                            aria-label={`Kurangi ${product.name}`}
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={quantities[product.$id] ?? 0}
                            onChange={(event) =>
                              handleQuantityChange(
                                product.$id,
                                event.target.value
                              )
                            }
                            className="h-9 w-16 rounded-md border border-slate-200 bg-white px-3 text-center text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-300/40"
                            inputMode="numeric"
                            pattern="[0-9]*"
                          />
                          <button
                            type="button"
                            onClick={() => adjustQuantity(product.$id, 1)}
                            className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-lg text-slate-900 transition hover:border-emerald-400 hover:text-emerald-300"
                            aria-label={`Tambah ${product.name}`}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                    <label className="flex flex-col gap-1 text-sm text-slate-700">
                      <span>Catatan (opsional)</span>
                      <textarea
                        rows={2}
                        value={notesByProduct[product.$id] ?? ""}
                        onChange={(event) =>
                          handleNoteChange(product.$id, event.target.value)
                        }
                        placeholder="Contoh: tanpa gula, ekstra es"
                        className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-500/30"
                      />
                    </label>
                  </div>
                ))}
              </div>

              {orderError ? (
                <div className="rounded-lg border border-pink-500/40 bg-rose-50 px-4 py-3 text-sm text-pink-200">
                  {orderError}
                </div>
              ) : null}

              {orderSuccess ? (
                <div className="rounded-lg border border-emerald-500/40 bg-emerald-50 px-4 py-3 text-sm text-emerald-200">
                  {orderSuccess}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={savingOrder}
                className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 shadow shadow-emerald-200/40 transition hover:bg-emerald-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200 disabled:cursor-not-allowed disabled:bg-emerald-500/50"
              >
                {savingOrder ? "Submitting…" : "Place order"}
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}

CustomerMenu.propTypes = {
  user: PropTypes.shape({
    $id: PropTypes.string,
    name: PropTypes.string,
  }).isRequired,
  isAdmin: PropTypes.bool,
  onNavigate: PropTypes.func,
  onLogout: PropTypes.func,
};
