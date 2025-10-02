export function parseCSV(text, { delimiter = ';', headers = true } = {}) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').filter(l => l.trim().length);
  if (!lines.length) return [];
  let cols = [];
  let start = 0;
  if (headers) {
    cols = splitLine(lines[0], delimiter);
    start = 1;
  }
  const rows = [];
  for (let i = start; i < lines.length; i++) {
    const parts = splitLine(lines[i], delimiter);
    if (!headers) {
      rows.push(parts);
    } else {
      const obj = {};
      cols.forEach((c, idx) => (obj[c] = parts[idx] ?? ''));
      rows.push(obj);
    }
  }
  return rows;
}

function splitLine(line, delimiter) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map(s => s.trim());
}

