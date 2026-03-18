/* ============================================================
   dining-calendar.js — CSULB Dining Calendar
   ============================================================ */

'use strict';

const CSULB_URL    = 'https://www.csulb.edu/beach-shops/residential-dining-menus';
const GUIDE_URL    = 'https://www.csulb.edu/beach-shops/residential-dining-guide';
const GUIDE_ANCHOR = 'accordion-10970536';
const CORS_PROXY   = 'https://api.codetabs.com/v1/proxy?quest=';
const HALL_COOKIE  = 'diningHall';
const DAY_NAMES   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DAY_SHORT   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const KNOWN_HALLS = ['Beachside', 'Hillside', 'Parkside'];

// ── Always-available items (hard-coded) ──────────────────────
// dietary: null override = mixed station (has both vegan and non-vegan options)
const ALWAYS_AVAILABLE = {
  Breakfast: [
    { name: 'Scrambled Eggs',              allergens: ['E'] },
    { name: 'Oatmeal',                     allergens: ['M'] },
    { name: 'Waffle Bar',                  allergens: ['E', 'M', 'W'] },
    { name: 'Assorted Breakfast Pastries', allergens: ['E', 'M', 'W'] },
    { name: 'Assorted Cereals',            allergens: ['M', 'W'] },
    { name: 'Fresh Fruit',                 allergens: [] },
    { name: 'Deli Bar',                    allergens: ['E', 'M', 'W'], dietary: null },
    { name: 'Milk',                        allergens: ['M'] },
    { name: 'Non-Dairy Milk',              allergens: [] },
    { name: 'Assorted Fruit Juice',        allergens: [] },
    { name: 'Assorted Sparkling Water',    allergens: [] },
    { name: 'Assorted Flavored Waters',    allergens: [] },
    { name: 'Assorted Soft Drinks',        allergens: [] },
  ],
  Lunch: [
    { name: 'Salad Bar',                allergens: [] },
    { name: 'Fresh Fruit',              allergens: [] },
    { name: "Chef's Choice",            allergens: [] },
    { name: 'Deli Bar',                 allergens: ['E', 'M', 'W'], dietary: null },
    { name: 'Assorted Cereals',         allergens: ['M', 'W'] },
    { name: 'Milk',                     allergens: ['M'] },
    { name: 'Non-Dairy Milk',           allergens: [] },
    { name: 'Assorted Fruit Juice',     allergens: [] },
    { name: 'Assorted Sparkling Water', allergens: [] },
    { name: 'Assorted Flavored Waters', allergens: [] },
    { name: 'Assorted Soft Drinks',     allergens: [] },
    { name: 'Assorted Desserts',        allergens: ['E', 'M', 'W'] },
    { name: 'Novelty Ice Creams',       allergens: ['M'] },
    { name: 'Fruit Ice Creams',         allergens: [] },
  ],
  Dinner: [
    { name: 'Salad Bar',                allergens: [] },
    { name: 'Fresh Fruit',              allergens: [] },
    { name: "Chef's Choice",            allergens: [] },
    { name: 'Deli Bar',                 allergens: ['E', 'M', 'W'], dietary: null },
    { name: 'Assorted Cereals',         allergens: ['M', 'W'] },
    { name: 'Milk',                     allergens: ['M'] },
    { name: 'Non-Dairy Milk',           allergens: [] },
    { name: 'Assorted Fruit Juice',     allergens: [] },
    { name: 'Assorted Sparkling Water', allergens: [] },
    { name: 'Assorted Flavored Waters', allergens: [] },
    { name: 'Assorted Soft Drinks',     allergens: [] },
  ],
};
ALWAYS_AVAILABLE.Brunch = ALWAYS_AVAILABLE.Lunch;

// Vegan suggestions shown on the asterisk tooltip when no vegan cycle items
const VEGAN_SUGGESTIONS = {
  Breakfast: 'Try fresh fruit or oatmeal with non-dairy milk.',
  Brunch:    'Build a salad or grab a vegan sandwich from the deli.',
  Lunch:     'Build a salad or grab a vegan sandwich from the deli.',
  Dinner:    'Build a salad or grab a vegan sandwich from the deli.',
};

// ── Allergen badge map ────────────────────────────────────────
const ALLERGEN_CSS = {
  'M':    'badge-M',
  'E':    'badge-E',
  'W':    'badge-W',
  'S':    'badge-S',
  'P':    'badge-P',
  'TN':   'badge-TN',
  'F':    'badge-F',
  'SF-C': 'badge-SF',
  'SS':   'badge-SS',
};

// ── Dietary detection ─────────────────────────────────────────
const DIETARY_TOOLTIP =
  'This label is automatically determined based on allergen codes and item ' +
  'name keywords. It may not be completely accurate — please verify with ' +
  'dining staff.';

const VEGAN_OVERRIDE = ['gardein', 'vegan', 'plant-based', 'plant based'];

