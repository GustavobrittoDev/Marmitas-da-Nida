import { CheckoutData, Coordinates, DeliveryPricing, RestaurantLocation } from '../types';
import { formatCurrency } from './format';

const geocodeCacheKey = 'nida-geocode-cache-v1';

type GeocodeResult = {
  coordinates: Coordinates;
  displayName: string;
};

function readGeocodeCache() {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const rawValue = window.localStorage.getItem(geocodeCacheKey);
    return rawValue ? (JSON.parse(rawValue) as Record<string, GeocodeResult>) : {};
  } catch {
    return {};
  }
}

function writeGeocodeCache(cache: Record<string, GeocodeResult>) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(geocodeCacheKey, JSON.stringify(cache));
  } catch {
    return;
  }
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function haversineDistance(origin: Coordinates, destination: Coordinates) {
  const earthRadiusKm = 6371;
  const deltaLat = toRadians(destination.lat - origin.lat);
  const deltaLon = toRadians(destination.lon - origin.lon);
  const originLat = toRadians(origin.lat);
  const destinationLat = toRadians(destination.lat);

  const arc =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(originLat) * Math.cos(destinationLat) * Math.sin(deltaLon / 2) ** 2;

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(arc));
}

export function buildCustomerAddressQuery(
  checkout: CheckoutData,
  restaurantLocation: RestaurantLocation,
) {
  if (checkout.deliveryType !== 'delivery') {
    return '';
  }

  const hasMinimumAddress =
    checkout.street.trim().length > 2 &&
    checkout.number.trim().length > 0 &&
    checkout.neighborhood.trim().length > 1;

  if (!hasMinimumAddress) {
    return '';
  }

  return [
    checkout.street.trim(),
    checkout.number.trim(),
    checkout.neighborhood.trim(),
    restaurantLocation.city,
    restaurantLocation.state,
    restaurantLocation.country,
  ]
    .filter(Boolean)
    .join(', ');
}

export function getMinimumDeliveryFee(deliveryPricing: DeliveryPricing) {
  return deliveryPricing.baseFee;
}

export function getDeliveryFeeTiers(deliveryPricing: DeliveryPricing, count = 4) {
  return Array.from({ length: count }, (_, index) => {
    const startKm = index * deliveryPricing.stepDistanceKm;
    const endKm = (index + 1) * deliveryPricing.stepDistanceKm;
    const fee = deliveryPricing.baseFee + index * deliveryPricing.feeStep;

    return {
      id: `tier-${index + 1}`,
      label:
        index === 0
          ? `Ate ${endKm.toFixed(0)} km`
          : `${startKm.toFixed(0)} a ${endKm.toFixed(0)} km`,
      fee,
    };
  });
}

export function getIdleDeliveryMessage(deliveryPricing: DeliveryPricing) {
  return `Taxa a partir de ${formatCurrency(
    deliveryPricing.baseFee,
  )}. Preencha rua, numero e bairro para calcular automaticamente.`;
}

export function getPickupDeliveryInfo() {
  return {
    status: 'success' as const,
    fee: 0,
    eta: 'Retirada disponivel imediatamente apos a confirmacao.',
    distanceKm: null,
    resolvedAddress: '',
    message: 'Retirada no local selecionada.',
  };
}

export function getErrorDeliveryInfo(deliveryPricing: DeliveryPricing) {
  return {
    status: 'error' as const,
    fee: 0,
    eta: 'Nao foi possivel calcular a taxa automaticamente.',
    distanceKm: null,
    resolvedAddress: '',
    message: `Confira rua, numero e bairro. Se preferir, confirme a taxa pelo WhatsApp. Taxa minima: ${formatCurrency(
      deliveryPricing.baseFee,
    )}.`,
  };
}

export function getIdleDeliveryInfo(deliveryPricing: DeliveryPricing) {
  return {
    status: 'idle' as const,
    fee: 0,
    eta: 'A taxa aparece automaticamente quando o endereco estiver completo.',
    distanceKm: null,
    resolvedAddress: '',
    message: getIdleDeliveryMessage(deliveryPricing),
  };
}

export function getLoadingDeliveryInfo(currentFee = 0) {
  return {
    status: 'loading' as const,
    fee: currentFee,
    eta: 'Calculando taxa de entrega...',
    distanceKm: null,
    resolvedAddress: '',
    message: 'Calculando a distancia ate a sua entrega...',
  };
}

export function calculateDeliveryInfo(
  origin: Coordinates,
  destination: Coordinates,
  deliveryPricing: DeliveryPricing,
  resolvedAddress: string,
) {
  const rawDistanceKm = haversineDistance(origin, destination);
  const distanceKm = Number(rawDistanceKm.toFixed(1));
  const stepCount = Math.max(0, Math.ceil(distanceKm / deliveryPricing.stepDistanceKm) - 1);
  const fee = deliveryPricing.baseFee + stepCount * deliveryPricing.feeStep;
  const etaStart = deliveryPricing.baseEtaMinutes + stepCount * deliveryPricing.etaStepMinutes;
  const etaEnd = etaStart + 10;

  return {
    status: 'success' as const,
    fee,
    eta: `${etaStart} a ${etaEnd} min`,
    distanceKm,
    resolvedAddress,
    message: `Taxa calculada para ${distanceKm.toFixed(1).replace('.', ',')} km: ${formatCurrency(fee)}.`,
  };
}

export async function geocodeAddress(query: string, signal?: AbortSignal) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return null;
  }

  const cache = readGeocodeCache();
  if (cache[normalizedQuery]) {
    return cache[normalizedQuery];
  }

  const params = new URLSearchParams({
    format: 'jsonv2',
    limit: '1',
    countrycodes: 'br',
    q: query,
  });

  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    signal,
    headers: {
      'Accept-Language': 'pt-BR,pt;q=0.9',
    },
  });

  if (!response.ok) {
    throw new Error('Falha ao consultar o geocodificador.');
  }

  const results = (await response.json()) as Array<{
    lat: string;
    lon: string;
    display_name: string;
  }>;

  if (!results.length) {
    return null;
  }

  const result = {
    coordinates: {
      lat: Number(results[0].lat),
      lon: Number(results[0].lon),
    },
    displayName: results[0].display_name,
  };

  cache[normalizedQuery] = result;
  writeGeocodeCache(cache);

  return result;
}
