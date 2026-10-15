import api from '../api/axios';

export interface WorkshopService {
  id?: number;
  name: string;
  category: string;
  prices: {
    hatchback: number;
    sedan: number;
    premium_sedan: number;
    compact_suv: number;
    suv: number;
    premium_suv: number;
    van: number;
  };
  is_custom?: boolean;
}

export const DEFAULT_WORKSHOP_SERVICES: WorkshopService[] = [
  { name: 'Foam Wash & Vacuuming', category: 'Car Wash', prices: { hatchback: 400, sedan: 500, premium_sedan: 600, compact_suv: 600, suv: 700, premium_suv: 900, van: 700 } },
  { name: 'Deluxe Wash', category: 'Car Wash', prices: { hatchback: 500, sedan: 600, premium_sedan: 700, compact_suv: 700, suv: 800, premium_suv: 1000, van: 800 } },
  { name: 'Deep Interior Detailing & Sanitization', category: 'Detailing', prices: { hatchback: 1500, sedan: 1800, premium_sedan: 2200, compact_suv: 2000, suv: 2500, premium_suv: 3200, van: 2500 } },
  { name: 'Exterior Body Rubbing & Polishing', category: 'Detailing', prices: { hatchback: 1800, sedan: 2200, premium_sedan: 2800, compact_suv: 2500, suv: 3000, premium_suv: 4000, van: 3000 } },
  { name: 'Teflon Coating', category: 'Car Wash', prices: { hatchback: 1200, sedan: 1500, premium_sedan: 1800, compact_suv: 1800, suv: 2200, premium_suv: 2800, van: 2200 } },
  { name: 'Full Body Teflon / Paint Protection Wax', category: 'Car Wash', prices: { hatchback: 1200, sedan: 1500, premium_sedan: 1800, compact_suv: 1800, suv: 2200, premium_suv: 2800, van: 2200 } },
  { name: 'Ceramic Coating (Dual Layer)', category: 'Detailing', prices: { hatchback: 12000, sedan: 15000, premium_sedan: 18000, compact_suv: 18000, suv: 22000, premium_suv: 28000, van: 22000 } },
  { name: 'Underbody Anti-Rust Coating', category: 'Protection', prices: { hatchback: 1500, sedan: 1800, premium_sedan: 2000, compact_suv: 2000, suv: 2400, premium_suv: 3000, van: 2400 } },
  { name: 'Engine Bay Cleaning & Dressing', category: 'Detailing', prices: { hatchback: 500, sedan: 600, premium_sedan: 700, compact_suv: 700, suv: 850, premium_suv: 1000, van: 850 } },
  { name: 'Headlight Restoration & Polish', category: 'Detailing', prices: { hatchback: 600, sedan: 700, premium_sedan: 800, compact_suv: 800, suv: 1000, premium_suv: 1200, van: 1000 } },
  { name: 'AC Duct Sanitization & Cabin Filter Cleaning', category: 'AC Service', prices: { hatchback: 600, sedan: 700, premium_sedan: 800, compact_suv: 800, suv: 1000, premium_suv: 1200, van: 1000 } },
  { name: 'Paid General Service & Check-up', category: 'Mechanic', prices: { hatchback: 1200, sedan: 1500, premium_sedan: 1800, compact_suv: 1800, suv: 2200, premium_suv: 2800, van: 2200 } },
  { name: 'Wheel Alignment & 4-Wheel Balancing', category: 'Wheel Service', prices: { hatchback: 700, sedan: 850, premium_sedan: 1000, compact_suv: 1000, suv: 1200, premium_suv: 1500, van: 1200 } },
  { name: 'Brake Service & Pad Cleaning', category: 'Mechanic', prices: { hatchback: 500, sedan: 600, premium_sedan: 750, compact_suv: 750, suv: 900, premium_suv: 1200, van: 900 } }
];

const LOCAL_STORAGE_KEY = 'gms_custom_workshop_services';
const DELETED_SERVICES_KEY = 'gms_deleted_workshop_services';

export function getDeletedServiceNames(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DELETED_SERVICES_KEY) || '[]');
  } catch {
    return [];
  }
}

