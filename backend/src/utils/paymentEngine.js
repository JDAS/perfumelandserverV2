function calculatePayments({ total, type, creditType, quotes, salesDate }) {
  /*const total = (products || []).reduce((sum, p) => {
    let price = Number(p.unitprice || 0);

    if (type === "credito") {
      if (price > 25000) price += 5000;
      else price += 3000;
    }

    return sum + (price - Number(p.discount || 0)) * Number(p.quantity || 0);
  }, 0);*/

  const numericTotal = Number(total || 0);

  if (!Number.isFinite(numericTotal) || numericTotal <= 0) {
    return [];
  }

  let nQuotes = 1;
  if (type === "contado") nQuotes = 1;
  else if (creditType === "normal") {
    nQuotes = numericTotal >= 30000 ? 4 : 3;
  } else if (
    creditType === "extendido" ||
    creditType === "extendido especial"
  ) {
    nQuotes = Number(quotes || 1);
  } else if (creditType === "2 pagos") {
    nQuotes = 2;
  }

  if (!Number.isFinite(nQuotes) || nQuotes < 1) {
    nQuotes = 1;
  }

  let amounts = [];
  let remaining = numericTotal;

  if (creditType === "extendido especial") {
    const base = Math.floor(numericTotal / nQuotes / 1000) * 1000;
    for (let i = 0; i < nQuotes - 1; i++) {
      amounts.push(base);
      remaining -= base;
    }
    amounts.unshift(remaining);
  } else if (creditType === "2 pagos") {
    const base = Math.floor(numericTotal / 2 / 1000) * 1000;
    amounts = [base, base];
    const diff = numericTotal - base * 2;
    if (diff !== 0) amounts[0] += diff;
  } else {
    for (let i = 0; i < nQuotes; i++) {
      let amt = Math.floor(numericTotal / nQuotes / 1000) * 1000;
      amounts.push(amt);
    }

    let diff = numericTotal - amounts.reduce((a, b) => a + b, 0);
    if (diff > 0) amounts[0] += diff;

    if (
      numericTotal > 50000 &&
      (creditType === "normal" || creditType === "extendido") &&
      nQuotes > 1
    ) {
      const first = Math.floor(numericTotal * 0.4 / 1000) * 1000;
      const rem = numericTotal - first;
      const per = Math.floor(rem / (nQuotes - 1) / 1000) * 1000;
      const lastDiff = rem - per * (nQuotes - 1);
      amounts = [first + lastDiff];
      for (let i = 1; i < nQuotes; i++) amounts.push(per);
    }
  }

  function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  const dates = [];
  const parsedSalesDate =
    salesDate instanceof Date ? new Date(salesDate) : new Date(salesDate);

  if (Number.isNaN(parsedSalesDate.getTime())) {
    return [];
  }

  const sd = new Date(
    parsedSalesDate.getFullYear(),
    parsedSalesDate.getMonth(),
    parsedSalesDate.getDate()
  );
  let lastDate = sd;

  for (let i = 0; i < nQuotes; i++) {
    if (i === 0) {
      dates.push(formatDate(sd));
    } else {
      const lastDay = lastDate.getDate();
      let next = new Date(lastDate);

      if (lastDay >= 1 && lastDay <= 3) {
        next = new Date(lastDate.getFullYear(), lastDate.getMonth(), 15);
      } else if (lastDay > 3 && lastDay <= 18) {
        next = new Date(lastDate.getFullYear(), lastDate.getMonth() + 1, 0);
      } else {
        next = new Date(lastDate.getFullYear(), lastDate.getMonth() + 1, 15);
      }

      dates.push(formatDate(next));
      lastDate = next;
    }
  }

  return amounts.map((amt, i) => ({
    number: i + 1,
    fecha: dates[i],
    expectedAmount: amt,
    amountPaid: 0,
    paid: false,
  }));
}

module.exports = { calculatePayments };
