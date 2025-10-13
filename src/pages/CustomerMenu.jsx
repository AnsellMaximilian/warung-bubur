import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router";
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
  onLogout = () => {},
}) {
  const navigate = useNavigate();

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
  const [noteExpanded, setNoteExpanded] = useState({});

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
      setNoteExpanded({});
    } else {
      setQuantities({});
      setNotesByProduct({});
      setOrderItemsByProduct({});
      setNoteExpanded({});
    }
  }, [menu]);

  const menuProducts = useMemo(() => {
    if (!menu) return [];

    return (menu.productIds || [])
      .map((productId) => products.find((product) => product.$id === productId))
      .filter(Boolean);
  }, [menu, products]);

  const menuDateLabel = useMemo(() => {
    if (!menu?.menuDate) return "Tanggal belum tersedia";
    return formatMenuDate(menu.menuDate);
  }, [menu?.menuDate]);

  const priceByProductId = useMemo(() => {
    const lookup = new Map();
    menuProducts.forEach((product) => {
      const price = Number(product?.price);
      lookup.set(product.$id, Number.isFinite(price) ? price : 0);
    });
    return lookup;
  }, [menuProducts]);

  const selectedTotals = useMemo(() => {
    let totalQuantity = 0;
    let totalAmount = 0;

    Object.entries(quantities).forEach(([productId, rawValue]) => {
      const qty = Number(rawValue) || 0;
      if (qty <= 0) {
        return;
      }
      const price = priceByProductId.get(productId) ?? 0;
      totalQuantity += qty;
      totalAmount += qty * price;
    });

    return { totalQuantity, totalAmount };
  }, [priceByProductId, quantities]);

  const hasSelection = selectedTotals.totalQuantity > 0;
  const hasSavedItems = Object.keys(orderItemsByProduct).length > 0;

  const savedOrderTimestamp = useMemo(() => {
    const items = Object.values(orderItemsByProduct || {});
    if (items.length === 0) {
      return null;
    }
    const timestamps = items
      .map((item) => Date.parse(item.$updatedAt || item.$createdAt || ""))
      .filter((value) => Number.isFinite(value));
    if (timestamps.length === 0) {
      return null;
    }
    return Math.max(...timestamps);
  }, [orderItemsByProduct]);

  const savedOrderLabel = useMemo(() => {
    if (!savedOrderTimestamp) {
      return "";
    }
    return new Date(savedOrderTimestamp).toLocaleString("id-ID");
  }, [savedOrderTimestamp]);

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
        setNoteExpanded((current) => {
          const nextExpanded = { ...current };
          Object.entries(nextNotes).forEach(([productId, noteValue]) => {
            nextExpanded[productId] = Boolean(noteValue);
          });
          return nextExpanded;
        });
      } catch (err) {
        const message =
          err?.message ||
          "Unable to retrieve existing order details. You can still create a new one.";
        setOrderError(message);
        setOrderItemsByProduct({});
        setNotesByProduct({});
        setNoteExpanded({});
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

  const toggleNoteSection = (productId) => {
    setNoteExpanded((current) => ({
      ...current,
      [productId]: !current[productId],
    }));
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
              onClick={() => navigate("/dashboard")}
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
    <main className="min-h-screen bg-gradient-to-b from-rose-50 via-white to-white text-slate-900">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pb-28 pt-10 sm:gap-8 sm:px-6 sm:pb-20 sm:pt-14">
        <header className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Pesan Menu</h1>
            <div className="flex items-center gap-2">
              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => navigate("/dashboard")}
                  className="rounded-full border border-rose-100 px-4 py-2 text-xs font-medium text-slate-600 shadow-sm transition hover:border-rose-200 hover:bg-white"
                >
                  Dashboard
                </button>
              ) : null}
              <button
                type="button"
                onClick={onLogout}
                className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-700"
              >
                Keluar
              </button>
            </div>
          </div>
          <div className="rounded-3xl border border-rose-100 bg-white/80 p-6 shadow-md shadow-rose-100/60 backdrop-blur">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium uppercase tracking-wide text-rose-400">{menu ? "Menu tersedia" : "Menu belum tersedia"}</p>
                <p className="text-2xl font-semibold text-slate-900">{menu ? "Pilih favorit kamu untuk besok" : "Tunggu sebentar ya"}</p>
                <p className="text-sm text-slate-600">
                  {isAdmin
                    ? "Gunakan tampilan ini untuk memastikan pengalaman pelanggan sudah rapi di layar kecil."
                    : "Sentuh produk favoritmu, atur jumlah, dan tambahkan catatan bila perlu."}
                </p>
              </div>
              <div className="flex flex-col items-start gap-2 rounded-2xl bg-rose-50 px-5 py-4 text-sm text-rose-500">
                <span className="text-xs uppercase tracking-wide text-rose-400">Tanggal penyajian</span>
                <span className="text-base font-semibold text-rose-500">{menu ? menuDateLabel : "Segera diumumkan"}</span>
              </div>
            </div>
          </div>
        </header>

        {error ? (
          <section className="rounded-3xl border border-pink-200 bg-rose-50/90 p-4 text-sm text-rose-600 shadow-sm">{error}</section>
        ) : null}

        {unpaidError ? (
          <section className="rounded-3xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-700 shadow-sm">{unpaidError}</section>
        ) : null}

        {unpaidLoading ? null : unpaidOrders.length > 0 ? (
          <section className="rounded-3xl border border-rose-100 bg-white/90 p-5 shadow-md shadow-rose-100/50 backdrop-blur">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Pesanan menunggu pembayaran</h2>
              <button
                type="button"
                onClick={loadUnpaidOrders}
                className="rounded-full border border-rose-100 px-3 py-1.5 text-xs font-medium text-rose-500 transition hover:border-rose-200 hover:bg-white"
              >
                Segarkan
              </button>
            </div>
            <ul className="mt-4 grid gap-3">
              {unpaidOrders.map((o) => (
                <li
                  key={o.$id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-rose-100 bg-rose-50/70 px-4 py-3 text-sm text-slate-700"
                >
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold text-slate-900">{formatMenuDate(o.menuDate)}</span>
                    <span className="text-xs text-slate-500">{o.summary.quantity} item • {formatRupiah(o.summary.amount)}</span>
                  </div>
                  <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-600">Belum bayar</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {hasSavedItems ? (
          <section className="rounded-3xl border border-emerald-100 bg-emerald-50/60 p-5 shadow-md shadow-emerald-100/50 backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Pesanan tersimpan</h2>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Terakhir diperbarui {savedOrderLabel || "baru dibuat"}
                </p>
              </div>
            </div>
            <ul className="mt-4 grid gap-3">
              {Object.values(orderItemsByProduct).map((item) => {
                const productId =
                  item?.productId && typeof item.productId === "object"
                    ? item.productId.$id
                    : item?.productId;
                const product = menuProducts.find((prod) => prod.$id === productId);
                const quantity = Number(item.quantity) || 0;
                const price = Number(item.price ?? product?.price ?? 0) || 0;
                const total = quantity * price;
                const note = item.note || "";
                const name = item.productName || product?.name || "Produk";
                return (
                  <li
                    key={item.$id || productId}
                    className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{name}</p>
                        <p className="text-xs text-slate-500">{quantity} item • {formatRupiah(total)}</p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-emerald-600 shadow-inner">
                        {formatRupiah(price)} / item
                      </span>
                    </div>
                    {note ? (
                      <p className="mt-2 text-xs text-slate-500">Catatan: {note}</p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <section className="rounded-3xl border border-rose-100 bg-white/90 p-6 shadow-lg shadow-rose-100/60 backdrop-blur">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">{menu ? "Katalog menu" : "Menunggu menu"}</h2>
              <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-600">{menu ? "Siap dipesan" : "Segera hadir"}</span>
            </div>
            <p className="text-sm text-slate-600">
              {menu
                ? "Geser dan pilih produk. Kontrol jumlah dibuat besar supaya mudah disentuh."
                : "Admin belum menautkan produk untuk tanggal ini."}
            </p>
          </div>

          <div className="my-6 h-px bg-gradient-to-r from-transparent via-rose-100 to-transparent" />

          {loading ? (
            <p className="text-sm text-slate-600">Memuat menu...</p>
          ) : !menu ? (
            <p className="mt-4 text-sm text-slate-600">Menu belum dirilis. Silakan cek kembali nanti.</p>
          ) : menuProducts.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">Produk belum ditautkan ke menu ini. Hubungi admin untuk bantuan.</p>
          ) : (
            <form className="flex flex-col gap-6" onSubmit={handleSubmitOrder}>
              <div className="grid gap-4 sm:grid-cols-2">
                {menuProducts.map((product) => {
                  const quantity = Number(quantities[product.$id]) || 0;
                  const noteIsOpen = Boolean(noteExpanded[product.$id]);
                  return (
                    <article
                      key={product.$id}
                      className="group flex h-full flex-col gap-4 overflow-hidden rounded-3xl border border-rose-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-rose-200 hover:shadow-md focus-within:border-emerald-300 focus-within:shadow-emerald-100"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <h3 className="text-lg font-semibold text-slate-900">{product.name}</h3>
                          <p className="text-sm font-medium text-emerald-600">{formatRupiah(product.price)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => adjustQuantity(product.$id, 1)}
                          className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-700"
                        >
                          {quantity > 0 ? "Tambah lagi" : "Tambah"}
                        </button>
                      </div>

                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between rounded-2xl border border-rose-100 bg-rose-50/70 px-3 py-2">
                          <button
                            type="button"
                            onClick={() => adjustQuantity(product.$id, -1)}
                            className="flex h-10 w-10 items-center justify-center rounded-full border border-transparent bg-white text-lg font-semibold text-slate-700 shadow-sm transition hover:border-emerald-200 hover:text-emerald-500"
                            aria-label={"Kurangi " + product.name}
                          >
                            -
                          </button>
                          <div className="flex flex-col items-center">
                            <span className="text-xs uppercase tracking-wide text-slate-400">Jumlah</span>
                            <input
                              type="number"
                              min="0"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={quantity}
                              onChange={(event) => handleQuantityChange(product.$id, event.target.value)}
                              className="h-10 w-16 rounded-xl border border-transparent bg-white text-center text-lg font-semibold text-slate-900 outline-none ring-2 ring-transparent transition focus:border-emerald-200 focus:ring-emerald-200"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => adjustQuantity(product.$id, 1)}
                            className="flex h-10 w-10 items-center justify-center rounded-full border border-transparent bg-white text-lg font-semibold text-slate-700 shadow-sm transition hover:border-emerald-200 hover:text-emerald-500"
                            aria-label={"Tambah " + product.name}
                          >
                            +
                          </button>
                        </div>

                        <div className="flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => toggleNoteSection(product.$id)}
                            className="flex items-center justify-between rounded-xl border border-rose-100 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-rose-200"
                          >
                            <span>Catatan untuk dapur</span>
                            <span className="text-slate-400">{noteIsOpen ? "Tutup" : "Tambah"}</span>
                          </button>
                          {noteIsOpen ? (
                            <textarea
                              rows={2}
                              value={notesByProduct[product.$id] ?? ""}
                              onChange={(event) => handleNoteChange(product.$id, event.target.value)}
                              placeholder="Contoh: tanpa gula, ekstra es"
                              className="w-full rounded-xl border border-rose-100 bg-rose-50/70 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-200 focus:ring-2 focus:ring-emerald-200/60"
                            />
                          ) : null}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {orderError ? (
                <div className="rounded-2xl border border-pink-300 bg-rose-50/90 px-4 py-3 text-sm text-rose-700">{orderError}</div>
              ) : null}

              {orderSuccess ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-700">{orderSuccess}</div>
              ) : null}

              <div className="sticky inset-x-0 bottom-4 -mx-4 flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-lg shadow-slate-300/30 sm:-mx-6 sm:px-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-600">
                    {hasSelection ? `${selectedTotals.totalQuantity} item dipilih` : "Belum ada item yang dipilih"}
                  </span>
                  <span className="text-lg font-semibold text-slate-900">{hasSelection ? formatRupiah(selectedTotals.totalAmount) : "Rp0"}</span>
                </div>
                <button
                  type="submit"
                  disabled={savingOrder || !hasSelection}
                  className="inline-flex w-full items-center justify-center rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-900 shadow-md shadow-emerald-200/60 transition hover:bg-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-500/50"
                >
                  {savingOrder ? "Mengirim pesanan..." : "Kirim pesanan"}
                </button>
              </div>
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
  onLogout: PropTypes.func,
};
