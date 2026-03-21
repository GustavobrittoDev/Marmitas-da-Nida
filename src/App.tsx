import { FormEvent, useEffect, useRef, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { AdminPanel } from './components/AdminPanel';
import { Icon, IconName } from './components/Icon';
import { seedSiteData } from './data/seedData';
import { usePersistentState } from './hooks/usePersistentState';
import {
  createRemoteOrder,
  fetchRemoteOrders,
  subscribeToRemoteOrders,
  updateRemoteOrderStatus,
} from './lib/ordersState';
import { fetchRemoteSiteData, saveRemoteSiteData, subscribeToRemoteSiteData } from './lib/siteState';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import { AddonOption, CartItem, CheckoutData, MenuItem, OrderRecord, OrderStatus, SiteData } from './types';
import { getBusinessStatus } from './utils/business';
import {
  buildCustomerAddressQuery,
  calculateDeliveryInfo,
  geocodeAddress,
  getDeliveryFeeTiers,
  getErrorDeliveryInfo,
  getIdleDeliveryInfo,
  getLoadingDeliveryInfo,
  getMinimumDeliveryFee,
  getPickupDeliveryInfo,
} from './utils/delivery';
import { formatCurrency, sanitizePhoneNumber } from './utils/format';
import { getItemOptionConfig, isLegacyGarnishOptionSet, normalizeOptionSelection } from './utils/menuOptions';
import { buildOrderRecord } from './utils/orders';
import { buildWhatsAppUrl } from './utils/whatsapp';

type MenuGroup = {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  image: string;
  available: boolean;
  featured: boolean;
  dishOfDay: boolean;
  prepTime: string;
  tags: string[];
  usesGlobalGarnishes?: boolean;
  addonTitle?: string;
  addonOptions?: AddonOption[];
  items: MenuItem[];
};

type ItemSheetState = {
  group: MenuGroup;
  selectedItemId: string;
  quantity: number;
  notes: string;
  selectedAddonIds: string[];
  cartItemId: string | null;
};

type InfoDrawerKey = 'hours' | 'delivery';

type MenuCardSelection = {
  selectedItemId: string;
  selectedAddonIds: string[];
};

type CartLine = {
  cartItem: CartItem;
  menuItem: MenuItem;
  addonLabels: string[];
  unitTotal: number;
  lineTotal: number;
};

type SiteDataSource = 'seed' | 'custom';
type DeliveryInfoState =
  | ReturnType<typeof getIdleDeliveryInfo>
  | ReturnType<typeof getPickupDeliveryInfo>
  | ReturnType<typeof getErrorDeliveryInfo>
  | ReturnType<typeof getLoadingDeliveryInfo>
  | ReturnType<typeof calculateDeliveryInfo>;
type AdminAuthMode = 'local' | 'supabase';
type SyncStatus = 'local' | 'connecting' | 'online' | 'saving' | 'error';
type AppRoute = 'storefront' | 'admin';

const siteDataStorageKey = 'nida-site-data-v2';
const siteDataSourceStorageKey = 'nida-site-data-source';
const customSiteDataStorageKey = 'nida-site-data-custom';
const localOrdersStorageKey = 'nida-orders-local';
const sizePattern = /\s*-\s*(Pequena|Media)$/i;

function getAppRoute() {
  if (typeof window === 'undefined') {
    return 'storefront' as AppRoute;
  }

  return window.location.hash.startsWith('#/admin') ? 'admin' : 'storefront';
}

function getHighlightIcon(highlight: string): IconName {
  const normalized = highlight.toLowerCase();

  if (normalized.includes('taxa') || normalized.includes('entrega')) {
    return 'motoboy';
  }

  if (normalized.includes('whatsapp')) {
    return 'whatsapp';
  }

  if (normalized.includes('fixos') || normalized.includes('pratos')) {
    return 'plate';
  }

  return 'sparkles';
}

function mergeOrders(primary: OrderRecord[], fallback: OrderRecord[]) {
  const merged = [...primary];
  const existingIds = new Set(primary.map((order) => order.id));

  fallback.forEach((order) => {
    if (!existingIds.has(order.id)) {
      merged.push(order);
      existingIds.add(order.id);
    }
  });

  return merged.sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
}

const emptyCheckout: CheckoutData = {
  fullName: '',
  phone: '',
  street: '',
  number: '',
  neighborhood: '',
  complement: '',
  reference: '',
  deliveryType: 'delivery',
  paymentMethod: 'pix',
  changeFor: '',
  notes: '',
};

function scrollToSection(sectionId: string) {
  document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function getSiteDataSignature(siteData: SiteData) {
  return JSON.stringify({
    categories: siteData.categories,
    menu: siteData.menu,
    home: siteData.home,
    site: siteData.site,
  });
}

function readCustomSiteData() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(customSiteDataStorageKey);
    return rawValue ? (JSON.parse(rawValue) as SiteData) : null;
  } catch {
    return null;
  }
}

function getBaseMenuItemName(item: MenuItem) {
  return item.name.replace(sizePattern, '').trim();
}

function getMenuItemSizeLabel(item: MenuItem) {
  const match = item.name.match(sizePattern);
  if (match) {
    return match[1];
  }

  return item.tags.find((tag) => tag === 'Pequena' || tag === 'Media');
}

function getItemGroupId(item: MenuItem) {
  return item.id.replace(/-(pequena|media)$/i, '');
}

function buildMenuGroups(menu: MenuItem[]) {
  const groups = new Map<string, MenuGroup>();

  for (const item of menu) {
    const groupId = getItemGroupId(item);
    const currentGroup = groups.get(groupId);

    if (!currentGroup) {
      groups.set(groupId, {
        id: groupId,
        categoryId: item.categoryId,
        name: getBaseMenuItemName(item),
        description: item.description,
        image: item.image,
        available: item.available,
        featured: item.featured,
        dishOfDay: item.dishOfDay,
        prepTime: item.prepTime,
        tags: item.tags.filter((tag) => tag !== 'Pequena' && tag !== 'Media'),
        usesGlobalGarnishes: item.usesGlobalGarnishes,
        addonTitle: item.addonTitle,
        addonOptions: item.addonOptions,
        items: [item],
      });
      continue;
    }

    currentGroup.items.push(item);
    currentGroup.image = currentGroup.image || item.image;
    currentGroup.available = currentGroup.available || item.available;
    currentGroup.featured = currentGroup.featured || item.featured;
    currentGroup.dishOfDay = currentGroup.dishOfDay || item.dishOfDay;
    currentGroup.tags = [...new Set([...currentGroup.tags, ...item.tags])].filter(
      (tag) => tag !== 'Pequena' && tag !== 'Media',
    );
  }

  return [...groups.values()].map((group) => ({
    ...group,
    items: [...group.items].sort((a, b) => a.price - b.price),
  }));
}

