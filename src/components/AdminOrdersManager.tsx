import { useMemo, useState } from 'react';
import { OrderRecord, OrderStatus } from '../types';
import { formatCurrency } from '../utils/format';
import { buildCustomerWhatsAppUrl, formatOrderDateTime, getOrderStatusLabel } from '../utils/orders';
import { Icon } from './Icon';

type AdminOrdersManagerProps = {
  orders: OrderRecord[];
  loading: boolean;
  error: string;
  onRefresh: () => Promise<void> | void;
  onStatusChange: (
    orderId: string,
    status: OrderStatus,
  ) => Promise<{ success: boolean; error?: string }>;
};

type OrderFilter = 'all' | OrderStatus;

const statusOptions: OrderStatus[] = ['received', 'preparing', 'on_the_way', 'completed'];

function getOrderStatusClassName(status: OrderStatus) {
  if (status === 'preparing') {
    return 'is-preparing';
  }

  if (status === 'on_the_way') {
    return 'is-on-the-way';
  }

  if (status === 'completed') {
    return 'is-completed';
  }

  return 'is-received';
}

export function AdminOrdersManager({
  orders,
  loading,
  error,
  onRefresh,
  onStatusChange,
}: AdminOrdersManagerProps) {
  const [filter, setFilter] = useState<OrderFilter>('all');
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState('');

  const counts = useMemo(
    () => ({
      all: orders.length,
      received: orders.filter((order) => order.status === 'received').length,
      preparing: orders.filter((order) => order.status === 'preparing').length,
      on_the_way: orders.filter((order) => order.status === 'on_the_way').length,
      completed: orders.filter((order) => order.status === 'completed').length,
    }),
    [orders],
  );

  const filteredOrders = useMemo(
    () => (filter === 'all' ? orders : orders.filter((order) => order.status === filter)),
    [filter, orders],
  );

  const handleStatusChange = async (orderId: string, status: OrderStatus) => {
    setUpdatingOrderId(orderId);
    setStatusError('');

    try {
      const result = await onStatusChange(orderId, status);

      if (!result.success) {
        setStatusError(result.error || 'Nao foi possivel atualizar o pedido.');
      }
    } finally {
      setUpdatingOrderId(null);
    }
  };

  return (
    <section className="admin-orders-stack">
      <div className="admin-orders-summary">
        <article className="stat-card admin-order-stat">
          <span>Pedidos no painel</span>
          <strong>{counts.all}</strong>
        </article>
        <article className="stat-card admin-order-stat">
          <span>Recebidos</span>
          <strong>{counts.received}</strong>
        </article>
        <article className="stat-card admin-order-stat">
          <span>Em preparo</span>
          <strong>{counts.preparing}</strong>
        </article>
        <article className="stat-card admin-order-stat">
          <span>A caminho</span>
          <strong>{counts.on_the_way}</strong>
        </article>
        <article className="stat-card admin-order-stat">
          <span>Finalizados</span>
          <strong>{counts.completed}</strong>
        </article>
      </div>

      <div className="admin-orders-toolbar">
        <div className="admin-orders-filters">
          <button
            type="button"
            className={`ghost-button ${filter === 'all' ? 'is-active' : ''}`}
            onClick={() => setFilter('all')}
          >
            Todos
          </button>
          {statusOptions.map((status) => (
            <button
              key={status}
              type="button"
              className={`ghost-button ${filter === status ? 'is-active' : ''}`}
              onClick={() => setFilter(status)}
            >
              {getOrderStatusLabel(status)}
            </button>
          ))}
        </div>
        <button type="button" className="secondary-button" onClick={() => void onRefresh()}>
          Atualizar lista
        </button>
      </div>

      {statusError ? <p className="error-text">{statusError}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}

      {loading ? (
        <div className="admin-inline-empty">Carregando pedidos...</div>
      ) : filteredOrders.length ? (
        <div className="admin-orders-list">
          {filteredOrders.map((order) => {
            const whatsappUrl = buildCustomerWhatsAppUrl(order.customerPhone);

            return (
              <article key={order.id} className="admin-order-card">
                <div className="admin-order-header">
                  <div className="admin-order-main">
                    <div className="admin-order-headline">
                      <span className="pill-label">{order.code}</span>
                      <span
                        className={`admin-order-status ${getOrderStatusClassName(order.status)}`}
                      >
                        {getOrderStatusLabel(order.status)}
                      </span>
                    </div>
                    <h4>{order.customerName}</h4>
                    <p>
                      {formatOrderDateTime(order.createdAt)} •{' '}
                      {order.deliveryType === 'delivery' ? 'Entrega' : 'Retirada'}
                    </p>
                  </div>
                  <div className="admin-order-total">
                    <span>Total</span>
                    <strong>{formatCurrency(order.total)}</strong>
                  </div>
                </div>

                <div className="admin-order-grid">
                  <section className="admin-order-block">
                    <div className="admin-order-block-title">
                      <Icon name="cart" className="small-icon" />
                      <strong>Itens</strong>
                    </div>
                    <div className="admin-order-items">
                      {order.items.map((item) => (
                        <div key={item.id} className="admin-order-item-row">
                          <div>
                            <strong>
                              {item.quantity}x {item.name}
                            </strong>
                            <p>
                              {item.sizeLabel ? `${item.sizeLabel} • ` : ''}
                              {formatCurrency(item.lineTotal)}
                            </p>
                            {item.addonNames.length ? (
                              <p>
                                {item.addonLabel}: {item.addonNames.join(', ')}
                              </p>
                            ) : null}
                            {item.notes ? <p>Obs.: {item.notes}</p> : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="admin-order-block">
                    <div className="admin-order-block-title">
                      <Icon name="phone" className="small-icon" />
                      <strong>Cliente</strong>
                    </div>
                    <p>{order.customerPhone}</p>
                    <div className="admin-order-block-title top-gap">
                      <Icon name="map" className="small-icon" />
                      <strong>Entrega</strong>
                    </div>
                    <p>{order.address.formatted}</p>
                    <p>{order.deliveryMessage}</p>
                    <p>{order.deliveryEta}</p>
                    <div className="admin-order-block-title top-gap">
                      <Icon name="card" className="small-icon" />
                      <strong>Pagamento</strong>
                    </div>
                    <p>
                      {order.paymentMethod === 'pix'
                        ? 'Pix'
                        : order.paymentMethod === 'cash'
                          ? 'Dinheiro'
                          : 'Cartao na entrega'}
                    </p>
                    {order.changeFor ? <p>Troco para {order.changeFor}</p> : null}
                    {order.notes ? (
                      <>
                        <div className="admin-order-block-title top-gap">
                          <Icon name="edit" className="small-icon" />
                          <strong>Observacoes</strong>
                        </div>
                        <p>{order.notes}</p>
                      </>
                    ) : null}
                  </section>
                </div>

                <div className="admin-order-footer">
                  <div className="admin-order-price-breakdown">
                    <span>Subtotal {formatCurrency(order.subtotal)}</span>
                    <span>Entrega {formatCurrency(order.deliveryFee)}</span>
                    <strong>Total {formatCurrency(order.total)}</strong>
                  </div>

                  <div className="admin-order-actions">
                    <div className="admin-order-status-actions">
                      {statusOptions.map((status) => (
                        <button
                          key={status}
                          type="button"
                          className={`ghost-button ${order.status === status ? 'is-active' : ''}`}
                          disabled={updatingOrderId === order.id}
                          onClick={() => void handleStatusChange(order.id, status)}
                        >
                          {getOrderStatusLabel(status)}
                        </button>
                      ))}
                    </div>
                    <a
                      className="secondary-button"
                      href={whatsappUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Abrir WhatsApp
                    </a>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="admin-inline-empty">
          Nenhum pedido encontrado neste filtro ainda.
        </div>
      )}
    </section>
  );
}