// Land animals only — seafood is separate so pescatarian can match
const LAND_MEAT_KEYWORDS = [
  'chicken','beef','pork','ham','turkey','bacon','sausage','pepperoni',
  'kielbasa','steak','burger','hot dog','rib','chorizo','meatball','lamb',
  'brisket','salami','prosciutto','carnitas','birria','carne asada','al pastor',
  'pastrami','meat lover','surf and turf',
];

const SEAFOOD_KEYWORDS = [
  'tuna','salmon','shrimp','lobster','crab','clam','oyster',
  'tilapia','anchov','fish','seafood',
];

// Items whose contents are genuinely unknown regardless of allergen labeling
const UNLABELED_KEYWORDS = ["chef's choice", "chef choice", "build your own"];

function detectDietary(name, allergens) {
  const lower = name.toLowerCase();

  const hasDairyOrEgg      = allergens.some(a => a === 'M' || a === 'E');
  const hasSeafoodAllergen = allergens.some(a => a.startsWith('SF') || a === 'F');
  const hasLandMeat        = LAND_MEAT_KEYWORDS.some(kw => lower.includes(kw));
  const hasSeafoodName     = SEAFOOD_KEYWORDS.some(kw => lower.includes(kw));
  const hasSeafood         = hasSeafoodAllergen || hasSeafoodName;

  // Named "unknown" items — contents not determinable regardless of allergen label
  if (UNLABELED_KEYWORDS.some(kw => lower.includes(kw))) return null;

  // Vegan-brand override fires first and bypasses the land-meat check entirely
  // (e.g. "Gardein Beef Fajitas" — "beef" is in the name but the product is plant-based)
  // Dairy/egg allergens still demote vegan → vegetarian
  if (VEGAN_OVERRIDE.some(kw => lower.includes(kw))) {
    return hasDairyOrEgg ? 'vegetarian' : 'vegan';
  }

  // Land meat → not vegetarian/pescatarian
  if (hasLandMeat) return null;

  // No land meat + seafood → pescatarian
  if (hasSeafood) return 'pescatarian';

  // Dairy or egg → vegetarian
  if (hasDairyOrEgg) return 'vegetarian';

  // No disqualifying keywords or allergens → compatible with vegan
  return 'vegan';
}

// ── App state ─────────────────────────────────────────────────
const state = {
  cycleData:            null,
  cycleDateMap:         null,
  holidayMap:           null,   // loaded in background from dining guide
  currentMondayDate:    null,
  activeMeal:           null,
  activeHall:           'Beachside',
  mobileActiveDayIndex: 0,
  calendarOpen:         false,
  calendarViewDate:     new Date(),
};

