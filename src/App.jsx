import React, { useState, useEffect, useMemo } from 'react';
import { db } from './firebase';
import { collection, doc, onSnapshot, setDoc, getDoc, writeBatch } from 'firebase/firestore';
import { Plus, X, Search, TrendingUp, TrendingDown, Minus, Upload, Calendar, Target, Zap, ChevronRight, ChevronLeft, BarChart3, FileText, Image as ImageIcon, Trash2, Edit3, CheckCircle2, LayoutGrid, CalendarDays, GitBranch, ArrowRight, Layers, ExternalLink, Settings, FileUp, AlertCircle, ArrowUpDown, Eye } from 'lucide-react';

const STORAGE_KEY = 'abtests:all';
const CLICKUP_SETTINGS_KEY = 'abtests:clickup-settings';

// Build a ClickUp task-create URL with prefilled fields
const buildClickUpUrl = (test, settings) => {
  const baseUrl = settings?.workspaceUrl?.trim() || 'https://app.clickup.com';
  // Strip trailing slash
  const base = baseUrl.replace(/\/$/, '');

  const title = `[${test.brand}] ${test.changesTo} Test: ${test.adSet || 'Untitled'}`;

  const descLines = [
    `**Brand:** ${test.brand}`,
    `**Ad Set:** ${test.adSet || '—'}`,
    `**Change Type:** ${test.changesTo}`,
    `**Status:** ${test.status}`,
    '',
    `**Objective:**`,
    test.objective || '—',
    '',
    `**Differentiator:**`,
    test.differentiator || '—',
    '',
    `**Variation A:** ${test.variationA?.name || '—'}`,
    test.variationA?.description ? test.variationA.description : '',
    '',
    `**Variation B:** ${test.variationB?.name || '—'}`,
    test.variationB?.description ? test.variationB.description : '',
    '',
    `**Designs Due:** ${test.designsDue || 'TBD'}`,
    `**Launch Date:** ${test.launchDate || 'TBD'}`,
    `**Review Date:** ${test.reviewDate || 'TBD'}`,
  ].filter(Boolean).join('\n');

  const params = new URLSearchParams();
  params.set('name', title);
  params.set('description', descLines);
  if (test.launchDate) params.set('due_date', test.launchDate);

  // ClickUp's universal task-create deep link
  return `${base}/t/new?${params.toString()}`;
};

const BRAND_COLORS = {
  'Anthem': { bg: '#FEE2E2', text: '#991B1B', accent: '#DC2626' },
  'Aspen & Arlo': { bg: '#EDE9FE', text: '#5B21B6', accent: '#7C3AED' },
  'Lemon Park': { bg: '#FEF3C7', text: '#92400E', accent: '#D97706' },
  'Painted Paper': { bg: '#DBEAFE', text: '#1E40AF', accent: '#2563EB' },
  'Lashbox LA': { bg: '#FCE7F3', text: '#9D174D', accent: '#DB2777' },
  'What We Make': { bg: '#D1FAE5', text: '#065F46', accent: '#059669' },
  'Corroon': { bg: '#E0E7FF', text: '#3730A3', accent: '#4F46E5' },
  'Parisi Coffee': { bg: '#FED7AA', text: '#9A3412', accent: '#EA580C' },
  'Savoy Tea': { bg: '#CFFAFE', text: '#155E75', accent: '#0891B2' },
};

const getBrandStyle = (brand) => BRAND_COLORS[brand] || { bg: '#E5E7EB', text: '#374151', accent: '#6B7280' };

const STATUS_CONFIG = {
  'planning': { label: 'Planning', color: '#6B7280', bg: '#F3F4F6' },
  'design-needed': { label: 'Design Needed', color: '#B91C1C', bg: '#FEE2E2' },
  'in-design': { label: 'In Design', color: '#D97706', bg: '#FEF3C7' },
  'design-complete': { label: 'Design Complete', color: '#0E7490', bg: '#CFFAFE' },
  'ready-to-launch': { label: 'Ready to Launch', color: '#7C2D12', bg: '#FED7AA' },
  'live': { label: 'Live', color: '#2563EB', bg: '#DBEAFE' },
  'review': { label: 'In Review', color: '#7C3AED', bg: '#EDE9FE' },
  'complete': { label: 'Complete', color: '#059669', bg: '#D1FAE5' },
};

// Statuses that count as "In Pipeline" for the header counter
const PIPELINE_STATUSES = ['planning', 'design-needed', 'in-design', 'design-complete', 'ready-to-launch'];

const CHANGE_TYPES = ['Copy', 'Imagery', 'Graphic', 'Ad Strategy', 'Headline', 'CTA', 'Audience', 'Format'];

const seedData = [
  {
    id: 'seed-1', brand: 'Anthem', adSet: 'AM51', changesTo: 'Copy',
    objective: 'Determine if human-product interaction drives higher engagement than siloed product imagery',
    differentiator: 'Variation A: Human | Variation B: Silo',
    variationA: { name: 'Human', description: 'Lifestyle shot with model interacting with product', imageUrl: '' },
    variationB: { name: 'Silo', description: 'Clean product shot on white background', imageUrl: '' },
    designsDue: '2026-05-31', launchDate: '2026-05-31', reviewDate: '2026-05-31',
    status: 'planning', winner: null, parentId: null,
    metrics: { a: { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 }, b: { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 } },
    dailyLog: [], notes: ''
  },
  {
    id: 'seed-2', brand: 'Aspen & Arlo', adSet: 'AAM51', changesTo: 'Imagery',
    objective: 'Test imagery style impact on click-through',
    differentiator: 'Variation A: Human | Variation B: Silo',
    variationA: { name: 'Human', description: '', imageUrl: '' },
    variationB: { name: 'Silo', description: '', imageUrl: '' },
    designsDue: '2026-05-31', launchDate: '2026-05-31', reviewDate: '2026-05-31',
    status: 'planning', winner: null, parentId: null,
    metrics: { a: { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 }, b: { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 } },
    dailyLog: [], notes: ''
  },
  {
    id: 'seed-3', brand: 'Lemon Park', adSet: 'LPM51', changesTo: 'Graphic',
    objective: 'Test graphic treatment effect on conversion',
    differentiator: 'Variation A: Human | Variation B: Silo',
    variationA: { name: 'Human', description: '', imageUrl: '' },
    variationB: { name: 'Silo', description: '', imageUrl: '' },
    designsDue: '2026-05-31', launchDate: '2026-05-31', reviewDate: '2026-05-31',
    status: 'planning', winner: null, parentId: null,
    metrics: { a: { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 }, b: { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 } },
    dailyLog: [], notes: ''
  },
  {
    id: 'seed-4', brand: 'Painted Paper', adSet: 'PPM51', changesTo: 'Ad Strategy',
    objective: 'Validate ad strategy direction for trade audience',
    differentiator: 'Variation A: Human | Variation B: Silo',
    variationA: { name: 'Human', description: '', imageUrl: '' },
    variationB: { name: 'Silo', description: '', imageUrl: '' },
    designsDue: '2026-05-31', launchDate: '2026-05-31', reviewDate: '2026-05-31',
    status: 'planning', winner: null, parentId: null,
    metrics: { a: { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 }, b: { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 } },
    dailyLog: [], notes: ''
  },
];

const calcMetrics = (m) => {
  const ctr = m.impressions > 0 ? (m.clicks / m.impressions) * 100 : 0;
  const cpc = m.clicks > 0 ? m.spend / m.clicks : 0;
  const cpa = m.conversions > 0 ? m.spend / m.conversions : 0;
  const cvr = m.clicks > 0 ? (m.conversions / m.clicks) * 100 : 0;
  const roas = m.spend > 0 ? m.revenue / m.spend : 0;
  return { ctr, cpc, cpa, cvr, roas };
};

const calcSignificance = (a, b) => {
  if (a.clicks < 30 || b.clicks < 30) return { significant: false, confidence: 0, pValue: 1, message: 'Need at least 30 clicks per variation' };
  const pA = a.conversions / a.clicks;
  const pB = b.conversions / b.clicks;
  const pPool = (a.conversions + b.conversions) / (a.clicks + b.clicks);
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / a.clicks + 1 / b.clicks));
  if (se === 0) return { significant: false, confidence: 0, pValue: 1, message: 'No variance detected' };
  const z = Math.abs(pA - pB) / se;
  const pValue = 2 * (1 - normalCDF(z));
  const confidence = (1 - pValue) * 100;
  return {
    significant: pValue < 0.05,
    confidence: Math.min(confidence, 99.9),
    pValue, z,
    message: pValue < 0.05 ? 'Statistically significant' : 'Not yet significant'
  };
};

const normalCDF = (z) => {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
};

// ============ CSV PARSING ============
// Simple CSV parser handling quoted fields with commas
const parseCSV = (text) => {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line) => {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (c === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur.trim());
    return result;
  };

  const headers = parseLine(lines[0]).map(h => h.replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map(line => {
    const values = parseLine(line);
    const row = {};
    headers.forEach((h, i) => { row[h] = (values[i] || '').replace(/^"|"$/g, ''); });
    return row;
  });
  return { headers, rows };
};

