export type CategoryIcon = 'meal' | 'plate' | 'leaf' | 'drink' | 'dessert' | 'plus';

export type Category = {
  id: string;
  name: string;
  description: string;
  icon: CategoryIcon;
};

export type AddonOption = {
  id: string;
  name: string;
  price: number;
};

export type MenuItem = {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  image: string;
  available: boolean;
  featured: boolean;
  dishOfDay: boolean;
  prepTime: string;
  tags: string[];
  addonTitle?: string;
  addonOptions?: AddonOption[];
};

export type Testimonial = {
  id: string;
  name: string;
  neighborhood: string;
  quote: string;
};

export type HowItWorksStep = {
  id: string;
  title: string;
  description: string;
};

export type HomeContent = {
  heroTitle: string;
  heroSubtitle: string;
  heroNote: string;
  bannerLabel: string;
  bannerTitle: string;
  bannerText: string;
  bannerImage: string;
  promoTitle: string;
  promoText: string;
  highlights: string[];
  howItWorks: HowItWorksStep[];
  testimonials: Testimonial[];
};

export type BusinessHoursDay = {
  day: number;
  label: string;
  enabled: boolean;
  open: string;
  close: string;
};

export type DeliveryZone = {
  id: string;
  neighborhood: string;
  fee: number;
  eta: string;
};

export type Coordinates = {
  lat: number;
  lon: number;
};

export type RestaurantLocation = {
  city: string;
  state: string;
  country: string;
  coordinates: Coordinates;
};

export type DeliveryPricing = {
  baseFee: number;
  feeStep: number;
  stepDistanceKm: number;
  baseEtaMinutes: number;
  etaStepMinutes: number;
};

export type AdminCredentials = {
  username: string;
  password: string;
};

export type SiteConfig = {
  businessName: string;
  tagline: string;
  whatsappNumber: string;
  phone: string;
  address: string;
  instagram: string;
  facebook: string;
  deliveryNotice: string;
  hours: BusinessHoursDay[];
  deliveryZones: DeliveryZone[];
  restaurantLocation: RestaurantLocation;
  deliveryPricing: DeliveryPricing;
  adminCredentials: AdminCredentials;
};

export type SiteData = {
  categories: Category[];
  menu: MenuItem[];
  home: HomeContent;
  site: SiteConfig;
  updatedAt: string;
};

export type CartItem = {
  id: string;
  itemId: string;
  quantity: number;
  notes: string;
  selectedAddonIds: string[];
};

export type DeliveryType = 'delivery' | 'pickup';
export type PaymentMethod = 'pix' | 'cash' | 'card';

export type CheckoutData = {
  fullName: string;
  phone: string;
  street: string;
  number: string;
  neighborhood: string;
  complement: string;
  reference: string;
  deliveryType: DeliveryType;
  paymentMethod: PaymentMethod;
  changeFor: string;
  notes: string;
};