// ── Date helpers ──────────────────────────────────────────────
function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getMondayOf(date) {
  const d = new Date(date);
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function formatMonthDay(date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function isToday(date) {
  const now = new Date();
  return date.getFullYear() === now.getFullYear() &&
         date.getMonth()    === now.getMonth()    &&
         date.getDate()     === now.getDate();
}

function autoSelectMeal() {
  const now  = new Date();
  const dow  = now.getDay();
  const hour = now.getHours() + now.getMinutes() / 60;
  const isWeekend = dow === 0 || dow === 6;
  if (isWeekend && hour >= 11 && hour < 13.5) return 'Brunch';
  if (hour >= 7   && hour < 11)   return 'Breakfast';
  if (hour >= 11  && hour < 15.5) return 'Lunch';
  return 'Dinner';
}

// ── Cookie helpers ────────────────────────────────────────────
function getCookie(name) {
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}

function setCookie(name, value, days = 365) {
  const exp = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${exp}; path=/`;
}

// ── URL param helpers ─────────────────────────────────────────
function parseURLParams() {
  const p = new URLSearchParams(location.search);
  return {
    dateStr: p.get('date'),
    hall:    p.get('hall'),
    meal:    p.get('meal'),
  };
}

function buildURL() {
  const activeDate = addDays(state.currentMondayDate, state.mobileActiveDayIndex);
  const p = new URLSearchParams();
  p.set('date', toDateKey(activeDate));
  p.set('hall', state.activeHall);
  p.set('meal', state.activeMeal || '');
  return location.pathname + '?' + p.toString();
}

function syncURL() {
  if (!state.activeMeal) return;
  history.replaceState(null, '', buildURL());
}

// ── HTML parsing helpers ──────────────────────────────────────
/**
 * Split a <p> element's child nodes at <br> boundaries into arrays of tokens.
 * Token: { type: 'strong'|'em'|'text', text: string }
 */
function splitParagraphIntoLines(p) {
  const lines = [];
  let line = [];

  function flush() {
    if (line.length) { lines.push(line); line = []; }
  }

  for (const node of p.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent.trim();
      if (text) line.push({ type: 'text', text });
    } else if (node.nodeName === 'BR') {
      flush();
    } else if (node.nodeName === 'STRONG') {
      const text = node.textContent.trim();
      if (text) line.push({ type: 'strong', text });
    } else if (node.nodeName === 'EM') {
      const text = node.textContent.trim();
      if (text) line.push({ type: 'em', text });
    } else {
      const text = node.textContent.trim();
      if (text) line.push({ type: 'text', text });
    }
  }
  flush();
  return lines;
}

function isHallToken(token) {
  if (token.type !== 'em') return false;
  const t = token.text.toLowerCase();
  return KNOWN_HALLS.some(h => t.includes(h.toLowerCase()));
}

function extractHallName(token) {
  const t = token.text.toLowerCase();
  return KNOWN_HALLS.find(h => t.includes(h.toLowerCase())) || token.text;
}

/**
 * Parse item name + allergen codes from a line's tokens.
 */
function parseItemLine(tokens) {
  const nameParts = [];
  let allergens = [];

  for (const tok of tokens) {
    if (tok.type === 'em') {
      const codes = tok.text.split('/').map(c => c.trim()).filter(Boolean);
      const isAllergen = codes.length > 0 && codes.every(c =>
        /^(M|E|W|S|P|TN|F|SF-C?|SS)$/i.test(c)
      );
      if (isAllergen) {
        allergens = codes.map(c => c.toUpperCase());
      } else {
        nameParts.push(tok.text);
      }
    } else if (tok.type === 'text') {
      nameParts.push(tok.text);
    }
  }

  const name = nameParts.join(' ').replace(/\s+/g, ' ').replace(/\u00a0/g, ' ').trim();
  return { name, allergens };
}

// ── parseCycleDateMap ─────────────────────────────────────────
/**
 * Returns Map<'YYYY-MM-DD' (Monday of week), cycleNum>
 *
 * Tables are inside accordion card-bodies. The year is in the card's
 * button text (e.g. "Spring 2026 Residential Dining Menu Cycle Dates").
 * Walking up to the .card level gets the year from card textContent.
 */
function parseCycleDateMap(doc) {
  const map = new Map();

  doc.querySelectorAll('table').forEach(table => {
    // Find year by walking up to .card, whose textContent includes button text
    let year = new Date().getFullYear();
    let el = table.parentElement;
    for (let i = 0; i < 8 && el; i++) {
      const m = el.textContent.match(/\b(202\d)\b/);
      if (m) { year = parseInt(m[1], 10); break; }
      el = el.parentElement;
    }

    table.querySelectorAll('tr').forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length < 2) return;

      const dateText  = cells[0].textContent.trim().replace(/\bSept\b/i, 'Sep');
      const cycleText = cells[1].textContent.trim();
      const cycleNum  = parseInt(cycleText, 10);

      if (isNaN(cycleNum) || cycleNum < 1 || cycleNum > 5) return;

      const parsed = new Date(`${dateText} ${year}`);
      if (isNaN(parsed.getTime())) return;

      map.set(toDateKey(getMondayOf(parsed)), cycleNum);
    });
  });

  return map;
}

// ── parseCycleData ────────────────────────────────────────────
/**
 * Returns Map<cycleNum, { [dayName]: { [meal]: { [hall]: item[] } } }>
 *
 * The page structure is:
 *   <h2><a class="ck-anchor" id="cycle1"></a>Cycle 1 Menu</h2>
 *   ... (several wrapper divs) ...
 *   <div class="paragraph--type--accordion">  ← cycle 1's accordion
 *
 * The h2 and accordion are NOT siblings. We find cycle anchors
 * (a[id^="cycle"]) and use compareDocumentPosition to find the
 * first accordion that follows each anchor in document order.
 */
function parseCycleData(doc) {
  const data = new Map();

  // Cycle anchors in document order (a#cycle1, a#cycle2, …)
  const cycleAnchors = Array.from(doc.querySelectorAll('a[id]'))
    .filter(a => /^cycle\d+$/.test(a.id));

  if (cycleAnchors.length === 0) return data;

  const allAccordions = Array.from(doc.querySelectorAll('.paragraph--type--accordion'));

  for (let i = 0; i < cycleAnchors.length; i++) {
    const anchor    = cycleAnchors[i];
    const nextAnchor = cycleAnchors[i + 1] || null;
    const cycleNum  = parseInt(anchor.id.replace('cycle', ''), 10);

    // First accordion that comes AFTER this anchor AND BEFORE the next anchor
    const accordion = allAccordions.find(acc => {
      const afterThis  = (anchor.compareDocumentPosition(acc) & 4 /* FOLLOWING */) !== 0;
      const beforeNext = !nextAnchor ||
        (nextAnchor.compareDocumentPosition(acc) & 2 /* PRECEDING */) !== 0;
      return afterThis && beforeNext;
    });

    if (!accordion) continue;

    const cycleMenu = {};

    accordion.querySelectorAll('.card').forEach(card => {
      const btn = card.querySelector('button');
      if (!btn) return;
      const dayName = btn.textContent.trim();
      if (!DAY_NAMES.includes(dayName)) return; // skip date-table cards

      const body = card.querySelector('.card-body');
      if (!body) return;

      const dayMenu    = {};
      let currentMeal  = null;
      let currentHall  = null;

      body.querySelectorAll('p').forEach(p => {
        splitParagraphIntoLines(p).forEach(lineTokens => {
          if (!lineTokens.length) return;
          const first = lineTokens[0];

          if (first.type === 'strong') {
            currentMeal = first.text.trim();
            const rest = lineTokens.slice(1);
            if (rest.length && currentMeal && currentHall) {
              const { name, allergens } = parseItemLine(rest);
              if (name) pushItem(dayMenu, currentMeal, currentHall, name, allergens);
            }
            return;
          }

          if (isHallToken(first)) {
            currentHall = extractHallName(first);
            const rest = lineTokens.slice(1);
            if (rest.length && currentMeal) {
              const { name, allergens } = parseItemLine(rest);
              if (name) pushItem(dayMenu, currentMeal, currentHall, name, allergens);
            }
            return;
          }

          if (currentMeal && currentHall) {
            const { name, allergens } = parseItemLine(lineTokens);
            if (name) pushItem(dayMenu, currentMeal, currentHall, name, allergens);
          }
        });
      });

      cycleMenu[dayName] = dayMenu;
    });

    data.set(cycleNum, cycleMenu);
  }

  return data;
}

// ── parseHolidayClosures ──────────────────────────────────────
/**
 * Parses the dining guide page for special holiday closure dates.
 * Returns Map<'YYYY-MM-DD', { label: string }>
 *
 * Dates where items are absent for regular schedule reasons (e.g. Parkside
 * on weekends) are handled separately by the "no items → closed" logic.
 * This map is only needed for holiday-specific labeling.
 */
function parseHolidayClosures(guideDoc) {
  const map = new Map();
  const accordion = guideDoc.getElementById(GUIDE_ANCHOR);
  if (!accordion) return map;

  const dateRe = /\b(\d{1,2})-(\d{1,2})-(\d{2,4})\b/g;

  function parseMDY(m, d, y) {
    let year = parseInt(y, 10);
    if (year < 100) year += 2000;
    return new Date(year, parseInt(m, 10) - 1, parseInt(d, 10));
  }

  accordion.querySelectorAll('h5').forEach(h5 => {
    const h5Text = h5.textContent.replace(/\u00a0/g, ' ').trim();
    const allMatches = [...h5Text.matchAll(dateRe)];
    if (allMatches.length === 0) return;

    // Collect all P siblings following this H5 until the next heading
    const pTexts = [];
    let el = h5.nextElementSibling;
    while (el && !['H3', 'H4', 'H5'].includes(el.tagName)) {
      if (el.tagName === 'P') {
        const t = el.textContent.replace(/\u00a0/g, ' ').trim();
        if (t) pTexts.push(t);
      }
      el = el.nextElementSibling;
    }
    const descText = pTexts.join('\n');

    // Full text exactly as it appears in the guide
    const fullText = h5Text + (descText ? '\n' + descText : '');

    const combined = (h5Text + ' ' + descText).toLowerCase();
    let label = 'Holiday Closure';
    if (/spring break/.test(combined))      label = 'Spring Break';
    else if (/thanksgiving/.test(combined)) label = 'Thanksgiving';
    else if (/fall break/.test(combined))   label = 'Fall Break';
    else if (/labor day/.test(combined))    label = 'Labor Day';
    else if (/veteran/.test(combined))      label = 'Veterans Day';
    else if (/winter/.test(combined))       label = 'Winter Break';

    const entry = { label, text: fullText };
    const isRange = /\bto\b/i.test(h5Text) && allMatches.length >= 2;

    if (isRange) {
      const start = parseMDY(...allMatches[0].slice(1));
      const end   = parseMDY(...allMatches[allMatches.length - 1].slice(1));
      if (!isNaN(start) && !isNaN(end)) {
        let cur = new Date(start);
        while (cur <= end) {
          map.set(toDateKey(new Date(cur)), entry);
          cur.setDate(cur.getDate() + 1);
        }
      }
    } else {
      allMatches.forEach(match => {
        const date = parseMDY(...match.slice(1));
        if (!isNaN(date.getTime())) map.set(toDateKey(date), entry);
      });
    }
  });

  return map;
}

function pushItem(dayMenu, meal, hall, name, allergens) {
  if (!dayMenu[meal])       dayMenu[meal]       = {};
  if (!dayMenu[meal][hall]) dayMenu[meal][hall] = [];
  dayMenu[meal][hall].push({ name, allergens, dietary: detectDietary(name, allergens) });
}

// ── Render helpers ────────────────────────────────────────────
function makeWarningIcon() {
  const NS  = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('width', '9');
  svg.setAttribute('height', '9');
  svg.setAttribute('fill', 'currentColor');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('holiday-icon');
  const path = document.createElementNS(NS, 'path');
  // Bootstrap exclamation-triangle-fill
  path.setAttribute('d',
    'M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 ' +
    '1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9' +
    '.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 ' +
    '6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z'
  );
  svg.appendChild(path);
  return svg;
}

function makeBadge(code) {
  const cls  = ALLERGEN_CSS[code] || 'badge-SS';
  const span = document.createElement('span');
  span.className = `badge ${cls}`;
  span.textContent = code;
  return span;
}

const DIETARY_LABEL = { vegan: 'Vegan', vegetarian: 'Vt.', pescatarian: 'Pesc.' };
const DIETARY_CLASS = { vegan: 'badge-vegan', vegetarian: 'badge-veg', pescatarian: 'badge-pesc' };

function makeDietaryBadge(dietary) {
  const span = document.createElement('span');
  span.className = `badge ${DIETARY_CLASS[dietary]}`;
  span.textContent = DIETARY_LABEL[dietary];
  span.addEventListener('mouseenter', e => showDietaryTooltip(e));
  span.addEventListener('mousemove',  e => moveDietaryTooltip(e));
  span.addEventListener('mouseleave', hideDietaryTooltip);
  return span;
}

function showTooltip(e, text) {
  const tip = document.getElementById('dietary-tooltip');
  tip.textContent = text;
  tip.style.opacity = '1';
  moveDietaryTooltip(e);
}

function showDietaryTooltip(e) {
  showTooltip(e, DIETARY_TOOLTIP);
}
function moveDietaryTooltip(e) {
  const tip  = document.getElementById('dietary-tooltip');
  const x    = e.clientX + 14;
  const y    = e.clientY - 8;
  const tipW = tip.offsetWidth || 260;
  const tipH = tip.offsetHeight || 40;
  tip.style.left = (x + tipW > window.innerWidth ? x - tipW - 24 : x) + 'px';
  tip.style.top  = Math.max(4, y - tipH) + 'px';
}
function hideDietaryTooltip() {
  document.getElementById('dietary-tooltip').style.opacity = '0';
}

function makeItemEl(item) {
  const div  = document.createElement('div');
  div.className = 'menu-item' + (item.dietary ? ` dietary-${item.dietary}` : '');

  const name = document.createElement('span');
  name.className = 'item-name';
  name.textContent = item.name;
  div.appendChild(name);

  if (item.allergens.length || item.dietary) {
    const badges = document.createElement('div');
    badges.className = 'item-badges';
    item.allergens.forEach(a => badges.appendChild(makeBadge(a)));
    if (item.dietary) badges.appendChild(makeDietaryBadge(item.dietary));
    div.appendChild(badges);
  }
  return div;
}

function getItemsForDay(dayName) {
  if (!state.cycleData || !state.cycleDateMap) return [];
  const cycleNum  = state.cycleDateMap.get(toDateKey(state.currentMondayDate));
  if (!cycleNum) return [];
  const cycleMenu = state.cycleData.get(cycleNum);
  if (!cycleMenu) return [];
  const items = cycleMenu[dayName]?.[state.activeMeal]?.[state.activeHall] ?? [];
  // Exclude items with unknown contents — they live in Always Available instead
  return items.filter(it => {
    const lower = it.name.toLowerCase();
    return !UNLABELED_KEYWORDS.some(kw => lower.includes(kw));
  });
}

// ── Always-available section ──────────────────────────────────
function resolveAlwaysAvailItems(meal) {
  return (ALWAYS_AVAILABLE[meal] || []).map(i => ({
    name:      i.name,
    allergens: i.allergens,
    dietary:   'dietary' in i ? i.dietary : detectDietary(i.name, i.allergens),
  }));
}

function makeAlwaysAvailSection(meal) {
  const items = resolveAlwaysAvailItems(meal);

  const section = document.createElement('div');
  section.className = 'always-avail';

  const toggle = document.createElement('button');
  toggle.className = 'always-avail-toggle';
  toggle.type = 'button';
  toggle.innerHTML = '<span class="aa-arrow">▸</span> Always Available';

  const body = document.createElement('div');
  body.className = 'always-avail-body';
  body.hidden = true;
  items.forEach(item => body.appendChild(makeItemEl(item)));

  toggle.addEventListener('click', e => {
    e.stopPropagation();
    body.hidden = !body.hidden;
    toggle.querySelector('.aa-arrow').textContent = body.hidden ? '▸' : '▾';
  });

  section.appendChild(toggle);
  section.appendChild(body);
  return section;
}

// ── Rendering ─────────────────────────────────────────────────
function renderWeekLabel() {
  const mon = state.currentMondayDate;
  const sun = addDays(mon, 6);
  document.getElementById('week-label').textContent =
    `${formatMonthDay(mon)} – ${formatMonthDay(sun)}`;

  const cycleNum = state.cycleDateMap?.get(toDateKey(mon));
  const cycleEl  = document.getElementById('cycle-label');
  cycleEl.textContent  = cycleNum ? `Cycle ${cycleNum}` : '';
  cycleEl.style.display = cycleNum ? '' : 'none';
}

function renderGrid() {
  const grid = document.getElementById('week-grid');
  grid.innerHTML = '';

  for (let i = 0; i < 7; i++) {
    const date     = addDays(state.currentMondayDate, i);
    const dayName  = DAY_NAMES[date.getDay()];
    const items    = getItemsForDay(dayName);
    const today    = isToday(date);
    const selected = i === state.mobileActiveDayIndex;

    const dateKey = toDateKey(date);
    const holiday = state.holidayMap?.get(dateKey);

    const card = document.createElement('div');
    card.className = 'day-card'
      + (today    ? ' today'    : '')
      + (selected ? ' selected' : '')
      + (holiday  ? ' holiday-warning' : '');
    card.style.cursor = 'pointer';

    const hdr = document.createElement('div');
    hdr.className = 'day-header';
    hdr.innerHTML = `
      <div class="day-name">${DAY_SHORT[date.getDay()]}</div>
      <div class="day-date">${formatMonthDay(date)}</div>
      ${today ? '<div class="today-badge">Today</div>' : ''}
    `;

    // Holiday warning: icon in day-name + tooltip on header
    if (holiday) {
      hdr.style.cursor = 'help';
      hdr.addEventListener('mouseenter', e => showTooltip(e, holiday.text));
      hdr.addEventListener('mousemove',  moveDietaryTooltip);
      hdr.addEventListener('mouseleave', hideDietaryTooltip);
      hdr.querySelector('.day-name').prepend(makeWarningIcon());
    }

    // Asterisk if cycle menu has no vegan items
    const hasVegan = items.some(it => it.dietary === 'vegan');
    if (!hasVegan && items.length > 0) {
      const suggestion = VEGAN_SUGGESTIONS[state.activeMeal] || '';
      const tipText = `No vegan items in the cycle menu for this day.\n\nAlways-available options:\n${suggestion}`;
      const ast = document.createElement('span');
      ast.className = 'no-vegan-asterisk';
      ast.textContent = '*';
      ast.addEventListener('mouseenter', e => showTooltip(e, tipText));
      ast.addEventListener('mousemove',  moveDietaryTooltip);
      ast.addEventListener('mouseleave', hideDietaryTooltip);
      hdr.querySelector('.day-name').appendChild(ast);
    }

    card.appendChild(hdr);

    const body = document.createElement('div');
    body.className = 'day-body';

    if (items.length === 0) {
      card.classList.add('closed');
      const msg = document.createElement('div');
      if (holiday) {
        msg.className = 'closed-holiday-msg';
        const link = document.createElement('a');
        link.href = `${GUIDE_URL}#${GUIDE_ANCHOR}`;
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = 'See schedule →';
        msg.textContent = `Closed — ${holiday.label}. `;
        msg.appendChild(link);
      } else {
        msg.className = 'closed-simple-msg';
        msg.textContent = 'Closed';
      }
      body.appendChild(msg);
      // No Always Available for closed days
    } else {
      items.forEach(item => body.appendChild(makeItemEl(item)));
      body.appendChild(makeAlwaysAvailSection(state.activeMeal));
    }

    // Holiday tooltip on body area; yield to dietary badge tooltips
    if (holiday) {
      body.addEventListener('mousemove', e => {
        if (e.target.closest('.badge-vegan, .badge-veg, .badge-pesc')) return;
        showTooltip(e, holiday.text);
      });
      body.addEventListener('mouseleave', hideDietaryTooltip);
    }

    card.appendChild(body);

    // Clicking a day card selects it
    card.addEventListener('click', () => {
      state.mobileActiveDayIndex = i;
      renderGrid();
      renderMobileDay();
      syncURL();
    });

    grid.appendChild(card);
  }
}

