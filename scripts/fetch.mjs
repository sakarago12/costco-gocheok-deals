// 코스트코 코리아 '스페셜 할인' 목록과 고척점 정보를 받아 data.json으로 저장합니다.
// 실행: node scripts/fetch.mjs   (Node.js 20 이상, 의존성 없음)
import { writeFile } from 'node:fs/promises';

const BASE = 'https://www.costco.co.kr';
const API = `${BASE}/rest/v2/korea`;
const STORE = 'Gocheok';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'ko-KR,ko;q=0.9',
};

// URL 첫 경로 → 카테고리 이름
const CATS = {
  Foods: '식품',
  HealthSupplement: '건강·영양제',
  'BeautyHouseholdPersonal-Care':'뷰티·생활용품',
  HomeKitchen: '주방·생활',
  FurnitureBeddingHome: '가구·침구',
  Appliances: '가전',
  ElectronicsComputers: '디지털·컴퓨터',
  ClothingBagsAccessories: '의류·잡화',
  BabyKidsToysPets: '유아·완구·반려',
  SportsFitnessCamping: '스포츠·캠핑',
  PatioLawnGarden: '원예·정원',
  HardwareAutomotive: '공구·자동차',
  'StationeryOffice-Supplies': '문구·사무',
  JewelryWatchesAccessories: '주얼리·시계',
  'Gift-Cards-Tickets': '상품권',
  'Gift-Set': '선물세트',
  'Gift-Set-Special': '선물세트',
  GrillsAccessories: '스포츠·캠핑',
};

// 사업자용 대량 묶음(예: '박서 3매 X 448개', 수백만 원)은 매장 쇼핑과 무관하므로 제외
const isBulkBusiness = p => (p.price?.value ?? 0) >= 2_000_000 && /x\s*-?\s*\d{2,}\s*(개|병|박스|pk|ea|ct)?/i.test(`${p.name} ${p.englishName || ''}`);

async function getJson(url, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: HEADERS });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (i >= tries) throw new Error(`${url} 실패: ${e.message}`);
      await new Promise(r => setTimeout(r, 2000 * i));
    }
  }
}

// UTC ISO → 한국 날짜 'YYYY-MM-DD'
const kstDate = iso => iso ? new Date(new Date(iso).getTime() + 9 * 3600e3).toISOString().slice(0, 10) : null;

async function fetchProducts() {
  const all = [];
  for (let page = 0, total = 1; page < total; page++) {
    const d = await getJson(`${API}/products/search?category=SpecialPriceOffers&pageSize=100&currentPage=${page}&lang=ko&curr=KRW&fields=FULL`);
    total = d.pagination?.totalPages ?? 0;
    all.push(...(d.products || []));
  }
  return all;
}

function toItem(p) {
  const decals = (p.decalData || []).map(d => d.value?.url || '');
  const onlineOnly = decals.some(u => /OnlineOnly/i.test(u));
  const base = p.basePrice?.value ?? null;
  const price = p.price?.value ?? null;
  const off = p.couponDiscount?.discountValue ?? p.discountPrice?.value ?? (base && price ? base - price : null);
  if (onlineOnly || !price || !off || isBulkBusiness(p)) return null;
  const img = (p.images || []).find(i => i.format === 'product') || (p.images || [])[0];
  const top = (p.url || '').split('/').find(seg => CATS[seg]) || '';
  return {
    code: p.code,
    name: p.name,
    en: p.englishName || '',
    price,
    base: base ?? price + off,
    off,
    pct: Math.round((off / (base ?? price + off)) * 100),
    start: kstDate(p.couponDiscount?.discountStartDate || p.discountStartDate),
    end: kstDate(p.couponDiscount?.discountEndDate || p.discountEndDate),
    cat: CATS[top] || '기타',
    img: img ? BASE + img.url : '',
    url: BASE + p.url,
    rating: p.numberOfReviews ? { avg: p.averageRating, n: p.numberOfReviews } : null,
  };
}

async function fetchStore() {
  const s = await getJson(`${API}/stores/${STORE}?fields=FULL&lang=ko`);
  const oh = s.openingHours || {};
  const wk = (oh.weekDayOpeningList || []).find(d => !d.closed);
  return {
    name: s.displayName,
    address: s.address?.formattedAddress || '',
    phone: s.address?.phone || '',
    hours: wk ? `${wk.openingTime.formattedHour} - ${wk.closingTime.formattedHour}` : '',
    notice: oh.name || '',
    closedDays: (oh.specialDayOpeningList || []).filter(d => d.closed).map(d => kstDate(d.date)),
  };
}

const [products, store] = await Promise.all([fetchProducts(), fetchStore()]);
const seen = new Set();
const items = products.map(toItem).filter(it => it && !seen.has(it.code) && seen.add(it.code));
items.sort((a, b) => b.off - a.off);

if (items.length < 20) throw new Error(`상품이 ${items.length}개뿐이라 저장하지 않습니다 (응답 이상 의심).`);

const out = { updated: new Date().toISOString(), store, total: products.length, items };
await writeFile(new URL('../data.json', import.meta.url), JSON.stringify(out));
console.log(`전체 ${products.length}개 중 온라인 전용 제외 ${items.length}개 저장`);
