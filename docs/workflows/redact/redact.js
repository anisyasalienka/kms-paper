// Masks credentials and structured personal data before any text reaches a model (NFR4, GR7).
// Detection is rule-based: known formats, keyword + value, and random-looking strings.
// Each hit is replaced by a tag that carries only the masked value, e.g. [KREDENSIAL: Vpn#****].
const TAG = { credential: 'KREDENSIAL', personal_data: 'DATA_PRIBADI' };
const TAG_RE = /\[(?:KREDENSIAL|DATA_PRIBADI): [^\]\n]{1,80}\]/g;

const maskHead = raw => raw.length <= 4 ? '****' : raw.slice(0, Math.min(4, Math.ceil(raw.length / 3))) + '****';
const digits = s => s.replace(/\D/g, '');

function luhn(num) {
  let sum = 0, alt = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let d = +num[i];
    if (alt) { d *= 2; if (d > 9) d -= 9; }
    sum += d; alt = !alt;
  }
  return sum % 10 === 0;
}

function validNik(n) {
  const prov = +n.slice(0, 2), day = +n.slice(6, 8), month = +n.slice(8, 10);
  return prov >= 11 && prov <= 94 && ((day >= 1 && day <= 31) || (day >= 41 && day <= 71)) && month >= 1 && month <= 12;
}

// Values after a keyword that are words, not secrets ("password: menyusul").
const NOT_A_VALUE = new Set(['ada', 'sama', 'akan', 'belum', 'tidak', 'yang', 'dan', 'atau', 'dikirim', 'terlampir', 'menyusul',
  'lihat', 'tanya', 'hubungi', 'sudah', 'baru', 'lama', 'default', 'kosong', 'none', 'null', 'n/a', 'tbd', 'sent', 'see', 'via', 'the', 'is',
  'bearer', 'basic']);

const KEYWORD = String.raw`(?:password|passwd|pwd|pass|kata\s?sandi|sandi|passcode|pin|otp|client[_\s-]?secret|secret[_\s-]?key|secret|api[_\s-]?key|apikey|(?:merchant|access|app|license|licence|encryption|signing|master|server|secret|private)[_\s-]?key|access[_\s-]?token|auth[_\s-]?token|token)`;
const KEYWORD_VALUE_RE = new RegExp(
  String.raw`(?<![A-Za-z])(${KEYWORD})(?![A-Za-z])([^\n:=]{0,30}?)(\s*(?::|=|\badalah\b|\byaitu\b|\bis\b)\s*)(["'\x60]?)([^\s"'\x60]{4,128})`, 'gi');
const KEYWORD_SPACE_RE = new RegExp(
  String.raw`(?<![A-Za-z])(${KEYWORD})([ \t]+)(["'\x60]?)([^\s"'\x60:=]{6,128})`, 'gi');

