const Destination = require('../models/Destination');
const seedData = require('../data/destinations.seed.json');

const OTM_BASE = 'https://api.opentripmap.com/0.1/en/places';
const OTM_KEY = process.env.OPENTRIPMAP_API_KEY;

const seedDestinationsIfEmpty = async () => {
  const count = await Destination.countDocuments();
  if (count > 0) return;

  await Destination.insertMany(seedData);
};

const normalizeCategory = (value) => {
  const normalized = String(value || '').toLowerCase().trim();
  if (['beach', 'history', 'adventure'].includes(normalized)) return normalized;
  return 'all';
};

const deriveCategory = (kinds = '', name = '', description = '') => {
  const text = `${kinds} ${name} ${description}`.toLowerCase();
  if (/(beach|coast|coastal|island|ocean|sea|shore|lagoon|bay|reef|sunset)/.test(text)) return 'beach';
  if (/(museum|historic|history|heritage|monument|palace|fort|temple|church|cathedral|castle|ruins|archaeology)/.test(text)) return 'history';
  if (/(adventure|trek|hike|trail|mountain|peak|forest|national park|wildlife|safari|canyon|rafting|ski|cliff)/.test(text)) return 'adventure';
  return 'adventure';
};

const fallbackImage =
  'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=60';

const buildRating = (rate) => {
  const base = Number(rate || 2);
  const scaled = 3 + base * 0.7;
  return Math.min(5, Math.max(3.5, Number(scaled.toFixed(1))));
};

const sanitizeDescription = (text = '') => {
  const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  if (/[^\x00-\x7F]/.test(cleaned)) return '';
  return cleaned.length > 220 ? cleaned.slice(0, 217) + '...' : cleaned;
};

const normalizeOutput = (items = []) =>
  items.map((item) => {
    const description = sanitizeDescription(item.description) || 'A popular destination worth exploring.';
    return { ...item, description };
  });

const mapToDestination = (details) => ({
  name: details?.name || 'Hidden gem',
  country: details?.address?.country || details?.address?.city || 'Unknown',
  image: details?.preview?.source || fallbackImage,
  description:
    sanitizeDescription(details?.wikipedia_extracts?.text) ||
    sanitizeDescription(details?.info?.descr) ||
    'A popular destination worth exploring.',
  rating: buildRating(details?.rate),
  category: deriveCategory(
    details?.kinds || '',
    details?.name || '',
    details?.wikipedia_extracts?.text || details?.info?.descr || ''
  ),
  lat: details?.point?.lat || 0,
  lng: details?.point?.lon || 0
});

const mapFromRadius = (item) => ({
  name: item?.name || 'Hidden gem',
  country: item?.address?.country || item?.address?.city || 'Unknown',
  image: fallbackImage,
  description: 'A popular destination worth exploring.',
  rating: buildRating(item?.rate),
  category: deriveCategory(item?.kinds || '', item?.name || '', ''),
  lat: item?.point?.lat || 0,
  lng: item?.point?.lon || 0
});