function renderMobileDay() {
  const date    = addDays(state.currentMondayDate, state.mobileActiveDayIndex);
  const dayName = DAY_NAMES[date.getDay()];
  const items   = getItemsForDay(dayName);
  const today   = isToday(date);
  const dateKey = toDateKey(date);
  const holiday = state.holidayMap?.get(dateKey);

  const mobileLbl = document.getElementById('mobile-day-label');
  mobileLbl.textContent =
    `${DAY_SHORT[date.getDay()]} ${formatMonthDay(date)}${today ? ' · Today' : ''}`;

  // Holiday styling on mobile day label
  mobileLbl.classList.toggle('holiday-warning', !!holiday);
  mobileLbl.onmouseenter = holiday ? (e => showTooltip(e, holiday.text)) : null;
  mobileLbl.onmousemove  = holiday ? moveDietaryTooltip : null;
  mobileLbl.onmouseleave = holiday ? hideDietaryTooltip : null;
  mobileLbl.style.cursor = holiday ? 'help' : '';
  if (holiday) mobileLbl.prepend(makeWarningIcon());

  const content = document.getElementById('mobile-day-content');
  content.innerHTML = '';

  if (items.length === 0) {
    const holiday = state.holidayMap?.get(dateKey);
    const msg = document.createElement('div');
    if (holiday) {
      msg.className = 'closed-holiday-msg';
      const link = document.createElement('a');
      link.href = `${GUIDE_URL}#${GUIDE_ANCHOR}`;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = 'See schedule →';
      msg.textContent = `Closed — ${holiday.label}. `;
      msg.appendChild(link);
    } else {
      msg.className = 'closed-simple-msg';
      msg.textContent = 'Closed';
    }
    content.appendChild(msg);
  } else {
    items.forEach(item => content.appendChild(makeItemEl(item)));
    content.appendChild(makeAlwaysAvailSection(state.activeMeal));
  }
}

