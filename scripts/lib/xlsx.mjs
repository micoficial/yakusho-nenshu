// 依存なしで .xlsx を読む（ZIP の中の XML を取り出して、セルの値を行の配列にする）
import fs from 'node:fs';
import zlib from 'node:zlib';

function unzip(buf) {
  // 中央ディレクトリの終わり（EOCD）を後ろから探す
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('ZIP ではありません');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = new Map();
  for (let k = 0; k < count; k++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('ZIP の目次が壊れています');
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nlen = buf.readUInt16LE(p + 28);
    const elen = buf.readUInt16LE(p + 30);
    const clen = buf.readUInt16LE(p + 32);
    const off = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nlen);
    p += 46 + nlen + elen + clen;
    const lnlen = buf.readUInt16LE(off + 26);
    const lelen = buf.readUInt16LE(off + 28);
    const start = off + 30 + lnlen + lelen;
    const raw = buf.subarray(start, start + csize);
    files.set(name, () => (method === 0 ? raw : zlib.inflateRawSync(raw)));
  }
  return files;
}

const XML_ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const unxml = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => {
  if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1));
  return XML_ENT[e] ?? m;
});
// <si> の中の文字（ふりがな <rPh> は除く）
const textOf = (xml) => unxml(xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '').replace(/<phoneticPr\b[^>]*\/>/g, '')
  .match(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t\s*\/>/g)?.map((t) => t.replace(/^<t[^>]*>|<\/t>$/g, '').replace(/^<t\s*\/>$/, '')).join('') ?? '');

const colNum = (letters) => [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
export const cellRef = (ref) => {
  const m = /^([A-Z]+)(\d+)$/.exec(ref);
  return { c: colNum(m[1]), r: +m[2] - 1 };
};

// 戻り値: [{ name, rows: [[値...]...], merges: [{r1,c1,r2,c2}] }]
export function readXlsx(file) {
  const files = unzip(fs.readFileSync(file));
  const get = (n) => { const f = files.get(n); return f ? f().toString('utf8') : null; };
  const shared = [];
  const ss = get('xl/sharedStrings.xml');
  if (ss) for (const m of ss.matchAll(/<si>([\s\S]*?)<\/si>|<si\/>/g)) shared.push(m[1] ? textOf(m[1]) : '');
  const wb = get('xl/workbook.xml');
  const rels = get('xl/_rels/workbook.xml.rels') || '';
  const relMap = new Map([...rels.matchAll(/<Relationship\b[^>]*>/g)].map((m) => [/Id="([^"]+)"/.exec(m[0])[1], /Target="([^"]+)"/.exec(m[0])[1]]));
  const sheets = [];
  for (const m of wb.matchAll(/<sheet\b[^>]*>/g)) {
    const name = unxml(/name="([^"]*)"/.exec(m[0])[1]);
    const rid = /r:id="([^"]+)"/.exec(m[0])?.[1] ?? /\bid="([^"]+)"/.exec(m[0])?.[1];
    let target = relMap.get(rid);
    target = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
    const xml = get(target);
    const rows = [];
    for (const rm of xml.matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
      if (!rm[1]) continue;
      for (const cm of rm[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = cm[1];
        const ref = /r="([A-Z]+\d+)"/.exec(attrs)?.[1];
        if (!ref || !cm[2]) continue;
        const t = /t="(\w+)"/.exec(attrs)?.[1];
        const v = /<v>([\s\S]*?)<\/v>/.exec(cm[2])?.[1];
        let val;
        if (t === 's') val = shared[+v];
        else if (t === 'inlineStr') val = textOf(/<is>([\s\S]*?)<\/is>/.exec(cm[2])?.[1] ?? '');
        else if (t === 'str' || t === 'e') val = v != null ? unxml(v) : '';
        else if (t === 'b') val = v === '1';
        else val = v != null && v !== '' ? +v : null;
        if (val == null) continue;
        const { r, c } = cellRef(ref);
        (rows[r] ||= [])[c] = val;
      }
    }
    const merges = [...xml.matchAll(/<mergeCell ref="([A-Z]+\d+):([A-Z]+\d+)"/g)].map((mm) => {
      const a = cellRef(mm[1]); const b = cellRef(mm[2]);
      return { r1: a.r, c1: a.c, r2: b.r, c2: b.c };
    });
    sheets.push({ name, rows, merges });
  }
  return sheets;
}
