function calculatePayments({ total, type, creditType, quotes, salesDate }) {
  /*const total = (products || []).reduce((sum, p) => {
    let price = Number(p.unitprice || 0);

    if (type === "credito") {
      if (price > 25000) price += 5000;
      else price += 3000;
    }

    return sum + (price - Number(p.discount || 0)) * Number(p.quantity || 0);
  }, 0);*/

  let nQuotes = 1;
  if (type === "contado") nQuotes = 1;
  else if (creditType === "normal") {
    nQuotes = total >= 30000 ? 4 : 3;
  } else if (
    creditType === "extendido" ||
    creditType === "extendido especial"
  ) {
    nQuotes = Number(quotes || 1);
  } else if (creditType === "2 pagos") {
    nQuotes = 2;
  }

  let amounts = [];
  let remaining = total;

  if (creditType === "extendido especial") {
    const base = Math.floor(total / nQuotes / 1000) * 1000;
    for (let i = 0; i < nQuotes - 1; i++) {
      amounts.push(base);
      remaining -= base;
    }
    amounts.unshift(remaining);
  } else if (creditType === "2 pagos") {
    const base = Math.floor(total / 2 / 1000) * 1000;
    amounts = [base, base];
    const diff = total - base * 2;
    if (diff !== 0) amounts[0] += diff;
  } else {
    for (let i = 0; i < nQuotes; i++) {
      let amt = Math.floor(total / nQuotes / 1000) * 1000;
      amounts.push(amt);
    }

    let diff = total - amounts.reduce((a, b) => a + b, 0);
    if (diff > 0) amounts[0] += diff;

    if (total > 50000 && (creditType === "normal" || creditType === "extendido")) {
      const first = Math.floor(total * 0.4 / 1000) * 1000;
      const rem = total - first;
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
  const [year, month, day] = String(salesDate || "").split("-").map(Number);
  const sd = new Date(year, month - 1, day);
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