function getGroupPriceLabel(group: MenuGroup) {
  const prices = group.items.map((item) => item.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  if (minPrice === maxPrice) {
    return formatCurrency(minPrice);
  }

  return `${formatCurrency(minPrice)} a ${formatCurrency(maxPrice)}`;
}

function getAddonSelectionRules(
  siteConfig: SiteData['site'],
  item?:
    | Pick<MenuItem, 'usesGlobalGarnishes' | 'addonTitle' | 'addonOptions'>
    | Pick<MenuGroup, 'usesGlobalGarnishes' | 'addonTitle' | 'addonOptions'>
    | null,
) {
  const config = getItemOptionConfig(siteConfig, item);

  return {
    hasGarnishChoices: config?.source === 'garnish',
    minSelections: 0,
    maxSelections: config?.maxSelections ?? 0,
  };
}

function getAddonLabel(
  siteConfig: SiteData['site'],
  item?:
    | Pick<MenuItem, 'usesGlobalGarnishes' | 'addonTitle' | 'addonOptions'>
    | Pick<MenuGroup, 'usesGlobalGarnishes' | 'addonTitle' | 'addonOptions'>
    | null,
) {
  return getItemOptionConfig(siteConfig, item)?.title || 'Adicionais';
}

function getAddonOptions(
  siteConfig: SiteData['site'],
  item?:
    | Pick<MenuItem, 'usesGlobalGarnishes' | 'addonTitle' | 'addonOptions'>
    | Pick<MenuGroup, 'usesGlobalGarnishes' | 'addonTitle' | 'addonOptions'>
    | null,
) {
  return getItemOptionConfig(siteConfig, item)?.options ?? [];
}

function normalizeAddonSelection(
  siteConfig: SiteData['site'],
  selectedAddonIds: string[],
  item?:
    | Pick<MenuItem, 'usesGlobalGarnishes' | 'addonTitle' | 'addonOptions'>
    | Pick<MenuGroup, 'usesGlobalGarnishes' | 'addonTitle' | 'addonOptions'>
    | null,
) {
  return normalizeOptionSelection(selectedAddonIds, getItemOptionConfig(siteConfig, item));
}

function App() {
  const [siteData, setSiteData] = usePersistentState(siteDataStorageKey, seedSiteData);
  const [siteDataSource, setSiteDataSource] = usePersistentState<SiteDataSource>(
    siteDataSourceStorageKey,
    'seed',
  );
  const [cart, setCart] = usePersistentState<CartItem[]>('nida-cart', []);
  const [checkout, setCheckout] = usePersistentState<CheckoutData>('nida-checkout', emptyCheckout);
  const [localOrders, setLocalOrders] = usePersistentState<OrderRecord[]>(localOrdersStorageKey, []);
  const [activeCategoryId, setActiveCategoryId] = useState(siteData.categories[0]?.id ?? '');
  const [itemSheet, setItemSheet] = useState<ItemSheetState | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [route, setRoute] = useState<AppRoute>(() => getAppRoute());
  const [openInfoDrawer, setOpenInfoDrawer] = useState<InfoDrawerKey | null>(null);
  const [openMenuGroupId, setOpenMenuGroupId] = useState<string | null>(null);
  const [menuCardSelections, setMenuCardSelections] = useState<Record<string, MenuCardSelection>>({});
  const [localAdminAuthenticated, setLocalAdminAuthenticated] = usePersistentState(
    'nida-admin-auth',
    false,
  );
  const [remoteAdminAuthenticated, setRemoteAdminAuthenticated] = useState(false);
  const [adminSessionEmail, setAdminSessionEmail] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(
    isSupabaseConfigured ? 'connecting' : 'local',
  );
  const [syncError, setSyncError] = useState('');
  const [remoteReady, setRemoteReady] = useState(!isSupabaseConfigured);
  const [remoteOrders, setRemoteOrders] = useState<OrderRecord[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState('');
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);
  const [checkoutSubmitMessage, setCheckoutSubmitMessage] = useState('');
  const [, setTimeTick] = useState(Date.now());
  const [deliveryInfo, setDeliveryInfo] = useState<DeliveryInfoState>(() =>
    getIdleDeliveryInfo(seedSiteData.site.deliveryPricing),
  );
  const [cartAttentionActive, setCartAttentionActive] = useState(false);
  const [cartAttentionLabel, setCartAttentionLabel] = useState('Toque para revisar e finalizar');
  const cartAttentionTimeoutRef = useRef<number | null>(null);
  const syncingLocalOrdersRef = useRef(false);
  const skipRemoteSaveRef = useRef(false);
  const siteDataRef = useRef(siteData);
  const authMode: AdminAuthMode = isSupabaseConfigured ? 'supabase' : 'local';
  const adminAuthenticated = isSupabaseConfigured
    ? remoteAdminAuthenticated
    : localAdminAuthenticated;
  const orders = isSupabaseConfigured ? mergeOrders(remoteOrders, localOrders) : localOrders;
  const restaurantLocation = siteData.site.restaurantLocation ?? seedSiteData.site.restaurantLocation;
  const deliveryPricing = siteData.site.deliveryPricing ?? seedSiteData.site.deliveryPricing;

  useEffect(() => {
    const interval = window.setInterval(() => setTimeTick(Date.now()), 60000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const syncRoute = () => {
      setRoute(getAppRoute());
    };

    syncRoute();
    window.addEventListener('hashchange', syncRoute);
    return () => window.removeEventListener('hashchange', syncRoute);
  }, []);

  useEffect(() => {
    siteDataRef.current = siteData;
  }, [siteData]);

  useEffect(() => {
    return () => {
      if (cartAttentionTimeoutRef.current) {
        window.clearTimeout(cartAttentionTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      return;
    }

    const supabaseClient = supabase;
    let isActive = true;

    const applyRemoteSiteData = (nextSiteData: SiteData) => {
      if (!isActive) {
        return;
      }

      skipRemoteSaveRef.current = true;
      setSiteData(nextSiteData);
      setSiteDataSource('custom');
      setSyncStatus('online');
      setSyncError('');
      setRemoteReady(true);
    };

    const syncSessionState = (session: Session | null) => {
      if (!isActive) {
        return;
      }

      setRemoteAdminAuthenticated(Boolean(session));
      setAdminSessionEmail(session?.user.email ?? null);
    };

    const loadRemoteState = async (session: Session | null) => {
      const remoteResult = await fetchRemoteSiteData();

      if (!isActive) {
        return;
      }

      if (remoteResult.error) {
        setSyncStatus('error');
        setSyncError(remoteResult.error);
        setRemoteReady(true);
        return;
      }

      if (remoteResult.data) {
        applyRemoteSiteData(remoteResult.data);
        return;
      }

      if (session?.user) {
        setSyncStatus('saving');

        const bootstrapResult = await saveRemoteSiteData(siteDataRef.current, session.user.id);

        if (!isActive) {
          return;
        }

        if (bootstrapResult.error) {
          setSyncStatus('error');
          setSyncError(bootstrapResult.error);
          setRemoteReady(true);
          return;
        }
      }

      setSyncStatus('online');
      setSyncError('');
      setRemoteReady(true);
    };

    void (async () => {
      setSyncStatus('connecting');
      setSyncError('');

      const { data, error } = await supabaseClient.auth.getSession();

      if (!isActive) {
        return;
      }

      if (error) {
        setSyncStatus('error');
        setSyncError(error.message);
        setRemoteReady(true);
        return;
      }

      syncSessionState(data.session);
      await loadRemoteState(data.session);
    })();

    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      syncSessionState(session);

      if (session) {
        void loadRemoteState(session);
      }
    });

    const unsubscribe = subscribeToRemoteSiteData(
      (nextSiteData) => {
        applyRemoteSiteData(nextSiteData);
      },
      (message) => {
        if (!isActive) {
          return;
        }

        setSyncStatus('error');
        setSyncError(message);
      },
    );

    return () => {
      isActive = false;
      subscription.unsubscribe();
      unsubscribe();
    };
  }, [setSiteData, setSiteDataSource]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !remoteReady || !remoteAdminAuthenticated) {
      return;
    }

    const supabaseClient = supabase;

    if (skipRemoteSaveRef.current) {
      skipRemoteSaveRef.current = false;
      return;
    }

    const timeout = window.setTimeout(async () => {
      setSyncStatus('saving');

      const {
        data: { user },
      } = await supabaseClient.auth.getUser();
      const saveResult = await saveRemoteSiteData(siteData, user?.id);

      if (saveResult.error) {
        setSyncStatus('error');
        setSyncError(saveResult.error);
        return;
      }

      setSyncStatus('online');
      setSyncError('');
    }, 500);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [remoteAdminAuthenticated, remoteReady, siteData]);

  const loadRemoteOrdersList = async () => {
    if (!isSupabaseConfigured || !supabase) {
      setOrdersError('');
      setOrdersLoading(false);
      return;
    }

    setOrdersLoading(true);
    const result = await fetchRemoteOrders();

    if (result.error) {
      setOrdersError(result.error);
      setOrdersLoading(false);
      return;
    }

    setRemoteOrders(result.data);
    setOrdersError('');
    setOrdersLoading(false);
  };

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      return;
    }

    if (!remoteAdminAuthenticated || route !== 'admin') {
      if (!remoteAdminAuthenticated) {
        setRemoteOrders([]);
      }
      setOrdersLoading(false);
      setOrdersError('');
      return;
    }

    let isActive = true;

    void (async () => {
      await loadRemoteOrdersList();
    })();

    const unsubscribe = subscribeToRemoteOrders(
      (nextOrders) => {
        if (!isActive) {
          return;
        }

        setRemoteOrders(nextOrders);
        setOrdersError('');
        setOrdersLoading(false);
      },
      (message) => {
        if (!isActive) {
          return;
        }

        setOrdersError(message);
      },
    );

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, [remoteAdminAuthenticated, route]);

  useEffect(() => {
    if (!isSupabaseConfigured || !localOrders.length || syncingLocalOrdersRef.current) {
      return;
    }

    let isCancelled = false;
    syncingLocalOrdersRef.current = true;

    void (async () => {
      const syncedIds: string[] = [];
      let syncErrorMessage = '';

      for (const order of localOrders) {
        const result = await createRemoteOrder(order);

        if (result.error) {
          syncErrorMessage = result.error;
          break;
        }

        syncedIds.push(order.id);

        if (!isCancelled) {
          setRemoteOrders((current) => mergeOrders([order], current));
        }
      }

      if (!isCancelled) {
        if (syncedIds.length) {
          setLocalOrders((current) => current.filter((order) => !syncedIds.includes(order.id)));
        }

        if (syncErrorMessage) {
          setOrdersError(syncErrorMessage);
        } else if (syncedIds.length) {
          setOrdersError('');
        }
      }

      syncingLocalOrdersRef.current = false;
    })();

    return () => {
      isCancelled = true;
      syncingLocalOrdersRef.current = false;
    };
  }, [localOrders, setLocalOrders]);

  useEffect(() => {
    const hasLegacyCategories = siteData.categories.some((category) => category.id === 'marmitas-dia');
    const hasPlaceholderContact =
      siteData.site.whatsappNumber === '5511999999999' || siteData.site.phone === '(11) 99999-9999';
    const hasPlaceholderMedia =
      siteData.home.bannerImage.endsWith('.svg') ||
      siteData.menu.some((item) => item.image.endsWith('.svg'));
    const hasLegacyAddress = siteData.site.address === 'Rua das Palmeiras, 125 - Centro';
    const hasLegacyMealAddons = siteData.menu.some(
      (item) =>
        (item.categoryId === 'especial-do-dia' || item.categoryId === 'pratos-fixos') &&
        item.addonOptions?.some((option) => ['ovo-frito', 'salada-simples', 'salada-completa'].includes(option.id)),
    );
    const hasMissingGarnishConfig =
      !siteData.site.garnishConfig ||
      !Array.isArray(siteData.site.garnishConfig.options) ||
      typeof siteData.site.garnishConfig.maxSelections !== 'number';
    const hasLegacyInlineGarnishes = siteData.menu.some(
      (item) => isLegacyGarnishOptionSet(item.addonOptions) && !item.usesGlobalGarnishes,
    );
    const hasLegacyTagline = siteData.site.tagline === 'Especial do dia e pratos fixos com sabor caseiro e confianca.';
    const hasLegacyDeliveryConfig =
      !siteData.site.restaurantLocation ||
      !siteData.site.deliveryPricing;
    const hasFridayLockedCopy =
      siteData.categories.some(
        (category) =>
          category.id === 'especial-do-dia' &&
          category.description ===
            'Sabores em destaque nesta sexta-feira, preparados na hora e com cara de almoco caseiro.',
      ) ||
      siteData.menu.some(
        (item) =>
          item.description ===
            'Especial desta sexta com arroz, feijao e 2 guarnicoes a escolha: farofa, macarrao com molho ou chuchu refogado.' ||
          item.description ===
            'Prato do dia com a mistura principal da sexta-feira, ideal para quem quer um pedido caprichado e sem complicacao.',
      ) ||
      siteData.home.promoTitle === 'Pratos fixos todos os dias e especial caprichado na sexta' ||
      siteData.home.howItWorks.some(
        (step) => step.id === 'explore' && step.title === '1. Veja o cardapio da sexta',
      );
    const seedChanged = getSiteDataSignature(siteData) !== getSiteDataSignature(seedSiteData);

    if (hasLegacyCategories) {
      setSiteData(seedSiteData);
      setSiteDataSource('seed');
      setCart([]);
      return;
    }

    if (hasLegacyMealAddons) {
      setSiteData((current) => ({
        ...current,
        menu: current.menu.map((item) => {
          const seedItem = seedSiteData.menu.find((seedMenuItem) => seedMenuItem.id === item.id);

          if (
            !seedItem ||
            (item.categoryId !== 'especial-do-dia' && item.categoryId !== 'pratos-fixos') ||
            !item.addonOptions?.some((option) =>
              ['ovo-frito', 'salada-simples', 'salada-completa'].includes(option.id),
            )
          ) {
            return item;
          }

          return {
            ...item,
            addonTitle: seedItem.addonTitle,
            addonOptions: seedItem.addonOptions,
          };
        }),
        updatedAt: new Date().toISOString(),
      }));
      return;
    }

    if (hasMissingGarnishConfig || hasLegacyInlineGarnishes) {
      setSiteData((current) => ({
        ...current,
        site: {
          ...current.site,
          garnishConfig:
            current.site.garnishConfig &&
            Array.isArray(current.site.garnishConfig.options) &&
            current.site.garnishConfig.options.length
              ? {
                  title: current.site.garnishConfig.title || seedSiteData.site.garnishConfig.title,
                  maxSelections:
                    typeof current.site.garnishConfig.maxSelections === 'number'
                      ? current.site.garnishConfig.maxSelections
                      : seedSiteData.site.garnishConfig.maxSelections,
                  options: current.site.garnishConfig.options,
                }
              : seedSiteData.site.garnishConfig,
        },
        menu: current.menu.map((item) =>
          isLegacyGarnishOptionSet(item.addonOptions)
            ? {
                ...item,
                usesGlobalGarnishes: true,
                addonTitle: undefined,
                addonOptions: undefined,
              }
            : item,
        ),
        updatedAt: new Date().toISOString(),
      }));
      return;
    }

    if (hasLegacyDeliveryConfig) {
      setSiteData((current) => ({
        ...current,
        site: {
          ...current.site,
          restaurantLocation: seedSiteData.site.restaurantLocation,
          deliveryPricing: seedSiteData.site.deliveryPricing,
          deliveryNotice:
            current.site.deliveryNotice ===
            'Pagamento em dinheiro, cartao ou Pix (58705032000172 - Joao). Consulte a taxa de entrega pelo WhatsApp.'
              ? seedSiteData.site.deliveryNotice
              : current.site.deliveryNotice,
        },
        updatedAt: new Date().toISOString(),
      }));
      return;
    }

    if (hasLegacyTagline) {
      setSiteData((current) => ({
        ...current,
        site: {
          ...current.site,
          tagline: '',
        },
        updatedAt: new Date().toISOString(),
      }));
      return;
    }

    if (hasFridayLockedCopy) {
      setSiteData((current) => ({
        ...current,
        categories: current.categories.map((category) =>
          category.id === 'especial-do-dia' &&
          category.description ===
            'Sabores em destaque nesta sexta-feira, preparados na hora e com cara de almoco caseiro.'
            ? {
                ...category,
                description: 'Sabores em destaque preparados na hora e com cara de almoco caseiro.',
              }
            : category,
        ),
        menu: current.menu.map((item) => {
          if (
            item.description ===
            'Especial desta sexta com arroz, feijao e 2 guarnicoes a escolha: farofa, macarrao com molho ou chuchu refogado.'
          ) {
            return {
              ...item,
              description:
                'Especial do dia com arroz, feijao e 2 guarnicoes a escolha: farofa, macarrao com molho ou chuchu refogado.',
            };
          }

          if (
            item.description ===
            'Prato do dia com a mistura principal da sexta-feira, ideal para quem quer um pedido caprichado e sem complicacao.'
          ) {
            return {
              ...item,
              description:
                'Prato do dia com a mistura principal da casa, ideal para quem quer um pedido caprichado e sem complicacao.',
            };
          }

          return item;
        }),
        home: {
          ...current.home,
          promoTitle:
            current.home.promoTitle === 'Pratos fixos todos os dias e especial caprichado na sexta'
              ? 'Pratos fixos todos os dias e especial caprichado da casa'
              : current.home.promoTitle,
          howItWorks: current.home.howItWorks.map((step) =>
            step.id === 'explore' && step.title === '1. Veja o cardapio da sexta'
              ? { ...step, title: '1. Veja o cardapio' }
              : step,
          ),
        },
        updatedAt: new Date().toISOString(),
      }));
      return;
    }

    if (hasLegacyAddress) {
      setSiteData((current) => ({
        ...current,
        site: {
          ...current.site,
          address: seedSiteData.site.address,
        },
        updatedAt: new Date().toISOString(),
      }));
      return;
    }

    if (siteDataSource === 'custom') {
      return;
    }

    if (hasPlaceholderContact || hasPlaceholderMedia) {
      setSiteData(seedSiteData);
      setSiteDataSource('seed');
      return;
    }

    if (seedChanged) {
      setSiteData(seedSiteData);
      setSiteDataSource('seed');
    }
  }, [
    setCart,
    setSiteData,
    setSiteDataSource,
    siteData,
    siteDataSource,
  ]);

  useEffect(() => {
    if (isSupabaseConfigured) {
      return;
    }

    const storedCustomSiteData = readCustomSiteData();

    if (storedCustomSiteData && siteDataSource !== 'custom') {
      setSiteData(storedCustomSiteData);
      setSiteDataSource('custom');
    }
  }, [setSiteData, setSiteDataSource, siteDataSource]);

  useEffect(() => {
    if (isSupabaseConfigured) {
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    try {
      if (siteDataSource === 'custom') {
        window.localStorage.setItem(customSiteDataStorageKey, JSON.stringify(siteData));
      }
    } catch {
      return;
    }
  }, [siteData, siteDataSource]);

  useEffect(() => {
    if (!siteData.categories.some((category) => category.id === activeCategoryId)) {
      setActiveCategoryId(siteData.categories[0]?.id ?? '');
    }
  }, [activeCategoryId, siteData.categories]);

  useEffect(() => {
    if (checkout.paymentMethod !== 'cash' && checkout.changeFor) {
      setCheckout((current) => ({ ...current, changeFor: '' }));
    }
  }, [checkout.changeFor, checkout.paymentMethod, setCheckout]);

  useEffect(() => {
    if (checkout.deliveryType === 'pickup') {
      setDeliveryInfo(getPickupDeliveryInfo());
      return;
    }

    const addressQuery = buildCustomerAddressQuery(checkout, restaurantLocation);

    if (!addressQuery) {
      setDeliveryInfo(getIdleDeliveryInfo(deliveryPricing));
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setDeliveryInfo((current) => getLoadingDeliveryInfo(current.fee));

      try {
        const result = await geocodeAddress(addressQuery, controller.signal);

        if (!result) {
          setDeliveryInfo(getErrorDeliveryInfo(deliveryPricing));
          return;
        }

        setDeliveryInfo(
          calculateDeliveryInfo(
            restaurantLocation.coordinates,
            result.coordinates,
            deliveryPricing,
            result.displayName,
          ),
        );
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          return;
        }

        setDeliveryInfo(getErrorDeliveryInfo(deliveryPricing));
      }
    }, 700);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [
    checkout.deliveryType,
    checkout.neighborhood,
    checkout.number,
    checkout.street,
    deliveryPricing,
    restaurantLocation,
  ]);

  const businessStatus = getBusinessStatus(siteData.site.hours, 'America/Sao_Paulo');
  const menuGroups = buildMenuGroups(siteData.menu);
  const selectedCategory =
    siteData.categories.find((category) => category.id === activeCategoryId) ?? siteData.categories[0];
  const visibleGroups = selectedCategory
    ? menuGroups.filter((group) => group.categoryId === selectedCategory.id)
    : menuGroups;
  const cartLines: CartLine[] = cart.flatMap((cartItem) => {
    const menuItem = siteData.menu.find((item) => item.id === cartItem.itemId);
    if (!menuItem) {
      return [];
    }

    const itemOptionConfig = getItemOptionConfig(siteData.site, menuItem);
    const addonLabels =
      itemOptionConfig?.options
        .filter((option) => cartItem.selectedAddonIds.includes(option.id))
        .map((option) => option.name) ?? [];
    const addonTotal =
      itemOptionConfig?.options
        .filter((option) => cartItem.selectedAddonIds.includes(option.id))
        .reduce((sum, option) => sum + option.price, 0) ?? 0;

    return [
      {
        cartItem,
        menuItem,
        addonLabels,
        unitTotal: menuItem.price + addonTotal,
        lineTotal: (menuItem.price + addonTotal) * cartItem.quantity,
      },
    ];
  });
  const subtotal = cartLines.reduce((total, line) => total + line.lineTotal, 0);
  const total = subtotal + deliveryInfo.fee;
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const minDeliveryFee = getMinimumDeliveryFee(deliveryPricing);
  const deliveryFeeTiers = getDeliveryFeeTiers(deliveryPricing, 4);
  const spotlightTestimonials = siteData.home.testimonials.slice(0, 3);
  const phoneDigits = sanitizePhoneNumber(siteData.site.phone);
  const genericWhatsAppUrl = `https://wa.me/${siteData.site.whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent(
    `Olá, gostaria de pedir na ${siteData.site.businessName}.`,
  )}`;

  const appWhatsAppUrl = `https://wa.me/${siteData.site.whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent(
    `Ola, gostaria de pedir na ${siteData.site.businessName}.`,
  )}`;
  const selectedSheetItem = itemSheet
    ? itemSheet.group.items.find((item) => item.id === itemSheet.selectedItemId) ?? itemSheet.group.items[0]
    : null;
  const selectedSheetConfig = getItemOptionConfig(siteData.site, selectedSheetItem);
  const selectedSheetRules = getAddonSelectionRules(siteData.site, selectedSheetItem);
  const selectedSheetAddonTotal =
    selectedSheetConfig?.options
      ?.filter((option) => itemSheet?.selectedAddonIds.includes(option.id))
      .reduce((sum, option) => sum + option.price, 0) ?? 0;
  const selectedSheetCanSubmit =
    !itemSheet || itemSheet.selectedAddonIds.length >= selectedSheetRules.minSelections;
  const cartButtonLabel =
    cartCount > 0
      ? `${cartCount} ${cartCount === 1 ? 'item no carrinho' : 'itens no carrinho'}`
      : 'Seu carrinho esta vazio';
  const cartButtonCaption =
    cartCount > 0
      ? cartAttentionActive
        ? cartAttentionLabel
        : 'Toque para revisar e finalizar'
      : 'Adicione um prato e abra aqui para finalizar.';

  const triggerCartAttention = (label = 'Item adicionado. Abra o carrinho para finalizar.') => {
    if (typeof window === 'undefined') {
      return;
    }

    if (cartAttentionTimeoutRef.current) {
      window.clearTimeout(cartAttentionTimeoutRef.current);
    }

    setCartAttentionLabel(label);
    setCartAttentionActive(false);

    window.requestAnimationFrame(() => {
      setCartAttentionActive(true);
    });

    cartAttentionTimeoutRef.current = window.setTimeout(() => {
      setCartAttentionActive(false);
      setCartAttentionLabel('Toque para revisar e finalizar');
    }, 1800);
  };

  const getDefaultGroupSelection = (group: MenuGroup): MenuCardSelection => {
    const defaultItem = group.items.find((item) => item.available) ?? group.items[0];

    return {
      selectedItemId: defaultItem?.id ?? '',
      selectedAddonIds: [],
    };
  };

  const getGroupSelection = (group: MenuGroup) => {
    const fallbackSelection = getDefaultGroupSelection(group);
    const currentSelection = menuCardSelections[group.id] ?? fallbackSelection;
    const selectedItem =
      group.items.find((item) => item.id === currentSelection.selectedItemId) ??
      group.items.find((item) => item.available) ??
      group.items[0];
    const selectionRules = getAddonSelectionRules(siteData.site, selectedItem);

    return {
      selectedItem,
      selection: {
        selectedItemId: selectedItem?.id ?? fallbackSelection.selectedItemId,
        selectedAddonIds: normalizeAddonSelection(
          siteData.site,
          currentSelection.selectedAddonIds,
          selectedItem,
        ),
      },
      selectionRules,
    };
  };

  const setGroupSelection = (groupId: string, selection: MenuCardSelection) => {
    setMenuCardSelections((current) => ({
      ...current,
      [groupId]: selection,
    }));
  };

  const selectGroupItem = (group: MenuGroup, itemId: string) => {
    const nextItem = group.items.find((item) => item.id === itemId);

    if (!nextItem) {
      return;
    }

    const currentSelection = getGroupSelection(group).selection;
    setGroupSelection(group.id, {
      selectedItemId: nextItem.id,
      selectedAddonIds: normalizeAddonSelection(
        siteData.site,
        currentSelection.selectedAddonIds,
        nextItem,
      ),
    });
  };

  const toggleGroupAddon = (group: MenuGroup, addonId: string) => {
    const { selectedItem, selection, selectionRules } = getGroupSelection(group);
    const selectedItemOptions = getAddonOptions(siteData.site, selectedItem);

    if (!selectedItemOptions.some((option) => option.id === addonId)) {
      return;
    }

    const alreadySelected = selection.selectedAddonIds.includes(addonId);
    const nextAddonIds = alreadySelected
      ? selection.selectedAddonIds.filter((id) => id !== addonId)
      : selection.selectedAddonIds.length >= selectionRules.maxSelections
        ? selection.selectedAddonIds
        : [...selection.selectedAddonIds, addonId];

    setGroupSelection(group.id, {
      selectedItemId: selection.selectedItemId,
      selectedAddonIds: nextAddonIds,
    });
  };

  const openItemSheet = (group: MenuGroup) => {
    const { selectedItem, selection } = getGroupSelection(group);

    if (!selectedItem?.available) {
      return;
    }

    setItemSheet({
      group,
      selectedItemId: selection.selectedItemId,
      quantity: 1,
      notes: '',
      selectedAddonIds: selection.selectedAddonIds,
      cartItemId: null,
    });
  };

  const addConfiguredGroupToCart = (group: MenuGroup) => {
    const { selectedItem, selection, selectionRules } = getGroupSelection(group);

    if (!selectedItem?.available || selection.selectedAddonIds.length < selectionRules.minSelections) {
      return;
    }

    setCart((current) => [
      ...current,
      {
        id: `${selection.selectedItemId}-${Date.now()}`,
        itemId: selection.selectedItemId,
        quantity: 1,
        notes: '',
        selectedAddonIds: selection.selectedAddonIds,
      },
    ]);

    triggerCartAttention();
  };

  const openCartItemEditor = (line: CartLine) => {
    const group = menuGroups.find((menuGroup) => menuGroup.id === getItemGroupId(line.menuItem));

    if (!group) {
      return;
    }

    setCartOpen(false);
    setItemSheet({
      group,
      selectedItemId: line.cartItem.itemId,
      quantity: line.cartItem.quantity,
      notes: line.cartItem.notes,
      selectedAddonIds: normalizeAddonSelection(
        siteData.site,
        line.cartItem.selectedAddonIds,
        line.menuItem,
      ),
      cartItemId: line.cartItem.id,
    });
  };

  const closeItemSheet = () => {
    const shouldReturnToCart = Boolean(itemSheet?.cartItemId);
    setItemSheet(null);

    if (shouldReturnToCart) {
      setCartOpen(true);
    }
  };

  void genericWhatsAppUrl;
  const menuSection = (
    <section className="section-card" id="cardapio">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Cardapio</p>
          <h2>Escolha a categoria e monte seu pedido</h2>
        </div>
        <button
          type="button"
          className="ghost-button desktop-action"
          onClick={() => setCartOpen(true)}
        >
          Ver carrinho
        </button>
      </div>

      <div className="category-scroller">
        {siteData.categories.map((category) => (
          <button
            key={category.id}
            type="button"
            className={`category-chip ${category.id === activeCategoryId ? 'is-active' : ''}`}
            onClick={() => {
              setActiveCategoryId(category.id);
              setOpenMenuGroupId(null);
            }}
          >
            <Icon name={category.icon} className="small-icon" />
            <span>{category.name}</span>
          </button>
        ))}
      </div>

      <div className="category-caption">
        <p>{selectedCategory?.description}</p>
      </div>

      <div className="menu-grid">
        {visibleGroups.map((group) => {
          const { selectedItem, selection, selectionRules } = getGroupSelection(group);
          const selectedItemConfig = getItemOptionConfig(siteData.site, selectedItem);
          const selectedAddonTotal =
            selectedItemConfig?.options
              ?.filter((option) => selection.selectedAddonIds.includes(option.id))
              .reduce((sum, option) => sum + option.price, 0) ?? 0;
          const canAddGroup = group.available && selection.selectedAddonIds.length >= selectionRules.minSelections;
          const isOpen = openMenuGroupId === group.id;

          return (
            <article
              key={group.id}
              className={`menu-card menu-drawer-card drawer-card ${isOpen ? 'is-open' : ''} ${!group.available ? 'is-unavailable' : ''}`}
            >
              <button
                type="button"
                className="menu-drawer-trigger"
                onClick={() => toggleMenuGroup(group.id)}
                aria-expanded={isOpen}
                aria-controls={`menu-group-${group.id}`}
              >
                {group.image ? (
                  <div className="menu-drawer-thumb">
                    <img src={group.image} alt={group.name} />
                  </div>
                ) : null}
                <div className="menu-drawer-main">
                  <div className="menu-card-header menu-drawer-header">
                    <div>
                      <h3>{group.name}</h3>
                      <p>{group.description}</p>
                    </div>
                  </div>

                  <div className="menu-drawer-summary">
                    <span className="menu-card-section-label">Tamanho e preco</span>
                    <div className="size-chip-row menu-drawer-price-list">
                      {group.items.map((item) => (
                        <span key={item.id} className="mini-chip muted-chip menu-drawer-price-chip">
                          {getMenuItemSizeLabel(item) ? `${getMenuItemSizeLabel(item)} ` : 'Valor '}
                          {formatCurrency(item.price)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <span className="drawer-toggle" aria-hidden="true">
                  <Icon name={isOpen ? 'minus' : 'plus'} className="drawer-toggle-icon" />
                </span>
              </button>

              <div
                id={`menu-group-${group.id}`}
                className={`menu-drawer-content ${isOpen ? 'is-open' : ''}`}
              >
                {group.dishOfDay ? <span className="mini-chip accent-chip">Prato do dia</span> : null}

                {group.items.length > 1 ? (
                  <div className="menu-card-section">
                    <div className="menu-card-section-header">
                      <span className="menu-card-section-label">Escolha o tamanho</span>
                    </div>
                    <div className="menu-choice-grid size-choice-grid">
                      {group.items.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`menu-choice ${selection.selectedItemId === item.id ? 'is-selected' : ''}`}
                          onClick={() => selectGroupItem(group, item.id)}
                          disabled={!item.available}
                        >
                          <span>{getMenuItemSizeLabel(item) ?? item.name}</span>
                          <strong>{formatCurrency(item.price)}</strong>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {selectedItemConfig?.options.length ? (
                  <div className="menu-card-section">
                    <div className="menu-card-section-header">
                      <span className="menu-card-section-label">{getAddonLabel(siteData.site, selectedItem)}</span>
                      <span className="selection-hint">
                        {selectionRules.hasGarnishChoices
                          ? `Ate ${selectionRules.maxSelections} opcoes`
                          : 'Opcional'}
                      </span>
                    </div>
                    <div className="menu-choice-grid addon-choice-grid">
                      {selectedItemConfig.options.map((addon) => {
                        const isSelected = selection.selectedAddonIds.includes(addon.id);
                        const isDisabled =
                          !isSelected && selection.selectedAddonIds.length >= selectionRules.maxSelections;

                        return (
                          <button
                            key={addon.id}
                            type="button"
                            className={`menu-choice ${isSelected ? 'is-selected' : ''}`}
                            onClick={() => toggleGroupAddon(group, addon.id)}
                            disabled={isDisabled}
                          >
                            <span>{addon.name}</span>
                            {addon.price ? <strong>{formatCurrency(addon.price)}</strong> : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <div className="chip-row">
                  {group.tags.map((tag) => (
                    <span key={tag} className="mini-chip muted-chip">
                      {tag}
                    </span>
                  ))}
                  <span className="mini-chip success-chip">{group.prepTime}</span>
                </div>

                <div className="menu-card-actions">
                  <button
                    type="button"
                    className="primary-button wide-button"
                    onClick={() => addConfiguredGroupToCart(group)}
                    disabled={!canAddGroup}
                  >
                    {group.available
                      ? `Adicionar ${formatCurrency((selectedItem?.price ?? 0) + selectedAddonTotal)}`
                      : 'Indisponivel'}
                  </button>
                  {(group.items.length > 1 || selectedItemConfig?.options.length) && group.available ? (
                    <button type="button" className="ghost-button menu-card-link" onClick={() => openItemSheet(group)}>
                      Detalhes e observacoes
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );

  const updateCheckoutField = <K extends keyof CheckoutData,>(
    field: K,
    value: CheckoutData[K],
  ) => {
    setCheckout((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const addItemToCart = () => {
    if (!itemSheet || !selectedSheetCanSubmit) {
      return;
    }

    const shouldReturnToCart = Boolean(itemSheet.cartItemId);
    const nextCartItem = {
      id: itemSheet.cartItemId ?? `${itemSheet.selectedItemId}-${Date.now()}`,
      itemId: itemSheet.selectedItemId,
      quantity: itemSheet.quantity,
      notes: itemSheet.notes.trim(),
      selectedAddonIds: itemSheet.selectedAddonIds,
    };

    setCart((current) =>
      itemSheet.cartItemId
        ? current.map((item) => (item.id === itemSheet.cartItemId ? nextCartItem : item))
        : [...current, nextCartItem],
    );

    setItemSheet(null);

    if (shouldReturnToCart) {
      setCartOpen(true);
      return;
    }

    triggerCartAttention();
  };

  const changeCartQuantity = (cartItemId: string, delta: number) => {
    setCart((current) =>
      current.flatMap((item) => {
        if (item.id !== cartItemId) {
          return [item];
        }

        const nextQuantity = item.quantity + delta;

        if (nextQuantity <= 0) {
          return [];
        }

        return [{ ...item, quantity: nextQuantity }];
      }),
    );
  };

  const removeFromCart = (cartItemId: string) => {
    setCart((current) => current.filter((item) => item.id !== cartItemId));
  };

  const toggleInfoDrawer = (drawer: InfoDrawerKey) => {
    setOpenInfoDrawer((current) => (current === drawer ? null : drawer));
  };

  const toggleMenuGroup = (groupId: string) => {
    setOpenMenuGroupId((current) => (current === groupId ? null : groupId));
  };

  const navigateToRoute = (nextRoute: AppRoute) => {
    if (typeof window === 'undefined') {
      return;
    }

    const nextHash = nextRoute === 'admin' ? '#/admin' : '#/';

    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }

    setRoute(nextRoute);
  };

  const loginAdmin = async (username: string, password: string) => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.signInWithPassword({
        email: username.trim(),
        password,
      });

      if (error) {
        return {
          success: false,
          error: 'Email ou senha incorretos.',
        };
      }

      return {
        success: true,
      };
    }

    const success =
      username === siteData.site.adminCredentials.username &&
      password === siteData.site.adminCredentials.password;

    if (success) {
      setLocalAdminAuthenticated(true);
    }

    return {
      success,
      error: success ? '' : 'Login ou senha incorretos.',
    };
  };

  const logoutAdmin = async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
      return;
    }

    setLocalAdminAuthenticated(false);
  };

  const handleUpdateOrderStatus = async (orderId: string, status: OrderStatus) => {
    if (!isSupabaseConfigured) {
      setLocalOrders((current) =>
        current.map((order) =>
          order.id === orderId
            ? { ...order, status, updatedAt: new Date().toISOString() }
            : order,
        ),
      );

      return {
        success: true,
      };
    }

    const currentOrder = remoteOrders.find((order) => order.id === orderId);

    if (!currentOrder || !supabase) {
      return {
        success: false,
        error: 'Pedido nao encontrado para atualizar.',
      };
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const result = await updateRemoteOrderStatus(currentOrder, status, user?.id);

    if (result.error) {
      return {
        success: false,
        error: result.error,
      };
    }

    if (result.data) {
      setRemoteOrders((current) =>
        current.map((order) => (order.id === orderId ? result.data! : order)),
      );
    }

    return {
      success: true,
    };
  };

  const finalizeOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!cartLines.length || checkoutSubmitting) {
      return;
    }

    setCheckoutSubmitting(true);
    setCheckoutSubmitMessage('');
    const pendingPopup = window.open('', '_blank');

    const orderRecord = buildOrderRecord({
      checkout,
      deliveryFee: deliveryInfo.fee,
      deliveryMessage: deliveryInfo.message,
      deliveryEta: deliveryInfo.eta,
      deliveryDistanceKm: deliveryInfo.distanceKm,
      subtotal,
      total,
      items: cartLines.map((line) => ({
        cartItemId: line.cartItem.id,
        itemId: line.menuItem.id,
        name: line.menuItem.name,
        quantity: line.cartItem.quantity,
        notes: line.cartItem.notes,
        sizeLabel: getMenuItemSizeLabel(line.menuItem) ?? '',
        addonLabel: getAddonLabel(siteData.site, line.menuItem),
        addonNames: line.addonLabels,
        unitTotal: line.unitTotal,
        lineTotal: line.lineTotal,
        image: line.menuItem.image,
      })),
    });

    let orderSaveError = '';

    if (isSupabaseConfigured) {
      const saveResult = await createRemoteOrder(orderRecord);

      if (saveResult.error) {
        orderSaveError = saveResult.error;
        setOrdersError(saveResult.error);
        setLocalOrders((current) => [orderRecord, ...current]);
      } else {
        setRemoteOrders((current) => mergeOrders([orderRecord], current));
        setLocalOrders((current) => current.filter((order) => order.id !== orderRecord.id));
        setOrdersError('');
      }
    } else {
      setLocalOrders((current) => [orderRecord, ...current]);
    }

    const url = buildWhatsAppUrl({
      siteData,
      cartLines,
      checkout,
      subtotal,
      deliveryFee: deliveryInfo.fee,
      total,
      orderCode: orderRecord.code,
    });

    if (pendingPopup) {
      pendingPopup.location.href = url;
    } else {
      window.location.href = url;
    }

    setCheckoutSubmitMessage(
      orderSaveError
        ? `Pedido enviado ao WhatsApp, mas nao foi possivel salvar online: ${orderSaveError}`
        : `Pedido ${orderRecord.code} salvo com sucesso e enviado para o WhatsApp.`,
    );
    setCheckoutSubmitting(false);
  };

  if (route === 'admin') {
    return (
      <AdminPanel
        authenticated={adminAuthenticated}
        authMode={authMode}
        syncStatus={syncStatus}
        syncError={syncError}
        adminUserEmail={adminSessionEmail}
        onNavigateHome={() => navigateToRoute('storefront')}
        onLogin={loginAdmin}
        onLogout={logoutAdmin}
        orders={orders}
        ordersLoading={isSupabaseConfigured ? ordersLoading : false}
        ordersError={ordersError}
        onRefreshOrders={loadRemoteOrdersList}
        onUpdateOrderStatus={handleUpdateOrderStatus}
        siteData={siteData}
        onChange={(next) => {
          if (!isSupabaseConfigured) {
            setSiteDataSource('custom');
          }
          setSiteData(next);
        }}
      />
    );
  }

  return (
    <>
      <div className="page-shell">
        <div className="app-frame">
          <header className="topbar">
            <div className="brand-lockup">
              <img
                src="/logo-marmitas-da-nida.png"
                alt="Logo da Marmitas da Nida"
                className="brand-icon"
              />
            </div>

            <div className="topbar-actions">
              <div className={`status-pill ${businessStatus.isOpen ? 'is-open' : 'is-closed'}`}>
                <span className="status-dot" />
                {businessStatus.label}
              </div>
              <button
                type="button"
                className="ghost-button desktop-action"
                onClick={() => navigateToRoute('admin')}
              >
                Painel
              </button>
            </div>
          </header>

          <main className="content-stack">
            {menuSection}

            <section className="section-card social-proof-section" aria-label="Avaliacoes de clientes">
              <div className="social-proof-media">
                <img
                  src="/images/home/customer-showcase.png"
                  alt="Pratos caseiros da Marmitas da Nida"
                  className="social-proof-image"
                />
                <div className="social-proof-cards">
                  {spotlightTestimonials.map((testimonial) => (
                    <article key={testimonial.id} className="social-proof-card">
                      <div className="social-proof-rating">
                        <Icon name="star" className="tiny-icon" />
                        <span>5.0</span>
                      </div>
                      <p>{testimonial.quote}</p>
                      <strong>{testimonial.name}</strong>
                    </article>
                  ))}
                </div>
              </div>
            </section>

            <section className="hero-section section-card">
              <div className="hero-copy">
                <img
                  src="/logo-marmitas-da-nida.png"
                  alt="Logo da Marmitas da Nida"
                  className="hero-logo"
                />
                <h1>{siteData.home.heroTitle}</h1>
                <p className="hero-subtitle">{siteData.home.heroSubtitle}</p>
                {siteData.home.heroNote ? <p className="hero-note">{siteData.home.heroNote}</p> : null}

                <div className="hero-actions">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => scrollToSection('cardapio')}
                  >
                    Ver Cardapio
                  </button>
                </div>

                <div className="highlight-grid">
                  {siteData.home.highlights.map((highlight) => (
                    <div key={highlight} className="highlight-card">
                      <Icon name={getHighlightIcon(highlight)} className="highlight-icon" />
                      <span>{highlight}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="hero-visual">
                <div className="hero-media-card">
                  <img src={siteData.home.bannerImage} alt="Prato em destaque" className="hero-image" />
                </div>
                <div className="floating-info primary-float">
                  {siteData.home.bannerLabel ? <span>{siteData.home.bannerLabel}</span> : null}
                  {siteData.home.bannerTitle ? <strong>{siteData.home.bannerTitle}</strong> : null}
                  {siteData.home.bannerText ? <p>{siteData.home.bannerText}</p> : null}
                </div>
                <div className="floating-info secondary-float">
                  <span>Entrega a partir de</span>
                  <strong>{formatCurrency(minDeliveryFee)}</strong>
                  <p>{businessStatus.detail}</p>
                </div>
              </div>
            </section>

            <section className="info-grid">
              <article className={`section-card compact-card drawer-card ${openInfoDrawer === 'hours' ? 'is-open' : ''}`}>
                <button
                  type="button"
                  className="drawer-trigger"
                  onClick={() => toggleInfoDrawer('hours')}
                  aria-expanded={openInfoDrawer === 'hours'}
                  aria-controls="drawer-hours"
                >
                  <div className="drawer-trigger-main">
                    <div className="icon-wrap">
                      <Icon name="clock" className="section-icon" />
                    </div>
                    <div className="drawer-trigger-copy">
                      <p className="eyebrow">Horario</p>
                      <h2>{businessStatus.label}</h2>
                      <p className="drawer-trigger-note">{businessStatus.detail}</p>
                    </div>
                  </div>
                  <span className="drawer-toggle" aria-hidden="true">
                    <Icon name={openInfoDrawer === 'hours' ? 'minus' : 'plus'} className="drawer-toggle-icon" />
                  </span>
                </button>
                <div
                  id="drawer-hours"
                  className={`info-drawer-content ${openInfoDrawer === 'hours' ? 'is-open' : ''}`}
                >
                  <ul className="plain-list schedule-list">
                    {siteData.site.hours.map((hour) => (
                      <li key={hour.day}>
                        <span>{hour.label}</span>
                        <strong>{hour.enabled ? `${hour.open} - ${hour.close}` : 'Fechado'}</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>

              <article
                className={`section-card compact-card drawer-card ${openInfoDrawer === 'delivery' ? 'is-open' : ''}`}
              >
                <button
                  type="button"
                  className="drawer-trigger"
                  onClick={() => toggleInfoDrawer('delivery')}
                  aria-expanded={openInfoDrawer === 'delivery'}
                  aria-controls="drawer-delivery"
                >
                  <div className="drawer-trigger-main">
                    <div className="icon-wrap">
                      <Icon name="delivery" className="section-icon" />
                    </div>
                    <div className="drawer-trigger-copy">
                      <p className="eyebrow">Entrega</p>
                      <h2>Taxa por distancia</h2>
                      <p className="drawer-trigger-note">{siteData.site.deliveryNotice}</p>
                    </div>
                  </div>
                  <span className="drawer-toggle" aria-hidden="true">
                    <Icon
                      name={openInfoDrawer === 'delivery' ? 'minus' : 'plus'}
                      className="drawer-toggle-icon"
                    />
                  </span>
                </button>
                <div
                  id="drawer-delivery"
                  className={`info-drawer-content ${openInfoDrawer === 'delivery' ? 'is-open' : ''}`}
                >
                  <ul className="plain-list schedule-list">
                  {deliveryFeeTiers.map((tier) => (
                    <li key={tier.id}>
                      <span>{tier.label}</span>
                      <strong>
                        {formatCurrency(tier.fee)}
                      </strong>
                    </li>
                  ))}
                </ul>
                </div>
              </article>
            </section>

            <section className="section-card" id="como-funciona">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Como funciona</p>
                  <h2>Do cardapio ao WhatsApp sem atrito</h2>
                </div>
              </div>
              <div className="steps-grid">
                {siteData.home.howItWorks.map((step) => (
                  <article key={step.id} className="step-card">
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                  </article>
                ))}
              </div>
            </section>

            <footer className="section-card footer-card">
              <div className="footer-grid">
                <div>
                  <p className="eyebrow">Contato</p>
                  <h2>{siteData.site.businessName}</h2>
                  <p>{siteData.site.address}</p>
                </div>
                <div className="contact-list">
                  <a href={`tel:${phoneDigits}`} className="contact-link">
                    <Icon name="phone" className="small-icon" />
                    <span>{siteData.site.phone}</span>
                  </a>
                  <a
                    href={appWhatsAppUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="contact-link"
                  >
                    <Icon name="whatsapp" className="small-icon" />
                    <span>WhatsApp {siteData.site.phone}</span>
                  </a>
                  <a
                    href={siteData.site.instagram}
                    target="_blank"
                    rel="noreferrer"
                    className="contact-link"
                  >
                    <Icon name="sparkles" className="small-icon" />
                    <span>Instagram</span>
                  </a>
                  <button
                    type="button"
                    className="contact-link admin-link"
                    onClick={() => navigateToRoute('admin')}
                  >
                    <Icon name="lock" className="small-icon" />
                    <span>Area administrativa</span>
                  </button>
                </div>
              </div>
            </footer>
          </main>
        </div>
      </div>

      <button
        type="button"
        className={`floating-cart floating-cart-bar ${cartAttentionActive ? 'is-highlighted' : ''} ${cartCount ? 'has-items' : 'is-empty'}`}
        onClick={() => setCartOpen(true)}
        aria-label={`Abrir carrinho com ${cartCount} itens. Total ${formatCurrency(total)}`}
      >
        <span className="floating-cart-icon-wrap">
          <Icon name="cart" className="floating-icon" />
          {cartCount ? <span className="floating-cart-badge">{cartCount}</span> : null}
        </span>
        <span className="floating-cart-copy">
          <strong>{cartButtonLabel}</strong>
          <span>{cartButtonCaption}</span>
        </span>
        <span className="floating-cart-total">{cartCount ? formatCurrency(total) : 'Abrir'}</span>
      </button>

      {itemSheet ? (
        <div className="overlay-shell">
          <div className="sheet-panel">
            <div className="overlay-header">
              <div>
                <p className="eyebrow">Personalize seu pedido</p>
                <h2>{itemSheet.group.name}</h2>
              </div>
                <button
                  type="button"
                  className="icon-button ghost-button"
                  onClick={closeItemSheet}
                >
                  <Icon name="close" className="tiny-icon" />
                </button>
              </div>

            <div className="drawer-content">
              {selectedSheetItem?.image ? (
                <img
                  src={selectedSheetItem.image}
                  alt={itemSheet.group.name}
                  className="sheet-image"
                />
              ) : null}
              <p>{selectedSheetItem?.description ?? itemSheet.group.description}</p>

              {itemSheet.group.items.length > 1 ? (
                <div className="stack-list">
                  <div>
                    <p className="eyebrow">Tamanho da marmita</p>
                    <div className="size-option-grid">
                      {itemSheet.group.items.map((item) => (
                        <label
                          key={item.id}
                          className={`toggle-card ${itemSheet.selectedItemId === item.id ? 'is-selected' : ''}`}
                        >
                          <input
                            type="radio"
                            name="menu-size"
                            checked={itemSheet.selectedItemId === item.id}
                            onChange={() =>
                              setItemSheet((current) =>
                                current
                                    ? {
                                        ...current,
                                        selectedItemId: item.id,
                                        selectedAddonIds: normalizeAddonSelection(
                                          siteData.site,
                                          current.selectedAddonIds,
                                          item,
                                        ),
                                      }
                                    : current,
                                )
                            }
                          />
                          <span>{getMenuItemSizeLabel(item) ?? item.name}</span>
                          <strong>{formatCurrency(item.price)}</strong>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              {selectedSheetConfig?.options.length ? (
                <div className="stack-list">
                  <div>
                    <div className="menu-card-section-header">
                      <p className="eyebrow">{getAddonLabel(siteData.site, selectedSheetItem)}</p>
                      <span
                        className={`selection-hint ${itemSheet.selectedAddonIds.length < selectedSheetRules.minSelections ? 'is-warning' : ''}`}
                      >
                        {selectedSheetRules.hasGarnishChoices
                          ? `Ate ${selectedSheetRules.maxSelections} opcoes`
                          : 'Opcional'}
                      </span>
                    </div>
                    <div className="options-stack">
                      {selectedSheetConfig.options.map((addon) => {
                        const isSelected = itemSheet.selectedAddonIds.includes(addon.id);
                        const isDisabled =
                          !isSelected && itemSheet.selectedAddonIds.length >= selectedSheetRules.maxSelections;

                        return (
                          <label
                            key={addon.id}
                            className={`option-card ${isSelected ? 'is-selected' : ''} ${isDisabled ? 'is-disabled' : ''}`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={isDisabled}
                              onChange={() =>
                                setItemSheet((current) =>
                                  current
                                    ? {
                                        ...current,
                                        selectedAddonIds: current.selectedAddonIds.includes(addon.id)
                                          ? current.selectedAddonIds.filter((id) => id !== addon.id)
                                          : current.selectedAddonIds.length >= selectedSheetRules.maxSelections
                                            ? current.selectedAddonIds
                                            : [...current.selectedAddonIds, addon.id],
                                      }
                                    : current,
                                )
                              }
                            />
                            <span>{addon.name}</span>
                            {addon.price ? <strong>{formatCurrency(addon.price)}</strong> : null}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : null}

              <label className="field">
                <span>Observacoes do item</span>
                <textarea
                  rows={3}
                  value={itemSheet.notes}
                  onChange={(event) =>
                    setItemSheet((current) =>
                      current ? { ...current, notes: event.target.value } : current,
                    )
                  }
                  placeholder="Ex.: sem cebola, pouco sal, mandar talheres..."
                />
              </label>

              <div className="quantity-row">
                <span>Quantidade</span>
                <div className="quantity-control">
                  <button
                    type="button"
                    className="icon-button ghost-button"
                    onClick={() =>
                      setItemSheet((current) =>
                        current ? { ...current, quantity: Math.max(1, current.quantity - 1) } : current,
                      )
                    }
                  >
                    <Icon name="minus" className="tiny-icon" />
                  </button>
                  <strong>{itemSheet.quantity}</strong>
                  <button
                    type="button"
                    className="icon-button ghost-button"
                    onClick={() =>
                      setItemSheet((current) =>
                        current ? { ...current, quantity: current.quantity + 1 } : current,
                      )
                    }
                  >
                    <Icon name="plus" className="tiny-icon" />
                  </button>
                </div>
              </div>
            </div>

            <div className="sheet-footer">
              <button
                type="button"
                className="primary-button wide-button"
                onClick={addItemToCart}
                disabled={!selectedSheetCanSubmit}
              >
                {selectedSheetCanSubmit
                  ? `${itemSheet.cartItemId ? 'Salvar' : 'Adicionar'} ${formatCurrency(
                      ((selectedSheetItem?.price ?? 0) + selectedSheetAddonTotal) * itemSheet.quantity,
                    )}`
                  : `Escolha ${selectedSheetRules.minSelections} guarnicoes`}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {cartOpen ? (
        <div className="overlay-shell">
          <div className="drawer-panel">
            <div className="overlay-header">
              <div>
                <p className="eyebrow">Carrinho</p>
                <h2>{cartCount} itens selecionados</h2>
              </div>
              <button
                type="button"
                className="icon-button ghost-button"
                onClick={() => setCartOpen(false)}
              >
                <Icon name="close" className="tiny-icon" />
              </button>
            </div>

            <div className="drawer-content">
              {cartLines.length ? (
                <div className="stack-list">
                  {cartLines.map((line) => (
                    <article key={line.cartItem.id} className="cart-line">
                      {line.menuItem.image ? (
                        <img src={line.menuItem.image} alt={line.menuItem.name} className="cart-thumb" />
                      ) : null}
                      <div className="cart-line-copy">
                        <div className="menu-admin-header">
                          <strong>{line.menuItem.name}</strong>
                          <span>{formatCurrency(line.lineTotal)}</span>
                        </div>
                        <div className="cart-line-meta">
                          {getMenuItemSizeLabel(line.menuItem) ? (
                            <p>
                              <strong>Tamanho:</strong> {getMenuItemSizeLabel(line.menuItem)}
                            </p>
                          ) : null}
                          <p>
                            <strong>Quantidade:</strong> {line.cartItem.quantity}
                          </p>
                          <p>
                            <strong>Valor unitario:</strong> {formatCurrency(line.unitTotal)}
                          </p>
                          {line.addonLabels.length ? (
                            <p>
                              <strong>{getAddonLabel(siteData.site, line.menuItem)}:</strong> {line.addonLabels.join(', ')}
                            </p>
                          ) : null}
                          {line.cartItem.notes ? (
                            <p>
                              <strong>Observacoes:</strong> {line.cartItem.notes}
                            </p>
                          ) : null}
                        </div>
                        <div className="cart-line-actions">
                          <div className="quantity-control cart-inline-quantity">
                            <button
                              type="button"
                              className="ghost-button cart-step-button"
                              aria-label="Retirar 1 item"
                              onClick={() => changeCartQuantity(line.cartItem.id, -1)}
                            >
                              <span aria-hidden="true">-</span>
                            </button>
                            <strong className="cart-qty-value">{line.cartItem.quantity}</strong>
                            <button
                              type="button"
                              className="ghost-button cart-step-button"
                              aria-label="Adicionar 1 item"
                              onClick={() => changeCartQuantity(line.cartItem.id, 1)}
                            >
                              <span aria-hidden="true">+</span>
                            </button>
                          </div>
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={() => openCartItemEditor(line)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="ghost-button danger-button"
                            onClick={() => removeFromCart(line.cartItem.id)}
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <Icon name="cart" className="empty-icon" />
                  <p>Seu carrinho esta vazio por enquanto.</p>
                </div>
              )}

              <label className="field">
                <span>Observacoes gerais do pedido</span>
                <textarea
                  rows={4}
                  value={checkout.notes}
                  onChange={(event) => updateCheckoutField('notes', event.target.value)}
                  placeholder="Ex.: sem talheres, tocar interfone, retirar salada..."
                />
              </label>
            </div>

            <div className="sheet-footer">
              <div className="summary-stack">
                <div className="summary-row">
                  <span>Subtotal</span>
                  <strong>{formatCurrency(subtotal)}</strong>
                </div>
                <div className="summary-row">
                  <span>Entrega</span>
                  <strong>{formatCurrency(deliveryInfo.fee)}</strong>
                </div>
                <div className="summary-row total-row">
                  <span>Total final</span>
                  <strong>{formatCurrency(total)}</strong>
                </div>
              </div>
              <button
                type="button"
                className="ghost-button wide-button"
                onClick={() => {
                  setCartOpen(false);
                  scrollToSection('cardapio');
                }}
              >
                Adicionar mais itens
              </button>
              <button
                type="button"
                className="primary-button wide-button"
                disabled={!cartLines.length}
                onClick={() => {
                  setCartOpen(false);
                  setCheckoutOpen(true);
                }}
              >
                Ir para finalizacao
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {checkoutOpen ? (
        <div className="overlay-shell">
          <div className="checkout-panel">
            <div className="overlay-header">
              <div>
                <p className="eyebrow">Finalizacao</p>
                <h2>Preencha seus dados e envie no WhatsApp</h2>
              </div>
              <button
                type="button"
                className="icon-button ghost-button"
                onClick={() => setCheckoutOpen(false)}
              >
                <Icon name="close" className="tiny-icon" />
              </button>
            </div>
            <form className="checkout-form" onSubmit={finalizeOrder}>
              <div className="drawer-content">
                <div className="admin-grid two-columns">
                  <label className="field">
                    <span>Nome completo</span>
                    <input
                      value={checkout.fullName}
                      onChange={(event) => updateCheckoutField('fullName', event.target.value)}
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Telefone</span>
                    <input
                      value={checkout.phone}
                      onChange={(event) => updateCheckoutField('phone', event.target.value)}
                      required
                    />
                  </label>
                </div>

                <div className="option-switch">
                  <p className="eyebrow">Forma de entrega</p>
                  <div className="option-grid">
                    <label className={`toggle-card ${checkout.deliveryType === 'delivery' ? 'is-selected' : ''}`}>
                      <input
                        type="radio"
                        name="deliveryType"
                        checked={checkout.deliveryType === 'delivery'}
                        onChange={() => updateCheckoutField('deliveryType', 'delivery')}
                      />
                      <span>Entrega</span>
                    </label>
                    <label className={`toggle-card ${checkout.deliveryType === 'pickup' ? 'is-selected' : ''}`}>
                      <input
                        type="radio"
                        name="deliveryType"
                        checked={checkout.deliveryType === 'pickup'}
                        onChange={() => updateCheckoutField('deliveryType', 'pickup')}
                      />
                      <span>Retirada no local</span>
                    </label>
                  </div>
                </div>

                <div className="admin-grid two-columns">
                  <label className="field">
                    <span>Endereco</span>
                    <input
                      value={checkout.street}
                      onChange={(event) => updateCheckoutField('street', event.target.value)}
                      required={checkout.deliveryType === 'delivery'}
                    />
                  </label>
                  <label className="field">
                    <span>Numero</span>
                    <input
                      value={checkout.number}
                      onChange={(event) => updateCheckoutField('number', event.target.value)}
                      required={checkout.deliveryType === 'delivery'}
                    />
                  </label>
                  <label className="field">
                    <span>Bairro</span>
                    <input
                      value={checkout.neighborhood}
                      onChange={(event) => updateCheckoutField('neighborhood', event.target.value)}
                      required={checkout.deliveryType === 'delivery'}
                    />
                  </label>
                  <label className="field">
                    <span>Complemento</span>
                    <input
                      value={checkout.complement}
                      onChange={(event) => updateCheckoutField('complement', event.target.value)}
                    />
                  </label>
                  <label className="field full-span">
                    <span>Referencia</span>
                    <input
                      value={checkout.reference}
                      onChange={(event) => updateCheckoutField('reference', event.target.value)}
                    />
                  </label>
                </div>

                <div className="delivery-feedback">
                  {checkout.deliveryType === 'delivery' ? (
                    <>
                      <strong>{deliveryInfo.message}</strong>
                      <span>
                        {deliveryInfo.status === 'success' && deliveryInfo.distanceKm !== null
                          ? `${deliveryInfo.eta} • ${deliveryInfo.distanceKm
                              .toFixed(1)
                              .replace('.', ',')} km`
                          : deliveryInfo.eta}
                      </span>
                    </>
                  ) : (
                    <>
                      <strong>Retirada no local selecionada</strong>
                      <span>{siteData.site.address}</span>
                    </>
                  )}
                </div>

                <div className="option-switch">
                  <p className="eyebrow">Pagamento</p>
                  <div className="option-grid">
                    <label className={`toggle-card ${checkout.paymentMethod === 'pix' ? 'is-selected' : ''}`}>
                      <input
                        type="radio"
                        name="paymentMethod"
                        checked={checkout.paymentMethod === 'pix'}
                        onChange={() => updateCheckoutField('paymentMethod', 'pix')}
                      />
                      <span>Pix</span>
                    </label>
                    <label className={`toggle-card ${checkout.paymentMethod === 'cash' ? 'is-selected' : ''}`}>
                      <input
                        type="radio"
                        name="paymentMethod"
                        checked={checkout.paymentMethod === 'cash'}
                        onChange={() => updateCheckoutField('paymentMethod', 'cash')}
                      />
                      <span>Dinheiro</span>
                    </label>
                    <label className={`toggle-card ${checkout.paymentMethod === 'card' ? 'is-selected' : ''}`}>
                      <input
                        type="radio"
                        name="paymentMethod"
                        checked={checkout.paymentMethod === 'card'}
                        onChange={() => updateCheckoutField('paymentMethod', 'card')}
                      />
                      <span>Cartao na entrega</span>
                    </label>
                  </div>
                </div>

                {checkout.paymentMethod === 'cash' ? (
                  <label className="field">
                    <span>Troco para</span>
                    <input
                      value={checkout.changeFor}
                      onChange={(event) => updateCheckoutField('changeFor', event.target.value)}
                      placeholder="Ex.: 50,00"
                    />
                  </label>
                ) : null}

                <label className="field">
                  <span>Observacoes finais</span>
                  <textarea
                    rows={4}
                    value={checkout.notes}
                    onChange={(event) => updateCheckoutField('notes', event.target.value)}
                    placeholder="Ultimos detalhes do pedido..."
                  />
                </label>

                <div className="order-summary-card">
                  <div className="summary-row">
                    <span>Subtotal</span>
                    <strong>{formatCurrency(subtotal)}</strong>
                  </div>
                  <div className="summary-row">
                    <span>Taxa de entrega</span>
                    <strong>{formatCurrency(deliveryInfo.fee)}</strong>
                  </div>
                  <div className="summary-row total-row">
                    <span>Total final</span>
                    <strong>{formatCurrency(total)}</strong>
                  </div>
                </div>

                {checkoutSubmitMessage ? <p className="checkout-submit-message">{checkoutSubmitMessage}</p> : null}
              </div>

              <div className="sheet-footer">
                <button
                  type="submit"
                  className="primary-button wide-button"
                  disabled={!cartLines.length || checkoutSubmitting}
                >
                  {checkoutSubmitting ? 'Salvando pedido...' : 'Finalizar pedido no WhatsApp'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default App;