export function getLocalCustomServices(): WorkshopService[] {
  try {
    const stored: WorkshopService[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
    const deleted = getDeletedServiceNames();
    return stored.filter(s => !deleted.includes(s.name));
  } catch {
    return [];
  }
}

export async function fetchAllServices(): Promise<WorkshopService[]> {
  const deletedNames = getDeletedServiceNames().map(n => n.toLowerCase().trim());
  const localCustom = getLocalCustomServices();

  const map = new Map<string, WorkshopService>();

  // 1. Seed with Default Workshop Services
  DEFAULT_WORKSHOP_SERVICES.forEach(s => {
    const key = s.name.toLowerCase().trim();
    if (!deletedNames.includes(key)) {
      map.set(key, { ...s });
    }
  });

  // 2. Add local custom services
  localCustom.forEach(s => {
    const key = s.name.toLowerCase().trim();
    if (!deletedNames.includes(key)) {
      map.set(key, { ...s });
    }
  });

  // 3. Fetch from backend database (limit=1000 to get full catalog)
  try {
    const res = await api.get('/service-catalog', { params: { limit: 1000 } });
    const catalogData = res.data.data || [];

    catalogData.forEach((item: any) => {
      if (!item.item_name) return;
      const key = item.item_name.toLowerCase().trim();

      if (deletedNames.includes(key)) return;

      const rate = parseFloat(item.default_rate) || 500;
      const existing = map.get(key);

      if (existing) {
        // Enhance existing item with database ID and rates if available
        existing.id = item.id;
        if (item.category && item.category !== 'general') {
          existing.category = item.category.charAt(0).toUpperCase() + item.category.slice(1);
        }
      } else {
        // New service from database
        map.set(key, {
          id: item.id,
          name: item.item_name,
          category: item.category ? (item.category.charAt(0).toUpperCase() + item.category.slice(1)) : 'General',
          prices: {
            hatchback: rate,
            sedan: Math.round(rate * 1.2),
            premium_sedan: Math.round(rate * 1.4),
            compact_suv: Math.round(rate * 1.3),
            suv: Math.round(rate * 1.5),
            premium_suv: Math.round(rate * 1.8),
            van: Math.round(rate * 1.4),
          },
          is_custom: true
        });
      }
    });
  } catch (e) {
    console.warn('Failed to fetch catalog from backend, using local/default list:', e);
  }

  const resultList = Array.from(map.values());
  return resultList;
}

export async function saveCustomService(name: string, category: string, basePrice: number): Promise<WorkshopService> {
  const cleanName = name.trim();
  const cleanCat = category.trim() || 'General';
  const price = basePrice > 0 ? basePrice : 500;

  const newService: WorkshopService = {
    name: cleanName,
    category: cleanCat,
    prices: {
      hatchback: price,
      sedan: Math.round(price * 1.2),
      premium_sedan: Math.round(price * 1.4),
      compact_suv: Math.round(price * 1.3),
      suv: Math.round(price * 1.5),
      premium_suv: Math.round(price * 1.8),
      van: Math.round(price * 1.4),
    },
    is_custom: true
  };

  // 1. Remove from local deleted list if previously deleted
  try {
    const deletedNames = getDeletedServiceNames();
    const updatedDeleted = deletedNames.filter(n => n.toLowerCase().trim() !== cleanName.toLowerCase());
    localStorage.setItem(DELETED_SERVICES_KEY, JSON.stringify(updatedDeleted));
  } catch {}

  // 2. Persist to backend database
  try {
    const res = await api.post('/service-catalog', {
      name: cleanName,
      category: cleanCat,
      item_type: 'labour',
      default_rate: price,
      hsn_sac: '998714',
      tax_pct: 18
    });
    if (res.data?.id) {
      newService.id = res.data.id;
    }
  } catch (e) {
    console.warn('Backend POST /service-catalog failed, fallback to local storage:', e);
  }

  // 3. Persist to localStorage
  try {
    const existing = getLocalCustomServices();
    const updated = [newService, ...existing.filter(s => s.name.toLowerCase() !== cleanName.toLowerCase())];
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save service to local storage:', e);
  }

  // 4. Notify app components to re-fetch
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('workshop_services_updated'));
  }

  return newService;
}

export async function deleteWorkshopService(service: WorkshopService): Promise<void> {
  const name = service.name.trim();

  // 1. Soft delete in backend by ID and by Name
  try {
    if (service.id) {
      await api.delete(`/service-catalog/${service.id}`);
    } else {
      await api.delete(`/service-catalog/${encodeURIComponent(name)}`);
    }
  } catch (e) {
    console.warn('Backend delete /service-catalog failed:', e);
  }

  // 2. Save to deleted list in localStorage
  try {
    const deletedNames = getDeletedServiceNames();
    if (!deletedNames.includes(name)) {
      deletedNames.push(name);
      localStorage.setItem(DELETED_SERVICES_KEY, JSON.stringify(deletedNames));
    }

    // 3. Remove from custom local storage list
    const stored = getLocalCustomServices();
    const updatedStored = stored.filter(s => s.name.toLowerCase().trim() !== name.toLowerCase());
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedStored));
  } catch (e) {
    console.error('Failed to mark service deleted locally:', e);
  }

  // 4. Notify app components to re-fetch
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('workshop_services_updated'));
  }
}
