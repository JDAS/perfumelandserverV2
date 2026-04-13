function normalizeKeyword(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function parseCalendarDate(value) {
  if (value instanceof Date) {
    return new Date(
      value.getUTCFullYear(),
      value.getUTCMonth(),
      value.getUTCDate()
    );
  }

  const raw = String(value || "").trim();
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (isoMatch) {
    return new Date(
      Number(isoMatch[1]),
      Number(isoMatch[2]) - 1,
      Number(isoMatch[3])
    );
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;

  return new Date(
    parsed.getUTCFullYear(),
    parsed.getUTCMonth(),
    parsed.getUTCDate()
  );
}

export function formatCRC(value) {
  return new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: "CRC",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export function calculatePayments({ total, type, creditType, quotes, salesDate }) {
  const numericTotal = Number(total || 0);

  if (!Number.isFinite(numericTotal) || numericTotal <= 0) return [];

  const normalizedType = normalizeKeyword(type);
  const normalizedCreditType = normalizeKeyword(creditType);

  let nQuotes = 1;
  if (normalizedType === "contado") nQuotes = 1;
  else if (normalizedCreditType === "normal") nQuotes = numericTotal >= 30000 ? 4 : 3;
  else if (normalizedCreditType === "extendido" || normalizedCreditType === "extendido especial") nQuotes = Number(quotes || 1);
  else if (normalizedCreditType === "2 pagos" || normalizedCreditType === "dos pagos") nQuotes = 2;

  if (!Number.isFinite(nQuotes) || nQuotes < 1) nQuotes = 1;

  let amounts = [];
  let remaining = numericTotal;

  if (normalizedCreditType === "extendido especial") {
    const base = Math.floor(numericTotal / nQuotes / 1000) * 1000;
    for (let i = 0; i < nQuotes - 1; i += 1) {
      amounts.push(base);
      remaining -= base;
    }
    amounts.unshift(remaining);
  } else if (normalizedCreditType === "2 pagos" || normalizedCreditType === "dos pagos") {
    const base = Math.floor(numericTotal / 2 / 1000) * 1000;
    amounts = [base, base];
    const diff = numericTotal - base * 2;
    if (diff !== 0) amounts[0] += diff;
  } else {
    for (let i = 0; i < nQuotes; i += 1) {
      amounts.push(Math.floor(numericTotal / nQuotes / 1000) * 1000);
    }

    const diff = numericTotal - amounts.reduce((sum, amount) => sum + amount, 0);
    if (diff > 0) amounts[0] += diff;

    if (
      numericTotal > 50000 &&
      (normalizedCreditType === "normal" || normalizedCreditType === "extendido") &&
      nQuotes > 1
    ) {
      const first = Math.floor((numericTotal * 0.4) / 1000) * 1000;
      const remainder = numericTotal - first;
      const per = Math.floor(remainder / (nQuotes - 1) / 1000) * 1000;
      const lastDiff = remainder - per * (nQuotes - 1);
      amounts = [first + lastDiff];
      for (let i = 1; i < nQuotes; i += 1) amounts.push(per);
    }
  }

  const parsedSalesDate = parseCalendarDate(salesDate);
  if (!parsedSalesDate || Number.isNaN(parsedSalesDate.getTime())) return [];

  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const dates = [];
  const startDate = new Date(parsedSalesDate);
  let lastDate = startDate;

  for (let i = 0; i < nQuotes; i += 1) {
    if (i === 0) {
      dates.push(formatDate(startDate));
    } else {
      const lastDay = lastDate.getDate();
      let next = new Date(lastDate);

      if (lastDay >= 1 && lastDay <= 3) next = new Date(lastDate.getFullYear(), lastDate.getMonth(), 15);
      else if (lastDay > 3 && lastDay <= 18) next = new Date(lastDate.getFullYear(), lastDate.getMonth() + 1, 0);
      else next = new Date(lastDate.getFullYear(), lastDate.getMonth() + 1, 15);

      dates.push(formatDate(next));
      lastDate = next;
    }
  }

  return amounts.map((amount, index) => ({
    number: index + 1,
    fecha: dates[index],
    expectedAmount: amount,
    amountPaid: 0,
    paid: false,
  }));
}
