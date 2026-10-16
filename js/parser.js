/* Hisaab — ICICI statement parser.
 * Pure functions, no DOM. Works in the browser (window.HisaabParser) and in Node (module.exports).
 */
(function (root) {
  'use strict';

  // ---------- CSV tokenizer (handles quotes, escaped quotes, CRLF) ----------
  function parseCSV(text) {
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    const delim = guessDelimiter(text);
    const rows = [];
    let row = [], cell = '', inQ = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQ) {
        if (c === '"') {
          if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false;
        } else cell += c;
      } else if (c === '"') inQ = true;
      else if (c === delim) { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.map(r => r.map(c => c.trim()));
  }

  function guessDelimiter(text) {
    const sample = text.slice(0, 5000);
    const counts = { ',': 0, ';': 0, '\t': 0, '|': 0 };
    for (const ch of sample) if (ch in counts) counts[ch]++;
    return Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || ',';
  }

  // ---------- value parsing ----------
  const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

  function pad(n) { return String(n).padStart(2, '0'); }

  function validYMD(y, m, d) {
    if (y < 100) y += 2000;
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCMonth() !== m - 1) return null;
    return `${y}-${pad(m)}-${pad(d)}`;
  }

  /** Indian statements are day-first. Returns 'YYYY-MM-DD' or null. */
  function parseDate(s) {
    if (!s) return null;
    s = String(s).trim().replace(/\s+\d{1,2}:\d{2}(:\d{2})?\s*(am|pm)?$/i, '');
    let m;
    if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/))) return validYMD(+m[1], +m[2], +m[3]);
    if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/))) return validYMD(+m[3], +m[2], +m[1]);
    if ((m = s.match(/^(\d{1,2})[-/ .]([A-Za-z]{3,4})[A-Za-z]*[-/ .,]+(\d{2,4})$/))) {
      const mo = MONTHS[m[2].toLowerCase()];
      return mo ? validYMD(+m[3], mo, +m[1]) : null;
    }
    if ((m = s.match(/^([A-Za-z]{3,4})[A-Za-z]*\s+(\d{1,2}),?\s+(\d{4})$/))) {
      const mo = MONTHS[m[1].toLowerCase()];
      return mo ? validYMD(+m[3], mo, +m[2]) : null;
    }
    return null;
  }

  /** Returns { value: number (>=0), sign: 'dr'|'cr'|null } or null when empty. */
  function parseAmount(s) {
    if (s == null) return null;
    let str = String(s).trim();
    if (!str || str === '-' ) return null;
    let sign = null;
    if (/\b(cr|cr\.)\s*$/i.test(str)) sign = 'cr';
    else if (/\b(dr|dr\.)\s*$/i.test(str)) sign = 'dr';
    const neg = /^\(.*\)$/.test(str) || /^-/.test(str);
    str = str.replace(/(cr|dr)\.?\s*$/i, '').replace(/[₹,\s()]|inr|rs\.?/gi, '').replace(/^-/, '');
    if (!str) return null;
    const v = parseFloat(str);
    if (!isFinite(v)) return null;
    if (neg && !sign) sign = 'neg';
    return { value: Math.abs(v), sign };
  }

  // ---------- header detection ----------
  const H = {
    txDate: /^(transaction|txn|tran)\s*date|^date$/,
    valueDate: /value\s*date/,
    anyDate: /date/,
    desc: /remark|narration|particular|description|details|transaction\s*details/,
    withdrawal: /withdraw|debit|dr\b|paid\s*out/,
    deposit: /deposit|credit|cr\b|paid\s*in/,
    amount: /amount|amt/,
    drcr: /^(cr\/dr|dr\/cr|type|cr|dr|debit\/credit)$/,
    balance: /balance/,
    ref: /cheque|chq|ref/,
  };

  function scoreHeader(row) {
    const cells = row.map(c => c.toLowerCase());
    const has = re => cells.some(c => re.test(c));
    let s = 0;
    if (has(H.anyDate)) s += 2;
    if (has(H.desc)) s += 2;
    if (has(H.withdrawal) || has(H.amount)) s += 2;
    if (has(H.deposit)) s += 1;
    if (has(H.balance)) s += 1;
    return s;
  }

  function findHeaderRow(rows) {
    let best = -1, bestScore = 0;
    for (let i = 0; i < Math.min(rows.length, 60); i++) {
      const sc = scoreHeader(rows[i]);
      if (sc > bestScore) { best = i; bestScore = sc; }
    }
    return bestScore >= 5 ? best : -1;
  }

  /** Guess column indexes from a header row. -1 = not present. */
  function guessMapping(header) {
    const cells = header.map(c => c.toLowerCase().replace(/\s+/g, ' ').trim());
    const find = (re, exclude = []) => cells.findIndex((c, i) => c && re.test(c) && !exclude.includes(i));
    const map = { date: -1, desc: -1, withdrawal: -1, deposit: -1, amount: -1, drcr: -1, balance: -1, ref: -1 };
    map.date = find(H.txDate);
    if (map.date < 0) map.date = find(H.valueDate);
    if (map.date < 0) map.date = find(H.anyDate);
    map.desc = find(H.desc);
    map.balance = find(H.balance);
    const used = () => Object.values(map).filter(v => v >= 0);
    map.drcr = find(H.drcr, used());
    map.withdrawal = find(H.withdrawal, used());
    map.deposit = find(H.deposit, used());
    if (map.withdrawal < 0) map.amount = find(H.amount, used());
    map.ref = find(H.ref, used());
    return map;
  }

  // ---------- merchant + category ----------
  const NOISE = new Set(['upi', 'imps', 'neft', 'rtgs', 'mmt', 'pos', 'bil', 'onl', 'inf', 'ach', 'nach', 'payment', 'paid', 'pay', 'sent', 'na', 'null', 'to', 'from', 'by', 'for', 'txn', 'transfer', 'trf', 'ref', 'collect', 'request', 'upi intent', 'mob', 'net', 'ib', 'billpay', 'debit', 'credit', 'card', 'icici', 'icic', 'hdfc', 'sbin', 'utib', 'kkbk', 'yesb', 'ybl', 'okaxis', 'oksbi', 'okicici', 'paytm', 'phonepe', 'gpay', 'google pay', 'bharatpe']);

  function titleCase(s) {
    return s.toLowerCase().replace(/\b([a-z])/g, (m, c) => c.toUpperCase()).replace(/\s+/g, ' ').trim();
  }

  function extractMerchant(desc) {
    if (!desc) return 'Unknown';
    const d = desc.trim();
    if (/^atm|cash\s*w(i)?d|nfs\/cash|cwdr/i.test(d)) return 'ATM Withdrawal';
    if (/int\.?pd|interest/i.test(d) && d.length < 40) return 'Interest';
    if (/salary|sal\s*cr/i.test(d)) return 'Salary';
    const parts = d.split(/[\/\-|:]+/).map(p => p.trim()).filter(Boolean);
    const good = parts.filter(p => {
      const l = p.toLowerCase();
      if (NOISE.has(l)) return false;
      if (/bank/i.test(p)) return false;
      if (/^[\d\sx*]+$/i.test(p)) return false;           // refs / masked numbers
      if (/^[a-z]{4}0[a-z0-9]{6}$/i.test(p)) return false; // IFSC
      if (/^[a-z0-9]{12,}$/i.test(p) && /\d/.test(p)) return false;
      if (p.length < 3) return false;
      return /[a-z]{3}/i.test(p);
    });
    // UPI lines carry the payee's VPA — the handle is a far better merchant name than the free-text note.
    const vpa = parts.find(p => /^[a-z0-9._-]{2,}@[a-z]+$/i.test(p));
    if (vpa) {
      const handle = vpa.split('@')[0].toLowerCase()
        .split(/[._-]+/)
        .map(w => w.length > 6 ? w.replace(/(upi|india|pvtltd|petrol)$/, '') : w)
        .filter(w => w && !VPA_NOISE.has(w) && !/^\d+$/.test(w))
        .join(' ').replace(/\d+/g, ' ');
      if (handle.trim().length >= 2) return titleCase(handle).slice(0, 40);
    }
    const name = good.find(p => !p.includes('@')) || good[0];
    if (!name) return titleCase(d.slice(0, 32));
    const clean = name.includes('@') ? name.split('@')[0].replace(/[._\d]+/g, ' ') : name;
    return titleCase(clean).slice(0, 40) || 'Unknown';
  }

  const VPA_NOISE = new Set(['payu', 'rzp', 'razorpay', 'rides', 'upi', 'india', 'indiapvt', 'cf', 'pg', 'paytm', 'bharatpe', 'online', 'mer', 'merchant', 'pay', 'payments', 'in', 'apl', 'qr', 'ezetap', 'billdesk', 'cashfree', 'rent', 'store']);

  /** The free-text note a payer typed in a UPI transfer ("Dinner", "Weekend trip"), if any. */
  function extractNote(desc) {
    if (!/^(upi|mmt|imps)/i.test(desc || '')) return '';
    const parts = desc.split('/').map(p => p.trim());
    const note = parts.find((p, i) => i > 0 && /[a-z]{3}/i.test(p) && !p.includes('@') && !/bank|^upi$|^imps$|^mmt$/i.test(p) && !(/^[a-z]{3}[0-9a-z]{3}$/i.test(p) && /\d/.test(p)));
    return note && !/^(payment|pay|upi|na|sent|paid)$/i.test(note) ? note : '';
  }

  const CATEGORY_RULES = [
    ['Food & Dining', /swiggy|zomato|restaurant|resto|cafe|coffee|starbucks|domino|pizza|mcdonald|kfc|burger|eatery|dhaba|biryani|bakery|chai|food|kitchen|hotel|eatfit|dineout|haldiram|barbeque/i],
    ['Groceries', /bigbasket|blinkit|zepto|instamart|dmart|grofers|jiomart|grocery|kirana|supermarket|reliance\s*fresh|more\s*retail|nature.?s\s*basket|milk|dairy/i],
    ['Travel', /uber|ola\b|olacabs|rapido|irctc|makemytrip|goibibo|indigo|air\s*india|vistara|akasa|redbus|metro|cleartrip|yatra|ixigo|fastag|toll|parking/i],
    ['Fuel', /petrol|fuel|hpcl|iocl|bpcl|indian\s*oil|shell|bharat\s*petro|hp\s*pay/i],
    ['Shopping', /amazon|amzn|flipkart|myntra|ajio|meesho|nykaa|tata\s*cliq|croma|reliance\s*digital|decathlon|ikea|lifestyle|westside|zara|h&m|shoppers/i],
    ['Bills & Utilities', /airtel|jio|vodafone|vi\s|bsnl|electricity|bescom|msedcl|tata\s*power|adani|broadband|recharge|gas|water\s*bill|dth|tatasky|act\s*fibernet|bil\/|billdesk|postpaid|insurance|lic/i],
    ['Entertainment', /netflix|spotify|bookmyshow|hotstar|prime\s*video|youtube|pvr|inox|sony\s*liv|zee5|gaming|steam|playstation/i],
    ['Health', /pharma|apollo|medplus|1mg|netmeds|pharmeasy|hospital|clinic|doctor|diagnostic|lab|health|dental|gym|cult\.?fit/i],
    ['Rent & Home', /rent|landlord|nobroker|society|maintenance|urban\s*company|housejoy/i],
    ['Investments', /zerodha|groww|upstox|mutual|sip|nps|ppf|indmoney|kuvera|coin|smallcase|angel/i],
    ['Cash', /atm|cash\s*w/i],
    ['Education', /school|college|udemy|coursera|byju|unacademy|tuition|fees|exam/i],
  ];

  const CATEGORIES = ['Food & Dining', 'Groceries', 'Travel', 'Fuel', 'Shopping', 'Bills & Utilities', 'Entertainment', 'Health', 'Rent & Home', 'Investments', 'Cash', 'Education', 'Transfers', 'Income', 'Other'];

  function categorize(desc, type) {
    for (const [cat, re] of CATEGORY_RULES) if (re.test(desc)) return cat;
    if (type === 'credit') return /salary|sal\s*cr|int\.?pd|interest|refund|cashback/i.test(desc) ? 'Income' : 'Transfers';
    if (/^(upi|neft|imps|rtgs|mmt)/i.test(desc)) return 'Transfers';
    return 'Other';
  }

  // ---------- stable id for de-duplication ----------
  function hash(str) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(36) + (h1 >>> 0).toString(36);
  }

  // ---------- main: rows + mapping → transactions ----------
  function extractTransactions(rows, headerIdx, map) {
    const out = [];
    const seen = {};
    let skipped = 0;
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      const date = parseDate(r[map.date]);
      if (!date) { if (r.some(c => c)) skipped++; continue; }
      const desc = (r[map.desc] || '').replace(/\s+/g, ' ').trim();
      let type = null, amount = 0;
      const w = map.withdrawal >= 0 ? parseAmount(r[map.withdrawal]) : null;
      const dpt = map.deposit >= 0 ? parseAmount(r[map.deposit]) : null;
      if (w && w.value > 0) { type = 'debit'; amount = w.value; }
      else if (dpt && dpt.value > 0) { type = 'credit'; amount = dpt.value; }
      else if (map.amount >= 0) {
        const a = parseAmount(r[map.amount]);
        if (a && a.value > 0) {
          amount = a.value;
          const flag = map.drcr >= 0 ? String(r[map.drcr]).toLowerCase() : '';
          if (/cr|credit/.test(flag) || a.sign === 'cr') type = 'credit';
          else type = 'debit';
        }
      }
      if (!type) { skipped++; continue; }
      const bal = map.balance >= 0 ? parseAmount(r[map.balance]) : null;
      const ref = map.ref >= 0 ? (r[map.ref] || '').trim() : '';
      const balance = bal ? (bal.sign === 'dr' || bal.sign === 'neg' ? -bal.value : bal.value) : null;
      const base = [date, desc, type, amount.toFixed(2), balance == null ? '' : balance.toFixed(2), ref].join('|');
      // Two identical lines on one statement are real (e.g. two ₹20 chai payments) — keep both, distinct ids.
      seen[base] = (seen[base] || 0) + 1;
      const id = 't_' + hash(base + '#' + seen[base]);
      out.push({
        id, date, desc, type,
        amount: Math.round(amount * 100) / 100,
        balance, ref,
        merchant: extractMerchant(desc),
        note: extractNote(desc),
        category: categorize(desc, type),
        source: 'icici',
      });
    }
    return { transactions: out, skipped };
  }

  /** One-shot: text → { ok, header, headerIdx, mapping, rows, transactions, skipped, error } */
  function parseStatement(text, mappingOverride) {
    const rows = parseCSV(text);
    if (!rows.length) return { ok: false, error: 'The file is empty.' };
    let headerIdx = findHeaderRow(rows);
    if (headerIdx < 0) headerIdx = 0;
    const header = rows[headerIdx];
    const mapping = mappingOverride || guessMapping(header);
    const ready = mapping.date >= 0 && mapping.desc >= 0 && (mapping.withdrawal >= 0 || mapping.deposit >= 0 || mapping.amount >= 0);
    const res = ready ? extractTransactions(rows, headerIdx, mapping) : { transactions: [], skipped: 0 };
    return {
      ok: ready && res.transactions.length > 0,
      rows, header, headerIdx, mapping,
      transactions: res.transactions, skipped: res.skipped,
      error: !ready ? "Couldn't identify the date, description and amount columns — pick them below." :
        !res.transactions.length ? 'No transactions found with this column mapping.' : null,
    };
  }

  const api = { parseCSV, parseDate, parseAmount, guessMapping, findHeaderRow, extractTransactions, parseStatement, extractMerchant, extractNote, categorize, CATEGORIES, hash };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HisaabParser = api;
})(typeof window !== 'undefined' ? window : globalThis);
