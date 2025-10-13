import { Fragment, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router";
import { Query } from "appwrite";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { databases } from "../lib/appwrite.js";
import { formatMenuDate } from "../lib/utils.js";
import { formatRupiah } from "../lib/formatters.js";

const databaseId = import.meta.env.VITE_APPWRITE_DATABASE_ID;
const ordersCollectionId = import.meta.env.VITE_APPWRITE_ORDERS_COLLECTION_ID;
const orderItemsCollectionId = import.meta.env
  .VITE_APPWRITE_ORDER_ITEMS_COLLECTION_ID;

const canSummarizeOrders = Boolean(orderItemsCollectionId);

const extractCustomerName = (order) => {
  if (typeof order.userProfile.name === "string") {
    return order.userProfile.name;
  }

  if (typeof order.userId === "string") {
    return order.userId;
  }

  return "Unknown customer";
};

export default function AdminOrders({
  onLogout = () => {},
}) {
  const navigate = useNavigate();

  const [expandedOrders, setExpandedOrders] = useState([]);
  const [updatingOrderId, setUpdatingOrderId] = useState("");
  const [actionError, setActionError] = useState("");

  const configReady = Boolean(databaseId && ordersCollectionId);

  const ordersQueryKey = [
    "orders",
    databaseId,
    ordersCollectionId,
    orderItemsCollectionId,
    canSummarizeOrders,
  ];

  const queryClient = useQueryClient();

  const {
    data: orders = [],
    isPending: ordersPending,
    isFetching: ordersFetching,
    error: ordersError,
    refetch: refetchOrders,
  } = useQuery({
    queryKey: ordersQueryKey,
    enabled: configReady,
    queryFn: async () => {
      try {
        const ordersResponse = await databases.listDocuments(
          databaseId,
          ordersCollectionId,
          [
            Query.orderAsc("payment"),
            Query.orderDesc("$updatedAt"),
            Query.limit(200),
          ],
        );

        const normalizedOrders = ordersResponse.documents.map((order) => ({
          ...order,
          customerName: extractCustomerName(order),
          summary: { quantity: 0, amount: 0 },
          items: [],
        }));

        if (!canSummarizeOrders || normalizedOrders.length === 0) {
          return normalizedOrders;
        }

        const orderIds = normalizedOrders.map((order) => order.$id);
        const itemsResponse = await databases.listDocuments(
          databaseId,
          orderItemsCollectionId,
          [Query.equal("orderId", orderIds), Query.limit(500)]
        );

        const itemsByOrder = itemsResponse.documents.reduce((acc, item) => {
          const relatedOrderId =
            item.orderId && typeof item.orderId === "object"
              ? item.orderId.$id
              : item.orderId;
          if (!relatedOrderId) return acc;
          if (!acc.has(relatedOrderId)) {
            acc.set(relatedOrderId, []);
          }
          acc.get(relatedOrderId).push(item);
          return acc;
        }, new Map());

        const enrichedOrders = normalizedOrders.map((order) => {
          const orderItems = itemsByOrder.get(order.$id) ?? [];
          const totals = orderItems.reduce(
            (acc, item) => {
              const quantity = Number(item.quantity) || 0;
              const price = Number(item.price) || 0;
              acc.quantity += quantity;
              acc.amount += quantity * price;
              return acc;
            },
            { quantity: 0, amount: 0 }
          );
          return {
            ...order,
            summary: totals,
            items: orderItems,
          };
        });

        return enrichedOrders;
      } catch (err) {
        const message =
          err?.message ||
          "Unable to load orders. Confirm database permissions and IDs.";
        throw new Error(message);
      }
    },
  });

  const orderIdsKey = useMemo(
    () => (orders ?? []).map((o) => o.$id).join("|"),
    [orders]
  );

  const refreshOrders = () => refetchOrders({ throwOnError: false });

  const markOrderPaid = useMutation({
    mutationFn: async (orderId) => {
      if (!orderId) {
        throw new Error("Order identifier missing.");
      }
      if (!databaseId || !ordersCollectionId) {
        throw new Error("Orders collection is not configured.");
      }
      const updatedOrder = await databases.updateDocument(
        databaseId,
        ordersCollectionId,
        orderId,
        { payment: true },
      );
      return updatedOrder;
    },
    onMutate: (orderId) => {
      setActionError("");
      setUpdatingOrderId(orderId);
    },
    onSuccess: (updatedOrder) => {
      if (configReady) {
        queryClient.setQueryData(ordersQueryKey, (current) => {
          if (!Array.isArray(current)) return current;
          return current.map((order) =>
            order.$id === updatedOrder.$id
              ? { ...order, ...updatedOrder, payment: true }
              : order,
          );
        });
      }
      refreshOrders();
    },
    onError: (err) => {
      const message =
        err?.message ||
        "Unable to update payment status. Confirm permissions and try again.";
      setActionError(message);
    },
    onSettled: () => {
      setUpdatingOrderId("");
    },
  });

  useEffect(() => {
    setExpandedOrders([]);
  }, [orderIdsKey]);

  const loading = ordersPending || (ordersFetching && orders.length === 0);
  const loadError = ordersError?.message ?? "";

  const toggleOrderExpanded = (orderId) => {
    setExpandedOrders((current) =>
      current.includes(orderId)
        ? current.filter((id) => id !== orderId)
        : [...current, orderId]
    );
  };

  const handleRowKeyDown = (event, orderId) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleOrderExpanded(orderId);
    }
  };

  const handleMarkAsPaid = (event, orderId) => {
    event.stopPropagation();
    markOrderPaid.mutate(orderId);
  };

  if (!configReady) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-900 text-slate-100">
        <div className="max-w-md space-y-4 rounded-2xl border border-white/10 bg-slate-900/80 p-6 text-center shadow-2xl backdrop-blur">
          <h1 className="text-2xl font-semibold text-white">Missing setup</h1>
          <p className="text-sm text-slate-300">
            Define `VITE_APPWRITE_DATABASE_ID` and
            `VITE_APPWRITE_ORDERS_COLLECTION_ID` before reviewing payments.
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

  const paidCount = orders.filter((order) => order.payment).length;
  const unpaidCount = orders.length - paidCount;
  const totalCollected = orders.reduce((acc, order) => {
    if (!order.payment || !order.summary) return acc;
    return acc + order.summary.amount;
  }, 0);

  return (
    <main className="min-h-screen bg-slate-900/95 py-16 text-slate-100">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 sm:px-10">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Orders & Payments
            </h1>
            <p className="mt-2 text-sm text-slate-300 sm:text-base">
              Unpaid orders appear first. Use this view to reconcile payments
              and follow up with customers.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-300 sm:text-sm">
              <span>
                Unpaid:{" "}
                <span className="font-semibold text-white">{unpaidCount}</span>
              </span>
              <span>
                Paid:{" "}
                <span className="font-semibold text-white">{paidCount}</span>
              </span>
              {canSummarizeOrders ? (
                <span>
                  Collected:{" "}
                  <span className="font-semibold text-white">
                    {formatRupiah(totalCollected)}
                  </span>
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={refreshOrders}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white transition hover:border-white/30"
            >
              Refresh
            </button>
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

        {loadError ? (
          <p className="rounded-2xl border border-pink-500/40 bg-pink-500/10 px-4 py-3 text-sm text-pink-200">
            {loadError}
          </p>
        ) : null}
        {actionError ? (
          <p className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {actionError}
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-slate-300">Loading orders…</p>
        ) : orders.length === 0 ? (
          <p className="text-sm text-slate-300">
            No orders found yet. Orders will appear after customers submit their
            selections.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/80 shadow-2xl backdrop-blur">
            <table className="min-w-full divide-y divide-white/5 text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3 font-medium">Order ID</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Menu date</th>
                  {canSummarizeOrders ? (
                    <>
                      <th className="px-4 py-3 font-medium">Total qty</th>
                      <th className="px-4 py-3 font-medium">Amount</th>
                    </>
                  ) : null}
                  <th className="px-4 py-3 font-medium">Payment</th>
                  <th className="px-4 py-3 font-medium">Last update</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-200">
                {orders.map((order) => {
                  const isExpanded = expandedOrders.includes(order.$id);
                  const menuDate = order.menuDate
                    ? formatMenuDate(order.menuDate)
                    : "Not set";
                  const lastUpdate = order.$updatedAt
                    ? new Date(order.$updatedAt).toLocaleString("id-ID")
                    : "Unknown";
                  const detailColSpan = canSummarizeOrders ? 7 : 5;
                  return (
                    <Fragment key={order.$id}>
                      <tr
                        className={`cursor-pointer transition ${
                          isExpanded ? "bg-white/5" : "hover:bg-white/5"
                        }`}
                        onClick={() => toggleOrderExpanded(order.$id)}
                        onKeyDown={(event) =>
                          handleRowKeyDown(event, order.$id)
                        }
                        role="button"
                        tabIndex={0}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-white/20 bg-white/5 text-xs font-medium text-white">
                              {isExpanded ? "-" : "+"}
                            </span>
                            <span className="font-mono text-xs text-slate-300">
                              {order.$id}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">{order.customerName}</td>
                        <td className="px-4 py-3">{menuDate}</td>
                        {canSummarizeOrders ? (
                          <>
                            <td className="px-4 py-3">
                              {order.summary?.quantity ?? 0}
                            </td>
                            <td className="px-4 py-3">
                              {formatRupiah(order.summary?.amount ?? 0)}
                            </td>
                          </>
                        ) : null}
                        <td className="px-4 py-3">
                          {order.payment ? (
                            <span className="rounded-md bg-emerald-500/20 px-2 py-1 text-xs text-emerald-200">
                              Paid
                            </span>
                          ) : (
                            <div className="flex flex-col gap-2">
                              <span className="inline-flex w-fit rounded-md bg-amber-500/20 px-2 py-1 text-xs text-amber-200">
                                Unpaid
                              </span>
                              <button
                                type="button"
                                className="w-fit rounded-md border border-white/10 px-3 py-1 text-xs font-medium text-white transition hover:border-white/30 disabled:cursor-not-allowed disabled:opacity-70"
                                onClick={(event) =>
                                  handleMarkAsPaid(event, order.$id)
                                }
                                disabled={
                                  markOrderPaid.isPending &&
                                  updatingOrderId === order.$id
                                }
                              >
                                {markOrderPaid.isPending &&
                                updatingOrderId === order.$id
                                  ? "Marking..."
                                  : "Mark as paid"}
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-300">
                          {lastUpdate}
                        </td>
                      </tr>
                      {isExpanded ? (
                        <tr className="bg-slate-900/60">
                          <td
                            className="px-6 py-4 text-sm text-slate-200"
                            colSpan={detailColSpan}
                          >
                            <div className="space-y-4">
                              <div className="flex flex-wrap items-center gap-4 text-xs uppercase tracking-wide text-slate-400">
                                <span>
                                  Customer:&nbsp;
                                  <span className="text-sm font-semibold text-white normal-case">
                                    {order.customerName}
                                  </span>
                                </span>
                                <span>
                                  Order ID:&nbsp;
                                  <span className="font-mono text-xs text-slate-300">
                                    {order.$id}
                                  </span>
                                </span>
                              </div>
                              {order.items && order.items.length > 0 ? (
                                <div>
                                  <h3 className="text-sm font-semibold text-white">
                                    Order items
                                  </h3>
                                  <ul className="mt-2 space-y-2">
                                    {order.items.map((item) => {
                                      const itemQuantity =
                                        Number(item.quantity) || 0;
                                      const itemPriceEach =
                                        Number(item.price) || 0;
                                      const itemTotal =
                                        itemQuantity * itemPriceEach;
                                      const productName =
                                        item.productName ||
                                        (item.productId &&
                                        typeof item.productId === "object"
                                          ? item.productId.name
                                          : "") ||
                                        "Unnamed product";
                                      return (
                                        <li
                                          key={item.$id}
                                          className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200"
                                        >
                                          <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div>
                                              <p className="font-semibold text-white">
                                                {productName}
                                              </p>
                                              <p className="text-xs text-slate-300">
                                                Quantity: {itemQuantity}
                                              </p>
                                            </div>
                                            <div className="text-right">
                                              <p className="text-xs text-slate-300">
                                                Price each
                                              </p>
                                              <p className="text-sm text-white">
                                                {formatRupiah(itemPriceEach)}
                                              </p>
                                              <p className="text-xs text-slate-300">
                                                Total
                                              </p>
                                              <p className="text-sm text-white">
                                                {formatRupiah(itemTotal)}
                                              </p>
                                            </div>
                                          </div>
                                          {item.note ? (
                                            <p className="mt-2 text-xs text-slate-300">
                                              Note: {item.note}
                                            </p>
                                          ) : null}
                                        </li>
                                      );
                                    })}
                                  </ul>
                                </div>
                              ) : (
                                <p className="text-sm text-slate-300">
                                  {canSummarizeOrders
                                    ? "No order items recorded for this order yet."
                                    : "Order item details are unavailable. Define VITE_APPWRITE_ORDER_ITEMS_COLLECTION_ID to enable this view."}
                                </p>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
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

AdminOrders.propTypes = {
  onLogout: PropTypes.func,
};