function renderAll() {
  renderWeekLabel();
  renderGrid();
  renderMobileDay();
  syncURL();
}

function setStatus(msg, showSpinner = false) {
  const bar  = document.getElementById('status-bar');
  const spin = document.getElementById('spinner');
  const txt  = document.getElementById('status-msg');
  if (!msg) { bar.classList.add('hidden'); return; }
  bar.classList.remove('hidden');
  txt.textContent = msg;
  spin.classList.toggle('hidden', !showSpinner);
}

function setActiveMeal(meal) {
  state.activeMeal = meal;
  document.querySelectorAll('.meal-tab').forEach(btn => {
    const active = btn.dataset.meal === meal;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });
}

// ── Calendar picker ───────────────────────────────────────────
function renderCalendar() {
  const d     = state.calendarViewDate;
  const year  = d.getFullYear();
  const month = d.getMonth();

  document.getElementById('cal-month-label').textContent =
    new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(d);

  const firstDow   = new Date(year, month, 1).getDay();   // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const activeDateKey = toDateKey(addDays(state.currentMondayDate, state.mobileActiveDayIndex));
  const currentMonKey = toDateKey(state.currentMondayDate);

  const container = document.getElementById('cal-days');
  container.innerHTML = '';

  // Empty cells before the 1st
  for (let i = 0; i < firstDow; i++) {
    const empty = document.createElement('span');
    empty.className = 'cal-day cal-day-empty';
    container.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date    = new Date(year, month, day);
    const dateKey = toDateKey(date);
    const monKey  = toDateKey(getMondayOf(date));

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cal-day';
    btn.textContent = day;
    btn.setAttribute('aria-label',
      new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(date));

    if (monKey === currentMonKey) btn.classList.add('cal-in-week');
    if (isToday(date))            btn.classList.add('cal-today');
    if (dateKey === activeDateKey) btn.classList.add('cal-selected');

    btn.addEventListener('click', () => {
      state.currentMondayDate    = getMondayOf(date);
      const dow = date.getDay();
      state.mobileActiveDayIndex = dow === 0 ? 6 : dow - 1;
      toggleCalendar(false);
      renderAll();
    });

    container.appendChild(btn);
  }
}