// Platform field mapping. Each platform has different column names for the same metric.
const PLATFORM_MAPPINGS = {
  meta: {
    name: 'Meta Ads',
    detect: (h) => h.some(c => /amount spent|cpm \(cost|reach/i.test(c)) || h.some(c => c.toLowerCase() === 'amount spent (usd)'),
    spend: ['Amount spent (USD)', 'Amount spent', 'Spend'],
    impressions: ['Impressions'],
    clicks: ['Link clicks', 'Clicks (all)', 'Clicks'],
    conversions: ['Results', 'Purchases', 'Website purchases', 'Conversions'],
    revenue: ['Purchases conversion value', 'Website purchases conversion value', 'Conversion value'],
    date: ['Day', 'Date', 'Reporting starts'],
  },
  google: {
    name: 'Google Ads',
    detect: (h) => h.some(c => /^cost$/i.test(c)) && h.some(c => /^impr|impressions/i.test(c)),
    spend: ['Cost', 'Cost (USD)'],
    impressions: ['Impr.', 'Impressions'],
    clicks: ['Clicks'],
    conversions: ['Conversions', 'All conv.', 'All conversions'],
    revenue: ['Conv. value', 'All conv. value', 'Conversion value'],
    date: ['Day', 'Date'],
  },
  tiktok: {
    name: 'TikTok Ads',
    detect: (h) => h.some(c => /cost \(usd\)|cpm \(usd\)/i.test(c)) || h.some(c => /^cost$/i.test(c) && h.some(c2 => /video views/i.test(c2))),
    spend: ['Cost (USD)', 'Cost', 'Total cost'],
    impressions: ['Impressions'],
    clicks: ['Clicks (destination)', 'Clicks', 'Clicks (all)'],
    conversions: ['Total conversions', 'Conversions', 'Complete payment', 'Purchases'],
    revenue: ['Total complete payment value', 'Total conversion value', 'Purchase value'],
    date: ['Date', 'By Day', 'Day'],
  },
};

const detectPlatform = (headers) => {
  for (const [key, cfg] of Object.entries(PLATFORM_MAPPINGS)) {
    if (cfg.detect(headers)) return key;
  }
  return null;
};

const findColumn = (headers, candidates) => {
  for (const c of candidates) {
    const match = headers.find(h => h.toLowerCase() === c.toLowerCase());
    if (match) return match;
  }
  // Fuzzy: contains match
  for (const c of candidates) {
    const match = headers.find(h => h.toLowerCase().includes(c.toLowerCase()));
    if (match) return match;
  }
  return null;
};

const parseNumber = (val) => {
  if (val === null || val === undefined || val === '') return 0;
  // Strip currency symbols, commas, percentages
  const cleaned = String(val).replace(/[$,€£¥%]/g, '').trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
};

const normalizeDate = (val) => {
  if (!val) return '';
  // If already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(val)) return val.substring(0, 10);
  // Try common formats
  const d = new Date(val);
  if (!isNaN(d.getTime())) {
    return d.toISOString().substring(0, 10);
  }
  return '';
};

// Aggregate parsed CSV rows into totals matching the metrics shape
const aggregateCsvRows = (rows, mapping) => {
  const findCol = (key) => findColumn(Object.keys(rows[0] || {}), mapping[key] || []);
  const cols = {
    spend: findCol('spend'),
    impressions: findCol('impressions'),
    clicks: findCol('clicks'),
    conversions: findCol('conversions'),
    revenue: findCol('revenue'),
    date: findCol('date'),
  };

  const totals = { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 };
  const byDate = {};

  rows.forEach(row => {
    const spend = cols.spend ? parseNumber(row[cols.spend]) : 0;
    const impressions = cols.impressions ? parseNumber(row[cols.impressions]) : 0;
    const clicks = cols.clicks ? parseNumber(row[cols.clicks]) : 0;
    const conversions = cols.conversions ? parseNumber(row[cols.conversions]) : 0;
    const revenue = cols.revenue ? parseNumber(row[cols.revenue]) : 0;

    totals.spend += spend;
    totals.impressions += impressions;
    totals.clicks += clicks;
    totals.conversions += conversions;
    totals.revenue += revenue;

    if (cols.date) {
      const date = normalizeDate(row[cols.date]);
      if (date) {
        if (!byDate[date]) byDate[date] = { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 };
        byDate[date].spend += spend;
        byDate[date].impressions += impressions;
        byDate[date].clicks += clicks;
        byDate[date].conversions += conversions;
        byDate[date].revenue += revenue;
      }
    }
  });

  return { totals, byDate, columnsFound: cols };
};

// Threading helpers
const getThreadRoot = (test, allTests) => {
  let cur = test;
  const visited = new Set();
  while (cur.parentId && !visited.has(cur.id)) {
    visited.add(cur.id);
    const parent = allTests.find(t => t.id === cur.parentId);
    if (!parent) break;
    cur = parent;
  }
  return cur;
};

const getThreadDepth = (test, allTests) => {
  let depth = 0;
  let cur = test;
  const visited = new Set();
  while (cur.parentId && !visited.has(cur.id)) {
    visited.add(cur.id);
    const parent = allTests.find(t => t.id === cur.parentId);
    if (!parent) break;
    cur = parent;
    depth++;
  }
  return depth;
};

const getThreadChain = (rootId, allTests) => {
  const chain = [];
  const root = allTests.find(t => t.id === rootId);
  if (!root) return chain;
  chain.push(root);
  let currentId = root.id;
  const visited = new Set([root.id]);
  while (true) {
    const child = allTests.find(t => t.parentId === currentId && !visited.has(t.id));
    if (!child) break;
    chain.push(child);
    visited.add(child.id);
    currentId = child.id;
  }
  return chain;
};

function Badge({ children, bg, color, accent }) {
  return (
    <span style={{ background: bg, color, borderLeft: `3px solid ${accent}` }} className="inline-flex items-center px-2.5 py-1 text-xs font-semibold tracking-wide uppercase">
      {children}
    </span>
  );
}

function StatusPill({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.planning;
  return (
    <span style={{ background: cfg.bg, color: cfg.color }} className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase rounded-full">
      <span style={{ background: cfg.color }} className="w-1.5 h-1.5 rounded-full" />
      {cfg.label}
    </span>
  );
}

function MetricBlock({ label, value, suffix = '', winner = false }) {
  return (
    <div className={`p-3 ${winner ? 'bg-emerald-50 border-emerald-300' : 'bg-white'} border border-stone-200`}>
      <div className="text-[10px] font-bold tracking-widest uppercase text-stone-500 mb-1">{label}</div>
      <div className="text-lg font-serif text-stone-900">
        {value}{suffix && <span className="text-sm text-stone-500 ml-0.5">{suffix}</span>}
      </div>
    </div>
  );
}

function ImageUploader({ imageUrl, onChange, label }) {
  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => onChange(ev.target.result);
    reader.readAsDataURL(file);
  };
  return (
    <div className="relative group aspect-square bg-stone-100 border border-dashed border-stone-300 overflow-hidden">
      {imageUrl ? (
        <>
          <img src={imageUrl} alt={label} className="w-full h-full object-cover" />
          <button onClick={() => onChange('')} className="absolute top-2 right-2 bg-white/90 hover:bg-white p-1 rounded">
            <X className="w-3 h-3" />
          </button>
        </>
      ) : (
        <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer hover:bg-stone-200 transition">
          <Upload className="w-6 h-6 text-stone-400 mb-2" />
          <span className="text-[10px] font-bold tracking-widest uppercase text-stone-500">Upload</span>
          <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
        </label>
      )}
    </div>
  );
}

function CsvImportModal({ mode, onClose, onApply }) {
  // mode: 'snapshot' (apply to single variation) or 'log' (apply to daily log)
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [platform, setPlatform] = useState(null);
  const [error, setError] = useState('');
  const [targetVariation, setTargetVariation] = useState('a');

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setError('');
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target.result;
        const { headers, rows } = parseCSV(text);
        if (rows.length === 0) {
          setError('No rows found in CSV');
          return;
        }
        const detected = detectPlatform(headers);
        if (!detected) {
          setError('Could not auto-detect platform. Make sure you exported a standard report from Meta Ads Manager, Google Ads, or TikTok Ads Manager.');
          setParsed({ headers, rows });
          return;
        }
        const mapping = PLATFORM_MAPPINGS[detected];
        const agg = aggregateCsvRows(rows, mapping);
        setPlatform(detected);
        setParsed({ headers, rows, agg, mapping });
      } catch (err) {
        setError('Failed to parse CSV: ' + err.message);
      }
    };
    reader.readAsText(f);
  };

  const handleApply = () => {
    if (!parsed?.agg) return;
    onApply({
      platform,
      mode,
      targetVariation,
      totals: parsed.agg.totals,
      byDate: parsed.agg.byDate,
      rowCount: parsed.rows.length,
    });
    onClose();
  };

  const cfg = platform ? PLATFORM_MAPPINGS[platform] : null;
  const cols = parsed?.agg?.columnsFound || {};
  const dateCount = parsed?.agg?.byDate ? Object.keys(parsed.agg.byDate).length : 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-stone-900/50 backdrop-blur-sm" />
      <div className="relative bg-stone-50 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-stone-200" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between sticky top-0 bg-stone-50">
          <div>
            <h2 className="text-2xl" style={{ fontFamily: 'Fraunces, Georgia, serif', fontWeight: 500 }}>
              Import {mode === 'log' ? 'Daily Log' : 'Performance Snapshot'}
            </h2>
            <p className="text-xs text-stone-500 mt-1">
              {mode === 'log'
                ? 'Import multi-day data into the daily log (preserves date breakdown)'
                : 'Import totals into a single variation\'s metrics'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-stone-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* File picker */}
          <div>
            <label className="text-[10px] font-bold tracking-widest uppercase text-stone-500 mb-2 block">CSV File</label>
            <label className="block w-full px-4 py-6 bg-white border-2 border-dashed border-stone-300 hover:border-stone-500 cursor-pointer transition text-center">
              <FileUp className="w-6 h-6 text-stone-400 mx-auto mb-2" />
              <div className="text-sm font-semibold text-stone-700">{file ? file.name : 'Choose CSV file'}</div>
              <div className="text-xs text-stone-500 mt-1">From Meta Ads Manager, Google Ads, or TikTok Ads Manager</div>
              <input type="file" accept=".csv" onChange={handleFile} className="hidden" />
            </label>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border-l-4 border-red-400 p-3 flex gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-red-800">{error}</div>
            </div>
          )}

          {/* Detection result */}
          {platform && cfg && (
            <div className="bg-emerald-50 border-l-4 border-emerald-400 p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                <span className="text-sm font-semibold text-emerald-900">Detected: {cfg.name}</span>
              </div>
              <div className="text-xs text-emerald-800 space-y-0.5">
                <div>{parsed.rows.length} row{parsed.rows.length !== 1 ? 's' : ''} parsed{dateCount > 0 ? `, ${dateCount} unique date${dateCount !== 1 ? 's' : ''}` : ''}</div>
                <div>Mapped: {Object.entries(cols).filter(([_, v]) => v).map(([k, v]) => `${k}→${v}`).join(', ') || 'No columns matched'}</div>
              </div>
            </div>
          )}

          {/* Preview totals */}
          {parsed?.agg && (
            <div>
              <label className="text-[10px] font-bold tracking-widest uppercase text-stone-500 mb-2 block">Totals Preview</label>
              <div className="bg-white border border-stone-200 p-4 grid grid-cols-5 gap-3">
                {[
                  { label: 'Spend', val: `$${parsed.agg.totals.spend.toFixed(2)}` },
                  { label: 'Impr.', val: parsed.agg.totals.impressions.toLocaleString() },
                  { label: 'Clicks', val: parsed.agg.totals.clicks.toLocaleString() },
                  { label: 'Conv.', val: parsed.agg.totals.conversions.toLocaleString() },
                  { label: 'Revenue', val: `$${parsed.agg.totals.revenue.toFixed(2)}` },
                ].map(s => (
                  <div key={s.label}>
                    <div className="text-[9px] font-bold tracking-widest uppercase text-stone-500">{s.label}</div>
                    <div className="text-base font-mono text-stone-900 mt-0.5">{s.val}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Variation selector for snapshot mode */}
          {mode === 'snapshot' && parsed?.agg && (
            <div>
              <label className="text-[10px] font-bold tracking-widest uppercase text-stone-500 mb-2 block">Apply to Variation</label>
              <div className="flex gap-2">
                {['a', 'b'].map(v => (
                  <button key={v} onClick={() => setTargetVariation(v)}
                    className={`flex-1 px-4 py-3 text-sm font-bold tracking-widest uppercase border-2 transition ${
                      targetVariation === v ? 'bg-stone-900 text-white border-stone-900' : 'bg-white border-stone-300 hover:border-stone-500'
                    }`}>
                    Variation {v.toUpperCase()}
                  </button>
                ))}
              </div>
              <p className="text-xs text-stone-500 mt-2">This will <span className="font-semibold">replace</span> the current metric values for the selected variation.</p>
            </div>
          )}

          {/* Mode-specific guidance */}
          {mode === 'log' && parsed?.agg && (
            <div className="bg-stone-100 border-l-4 border-stone-400 px-4 py-3">
              <div className="text-[10px] font-bold tracking-widest uppercase text-stone-700 mb-1">Daily Log Import</div>
              <p className="text-xs text-stone-600 leading-relaxed">
                {dateCount > 0
                  ? `Will add ${dateCount} entries to the daily log. Each row goes into Variation A by default — you can split a CSV into A/B by exporting once filtered to each ad set, or edit individual rows after import.`
                  : 'No date column found — daily log import requires a date breakdown. Re-export with "Day" or "Date" as a breakdown dimension.'}
              </p>
            </div>
          )}

          {/* Export tips */}
          <details className="bg-white border border-stone-200 px-4 py-3">
            <summary className="text-xs font-bold tracking-widest uppercase text-stone-700 cursor-pointer">How to export from each platform</summary>
            <div className="mt-3 space-y-3 text-xs text-stone-600 leading-relaxed">
              <div>
                <div className="font-semibold text-stone-900 mb-1">Meta Ads Manager</div>
                Filter to your ad set → Reports → Export → CSV. For daily log, set breakdown to "Day". Make sure columns include: Amount spent, Impressions, Link clicks, Results (or Purchases), Purchases conversion value.
              </div>
              <div>
                <div className="font-semibold text-stone-900 mb-1">Google Ads</div>
                Filter to your ad group / ad → Reports → Download → CSV. For daily log, segment by Day. Columns: Cost, Impr., Clicks, Conversions, Conv. value.
              </div>
              <div>
                <div className="font-semibold text-stone-900 mb-1">TikTok Ads Manager</div>
                Filter to your ad group → Export → CSV. For daily log, breakdown by Day. Columns: Cost (USD), Impressions, Clicks (destination), Total conversions, Total complete payment value.
              </div>
            </div>
          </details>
        </div>

        <div className="px-6 py-4 border-t border-stone-200 flex justify-end gap-2 sticky bottom-0 bg-stone-50">
          <button onClick={onClose} className="px-4 py-2 text-xs font-bold tracking-widest uppercase text-stone-600 hover:bg-stone-100">Cancel</button>
          <button onClick={handleApply} disabled={!parsed?.agg}
            className="px-4 py-2 bg-stone-900 text-white text-xs font-bold tracking-widest uppercase hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed">
            Import
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailPortal({ test, allTests, clickUpSettings, onClose, onSave, onDelete, onOpenTest, onCreateFollowUp }) {
  const [edited, setEdited] = useState(test);
  const [tab, setTab] = useState('overview');
  const [csvImport, setCsvImport] = useState(null); // null | 'snapshot' | 'log'

  useEffect(() => { setEdited(test); setTab('overview'); }, [test]);

  const handleCsvApply = (result) => {
    if (result.mode === 'snapshot') {
      // Replace the target variation's metrics with totals
      setEdited(prev => ({
        ...prev,
        metrics: {
          ...prev.metrics,
          [result.targetVariation]: {
            spend: result.totals.spend,
            impressions: result.totals.impressions,
            clicks: result.totals.clicks,
            conversions: result.totals.conversions,
            revenue: result.totals.revenue,
          }
        }
      }));
    } else if (result.mode === 'log') {
      // Append byDate entries to dailyLog (into Variation A side by default)
      const newEntries = Object.entries(result.byDate).map(([date, m]) => ({
        date,
        aSpend: m.spend, aClicks: m.clicks, aConv: m.conversions,
        bSpend: 0, bClicks: 0, bConv: 0,
        note: `Imported from ${PLATFORM_MAPPINGS[result.platform].name}`,
      })).sort((a, b) => a.date.localeCompare(b.date));
      setEdited(prev => ({
        ...prev,
        dailyLog: [...(prev.dailyLog || []), ...newEntries],
      }));
    }
  };

  const update = (path, value) => {
    setEdited(prev => {
      const next = { ...prev };
      const keys = path.split('.');
      let cur = next;
      for (let i = 0; i < keys.length - 1; i++) {
        cur[keys[i]] = { ...cur[keys[i]] };
        cur = cur[keys[i]];
      }
      cur[keys[keys.length - 1]] = value;
      return next;
    });
  };

  const aMetrics = calcMetrics(edited.metrics.a);
  const bMetrics = calcMetrics(edited.metrics.b);
  const sig = calcSignificance(edited.metrics.a, edited.metrics.b);
  const brandStyle = getBrandStyle(edited.brand);

  const root = getThreadRoot(edited, allTests);
  const chain = getThreadChain(root.id, allTests);
  const hasThread = chain.length > 1;

  const addLogEntry = () => {
    const today = new Date().toISOString().split('T')[0];
    update('dailyLog', [...(edited.dailyLog || []), {
      date: today, aSpend: 0, aClicks: 0, aConv: 0, bSpend: 0, bClicks: 0, bConv: 0, note: ''
    }]);
  };

  const updateLogEntry = (idx, field, value) => {
    const newLog = [...edited.dailyLog];
    newLog[idx] = { ...newLog[idx], [field]: value };
    update('dailyLog', newLog);
  };

  const removeLogEntry = (idx) => {
    update('dailyLog', edited.dailyLog.filter((_, i) => i !== idx));
  };

  const handleSave = () => onSave(edited);

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-5xl bg-stone-50 overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()} style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div className="sticky top-0 z-10 bg-stone-50 border-b border-stone-200">
          <div className="px-8 py-5 flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <Badge bg={brandStyle.bg} color={brandStyle.text} accent={brandStyle.accent}>{edited.brand}</Badge>
                <span className="text-xs font-mono text-stone-500">{edited.adSet}</span>
                <StatusPill status={edited.status} />
                {hasThread && (
                  <span className="text-[10px] font-bold tracking-widest uppercase text-stone-700 bg-stone-200 px-2 py-1 flex items-center gap-1">
                    <Layers className="w-3 h-3" /> Round {chain.findIndex(t => t.id === edited.id) + 1} of {chain.length}
                  </span>
                )}
              </div>
              <h2 className="text-3xl text-stone-900 leading-tight" style={{ fontFamily: 'Fraunces, Georgia, serif', fontWeight: 500 }}>
                {edited.changesTo} Test
              </h2>
              <p className="text-sm text-stone-600 mt-1 max-w-2xl">{edited.objective}</p>
            </div>
            <div className="flex items-center gap-2 ml-4">
              <button
                onClick={() => {
                  const url = buildClickUpUrl(edited, clickUpSettings);
                  window.open(url, '_blank', 'noopener,noreferrer');
                }}
                title="Open ClickUp with this test pre-filled as a new task"
                className="px-3 py-2 bg-white border border-stone-300 text-stone-900 text-xs font-bold tracking-widest uppercase hover:bg-stone-100 transition flex items-center gap-1.5">
                <ExternalLink className="w-3.5 h-3.5" />
                Send to ClickUp
              </button>
              <button onClick={handleSave} className="px-4 py-2 bg-stone-900 text-white text-xs font-bold tracking-widest uppercase hover:bg-stone-800 transition">Save</button>
              <button onClick={onClose} className="p-2 hover:bg-stone-200 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="px-8 flex gap-6 border-t border-stone-200 overflow-x-auto">
            {[
              { id: 'overview', label: 'Overview', icon: FileText },
              { id: 'thread', label: hasThread ? `Thread (${chain.length})` : 'Thread', icon: GitBranch },
              { id: 'creative', label: 'Creative', icon: ImageIcon },
              { id: 'results', label: 'Results', icon: BarChart3 },
              { id: 'log', label: 'Daily Log', icon: Calendar },
              { id: 'notes', label: 'Notes', icon: Edit3 },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`py-3 px-1 text-xs font-bold tracking-widest uppercase border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
                  tab === t.id ? 'border-stone-900 text-stone-900' : 'border-transparent text-stone-500 hover:text-stone-700'
                }`}>
                <t.icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-8">
          {tab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold tracking-widest uppercase text-stone-500 mb-2 block">Brand</label>
                  <select value={edited.brand} onChange={e => update('brand', e.target.value)} className="w-full px-3 py-2 bg-white border border-stone-300 text-sm">
                    {Object.keys(BRAND_COLORS).map(b => <option key={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold tracking-widest uppercase text-stone-500 mb-2 block">Ad Set ID</label>
                  <input value={edited.adSet} onChange={e => update('adSet', e.target.value)} className="w-full px-3 py-2 bg-white border border-stone-300 text-sm font-mono" />
                </div>
                <div>
                  <label className="text-[10px] font-bold tracking-widest uppercase text-stone-500 mb-2 block">Changes To</label>
                  <select value={edited.changesTo} onChange={e => update('changesTo', e.target.value)} className="w-full px-3 py-2 bg-white border border-stone-300 text-sm">
                    {CHANGE_TYPES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold tracking-widest uppercase text-stone-500 mb-2 block">Status</label>
                  <select value={edited.status} onChange={e => update('status', e.target.value)} className="w-full px-3 py-2 bg-white border border-stone-300 text-sm">
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold tracking-widest uppercase text-stone-500 mb-2 block">Objective / Hypothesis</label>
                <textarea value={edited.objective} onChange={e => update('objective', e.target.value)} rows={3}
                  className="w-full px-3 py-2 bg-white border border-stone-300 text-sm" placeholder="What are we trying to learn?" />
              </div>

              <div>
                <label className="text-[10px] font-bold tracking-widest uppercase text-stone-500 mb-2 block">Differentiator</label>
                <input value={edited.differentiator} onChange={e => update('differentiator', e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-stone-300 text-sm" placeholder="What's different between A and B?" />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-bold tracking-widest uppercase text-stone-500 mb-2 block">Designs Due</label>
                  <input type="date" value={edited.designsDue} onChange={e => update('designsDue', e.target.value)} className="w-full px-3 py-2 bg-white border border-stone-300 text-sm" />
                </div>
                <div>
                  <label className="text-[10px] font-bold tracking-widest uppercase text-stone-500 mb-2 block">Launch Date</label>
                  <input type="date" value={edited.launchDate} onChange={e => update('launchDate', e.target.value)} className="w-full px-3 py-2 bg-white border border-stone-300 text-sm" />
                </div>
                <div>
                  <label className="text-[10px] font-bold tracking-widest uppercase text-stone-500 mb-2 block">Review Date</label>
                  <input type="date" value={edited.reviewDate} onChange={e => update('reviewDate', e.target.value)} className="w-full px-3 py-2 bg-white border border-stone-300 text-sm" />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold tracking-widest uppercase text-stone-500 mb-2 block">Declared Winner</label>
                <div className="flex gap-2">
                  {['A', 'B', 'Tie', null].map(w => (
                    <button key={w || 'none'} onClick={() => update('winner', w)}
                      className={`px-4 py-2 text-xs font-bold tracking-widest uppercase border transition ${
                        edited.winner === w ? 'bg-stone-900 text-white border-stone-900' : 'bg-white border-stone-300 hover:border-stone-500'
                      }`}>
                      {w || 'None'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-6 border-t border-stone-200">
                <button onClick={() => { if (confirm('Delete this test?')) { onDelete(edited.id); onClose(); } }}
                  className="text-xs font-bold tracking-widest uppercase text-red-600 hover:text-red-800 flex items-center gap-2">
                  <Trash2 className="w-3.5 h-3.5" /> Delete Test
                </button>
              </div>
            </div>
          )}

          {tab === 'creative' && (
            <div className="grid grid-cols-2 gap-6">
              {['A', 'B'].map(v => {
                const key = v === 'A' ? 'variationA' : 'variationB';
                return (
                  <div key={v} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-2xl" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>Variation {v}</h3>
                      {edited.winner === v && (
                        <span className="text-[10px] font-bold tracking-widest uppercase text-emerald-700 bg-emerald-50 px-2 py-1 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Winner
                        </span>
                      )}
                    </div>
                    <input value={edited[key].name} onChange={e => update(`${key}.name`, e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-stone-300 text-sm font-semibold" placeholder="Variation name" />
                    <ImageUploader imageUrl={edited[key].imageUrl} onChange={url => update(`${key}.imageUrl`, url)} label={`Variation ${v}`} />
                    <textarea value={edited[key].description} onChange={e => update(`${key}.description`, e.target.value)} rows={3}
                      className="w-full px-3 py-2 bg-white border border-stone-300 text-sm" placeholder="Describe this variation..." />
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'results' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>Performance</h3>
                <button onClick={() => setCsvImport('snapshot')}
                  className="px-3 py-2 bg-white border border-stone-300 text-stone-900 text-xs font-bold tracking-widest uppercase hover:bg-stone-100 flex items-center gap-1.5">
                  <FileUp className="w-3.5 h-3.5" />
                  Import CSV
                </button>
              </div>
              <div className={`p-4 border ${sig.significant ? 'bg-emerald-50 border-emerald-300' : 'bg-amber-50 border-amber-300'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-bold tracking-widest uppercase text-stone-700 mb-1">Statistical Significance</div>
                    <div className="text-2xl" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
                      {sig.confidence.toFixed(1)}% confidence
                    </div>
                    <div className="text-xs text-stone-600 mt-1">{sig.message}</div>
                  </div>
                  <Zap className={`w-10 h-10 ${sig.significant ? 'text-emerald-600' : 'text-amber-500'}`} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {['a', 'b'].map(v => {
                  const m = edited.metrics[v];
                  const calc = v === 'a' ? aMetrics : bMetrics;
                  const isWinner = edited.winner === v.toUpperCase();
                  return (
                    <div key={v} className={`p-5 border-2 ${isWinner ? 'border-emerald-400 bg-emerald-50/30' : 'border-stone-200 bg-white'}`}>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>Variation {v.toUpperCase()}</h3>
                        {isWinner && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                      </div>
                      <div className="space-y-2 mb-4">
                        {[
                          { key: 'spend', label: 'Spend ($)' },
                          { key: 'impressions', label: 'Impressions' },
                          { key: 'clicks', label: 'Clicks' },
                          { key: 'conversions', label: 'Conversions' },
                          { key: 'revenue', label: 'Revenue ($)' },
                        ].map(f => (
                          <div key={f.key} className="flex items-center gap-2">
                            <label className="text-[10px] font-bold tracking-widest uppercase text-stone-500 w-24">{f.label}</label>
                            <input type="number" value={m[f.key]} onChange={e => update(`metrics.${v}.${f.key}`, parseFloat(e.target.value) || 0)}
                              className="flex-1 px-2 py-1 bg-stone-50 border border-stone-200 text-sm text-right font-mono" />
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-4 border-t border-stone-200">
                        <MetricBlock label="CTR" value={calc.ctr.toFixed(2)} suffix="%" winner={isWinner} />
                        <MetricBlock label="CPC" value={`$${calc.cpc.toFixed(2)}`} winner={isWinner} />
                        <MetricBlock label="CPA" value={`$${calc.cpa.toFixed(2)}`} winner={isWinner} />
                        <MetricBlock label="CVR" value={calc.cvr.toFixed(2)} suffix="%" winner={isWinner} />
                        <MetricBlock label="ROAS" value={calc.roas.toFixed(2) + 'x'} winner={isWinner} />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="bg-stone-900 text-stone-50 p-5">
                <div className="text-[10px] font-bold tracking-widest uppercase text-stone-400 mb-3">Variation B vs A</div>
                <div className="grid grid-cols-5 gap-4">
                  {[
                    { label: 'CTR', a: aMetrics.ctr, b: bMetrics.ctr, higherBetter: true },
                    { label: 'CPC', a: aMetrics.cpc, b: bMetrics.cpc, higherBetter: false },
                    { label: 'CPA', a: aMetrics.cpa, b: bMetrics.cpa, higherBetter: false },
                    { label: 'CVR', a: aMetrics.cvr, b: bMetrics.cvr, higherBetter: true },
                    { label: 'ROAS', a: aMetrics.roas, b: bMetrics.roas, higherBetter: true },
                  ].map(c => {
                    const diff = c.a > 0 ? ((c.b - c.a) / c.a) * 100 : 0;
                    const isWin = c.higherBetter ? diff > 0 : diff < 0;
                    const Icon = Math.abs(diff) < 0.5 ? Minus : isWin ? TrendingUp : TrendingDown;
                    const color = Math.abs(diff) < 0.5 ? 'text-stone-400' : isWin ? 'text-emerald-400' : 'text-red-400';
                    return (
                      <div key={c.label}>
                        <div className="text-[10px] font-bold tracking-widest uppercase text-stone-400">{c.label}</div>
                        <div className={`flex items-center gap-1.5 mt-1 ${color}`}>
                          <Icon className="w-4 h-4" />
                          <span className="text-lg font-mono">{diff > 0 ? '+' : ''}{diff.toFixed(1)}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {tab === 'log' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>Daily Performance Log</h3>
                <div className="flex items-center gap-2">
                  <button onClick={() => setCsvImport('log')}
                    className="px-3 py-2 bg-white border border-stone-300 text-stone-900 text-xs font-bold tracking-widest uppercase hover:bg-stone-100 flex items-center gap-1.5">
                    <FileUp className="w-3 h-3" />
                    Import CSV
                  </button>
                  <button onClick={addLogEntry} className="px-3 py-2 bg-stone-900 text-white text-xs font-bold tracking-widest uppercase flex items-center gap-2 hover:bg-stone-800">
                    <Plus className="w-3 h-3" /> Add Entry
                  </button>
                </div>
              </div>
              {(!edited.dailyLog || edited.dailyLog.length === 0) ? (
                <div className="py-12 text-center bg-white border border-dashed border-stone-300">
                  <Calendar className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                  <p className="text-sm text-stone-500">No log entries yet</p>
                </div>
              ) : (
                <div className="bg-white border border-stone-200">
                  <div className="grid grid-cols-9 gap-2 px-3 py-2 bg-stone-100 text-[10px] font-bold tracking-widest uppercase text-stone-600">
                    <div>Date</div>
                    <div className="col-span-3 text-center border-l border-stone-300">Variation A</div>
                    <div className="col-span-3 text-center border-l border-stone-300">Variation B</div>
                    <div className="col-span-2 border-l border-stone-300">Note</div>
                  </div>
                  <div className="grid grid-cols-9 gap-2 px-3 py-1 bg-stone-50 text-[9px] font-bold tracking-widest uppercase text-stone-500">
                    <div></div>
                    <div>Spend</div><div>Clicks</div><div>Conv</div>
                    <div>Spend</div><div>Clicks</div><div>Conv</div>
                    <div className="col-span-2"></div>
                  </div>
                  {edited.dailyLog.map((entry, i) => (
                    <div key={i} className="grid grid-cols-9 gap-2 px-3 py-2 border-t border-stone-100 items-center">
                      <input type="date" value={entry.date} onChange={e => updateLogEntry(i, 'date', e.target.value)} className="text-xs px-1 py-1 bg-stone-50 border border-stone-200" />
                      <input type="number" value={entry.aSpend} onChange={e => updateLogEntry(i, 'aSpend', parseFloat(e.target.value) || 0)} className="text-xs px-1 py-1 bg-stone-50 border border-stone-200 text-right font-mono" />
                      <input type="number" value={entry.aClicks} onChange={e => updateLogEntry(i, 'aClicks', parseInt(e.target.value) || 0)} className="text-xs px-1 py-1 bg-stone-50 border border-stone-200 text-right font-mono" />
                      <input type="number" value={entry.aConv} onChange={e => updateLogEntry(i, 'aConv', parseInt(e.target.value) || 0)} className="text-xs px-1 py-1 bg-stone-50 border border-stone-200 text-right font-mono" />
                      <input type="number" value={entry.bSpend} onChange={e => updateLogEntry(i, 'bSpend', parseFloat(e.target.value) || 0)} className="text-xs px-1 py-1 bg-stone-50 border border-stone-200 text-right font-mono" />
                      <input type="number" value={entry.bClicks} onChange={e => updateLogEntry(i, 'bClicks', parseInt(e.target.value) || 0)} className="text-xs px-1 py-1 bg-stone-50 border border-stone-200 text-right font-mono" />
                      <input type="number" value={entry.bConv} onChange={e => updateLogEntry(i, 'bConv', parseInt(e.target.value) || 0)} className="text-xs px-1 py-1 bg-stone-50 border border-stone-200 text-right font-mono" />
                      <div className="col-span-2 flex items-center gap-1">
                        <input value={entry.note} onChange={e => updateLogEntry(i, 'note', e.target.value)} placeholder="Note..." className="flex-1 text-xs px-2 py-1 bg-stone-50 border border-stone-200" />
                        <button onClick={() => removeLogEntry(i)} className="p-1 text-stone-400 hover:text-red-600">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'thread' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>Iteration Thread</h3>
                  <p className="text-xs text-stone-500 mt-1">Each test in this thread builds on the previous round's winner</p>
                </div>
                {edited.winner && edited.winner !== 'Tie' && (
                  <button onClick={() => onCreateFollowUp(edited)}
                    className="px-4 py-2 bg-stone-900 text-white text-xs font-bold tracking-widest uppercase hover:bg-stone-800 flex items-center gap-2">
                    <Plus className="w-3.5 h-3.5" /> Test Against Winner
                  </button>
                )}
              </div>

              {!hasThread ? (
                <div className="py-12 text-center bg-white border border-dashed border-stone-300">
                  <GitBranch className="w-8 h-8 text-stone-300 mx-auto mb-3" />
                  <p className="text-sm text-stone-500 mb-1">This is a standalone test</p>
                  <p className="text-xs text-stone-400">
                    {edited.winner && edited.winner !== 'Tie'
                      ? 'Click "Test Against Winner" to start a follow-up round'
                      : 'Once you declare a winner, you can spawn a follow-up test'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {chain.map((t, i) => {
                    const tBrand = getBrandStyle(t.brand);
                    const isCurrent = t.id === edited.id;
                    return (
                      <React.Fragment key={t.id}>
                        <div onClick={() => !isCurrent && onOpenTest(t)}
                          className={`p-4 border-2 transition ${isCurrent ? 'border-stone-900 bg-stone-50' : 'border-stone-200 bg-white hover:border-stone-400 cursor-pointer'}`}>
                          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="text-[10px] font-bold tracking-widest uppercase text-stone-500 bg-stone-100 px-2 py-1">Round {i + 1}</span>
                              <Badge bg={tBrand.bg} color={tBrand.text} accent={tBrand.accent}>{t.brand}</Badge>
                              <span className="text-xs font-mono text-stone-500">{t.adSet}</span>
                              <StatusPill status={t.status} />
                            </div>
                            {t.winner && (
                              <span className="text-[10px] font-bold tracking-widest uppercase text-emerald-700 bg-emerald-50 px-2 py-1 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Winner: {t.winner}
                              </span>
                            )}
                          </div>
                          <div className="flex items-baseline justify-between">
                            <div>
                              <div className="text-sm font-semibold text-stone-900">{t.changesTo}: {t.differentiator || t.objective}</div>
                              <div className="text-xs text-stone-500 mt-0.5">Launch: {t.launchDate || 'TBD'}</div>
                            </div>
                            {isCurrent && <span className="text-[10px] font-bold tracking-widest uppercase text-stone-900">You are here</span>}
                          </div>
                        </div>
                        {i < chain.length - 1 && (
                          <div className="flex justify-center text-stone-300">
                            <ArrowRight className="w-4 h-4 rotate-90" />
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === 'notes' && (
            <div className="space-y-3">
              <h3 className="text-xl" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>Notes & Learnings</h3>
              <textarea value={edited.notes} onChange={e => update('notes', e.target.value)} rows={20}
                className="w-full px-4 py-3 bg-white border border-stone-300 text-sm leading-relaxed"
                placeholder="What did you learn? What would you test next? Any context for future reference..." />
            </div>
          )}
        </div>
        {csvImport && (
          <CsvImportModal
            mode={csvImport}
            onClose={() => setCsvImport(null)}
            onApply={handleCsvApply}
          />
        )}
      </div>
    </div>
  );
}

function ThreadModal({ chain, currentId, onClose, onOpenTest }) {
  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-stone-900/50 backdrop-blur-sm" />
      <div className="relative bg-stone-50 max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl border border-stone-200" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between sticky top-0 bg-stone-50">
          <div>
            <div className="text-[10px] font-bold tracking-widest uppercase text-stone-500 mb-1 flex items-center gap-2">
              <GitBranch className="w-3 h-3" /> Iteration Thread
            </div>
            <h2 className="text-2xl" style={{ fontFamily: 'Fraunces, Georgia, serif', fontWeight: 500 }}>
              {chain.length} round{chain.length !== 1 ? 's' : ''} in this thread
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-stone-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-2">
          {chain.map((t, i) => {
            const tBrand = getBrandStyle(t.brand);
            const isCurrent = t.id === currentId;
            return (
              <React.Fragment key={t.id}>
                <div onClick={() => { onOpenTest(t); onClose(); }}
                  className={`p-4 border-2 transition cursor-pointer ${isCurrent ? 'border-stone-900 bg-stone-50' : 'border-stone-200 bg-white hover:border-stone-400'}`}>
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold tracking-widest uppercase text-stone-500 bg-stone-100 px-2 py-1">Round {i + 1}</span>
                      <Badge bg={tBrand.bg} color={tBrand.text} accent={tBrand.accent}>{t.brand}</Badge>
                      <span className="text-xs font-mono text-stone-500">{t.adSet || '—'}</span>
                      <StatusPill status={t.status} />
                    </div>
                    {t.winner && (
                      <span className="text-[10px] font-bold tracking-widest uppercase text-emerald-700 bg-emerald-50 px-2 py-1 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Winner: {t.winner}
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-stone-900 truncate">{t.changesTo}: {t.differentiator || t.objective || 'No objective'}</div>
                      <div className="text-xs text-stone-500 mt-0.5">Launch: {t.launchDate || 'TBD'}</div>
                    </div>
                    {isCurrent && <span className="text-[10px] font-bold tracking-widest uppercase text-stone-900 flex-shrink-0">You are here</span>}
                  </div>
                </div>
                {i < chain.length - 1 && (
                  <div className="flex justify-center text-stone-300">
                    <ArrowRight className="w-4 h-4 rotate-90" />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MonthCalendar({ tests, onSelect }) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const monthName = new Date(cursor.year, cursor.month).toLocaleString('default', { month: 'long', year: 'numeric' });
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const firstDay = new Date(cursor.year, cursor.month, 1).getDay();

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const testsByDate = useMemo(() => {
    const map = {};
    tests.forEach(t => {
      if (!t.launchDate) return;
      if (!map[t.launchDate]) map[t.launchDate] = [];
      map[t.launchDate].push(t);
    });
    return map;
  }, [tests]);

  const todayStr = new Date().toISOString().split('T')[0];

  const navigate = (delta) => {
    let m = cursor.month + delta, y = cursor.year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setCursor({ year: y, month: m });
  };

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="bg-white border border-stone-200">
      <div className="px-6 py-4 flex items-center justify-between border-b border-stone-200">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-stone-100"><ChevronLeft className="w-4 h-4" /></button>
          <h3 className="text-2xl" style={{ fontFamily: 'Fraunces, Georgia, serif', fontWeight: 500 }}>{monthName}</h3>
          <button onClick={() => navigate(1)} className="p-2 hover:bg-stone-100"><ChevronRight className="w-4 h-4" /></button>
        </div>
        <button onClick={() => { const d = new Date(); setCursor({ year: d.getFullYear(), month: d.getMonth() }); }}
          className="text-[10px] font-bold tracking-widest uppercase text-stone-500 hover:text-stone-900">Today</button>
      </div>
      <div className="grid grid-cols-7 border-b border-stone-200">
        {dayLabels.map(d => (
          <div key={d} className="px-3 py-2 text-[10px] font-bold tracking-widest uppercase text-stone-500 text-center border-r border-stone-100 last:border-r-0">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          const dateStr = day ? `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : null;
          const dayTests = dateStr ? (testsByDate[dateStr] || []) : [];
          const isToday = dateStr === todayStr;
          return (
            <div key={i} className={`min-h-[110px] border-r border-b border-stone-100 last:border-r-0 p-1.5 ${!day ? 'bg-stone-50/50' : ''} ${isToday ? 'bg-amber-50/40' : ''}`}>
              {day && (
                <>
                  <div className={`text-xs font-semibold mb-1 ${isToday ? 'text-amber-700' : 'text-stone-700'}`}>{day}</div>
                  <div className="space-y-1">
                    {dayTests.slice(0, 3).map(t => {
                      const bs = getBrandStyle(t.brand);
                      return (
                        <div key={t.id} onClick={() => onSelect(t)}
                          style={{ background: bs.bg, color: bs.text, borderLeft: `3px solid ${bs.accent}` }}
                          className="px-1.5 py-1 text-[10px] font-semibold cursor-pointer hover:opacity-80 truncate">
                          {t.brand} · {t.changesTo}
                        </div>
                      );
                    })}
                    {dayTests.length > 3 && (
                      <div className="text-[9px] text-stone-500 px-1">+{dayTests.length - 3} more</div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TimelineView({ tests, onSelect }) {
  const dated = tests.filter(t => t.launchDate);

  const range = useMemo(() => {
    if (dated.length === 0) {
      const d = new Date();
      return { start: new Date(d.getFullYear(), d.getMonth(), 1), end: new Date(d.getFullYear(), d.getMonth() + 2, 0) };
    }
    const dates = dated.map(t => new Date(t.launchDate));
    let min = new Date(Math.min(...dates));
    let max = new Date(Math.max(...dates));
    min = new Date(min.getFullYear(), min.getMonth(), 1);
    max = new Date(max.getFullYear(), max.getMonth() + 2, 0);
    return { start: min, end: max };
  }, [dated]);

  const totalDays = Math.ceil((range.end - range.start) / (1000 * 60 * 60 * 24));

  const byBrand = useMemo(() => {
    const groups = {};
    dated.forEach(t => {
      if (!groups[t.brand]) groups[t.brand] = [];
      groups[t.brand].push(t);
    });
    Object.values(groups).forEach(arr => arr.sort((a, b) => new Date(a.launchDate) - new Date(b.launchDate)));
    return groups;
  }, [dated]);

  const months = [];
  let cur = new Date(range.start);
  while (cur <= range.end) {
    months.push(new Date(cur));
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }

  const todayOffset = ((new Date() - range.start) / (1000 * 60 * 60 * 24) / totalDays) * 100;
  const showToday = todayOffset >= 0 && todayOffset <= 100;

  if (dated.length === 0) {
    return (
      <div className="bg-white border border-stone-200 p-12 text-center">
        <CalendarDays className="w-8 h-8 text-stone-300 mx-auto mb-3" />
        <p className="text-sm text-stone-500">No tests with launch dates yet</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-stone-200 overflow-x-auto">
      <div style={{ minWidth: Math.max(800, totalDays * 8) }}>
        <div className="relative h-10 border-b border-stone-200 bg-stone-50">
          {months.map((m, i) => {
            const offset = ((m - range.start) / (1000 * 60 * 60 * 24) / totalDays) * 100;
            return (
              <div key={i} className="absolute top-0 h-full flex items-center px-2 border-l border-stone-200" style={{ left: `${offset}%` }}>
                <span className="text-[10px] font-bold tracking-widest uppercase text-stone-600">
                  {m.toLocaleString('default', { month: 'short' })} {m.getFullYear()}
                </span>
              </div>
            );
          })}
        </div>

        {Object.entries(byBrand).map(([brand, brandTests]) => {
          const bs = getBrandStyle(brand);
          return (
            <div key={brand} className="border-b border-stone-100">
              <div className="flex">
                <div className="w-40 px-4 py-3 border-r border-stone-200 bg-stone-50/50 sticky left-0 z-10">
                  <Badge bg={bs.bg} color={bs.text} accent={bs.accent}>{brand}</Badge>
                </div>
                <div className="relative flex-1 py-3" style={{ minHeight: '52px' }}>
                  {showToday && (
                    <div className="absolute top-0 bottom-0 w-px bg-amber-500 z-10" style={{ left: `${todayOffset}%` }}>
                      <div className="absolute -top-1 -left-1 w-2 h-2 bg-amber-500 rounded-full" />
                    </div>
                  )}
                  {brandTests.map((t) => {
                    const launchOffset = ((new Date(t.launchDate) - range.start) / (1000 * 60 * 60 * 24) / totalDays) * 100;
                    const sCfg = STATUS_CONFIG[t.status];
                    return (
                      <div key={t.id} onClick={() => onSelect(t)}
                        style={{ left: `calc(${launchOffset}% - 4px)`, top: `8px` }}
                        className="absolute group cursor-pointer">
                        <div style={{ background: bs.accent }} className="w-2 h-8 hover:scale-y-110 transition" />
                        <div className="absolute left-3 top-0 hidden group-hover:block z-20 bg-stone-900 text-white px-3 py-2 whitespace-nowrap shadow-xl">
                          <div className="text-[10px] font-bold tracking-widest uppercase text-stone-400 mb-0.5">{t.adSet} · {t.changesTo}</div>
                          <div className="text-sm">{t.objective || 'No objective'}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span style={{ color: sCfg.color, background: sCfg.bg }} className="text-[9px] font-bold tracking-widest uppercase px-1.5 py-0.5 rounded-full">{sCfg.label}</span>
                            <span className="text-[10px] text-stone-300">{t.launchDate}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TestCard({ test, allTests, onSelect, onOpenThread }) {
  const [showCreative, setShowCreative] = useState(false);
  const brandStyle = getBrandStyle(test.brand);
  const sig = calcSignificance(test.metrics.a, test.metrics.b);
  const hasData = test.metrics.a.clicks > 0 || test.metrics.b.clicks > 0;
  const root = getThreadRoot(test, allTests);
  const chain = getThreadChain(root.id, allTests);
  const inThread = chain.length > 1;
  const roundNum = inThread ? chain.findIndex(t => t.id === test.id) + 1 : 0;

  return (
    <article className="bg-white border border-stone-200 hover:border-stone-900 hover:shadow-xl transition-all group">
      <div onClick={() => onSelect(test)} className="cursor-pointer">
        <div className="p-5 border-b border-stone-100">
          <div className="flex items-start justify-between mb-3 flex-wrap gap-1">
            <Badge bg={brandStyle.bg} color={brandStyle.text} accent={brandStyle.accent}>{test.brand}</Badge>
            <div className="flex items-center gap-1.5">
              {inThread && (
                <button
                  onClick={(e) => { e.stopPropagation(); onOpenThread(chain, test.id); }}
                  title="View full thread"
                  className="text-[9px] font-bold tracking-widest uppercase text-stone-700 bg-stone-100 hover:bg-stone-900 hover:text-white px-1.5 py-0.5 flex items-center gap-1 transition cursor-pointer">
                  <Layers className="w-2.5 h-2.5" /> R{roundNum}/{chain.length}
                </button>
              )}
              <StatusPill status={test.status} />
            </div>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-mono text-stone-400">{test.adSet || 'No ID'}</span>
            <span className="text-stone-300">·</span>
            <span className="text-[10px] font-bold tracking-widest uppercase text-stone-600">{test.changesTo}</span>
          </div>
          <h3 className="text-lg leading-tight text-stone-900 group-hover:text-stone-700" style={{ fontFamily: 'Fraunces, Georgia, serif', fontWeight: 500 }}>
            {test.objective || 'No objective set'}
          </h3>
          {test.differentiator && (
            <p className="text-xs text-stone-500 mt-2 line-clamp-2">{test.differentiator}</p>
          )}
        </div>

        <div className="p-4 flex items-center justify-between bg-stone-50/50 border-b border-stone-100">
          <div className="flex items-center gap-3 text-[10px] text-stone-500">
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>{test.launchDate || 'TBD'}</span>
            </div>
            {hasData && (
              <div className="flex items-center gap-1">
                <Zap className="w-3 h-3" />
                <span>{sig.confidence.toFixed(0)}%</span>
              </div>
            )}
            {test.winner && (
              <div className="flex items-center gap-1 text-emerald-700">
                <CheckCircle2 className="w-3 h-3" />
                <span className="font-semibold">Winner: {test.winner}</span>
              </div>
            )}
          </div>
          <div className="flex items-center text-stone-400 group-hover:text-stone-900">
            <span className="text-[10px] font-bold tracking-widest uppercase mr-1">Open</span>
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>

      {/* Collapsible creative section */}
      {showCreative && (
        <div className="grid grid-cols-2 border-b border-stone-100">
          {['variationA', 'variationB'].map((vk, idx) => {
            const v = test[vk];
            const letter = idx === 0 ? 'A' : 'B';
            const isWinner = test.winner === letter;
            return (
              <div key={vk} className={`p-3 ${idx === 0 ? 'border-r border-stone-100' : ''} ${isWinner ? 'bg-emerald-50/40' : ''}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[9px] font-bold tracking-widest uppercase text-stone-500">VAR {letter}</span>
                  {isWinner && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                </div>
                {v.imageUrl ? (
                  <div className="aspect-video bg-stone-100 overflow-hidden">
                    <img src={v.imageUrl} alt={v.name} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="aspect-video bg-stone-100 flex items-center justify-center">
                    <ImageIcon className="w-4 h-4 text-stone-300" />
                  </div>
                )}
                <div className="text-xs font-semibold text-stone-700 mt-1.5 truncate">{v.name || '—'}</div>
              </div>
            );
          })}
        </div>
      )}

      <button
        onClick={() => setShowCreative(s => !s)}
        className="w-full px-4 py-2 text-[10px] font-bold tracking-widest uppercase text-stone-500 hover:bg-stone-100 hover:text-stone-900 transition flex items-center justify-center gap-1.5 border-t border-stone-100">
        <Eye className="w-3 h-3" />
        {showCreative ? 'Hide Creative' : 'View Creative'}
      </button>
    </article>
  );
}

export default function App() {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTest, setSelectedTest] = useState(null);
  const [search, setSearch] = useState('');
  const [filterBrand, setFilterBrand] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [view, setView] = useState('grid');
  const [clickUpSettings, setClickUpSettings] = useState({ workspaceUrl: '' });
  const [showSettings, setShowSettings] = useState(false);
  const [threadModalChain, setThreadModalChain] = useState(null);
  const [sortBy, setSortBy] = useState('updated'); // 'updated' | 'launch-asc' | 'launch-desc' | 'brand'
  const [hoveredStat, setHoveredStat] = useState(null);

  // Subscribe to tests collection in real time. Any change from any user/device flows through here.
  useEffect(() => {
    let unsubscribe = () => {};
    (async () => {
      try {
        // First time: if collection is empty, seed it
        const seedCheck = await getDoc(doc(db, 'meta', 'seeded'));
        if (!seedCheck.exists()) {
          const batch = writeBatch(db);
          seedData.forEach(t => {
            batch.set(doc(db, 'tests', t.id), t);
          });
          batch.set(doc(db, 'meta', 'seeded'), { at: Date.now() });
          await batch.commit();
        }

        // Load ClickUp settings (one-time read)
        try {
          const cuSnap = await getDoc(doc(db, 'settings', 'clickup'));
          if (cuSnap.exists()) setClickUpSettings(cuSnap.data());
        } catch {}

        // Subscribe to real-time updates on tests
        unsubscribe = onSnapshot(
          collection(db, 'tests'),
          (snap) => {
            const loaded = snap.docs.map(d => ({ parentId: null, ...d.data(), id: d.id }));
            setTests(loaded);
            setLoading(false);
          },
          (err) => {
            console.error('Firestore subscription error:', err);
            setLoading(false);
          }
        );
      } catch (e) {
        console.error('Firestore init error:', e);
        setLoading(false);
      }
    })();
    return () => unsubscribe();
  }, []);

  const persistClickUpSettings = async (next) => {
    setClickUpSettings(next);
    try {
      await setDoc(doc(db, 'settings', 'clickup'), next);
    } catch (e) {
      console.error('Settings save failed:', e);
    }
  };

  const handleSave = async (test) => {
    setSelectedTest(test);
    try {
      await setDoc(doc(db, 'tests', test.id), test);
    } catch (e) {
      console.error('Save failed:', e);
      alert('Failed to save. Check your internet connection and try again.');
    }
  };

  const handleDelete = async (id) => {
    try {
      // Detach children: any test whose parent is being deleted gets its parentId cleared
      const children = tests.filter(t => t.parentId === id);
      const batch = writeBatch(db);
      batch.delete(doc(db, 'tests', id));
      children.forEach(c => {
        batch.set(doc(db, 'tests', c.id), { ...c, parentId: null });
      });
      await batch.commit();
    } catch (e) {
      console.error('Delete failed:', e);
      alert('Failed to delete. Check your internet connection and try again.');
    }
  };

  const handleAdd = async () => {
    const newTest = {
      id: `test-${Date.now()}`,
      brand: 'Anthem', adSet: '', changesTo: 'Copy',
      objective: '', differentiator: '',
      variationA: { name: 'A', description: '', imageUrl: '' },
      variationB: { name: 'B', description: '', imageUrl: '' },
      designsDue: '', launchDate: '', reviewDate: '',
      status: 'planning', winner: null, parentId: null,
      metrics: { a: { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 }, b: { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 } },
      dailyLog: [], notes: ''
    };
    try {
      await setDoc(doc(db, 'tests', newTest.id), newTest);
      setSelectedTest(newTest);
    } catch (e) {
      console.error('Add failed:', e);
      alert('Failed to create test. Check your internet connection and try again.');
    }
  };

  const handleCreateFollowUp = async (parent) => {
    const winnerKey = parent.winner === 'A' ? 'variationA' : 'variationB';
    const winnerVar = parent[winnerKey];
    const followUp = {
      id: `test-${Date.now()}`,
      brand: parent.brand,
      adSet: parent.adSet ? `${parent.adSet}-v2` : '',
      changesTo: parent.changesTo,
      objective: `Follow-up to ${parent.adSet || 'previous test'}: testing against winner`,
      differentiator: `Variation A: ${winnerVar.name} (prior winner) | Variation B: New challenger`,
      variationA: { name: `${winnerVar.name} (control)`, description: winnerVar.description, imageUrl: winnerVar.imageUrl },
      variationB: { name: 'New challenger', description: '', imageUrl: '' },
      designsDue: '', launchDate: '', reviewDate: '',
      status: 'planning', winner: null, parentId: parent.id,
      metrics: { a: { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 }, b: { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 } },
      dailyLog: [], notes: ''
    };
    try {
      await setDoc(doc(db, 'tests', followUp.id), followUp);
      setSelectedTest(followUp);
    } catch (e) {
      console.error('Follow-up creation failed:', e);
      alert('Failed to create follow-up. Check your internet connection and try again.');
    }
  };

  const filtered = useMemo(() => {
    const list = tests.filter(t => {
      if (filterBrand !== 'all' && t.brand !== filterBrand) return false;
      if (filterStatus !== 'all' && t.status !== filterStatus) return false;
      if (search) {
        const q = search.toLowerCase();
        return t.brand.toLowerCase().includes(q) || t.adSet.toLowerCase().includes(q) ||
               t.changesTo.toLowerCase().includes(q) || t.objective.toLowerCase().includes(q);
      }
      return true;
    });

    const sorted = [...list];
    if (sortBy === 'launch-asc') {
      // Tests without a date sink to the bottom
      sorted.sort((a, b) => {
        if (!a.launchDate && !b.launchDate) return 0;
        if (!a.launchDate) return 1;
        if (!b.launchDate) return -1;
        return a.launchDate.localeCompare(b.launchDate);
      });
    } else if (sortBy === 'launch-desc') {
      sorted.sort((a, b) => {
        if (!a.launchDate && !b.launchDate) return 0;
        if (!a.launchDate) return 1;
        if (!b.launchDate) return -1;
        return b.launchDate.localeCompare(a.launchDate);
      });
    } else if (sortBy === 'brand') {
      sorted.sort((a, b) => a.brand.localeCompare(b.brand));
    }
    // 'updated' default: keep insertion order (newest first since we prepend on add)
    return sorted;
  }, [tests, search, filterBrand, filterStatus, sortBy]);

  const stats = useMemo(() => ({
    total: tests.length,
    live: tests.filter(t => t.status === 'live').length,
    complete: tests.filter(t => t.status === 'complete').length,
    planning: tests.filter(t => PIPELINE_STATUSES.includes(t.status)).length,
  }), [tests]);

  const brands = useMemo(() => [...new Set(tests.map(t => t.brand))], [tests]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-stone-100"><span className="text-stone-500 text-sm">Loading...</span></div>;
  }

  return (
    <div className="min-h-screen bg-stone-100" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />

      <header className="bg-stone-900 text-stone-50">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-end justify-between flex-wrap gap-4">
            <div>
              <div className="text-[10px] font-bold tracking-[0.3em] uppercase text-stone-400 mb-1">Issue 01 — Vol. 2026</div>
              <h1 className="text-5xl text-stone-50 leading-none" style={{ fontFamily: 'Fraunces, Georgia, serif', fontWeight: 500, letterSpacing: '-0.02em' }}>
                The Test Ledger
              </h1>
              <p className="text-sm text-stone-400 mt-2 max-w-md">A working register of paid creative experiments — hypotheses, variants, evidence, verdicts.</p>
            </div>
            <div className="flex gap-6 text-right">
              {[
                { key: 'flight', label: 'In Flight', value: stats.live, list: tests.filter(t => t.status === 'live') },
                { key: 'pipeline', label: 'In Pipeline', value: stats.planning, list: tests.filter(t => PIPELINE_STATUSES.includes(t.status)) },
                { key: 'concluded', label: 'Concluded', value: stats.complete, list: tests.filter(t => t.status === 'complete') },
                { key: 'total', label: 'Total', value: stats.total, list: tests },
              ].map(s => (
                <div
                  key={s.key}
                  className="relative"
                  onMouseEnter={() => setHoveredStat(s.key)}
                  onMouseLeave={() => setHoveredStat(null)}>
                  <div className="text-3xl text-stone-50" style={{ fontFamily: 'Fraunces, Georgia, serif', fontWeight: 600 }}>{s.value}</div>
                  <div className="text-[9px] font-bold tracking-widest uppercase text-stone-400">{s.label}</div>

                  {hoveredStat === s.key && s.value > 0 && (
                    <div className="absolute right-0 top-full pt-2 z-30 text-left">
                      <div className="bg-white shadow-2xl border border-stone-200 min-w-[280px] max-w-[340px] max-h-[400px] overflow-y-auto">
                        <div className="px-3 py-2 bg-stone-100 border-b border-stone-200 sticky top-0">
                          <div className="text-[9px] font-bold tracking-widest uppercase text-stone-600">{s.label} · {s.value}</div>
                        </div>
                        <div className="py-1">
                          {s.list.map(t => {
                            const bs = getBrandStyle(t.brand);
                            return (
                              <button
                                key={t.id}
                                onClick={() => { setSelectedTest(t); setHoveredStat(null); }}
                                style={{ borderLeftColor: bs.accent }}
                                className="w-full px-3 py-2 hover:bg-stone-50 border-l-4 transition flex items-center gap-2">
                                <span style={{ background: bs.bg, color: bs.text }} className="text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 flex-shrink-0">
                                  {t.brand}
                                </span>
                                <span className="text-xs font-mono text-stone-500 flex-shrink-0">{t.adSet || '—'}</span>
                                <span className="text-xs text-stone-700 truncate flex-1 text-left">{t.changesTo}</span>
                                {t.winner && (
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                                )}
                                <ChevronRight className="w-3 h-3 text-stone-400 flex-shrink-0" />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className="bg-stone-50 border-b border-stone-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-8 py-4 flex items-center gap-3 flex-wrap">
          <div className="flex border border-stone-300 bg-white">
            {[
              { id: 'grid', label: 'Grid', icon: LayoutGrid },
              { id: 'month', label: 'Month', icon: Calendar },
              { id: 'timeline', label: 'Timeline', icon: CalendarDays },
            ].map(v => (
              <button key={v.id} onClick={() => setView(v.id)}
                className={`px-3 py-2 text-[10px] font-bold tracking-widest uppercase flex items-center gap-1.5 border-r last:border-r-0 border-stone-300 transition ${
                  view === v.id ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'
                }`}>
                <v.icon className="w-3 h-3" />
                {v.label}
              </button>
            ))}
          </div>

          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tests..."
              className="w-full pl-10 pr-3 py-2 bg-white border border-stone-200 text-sm focus:outline-none focus:border-stone-900" />
          </div>
          <select value={filterBrand} onChange={e => setFilterBrand(e.target.value)} className="px-3 py-2 bg-white border border-stone-200 text-xs font-semibold uppercase tracking-wider">
            <option value="all">All Brands</option>
            {brands.map(b => <option key={b}>{b}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 bg-white border border-stone-200 text-xs font-semibold uppercase tracking-wider">
            <option value="all">All Status</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="px-3 py-2 bg-white border border-stone-200 text-xs font-semibold uppercase tracking-wider" title="Sort">
            <option value="updated">Sort: Recently Added</option>
            <option value="launch-asc">Sort: Launch ↑</option>
            <option value="launch-desc">Sort: Launch ↓</option>
            <option value="brand">Sort: Brand</option>
          </select>
          <div className="flex-1" />
          <button onClick={() => setShowSettings(true)} title="ClickUp settings"
            className="p-2 bg-white border border-stone-200 text-stone-600 hover:bg-stone-100 hover:text-stone-900 transition">
            <Settings className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleAdd} className="px-4 py-2 bg-stone-900 text-white text-xs font-bold tracking-widest uppercase hover:bg-stone-800 flex items-center gap-2">
            <Plus className="w-3.5 h-3.5" /> New Test
          </button>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-8 py-8">
        {view === 'month' && <MonthCalendar tests={filtered} onSelect={setSelectedTest} />}
        {view === 'timeline' && <TimelineView tests={filtered} onSelect={setSelectedTest} />}

        {view === 'grid' && (
          filtered.length === 0 ? (
            <div className="py-24 text-center">
              <Target className="w-12 h-12 text-stone-300 mx-auto mb-4" />
              <p className="text-stone-500">No tests match your filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map(test => (
                <TestCard
                  key={test.id}
                  test={test}
                  allTests={tests}
                  onSelect={setSelectedTest}
                  onOpenThread={(chain, currentId) => setThreadModalChain({ chain, currentId })}
                />
              ))}
            </div>
          )
        )}
      </main>

      {selectedTest && (
        <DetailPortal
          test={selectedTest}
          allTests={tests}
          clickUpSettings={clickUpSettings}
          onClose={() => setSelectedTest(null)}
          onSave={handleSave}
          onDelete={handleDelete}
          onOpenTest={(t) => setSelectedTest(t)}
          onCreateFollowUp={handleCreateFollowUp}
        />
      )}

      {threadModalChain && (
        <ThreadModal
          chain={threadModalChain.chain}
          currentId={threadModalChain.currentId}
          onClose={() => setThreadModalChain(null)}
          onOpenTest={(t) => setSelectedTest(t)}
        />
      )}

      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowSettings(false)}>
          <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" />
          <div className="relative bg-stone-50 max-w-lg w-full shadow-2xl border border-stone-200" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
              <h2 className="text-2xl" style={{ fontFamily: 'Fraunces, Georgia, serif', fontWeight: 500 }}>ClickUp Settings</h2>
              <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-stone-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="text-[10px] font-bold tracking-widest uppercase text-stone-500 mb-2 block">
                  ClickUp Workspace URL <span className="text-stone-400 normal-case tracking-normal font-normal">(optional)</span>
                </label>
                <input
                  value={clickUpSettings.workspaceUrl}
                  onChange={e => setClickUpSettings({ ...clickUpSettings, workspaceUrl: e.target.value })}
                  placeholder="https://app.clickup.com"
                  className="w-full px-3 py-2 bg-white border border-stone-300 text-sm font-mono"
                />
                <p className="text-xs text-stone-500 mt-2 leading-relaxed">
                  Leave default if you use the standard ClickUp web app. If your team uses a custom subdomain or you want to deep-link to a specific workspace, paste the base URL here (e.g. <span className="font-mono">https://app.clickup.com/9012345</span>).
                </p>
              </div>

              <div className="bg-stone-100 border-l-4 border-stone-400 px-4 py-3">
                <div className="text-[10px] font-bold tracking-widest uppercase text-stone-700 mb-1">How this works</div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Clicking <span className="font-semibold">Send to ClickUp</span> opens a new ClickUp tab with the test's title, full description (brand, change type, objective, variations, dates), and due date pre-filled. You'll choose the destination List in ClickUp and save from there. No API key required.
                </p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-stone-200 flex justify-end gap-2">
              <button onClick={() => setShowSettings(false)} className="px-4 py-2 text-xs font-bold tracking-widest uppercase text-stone-600 hover:bg-stone-100">Cancel</button>
              <button onClick={() => { persistClickUpSettings(clickUpSettings); setShowSettings(false); }}
                className="px-4 py-2 bg-stone-900 text-white text-xs font-bold tracking-widest uppercase hover:bg-stone-800">
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="border-t border-stone-200 mt-16 py-8">
        <div className="max-w-7xl mx-auto px-8 text-center text-[10px] font-bold tracking-[0.3em] uppercase text-stone-400">
          The Test Ledger · Built for Vanquish
        </div>
      </footer>
    </div>
  );
}
