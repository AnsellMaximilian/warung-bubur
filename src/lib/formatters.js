export const formatRupiah = (value) => {
  if (value === null || value === undefined) {
    return "Rp. 0";
  }

  const numeric =
    typeof value === "number" ? value : Number.parseInt(value, 10);

  if (Number.isNaN(numeric)) {
    return "Rp. 0";
  }

  const rounded = Math.max(0, Math.floor(numeric));
  const formatted = rounded
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  return `Rp. ${formatted}`;
};
