import { BusinessHoursDay, DeliveryType, DeliveryZone } from '../types';

type BusinessStatus = {
  isOpen: boolean;
  label: string;
  detail: string;
};

const weekdayMap: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function toMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function getZonedTimeParts(timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(new Date());
  const weekday = parts.find((part) => part.type === 'weekday')?.value ?? 'Mon';
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '00';
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00';

  return {
    day: weekdayMap[weekday],
    totalMinutes: Number(hour) * 60 + Number(minute),
  };
}

export function getBusinessStatus(hours: BusinessHoursDay[], timeZone: string): BusinessStatus {
  const now = getZonedTimeParts(timeZone);
  const orderedHours = [...hours].sort((a, b) => a.day - b.day);
  const today = orderedHours.find((entry) => entry.day === now.day && entry.enabled);

  if (today) {
    const openMinutes = toMinutes(today.open);
    const closeMinutes = toMinutes(today.close);

    if (now.totalMinutes >= openMinutes && now.totalMinutes <= closeMinutes) {
      return {
        isOpen: true,
        label: 'Aberto',
        detail: `Recebendo pedidos ate ${today.close}`,
      };
    }

    if (now.totalMinutes < openMinutes) {
      return {
        isOpen: false,
        label: 'Fechado',
        detail: `Abre hoje as ${today.open}`,
      };
    }
  }

  for (let offset = 1; offset <= 7; offset += 1) {
    const nextDay = orderedHours.find(
      (entry) => entry.day === (now.day + offset) % 7 && entry.enabled,
    );

    if (nextDay) {
      const prefix = offset === 1 ? 'Reabre amanha' : `Reabre ${nextDay.label.toLowerCase()}`;
      return {
        isOpen: false,
        label: 'Fechado',
        detail: `${prefix} as ${nextDay.open}`,
      };
    }
  }

  return {
    isOpen: false,
    label: 'Horario',
    detail: 'Atualize os horarios no painel administrativo.',
  };
}

export function getDeliveryZone(
  zones: DeliveryZone[],
  neighborhood: string,
  deliveryType: DeliveryType,
) {
  if (deliveryType === 'pickup') {
    return {
      fee: 0,
      eta: 'Retirada disponivel imediatamente apos a confirmacao.',
      matchedZone: undefined,
    };
  }

  const normalizedNeighborhood = neighborhood.trim().toLowerCase();
  const matchedZone = zones.find(
    (zone) => zone.neighborhood.trim().toLowerCase() === normalizedNeighborhood,
  );

  return {
    fee: matchedZone?.fee ?? 0,
    eta: matchedZone?.eta ?? 'Consulte a taxa e o tempo de entrega pelo WhatsApp.',
    matchedZone,
  };
}
