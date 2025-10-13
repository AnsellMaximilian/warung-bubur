import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export const formatMenuDate = (raw) => {
  let date;
  if (!raw) {
    date = new Date();
  } else if (typeof raw === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const [year, month, day] = raw.split("-").map(Number);
      date = new Date(year, month - 1, day);
    } else {
      date = new Date(raw);
    }
  } else {
    date = new Date(raw);
  }

  // ✅ If invalid date, fallback to today
  if (Number.isNaN(date.getTime())) {
    date = new Date();
  }

  return date.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};
