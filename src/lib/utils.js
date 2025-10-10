export const formatMenuDate = (raw) => {
  if (!raw) return "Tanggal tidak diketahui";

  let date;
  if (typeof raw === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const [year, month, day] = raw.split("-").map(Number);
      date = new Date(year, month - 1, day);
    } else {
      date = new Date(raw);
    }
  } else {
    date = new Date(raw);
  }

  if (Number.isNaN(date.getTime())) {
    return raw;
  }

  return date.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};