function toggleCalendar(open) {
  state.calendarOpen = (open !== undefined) ? open : !state.calendarOpen;
  const dropdown = document.getElementById('calendar-dropdown');
  const btnCal   = document.getElementById('btn-calendar');
  dropdown.classList.toggle('hidden', !state.calendarOpen);
  btnCal.setAttribute('aria-expanded', String(state.calendarOpen));
  if (state.calendarOpen) {
    state.calendarViewDate = new Date(state.currentMondayDate);
    renderCalendar();
  }
}

// ── Fetch + parse ─────────────────────────────────────────────
async function fetchAndParse() {
  setStatus('Fetching menu data…', true);

  // Kick off both fetches in parallel; guide is non-blocking
  const menuFetchPromise  = fetch(CORS_PROXY + encodeURIComponent(CSULB_URL));
  const guideFetchPromise = fetch(CORS_PROXY + encodeURIComponent(GUIDE_URL));

  // Await menu data first (required before rendering)
  let html;
  try {
    const res = await menuFetchPromise;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  } catch (err) {
    setStatus('');
    document.getElementById('week-grid').innerHTML =
      `<div class="error-msg">Could not load menu data (${err.message}).<br><br>` +
      `Try refreshing, or visit <a href="${CSULB_URL}" target="_blank" rel="noopener">csulb.edu</a> directly.</div>`;
    return;
  }

  const doc = new DOMParser().parseFromString(html, 'text/html');
  state.cycleDateMap = parseCycleDateMap(doc);
  state.cycleData    = parseCycleData(doc);

  const cycleCount = state.cycleData.size;
  setStatus(cycleCount === 0
    ? 'Loaded (0 cycles parsed — page structure may have changed).'
    : '');

  renderAll();

  // Guide data arrives in background — re-render once it's ready
  guideFetchPromise
    .then(res => res.ok ? res.text() : Promise.reject(new Error(`HTTP ${res.status}`)))
    .then(guideHtml => {
      const guideDoc = new DOMParser().parseFromString(guideHtml, 'text/html');
      state.holidayMap = parseHolidayClosures(guideDoc);
      renderAll();
    })
    .catch(() => {}); // silently ignore guide errors — holidays are nice-to-have
}