const RULES = [
  { type: 'private_key', category: 'credential',
    re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    mask: () => 'private key' },
  { type: 'url_password', category: 'credential',
    re: /\b([a-z][a-z0-9+.-]*:\/\/[^\s:@\/]+:)([^\s\/]+)(@)(?=[^\s@\/]+)/gi,
    replace: (m, pre, pw, at, hit) => pre + hit(pw) + at },
  { type: 'api_token', category: 'credential',
    re: /\b(?:eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}|sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{30,}|xox[abpr]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{35})\b/g },
  { type: 'bearer_token', category: 'credential',
    re: /\b(Bearer\s+)([A-Za-z0-9._~+\/-]{12,}=*)/g,
    replace: (m, pre, tok, hit) => pre + hit(tok) },
  { type: 'keyword_secret', category: 'credential',
    re: KEYWORD_VALUE_RE,
    replace: (m, kw, mid, sep, q, val, hit) => {
      const v = val.replace(/[.,;:)\]]+$/, '');
      const tail = val.slice(v.length);
      if (v.length < 4 || NOT_A_VALUE.has(v.toLowerCase()) || /^\*+$/.test(v) || v.startsWith('[')) return m;
      return kw + mid + sep + q + hit(v) + tail;
    } },
  // Keyword followed only by a space ("password Reko#Stg2026!"): masked only when the value looks like a secret
  // (letters and digits, plus a symbol or mixed case), so "password reset sudah selesai" is left alone.
  { type: 'keyword_secret', category: 'credential',
    re: KEYWORD_SPACE_RE,
    replace: (m, kw, sep, q, val, hit) => {
      const v = val.replace(/[.,;:)\]]+$/, '');
      const tail = val.slice(v.length);
      const secretLike = /\d/.test(v) && /[A-Za-z]/.test(v) && (/[!@#$%^&*+=?~]/.test(v) || (/[a-z]/.test(v) && /[A-Z]/.test(v)));
      if (v.length < 6 || !secretLike || v.startsWith('[')) return m;
      return kw + sep + q + hit(v) + tail;
    } },
  { type: 'nik', category: 'personal_data',
    re: /(?<![\d])(\d{16})(?![\d])/g,
    replace: (m, n, hit) => validNik(n) ? hit(n, n.slice(0, 4) + '************') : m },
  { type: 'npwp', category: 'personal_data',
    re: /\b\d{2}\.\d{3}\.\d{3}\.\d-\d{3}\.\d{3}\b/g,
    mask: raw => raw.slice(0, 2) + '.***.***.*-***.***' },
  { type: 'card_number', category: 'personal_data',
    re: /(?<![\d-])([3-6]\d{3}(?:[ -]?\d{4}){2}[ -]?\d{1,7})(?![\d-])/g,
    replace: (m, n, hit) => { const d = digits(n); return d.length >= 13 && d.length <= 19 && luhn(d) ? hit(n, '**** **** **** ' + d.slice(-4)) : m; } },
  { type: 'bank_account', category: 'personal_data',
    re: /((?:no\.?\s*)?(?:rekening|rek\.|account number|a\/c)[^\n\d]{0,20})(\d[\d -]{6,18}\d)/gi,
    replace: (m, pre, n, hit) => pre + hit(n, '****' + digits(n).slice(-4)) },
  { type: 'phone', category: 'personal_data',
    re: /(?<![\d\w])((?:\+62|62|0)8\d{1,2}[- .]?\d{3,4}[- .]?\d{3,5})(?![\d])/g,
    replace: (m, n, hit) => { const d = digits(n); return d.length >= 10 && d.length <= 14 ? hit(n, n.slice(0, 4) + '****' + d.slice(-2)) : m; } },
  { type: 'personal_email', category: 'personal_data',
    re: /\b([A-Za-z0-9._%+-]+)@((?:gmail|yahoo|ymail|hotmail|outlook|live|icloud|proton|protonmail)\.[a-z.]{2,6})\b/gi,
    replace: (m, user, dom, hit) => hit(m, user[0] + '***@' + dom) },
  // Random-looking strings without a keyword: needs a real symbol, so IDs, hashes and UUIDs are not hit.
  { type: 'random_secret', category: 'credential',
    re: /(?<![\w\/:.@-])([A-Za-z0-9!@#$%^&*+=?~_-]{10,64})(?![\w\/.@-])/g,
    replace: (m, s, hit) => {
      const classes = [/[a-z]/, /[A-Z]/, /\d/, /[!@#$%^&*+=?~]/].filter(r => r.test(s)).length;
      return classes >= 3 && /[!@#$%^&*+=?~]/.test(s) && !/^[!@#$%^&*+=?~]|[!@#$%^&*+=?~]$/.test(s) ? hit(s) : m;
    } },
];

// Links are kept verbatim (the agent needs them to open documents); only a password inside a link is masked.
const URL_RE = /\bhttps?:\/\/[^\s<>"')\]]+/g;
const SOURCE_ID_RE = /\b(?:gdoc|gsheet|gslide|gpdf|gfolder):[A-Za-z0-9_-]{10,}/g;

function redactText(text, location, findings) {
  if (typeof text !== 'string' || text.length < 4) return text;
  const kept = [];
  const keep = s => { kept.push(s); return '\u0000' + (kept.length - 1) + '\u0000'; };
  let out = text.replace(TAG_RE, keep);
  for (const rule of RULES) {
    if (rule.type === 'nik') out = out.replace(URL_RE, u => keep(u)).replace(SOURCE_ID_RE, keep);
    out = out.replace(rule.re, (...args) => {
      const groups = args.slice(0, -2).filter(a => typeof a !== 'object');
      const hit = (raw, masked) => {
        const mv = masked || (rule.mask ? rule.mask(raw) : maskHead(raw));
        findings.push({ category: rule.category, type: rule.type, location, masked_value: mv });
        return keep('[' + TAG[rule.category] + ': ' + mv + ']');
      };
      if (rule.replace) return rule.replace(...groups, hit);
      return hit(groups[0]);
    });
  }
  while (/\u0000\d+\u0000/.test(out)) out = out.replace(/\u0000(\d+)\u0000/g, (m, i) => kept[+i]);
  return out;
}

// Header and identifier fields are routing data, not content.
const SKIP_KEYS = new Set(['source_id', 'message_id', 'attachment_id', 'from', 'to', 'cc', 'bcc', 'date', 'mime_type',
  'url', 'web_view_link', 'id', 'reader_tool', 'type', 'extraction_status', 'modified_time', 'code']);

function redactValue(value, path, findings) {
  if (typeof value === 'string') return redactText(value, path, findings);
  if (Array.isArray(value)) return value.map((v, i) => redactValue(v, path + '[' + i + ']', findings));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = SKIP_KEYS.has(k) ? v : redactValue(v, path ? path + '.' + k : k, findings);
    return out;
  }
  return value;
}

if (typeof module !== 'undefined') module.exports = { redactValue, redactText };