const otmRequest = async (endpoint, query) => {
  const url = `${OTM_BASE}/${endpoint}?apikey=${OTM_KEY}${query ? `&${query}` : ''}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`OpenTripMap error: ${response.status}`);
    }
    return response.json();
  } finally {
    clearTimeout(timer);
  }
};

const resolveCenter = async (name) => {
  if (!name) return null;
  const data = await otmRequest('geoname', `name=${encodeURIComponent(name)}`);
  if (!data || !data.lat || !data.lon) return null;
  return { lat: data.lat, lon: data.lon };
};

const fetchRadiusPlaces = async ({ lat, lon }, limit = 20) =>
  otmRequest('radius', `radius=250000&limit=${limit}&offset=0&lon=${lon}&lat=${lat}&format=json`);

const getDynamicDestinations = async ({ query, country, limit = 18 }) => {
  if (!OTM_KEY) return [];

  const centerName = query?.trim() || (country && country !== 'all' ? country : '');
  let items = [];

  if (centerName) {
    const center = await resolveCenter(centerName);
    if (center) {
      items = await fetchRadiusPlaces(center, limit);
    }
  } else {
    const seeds = [
      { lat: 48.8566, lon: 2.3522 },
      { lat: 35.6762, lon: 139.6503 },
      { lat: 40.7128, lon: -74.006 },
      { lat: 28.6139, lon: 77.209 },
      { lat: -33.8688, lon: 151.2093 },
      { lat: 41.9028, lon: 12.4964 }
    ];

    const batches = await Promise.all(seeds.map((seed) => fetchRadiusPlaces(seed, 6).catch(() => [])));
    items = batches.flat();
  }

  const unique = new Map();
  items.forEach((item) => {
    if (!item?.xid || unique.has(item.xid)) return;
    unique.set(item.xid, item);
  });

  const top = Array.from(unique.values()).slice(0, limit);

  const details = await Promise.all(top.map((item) => otmRequest(`xid/${item.xid}`, '').catch(() => null)));

  const detailed = details.filter(Boolean).map(mapToDestination);
  if (detailed.length) return detailed;

  return top.map(mapFromRadius);
};

const applyQueryFilter = (items = [], query = '') => {
  const term = String(query || '').trim().toLowerCase();
  if (!term) return items;
  return items.filter((item) => {
    const name = String(item.name || '').toLowerCase();
    const country = String(item.country || '').toLowerCase();
    const description = String(item.description || '').toLowerCase();
    return name.includes(term) || country.includes(term) || description.includes(term);
  });
};

const topUpFromDb = async ({ query, country, category, limit, excludeNames = [] }) => {
  const regex = query ? new RegExp(query, 'i') : null;
  const queryFilter = regex ? { $or: [{ name: regex }, { country: regex }, { description: regex }] } : {};
  const countryFilter = country && country !== 'all' ? { country } : {};

  const fallbackRaw = await Destination.find({ ...queryFilter, ...countryFilter })
    .sort({ rating: -1, name: 1 })
    .limit(Number(limit) || 18);

  let fallback = fallbackRaw.map((item) => {
    const obj = item.toObject();
    return { ...obj, category: obj.category || deriveCategory('', obj.name, obj.description) };
  });

  if (category && category !== 'all') {
    fallback = fallback.filter((item) => item.category === category);
  }

  if (excludeNames.length) {
    const exclude = new Set(excludeNames.map((name) => String(name).toLowerCase()));
    fallback = fallback.filter((item) => !exclude.has(String(item.name).toLowerCase()));
  }

  return fallback;
};

const getDestinations = async (req, res) => {
  await seedDestinationsIfEmpty();
  const destinations = await Destination.find().sort({ rating: -1, name: 1 });
  const withCategories = destinations.map((item) => {
    const obj = item.toObject();
    return { ...obj, category: obj.category || deriveCategory('', obj.name, obj.description) };
  });
  res.json(normalizeOutput(withCategories));
};

const searchDestinations = async (req, res) => {
  const { query = '', country = '', category = '', limit = '18' } = req.query;

  await seedDestinationsIfEmpty();

  const categoryFilter = normalizeCategory(category);

  if (!OTM_KEY) {
    const fallback = await topUpFromDb({ query, country, category: categoryFilter, limit: Number(limit) || 18 });
    res.json(normalizeOutput(fallback));
    return;
  }

  try {
    const items = await getDynamicDestinations({
      query: String(query || ''),
      country: String(country || ''),
      limit: Number(limit) || 18
    });

    let filteredItems = applyQueryFilter(items, query);
    if (categoryFilter !== 'all') {
      filteredItems = filteredItems.filter(
        (item) => (item.category || deriveCategory('', item.name, item.description)) === categoryFilter
      );
    }

    if (filteredItems.length) {
      const topUp = await topUpFromDb({
        query,
        country,
        category: categoryFilter,
        limit: Number(limit) || 18,
        excludeNames: filteredItems.map((item) => item.name)
      });
      const combined = [...filteredItems, ...topUp].slice(0, Number(limit) || 18);
      res.json(normalizeOutput(combined));
      return;
    }

    const fallback = await topUpFromDb({ query, country, category: categoryFilter, limit: Number(limit) || 18 });
    res.json(normalizeOutput(fallback));
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('OpenTripMap search error', error?.message || error);
    const fallback = await topUpFromDb({ query, country, category: categoryFilter, limit: Number(limit) || 18 });
    res.json(normalizeOutput(fallback));
  }
};

module.exports = { getDestinations, searchDestinations };
