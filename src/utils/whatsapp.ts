import { CartItem, CheckoutData, MenuItem, SiteData } from '../types';
import { formatCurrency, sanitizePhoneNumber } from './format';
import { getItemOptionConfig } from './menuOptions';

type ResolvedCartLine = {
  cartItem: CartItem;
  menuItem: MenuItem;
  addonLabels: string[];
  lineTotal: number;
};

function getAddonLabel(siteData: SiteData, menuItem: MenuItem) {
  return getItemOptionConfig(siteData.site, menuItem)?.title || 'Adicionais';
}

function buildAddress(checkout: CheckoutData) {
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

function paymentLabel(method: CheckoutData['paymentMethod']) {
  if (method === 'pix') {
    return 'Pix';
  }

  if (method === 'cash') {
    return 'Dinheiro';
  }

  return 'Cartao na entrega';
}

export function buildWhatsAppMessage(params: {
  siteData: SiteData;
  cartLines: ResolvedCartLine[];
  checkout: CheckoutData;
  subtotal: number;
  deliveryFee: number;
  total: number;
  orderCode?: string;
}) {
  const { siteData, cartLines, checkout, subtotal, deliveryFee, total, orderCode } = params;
  const itemLines = cartLines
    .map(({ cartItem, menuItem, addonLabels, lineTotal }) => {
      const addonText = addonLabels.length
        ? ` (${getAddonLabel(siteData, menuItem)}: ${addonLabels.join(', ')})`
        : '';
      const noteText = cartItem.notes ? `\n  Observacao: ${cartItem.notes}` : '';
      return `- ${cartItem.quantity}x ${menuItem.name}${addonText} - ${formatCurrency(lineTotal)}${noteText}`;
    })
    .join('\n');

  const paymentChange =
    checkout.paymentMethod === 'cash'
      ? checkout.changeFor || 'Nao precisa de troco'
      : 'Nao se aplica';

  return [
    `Ola, gostaria de fazer um pedido na ${siteData.site.businessName}.`,
    orderCode ? `Codigo do pedido: ${orderCode}` : null,
    '',
    '*Itens do pedido:*',
    itemLines,
    '',
    `*Subtotal:* ${formatCurrency(subtotal)}`,
    `*Taxa de entrega:* ${formatCurrency(deliveryFee)}`,
    `*Total:* ${formatCurrency(total)}`,
    '',
    '*Dados do cliente:*',
    `Nome: ${checkout.fullName}`,
    `Telefone: ${checkout.phone}`,
    '',
    '*Entrega:*',
    `Tipo: ${checkout.deliveryType === 'delivery' ? 'Entrega' : 'Retirada'}`,
    `Endereco: ${buildAddress(checkout)}`,
    '',
    '*Pagamento:*',
    `Forma de pagamento: ${paymentLabel(checkout.paymentMethod)}`,
    `Troco para: ${paymentChange}`,
    '',
    '*Observacoes:*',
    checkout.notes || 'Sem observacoes.',
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n');
}

export function buildWhatsAppUrl(params: {
  siteData: SiteData;
  cartLines: ResolvedCartLine[];
  checkout: CheckoutData;
  subtotal: number;
  deliveryFee: number;
  total: number;
  orderCode?: string;
}) {
  const phoneNumber = sanitizePhoneNumber(params.siteData.site.whatsappNumber);
  const message = encodeURIComponent(buildWhatsAppMessage(params));
  return `https://wa.me/${phoneNumber}?text=${message}`;
}