// ── Init ──────────────────────────────────────────────────────
function init() {
  const { dateStr, hall, meal } = parseURLParams();
  const hallSelect = document.getElementById('hall-select');

  // Hall: URL param > cookie > default
  const hallPref = (hall && KNOWN_HALLS.includes(hall))
    ? hall
    : (getCookie(HALL_COOKIE) && KNOWN_HALLS.includes(getCookie(HALL_COOKIE))
      ? getCookie(HALL_COOKIE)
      : 'Beachside');
  state.activeHall  = hallPref;
  hallSelect.value  = hallPref;

  // Meal: URL param > time-based
  setActiveMeal(meal || autoSelectMeal());

  // Date: URL param > today
  let focusDate = new Date();
  if (dateStr) {
    const parsed = new Date(dateStr + 'T12:00:00');
    if (!isNaN(parsed.getTime())) focusDate = parsed;
  }
  state.currentMondayDate    = getMondayOf(focusDate);
  const dow = focusDate.getDay();
  state.mobileActiveDayIndex = dow === 0 ? 6 : dow - 1;

  // Render initial skeleton
  renderWeekLabel();

  // ── Event wiring ──
  document.getElementById('btn-prev-week').addEventListener('click', () => {
    state.currentMondayDate = addDays(state.currentMondayDate, -7);
    renderAll();
  });

  document.getElementById('btn-next-week').addEventListener('click', () => {
    state.currentMondayDate = addDays(state.currentMondayDate, 7);
    renderAll();
  });

  document.querySelectorAll('.meal-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      setActiveMeal(btn.dataset.meal);
      renderGrid();
      renderMobileDay();
      syncURL();
    });
  });

  hallSelect.addEventListener('change', () => {
    state.activeHall = hallSelect.value;
    setCookie(HALL_COOKIE, state.activeHall);
    renderGrid();
    renderMobileDay();
    syncURL();
  });

  document.getElementById('btn-prev-day').addEventListener('click', () => {
    if (state.mobileActiveDayIndex > 0) {
      state.mobileActiveDayIndex--;
    } else {
      state.currentMondayDate    = addDays(state.currentMondayDate, -7);
      state.mobileActiveDayIndex = 6;
      renderWeekLabel();
    }
    renderMobileDay();
    syncURL();
  });

  document.getElementById('btn-next-day').addEventListener('click', () => {
    if (state.mobileActiveDayIndex < 6) {
      state.mobileActiveDayIndex++;
    } else {
      state.currentMondayDate    = addDays(state.currentMondayDate, 7);
      state.mobileActiveDayIndex = 0;
      renderWeekLabel();
    }
    renderMobileDay();
    syncURL();
  });

  // Calendar toggle
  document.getElementById('btn-calendar').addEventListener('click', e => {
    e.stopPropagation();
    toggleCalendar();
  });

  document.getElementById('cal-prev-month').addEventListener('click', e => {
    e.stopPropagation();
    const d = state.calendarViewDate;
    state.calendarViewDate = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    renderCalendar();
  });

  document.getElementById('cal-today-btn').addEventListener('click', e => {
    e.stopPropagation();
    const today = new Date();
    state.currentMondayDate    = getMondayOf(today);
    state.mobileActiveDayIndex = today.getDay() === 0 ? 6 : today.getDay() - 1;
    toggleCalendar(false);
    renderAll();
  });

  document.getElementById('cal-next-month').addEventListener('click', e => {
    e.stopPropagation();
    const d = state.calendarViewDate;
    state.calendarViewDate = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    renderCalendar();
  });

  // Close calendar on outside click
  document.addEventListener('click', e => {
    if (!state.calendarOpen) return;
    const dropdown = document.getElementById('calendar-dropdown');
    const btnCal   = document.getElementById('btn-calendar');
    if (!dropdown.contains(e.target) && !btnCal.contains(e.target)) {
      toggleCalendar(false);
    }
  });

  // Close calendar on Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && state.calendarOpen) toggleCalendar(false);
  });

  // Wire tooltip to static legend dietary badges
  document.querySelectorAll('.legend .badge-vegan, .legend .badge-veg, .legend .badge-pesc').forEach(el => {
    el.addEventListener('mouseenter', e => showDietaryTooltip(e));
    el.addEventListener('mousemove',  e => moveDietaryTooltip(e));
    el.addEventListener('mouseleave', hideDietaryTooltip);
  });

  fetchAndParse();
}

document.addEventListener('DOMContentLoaded', init);
