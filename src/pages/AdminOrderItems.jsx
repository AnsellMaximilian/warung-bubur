import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Query } from "appwrite";
import { useQuery } from "@tanstack/react-query";
import { databases } from "../lib/appwrite.js";
import { formatMenuDate } from "../lib/utils.js";
import { formatRupiah } from "../lib/formatters.js";

const databaseId = import.meta.env.VITE_APPWRITE_DATABASE_ID;
const ordersCollectionId = import.meta.env.VITE_APPWRITE_ORDERS_COLLECTION_ID;
const orderItemsCollectionId = import.meta.env
  .VITE_APPWRITE_ORDER_ITEMS_COLLECTION_ID;

const getTodayDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function AdminOrderItems({
  onNavigate = () => {},
  onLogout = () => {},
}) {
  const [currentDate] = useState(() => getTodayDateString());

  const configReady = useMemo(
    () => Boolean(databaseId && ordersCollectionId && orderItemsCollectionId),
    [],
  );

  const {
    data: orderItemsData,
    isPending,
    isFetching,
    error: orderItemsError,
    refetch: refetchOrderItems,
  } = useQuery({
    queryKey: [
      "order-items",
      databaseId,
      ordersCollectionId,
      orderItemsCollectionId,
      currentDate,
    ],
    enabled: configReady,
    queryFn: async () => {
      try {
        const ordersResponse = await databases.listDocuments(
          databaseId,
          ordersCollectionId,
          [Query.greaterThanEqual("menuDate", currentDate), Query.limit(200)],
        );
        const orderDocs = ordersResponse.documents;

        if (orderDocs.length === 0) {
          return { orders: orderDocs, items: [] };
        }

        const orderIds = orderDocs.map((order) => order.$id);
        const itemsResponse = await databases.listDocuments(
          databaseId,
          orderItemsCollectionId,
          [Query.equal("orderId", orderIds), Query.limit(200)],
        );

        const orderIndex = new Map(
          orderDocs.map((order) => [order.$id, order]),
        );

        const decoratedItems = itemsResponse.documents.map((item) => {
          const relatedOrderId =
            item.orderId && typeof item.orderId === "object"
              ? item.orderId.$id
              : item.orderId;
          return {
            ...item,
            relatedOrder: orderIndex.get(relatedOrderId) ?? null,
          };
        });

        return { orders: orderDocs, items: decoratedItems };
      } catch (err) {
        const message =
          err?.message ||
          "Unable to load today's order items. Confirm database permissions and IDs.";
        throw new Error(message);
      }
    },
  });

  const orders = orderItemsData?.orders ?? [];
  const items = orderItemsData?.items ?? [];
  const loading = isPending || (isFetching && items.length === 0);
  const loadError = orderItemsError?.message ?? "";
  const refreshOrderItems = () => refetchOrderItems({ throwOnError: false });

  if (!configReady) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-900 text-slate-100">
        <div className="max-w-md space-y-4 rounded-2xl border border-white/10 bg-slate-900/80 p-6 text-center shadow-2xl backdrop-blur">
          <h1 className="text-2xl font-semibold text-white">Missing setup</h1>
          <p className="text-sm text-slate-300">
            Define `VITE_APPWRITE_DATABASE_ID`,
            `VITE_APPWRITE_ORDERS_COLLECTION_ID`, and
            `VITE_APPWRITE_ORDER_ITEMS_COLLECTION_ID` before viewing order
            details.
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

  const totalItems = items.length;
  const totalQuantity = items.reduce(
    (acc, item) => acc + (Number(item.quantity) || 0),
    0,
  );

  return (
    <main className="min-h-screen bg-slate-900/95 py-16 text-slate-100">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 sm:px-10">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Today&apos;s Order Items
            </h1>
            <p className="mt-2 text-sm text-slate-300 sm:text-base">
              Showing order items for{" "}
              <span className="font-medium text-white">
                {formatMenuDate(currentDate)}
              </span>
              . Refresh to sync with the latest submissions.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-300 sm:text-sm">
              <span>
                Orders today:{" "}
                <span className="font-semibold text-white">
                  {orders.length}
                </span>
              </span>
              <span>
                Items recorded:{" "}
                <span className="font-semibold text-white">{totalItems}</span>
              </span>
              <span>
                Total quantity:{" "}
                <span className="font-semibold text-white">
                  {totalQuantity}
                </span>
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={refreshOrderItems}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white transition hover:border-white/30"
            >
              Refresh
            </button>
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

        {loadError ? (
          <p className="rounded-2xl border border-pink-500/40 bg-pink-500/10 px-4 py-3 text-sm text-pink-200">
            {loadError}
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-slate-300">Loading order items…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-300">
            No order items found for today. Orders will appear here as customers
            submit them.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/80 shadow-2xl backdrop-blur">
            <table className="min-w-full divide-y divide-white/5 text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3 font-medium">Order ID</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">Quantity</th>
                  <th className="px-4 py-3 font-medium">Item price</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Payment</th>
                  <th className="px-4 py-3 font-medium">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-200">
                {items.map((item) => {
                  const relatedOrderId =
                    item.orderId && typeof item.orderId === "object"
                      ? item.orderId.$id
                      : item.orderId;
                  const customerId =
                    item.relatedOrder &&
                    typeof item.relatedOrder.userProfile === "object"
                      ? (item.relatedOrder.userProfile.name ?? "")
                      : (item.relatedOrder?.userId ?? "");
                  const paymentStatus = item.relatedOrder?.payment ?? false;
                  const quantity = Number(item.quantity) || 0;
                  const priceEach = Number(item.price) || 0;
                  const total = quantity * priceEach;
                  const productName =
                    item.productName ||
                    (item.productId && typeof item.productId === "object"
                      ? item.productId.name
                      : "");
                  return (
                    <tr key={item.$id}>
                      <td className="px-4 py-3 font-mono text-xs text-slate-300">
                        {relatedOrderId}
                      </td>
                      <td className="px-4 py-3">
                        {customerId || "Unknown user"}
                      </td>
                      <td className="px-4 py-3">
                        {productName || "Unnamed product"}
                      </td>
                      <td className="px-4 py-3">{quantity}</td>
                      <td className="px-4 py-3">{formatRupiah(priceEach)}</td>
                      <td className="px-4 py-3">{formatRupiah(total)}</td>
                      <td className="px-4 py-3">
                        {paymentStatus ? (
                          <span className="rounded-md bg-emerald-500/20 px-2 py-1 text-xs text-emerald-200">
                            Paid
                          </span>
                        ) : (
                          <span className="rounded-md bg-amber-500/20 px-2 py-1 text-xs text-amber-200">
                            Unpaid
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {item.note || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}

AdminOrderItems.propTypes = {
  onNavigate: PropTypes.func,
  onLogout: PropTypes.func,
};
