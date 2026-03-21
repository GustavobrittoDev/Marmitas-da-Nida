import { CheckoutData, OrderRecord, OrderStatus } from '../types';
import { sanitizePhoneNumber } from './format';

type OrderLineInput = {
  cartItemId: string;
  itemId: string;
  name: string;
  quantity: number;
  notes: string;
  sizeLabel: string;
  addonLabel: string;
  addonNames: string[];
  unitTotal: number;
  lineTotal: number;
  image: string;
};

type BuildOrderRecordParams = {
  checkout: CheckoutData;
  deliveryFee: number;
  deliveryMessage: string;
  deliveryEta: string;
  deliveryDistanceKm: number | null;
  subtotal: number;
  total: number;
  items: OrderLineInput[];
};

function padOrderSegment(value: number) {
  return value.toString().padStart(6, '0');
}

export function createOrderCode() {
  const seed = Date.now() % 1000000;
  return `NIDA-${padOrderSegment(seed)}`;
}

export function buildOrderAddress(checkout: CheckoutData) {
  if (checkout.deliveryType === 'pickup') {
    return 'Retirada no local';
  }

  const addressParts = [
    checkout.street,
    checkout.number,
    checkout.neighborhood,
    checkout.complement && `Complemento: ${checkout.complement}`,
    checkout.reference && `Referencia: ${checkout.reference}`,
  ].filter(Boolean);

  return addressParts.join(', ');
}

export function buildOrderRecord(params: BuildOrderRecordParams): OrderRecord {
  const now = new Date().toISOString();
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `order-${Date.now()}`;

  return {
    id,
    code: createOrderCode(),
    status: 'received',
    createdAt: now,
    updatedAt: now,
    customerName: params.checkout.fullName.trim(),
    customerPhone: params.checkout.phone.trim(),
    deliveryType: params.checkout.deliveryType,
    paymentMethod: params.checkout.paymentMethod,
    changeFor: params.checkout.paymentMethod === 'cash' ? params.checkout.changeFor.trim() : '',
    notes: params.checkout.notes.trim(),
    address: {
      street: params.checkout.street.trim(),
      number: params.checkout.number.trim(),
      neighborhood: params.checkout.neighborhood.trim(),
      complement: params.checkout.complement.trim(),
      reference: params.checkout.reference.trim(),
      formatted: buildOrderAddress(params.checkout),
    },
    deliveryMessage: params.deliveryMessage,
    deliveryEta: params.deliveryEta,
    deliveryDistanceKm: params.deliveryDistanceKm,
    subtotal: params.subtotal,
    deliveryFee: params.deliveryFee,
    total: params.total,
    items: params.items.map((item) => ({
      id: item.cartItemId,
      itemId: item.itemId,
      name: item.name,
      quantity: item.quantity,
      notes: item.notes,
      sizeLabel: item.sizeLabel,
      addonLabel: item.addonLabel,
      addonNames: item.addonNames,
      unitTotal: item.unitTotal,
      lineTotal: item.lineTotal,
      image: item.image,
    })),
  };
}

export function getOrderStatusLabel(status: OrderStatus) {
  if (status === 'preparing') {
    return 'Em preparo';
  }

  if (status === 'on_the_way') {
    return 'A caminho';
  }

  if (status === 'completed') {
    return 'Finalizado';
  }

  if (status === 'cancelled') {
    return 'Cancelado';
  }

  return 'Recebido';
}

export function formatOrderDateTime(dateIso: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateIso));
}

export function buildCustomerWhatsAppUrl(phone: string) {
  const digits = sanitizePhoneNumber(phone);
  return digits ? `https://wa.me/${digits}` : '#';
}
