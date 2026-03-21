import { useEffect, useMemo, useState } from 'react';
import { OrderRecord, OrderStatus } from '../types';
import { formatCurrency } from '../utils/format';
import {
  buildCustomerWhatsAppUrl,
  formatOrderDateTime,
  getOrderStatusLabel,
} from '../utils/orders';
import { Icon, IconName } from './Icon';

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

type BoardFilter = 'active' | 'all' | 'closed';

type StatusColumn = {
  status: OrderStatus;
  title: string;
  subtitle: string;
  icon: IconName;
};

const statusColumns: StatusColumn[] = [
  {
    status: 'received',
    title: 'Recebidos',
    subtitle: 'Pedidos novos esperando acao',
    icon: 'cart',
  },
  {
    status: 'preparing',
    title: 'Em preparo',
    subtitle: 'Pedidos sendo montados na cozinha',
    icon: 'clock',
  },
  {
    status: 'on_the_way',
    title: 'A caminho',
    subtitle: 'Pedidos em rota para entrega',
    icon: 'motoboy',
  },
  {
    status: 'completed',
    title: 'Finalizados',
    subtitle: 'Pedidos concluidos e entregues',
    icon: 'check',
  },
  {
    status: 'cancelled',
    title: 'Cancelados',
    subtitle: 'Pedidos encerrados sem concluir a entrega',
    icon: 'close',
  },
];

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

  if (status === 'cancelled') {
    return 'is-cancelled';
  }

  return 'is-received';
}

function getOrderTypeLabel(order: OrderRecord) {
  return order.deliveryType === 'delivery' ? 'Entrega' : 'Retirada';
}

function getPaymentLabel(order: OrderRecord) {
  if (order.paymentMethod === 'pix') {
    return 'Pix';
  }

  if (order.paymentMethod === 'cash') {
    return 'Dinheiro';
  }

  return 'Cartao';
}

function getElapsedLabel(dateIso: string) {
  const diffMs = Date.now() - new Date(dateIso).getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));

  if (diffMinutes < 60) {
    return `${diffMinutes} min`;
  }

  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;

  if (!minutes) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}min`;
}

function getNextStatus(status: OrderStatus): OrderStatus | null {
  if (status === 'received') {
    return 'preparing';
  }

  if (status === 'preparing') {
    return 'on_the_way';
  }

  if (status === 'on_the_way') {
    return 'completed';
  }

  return null;
}

function getNextStatusActionLabel(status: OrderStatus) {
  if (status === 'received') {
    return 'Iniciar preparo';
  }

  if (status === 'preparing') {
    return 'Marcar a caminho';
  }

  if (status === 'on_the_way') {
    return 'Finalizar pedido';
  }

  return 'Pedido concluido';
}

function sortOrdersForBoard(orders: OrderRecord[]) {
  const statusPriority: Record<OrderStatus, number> = {
    received: 0,
    preparing: 1,
    on_the_way: 2,
    completed: 3,
    cancelled: 4,
  };

  return [...orders].sort((left, right) => {
    if (statusPriority[left.status] !== statusPriority[right.status]) {
      return statusPriority[left.status] - statusPriority[right.status];
    }

    if (left.status === 'completed' || left.status === 'cancelled') {
      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    }

    return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
  });
}

export function AdminOrdersManager({
  orders,
  loading,
  error,
  onRefresh,
  onStatusChange,
}: AdminOrdersManagerProps) {
  const [boardFilter, setBoardFilter] = useState<BoardFilter>('active');
  const [search, setSearch] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [openColumnStatus, setOpenColumnStatus] = useState<OrderStatus | null>('received');
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState('');

  const normalizedSearch = search.trim().toLowerCase();

  const sortedOrders = useMemo(() => sortOrdersForBoard(orders), [orders]);

  const visibleOrders = useMemo(() => {
    const byFilter =
      boardFilter === 'all'
        ? sortedOrders
        : boardFilter === 'closed'
          ? sortedOrders.filter(
              (order) => order.status === 'completed' || order.status === 'cancelled',
            )
          : sortedOrders.filter(
              (order) => order.status !== 'completed' && order.status !== 'cancelled',
            );

    if (!normalizedSearch) {
      return byFilter;
    }

    return byFilter.filter((order) => {
      const haystack = [
        order.code,
        order.customerName,
        order.customerPhone,
        order.address.neighborhood,
        order.address.street,
        ...order.items.map((item) => item.name),
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [boardFilter, normalizedSearch, sortedOrders]);

  const visibleColumns = useMemo(() => {
    if (boardFilter === 'closed') {
      return statusColumns.filter(
        (column) => column.status === 'completed' || column.status === 'cancelled',
      );
    }

    if (boardFilter === 'active') {
      return statusColumns.filter(
        (column) => column.status !== 'completed' && column.status !== 'cancelled',
      );
    }

    return statusColumns;
  }, [boardFilter]);

  const selectedOrder =
    visibleOrders.find((order) => order.id === selectedOrderId) ??
    visibleOrders.find((order) => order.status !== 'completed' && order.status !== 'cancelled') ??
    visibleOrders[0] ??
    null;

  useEffect(() => {
    if (!selectedOrder && selectedOrderId) {
      setSelectedOrderId(null);
      return;
    }

    if (!selectedOrderId && selectedOrder) {
      setSelectedOrderId(selectedOrder.id);
    }
  }, [selectedOrder, selectedOrderId]);

  useEffect(() => {
    const fallbackStatus =
      visibleColumns.find((column) => visibleOrders.some((order) => order.status === column.status))
        ?.status ??
      visibleColumns[0]?.status ??
      null;

    setOpenColumnStatus((current) => {
      if (current && visibleColumns.some((column) => column.status === current)) {
        return current;
      }

      return fallbackStatus;
    });
  }, [visibleColumns, visibleOrders]);

  const metrics = useMemo(() => {
    const activeOrders = orders.filter(
      (order) => order.status !== 'completed' && order.status !== 'cancelled',
    );
    const cancelledOrders = orders.filter((order) => order.status === 'cancelled');
    const deliveryOrders = orders.filter((order) => order.deliveryType === 'delivery');
    const averageTicket = orders.length
      ? orders.reduce((sum, order) => sum + order.total, 0) / orders.length
      : 0;
    const grossVolume = orders.reduce((sum, order) => sum + order.total, 0);

    return {
      total: orders.length,
      active: activeOrders.length,
      cancelled: cancelledOrders.length,
      delivery: deliveryOrders.length,
      pickup: orders.length - deliveryOrders.length,
      averageTicket,
      grossVolume,
    };
  }, [orders]);

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

  const canCancelSelectedOrder =
    selectedOrder && selectedOrder.status !== 'completed' && selectedOrder.status !== 'cancelled';

  const toggleColumnStatus = (status: OrderStatus) => {
    setOpenColumnStatus((current) => (current === status ? null : status));
  };

  return (
    <section className="admin-orders-pro">
      <div className="admin-orders-hero">
        <div className="admin-orders-summary">
          <article className="stat-card admin-order-stat">
            <span>Em andamento</span>
            <strong>{metrics.active}</strong>
          </article>
          <article className="stat-card admin-order-stat">
            <span>Pedidos totais</span>
            <strong>{metrics.total}</strong>
          </article>
          <article className="stat-card admin-order-stat">
            <span>Volume bruto</span>
            <strong>{formatCurrency(metrics.grossVolume)}</strong>
          </article>
          <article className="stat-card admin-order-stat">
            <span>Ticket medio</span>
            <strong>{formatCurrency(metrics.averageTicket)}</strong>
          </article>
          <article className="stat-card admin-order-stat">
            <span>Entrega x retirada</span>
            <strong>
              {metrics.delivery}/{metrics.pickup}
            </strong>
          </article>
          <article className="stat-card admin-order-stat">
            <span>Cancelados</span>
            <strong>{metrics.cancelled}</strong>
          </article>
        </div>
      </div>

      <div className="admin-orders-toolbar-pro">
        <label className="field admin-order-search-field">
          <span>Buscar pedido</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Codigo, cliente, telefone ou item"
          />
        </label>

        <div className="admin-orders-toolbar-actions">
          <div className="admin-orders-filters">
            <button
              type="button"
              className={`ghost-button ${boardFilter === 'active' ? 'is-active' : ''}`}
              onClick={() => setBoardFilter('active')}
            >
              Em andamento
            </button>
            <button
              type="button"
              className={`ghost-button ${boardFilter === 'all' ? 'is-active' : ''}`}
              onClick={() => setBoardFilter('all')}
            >
              Todos
            </button>
            <button
              type="button"
              className={`ghost-button ${boardFilter === 'closed' ? 'is-active' : ''}`}
              onClick={() => setBoardFilter('closed')}
            >
              Encerrados
            </button>
          </div>

          <button type="button" className="secondary-button" onClick={() => void onRefresh()}>
            Atualizar quadro
          </button>
        </div>
      </div>

      {statusError ? <p className="error-text">{statusError}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}

      {loading ? (
        <div className="admin-inline-empty">Carregando pedidos...</div>
      ) : visibleOrders.length ? (
        <div className="admin-orders-workspace">
          <div className="admin-orders-board">
            {visibleColumns.map((column) => {
              const columnOrders = visibleOrders.filter((order) => order.status === column.status);
              const isColumnOpen = openColumnStatus === column.status;

              return (
                <section
                  key={column.status}
                  className={`admin-order-column ${getOrderStatusClassName(column.status)} ${
                    isColumnOpen ? 'is-open' : ''
                  }`}
                >
                  <button
                    type="button"
                    className="admin-order-column-trigger"
                    onClick={() => toggleColumnStatus(column.status)}
                    aria-expanded={isColumnOpen}
                    aria-controls={`admin-order-column-${column.status}`}
                  >
                    <div className="admin-order-column-header">
                      <div className="admin-order-column-main">
                        <div className="admin-order-column-icon">
                          <Icon name={column.icon} className="small-icon" />
                        </div>
                        <div className="admin-order-column-copy">
                          <h4>{column.title}</h4>
                          <p>{column.subtitle}</p>
                        </div>
                      </div>
                      <div className="admin-order-column-header-actions">
                        <div className="admin-order-column-count">{columnOrders.length}</div>
                        <span className="drawer-toggle" aria-hidden="true">
                          <Icon
                            name={isColumnOpen ? 'minus' : 'plus'}
                            className="drawer-toggle-icon"
                          />
                        </span>
                      </div>
                    </div>
                  </button>

                  <div
                    id={`admin-order-column-${column.status}`}
                    className={`admin-order-column-content ${isColumnOpen ? 'is-open' : ''}`}
                  >
                    <div className="admin-order-column-list">
                      {columnOrders.length ? (
                        columnOrders.map((order) => {
                          const nextStatus = getNextStatus(order.status);
                          const quickActionLabel = getNextStatusActionLabel(order.status);
                          const previewItems = order.items.slice(0, 2);
                          const extraItems = order.items.length - previewItems.length;

                          return (
                            <article
                              key={order.id}
                              className={`admin-order-tile ${
                                selectedOrder?.id === order.id ? 'is-selected' : ''
                              }`}
                            >
                              <button
                                type="button"
                                className="admin-order-tile-main"
                                onClick={() => setSelectedOrderId(order.id)}
                              >
                                <div className="admin-order-tile-top">
                                  <span className="admin-order-code">{order.code}</span>
                                  <span className="admin-order-age">{getElapsedLabel(order.createdAt)}</span>
                                </div>

                                <div className="admin-order-tile-body">
                                  <strong>{order.customerName}</strong>
                                  <div className="admin-order-meta-row">
                                    <span className="admin-order-meta-tag">
                                      {formatOrderDateTime(order.createdAt)}
                                    </span>
                                    <span className="admin-order-meta-tag">
                                      {getOrderTypeLabel(order)}
                                    </span>
                                    <span className="admin-order-meta-tag">
                                      {getPaymentLabel(order)}
                                    </span>
                                  </div>
                                </div>

                                <div className="admin-order-chips">
                                  <span className="admin-order-chip">{order.items.length} item(ns)</span>
                                  <span className="admin-order-chip">
                                    {order.deliveryType === 'delivery'
                                      ? order.address.neighborhood || 'Entrega'
                                      : 'Retirada'}
                                  </span>
                                </div>

                                <div className="admin-order-tile-items">
                                  {previewItems.map((item) => (
                                    <p key={item.id} className="admin-order-preview-line">
                                      {item.quantity}x {item.name}
                                    </p>
                                  ))}
                                  {extraItems > 0 ? (
                                    <p className="admin-order-preview-line">+ {extraItems} item(ns)</p>
                                  ) : null}
                                </div>

                                <div className="admin-order-tile-footer">
                                  <div>
                                    <span>Total</span>
                                    <strong>{formatCurrency(order.total)}</strong>
                                  </div>
                                  <span className={`admin-order-status ${getOrderStatusClassName(order.status)}`}>
                                    {getOrderStatusLabel(order.status)}
                                  </span>
                                </div>
                              </button>

                              {nextStatus ? (
                                <button
                                  type="button"
                                  className="primary-button admin-order-quick-action"
                                  disabled={updatingOrderId === order.id}
                                  onClick={() => void handleStatusChange(order.id, nextStatus)}
                                >
                                  {updatingOrderId === order.id ? 'Atualizando...' : quickActionLabel}
                                </button>
                              ) : null}
                            </article>
                          );
                        })
                      ) : (
                        <div className="admin-order-empty-column">
                          Nenhum pedido nesta etapa agora.
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              );
            })}
          </div>

          <aside className="admin-order-detail-panel">
            {selectedOrder ? (
              <>
                <div className="admin-order-detail-header">
                  <div>
                    <p className="eyebrow">Pedido selecionado</p>
                    <h4>{selectedOrder.code}</h4>
                    <p>
                      {selectedOrder.customerName} - {formatOrderDateTime(selectedOrder.createdAt)}
                    </p>
                  </div>
                  <div className="admin-order-detail-total">
                    <span>Total</span>
                    <strong>{formatCurrency(selectedOrder.total)}</strong>
                  </div>
                </div>

                <div className="admin-order-detail-actions">
                  <div className="admin-order-status-actions">
                    {statusColumns.map((column) => (
                      <button
                        key={column.status}
                        type="button"
                        className={`ghost-button ${
                          selectedOrder.status === column.status ? 'is-active' : ''
                        }`}
                        disabled={updatingOrderId === selectedOrder.id}
                        onClick={() => void handleStatusChange(selectedOrder.id, column.status)}
                      >
                        {column.title}
                      </button>
                    ))}
                  </div>
                  <div className="admin-order-detail-action-links">
                    <a
                      className="secondary-button"
                      href={buildCustomerWhatsAppUrl(selectedOrder.customerPhone)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Abrir WhatsApp
                    </a>
                    {canCancelSelectedOrder ? (
                      <button
                        type="button"
                        className="ghost-button danger-button"
                        disabled={updatingOrderId === selectedOrder.id}
                        onClick={() => void handleStatusChange(selectedOrder.id, 'cancelled')}
                      >
                        {updatingOrderId === selectedOrder.id ? 'Atualizando...' : 'Cancelar pedido'}
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="admin-order-detail-sections">
                  <section className="admin-order-detail-section">
                    <div className="admin-order-detail-section-title">
                      <Icon name="cart" className="small-icon" />
                      <strong>Itens do pedido</strong>
                    </div>
                    <div className="admin-order-detail-items">
                      {selectedOrder.items.map((item) => (
                        <article key={item.id} className="admin-order-detail-item">
                          <div className="admin-order-detail-item-top">
                            <strong>
                              {item.quantity}x {item.name}
                            </strong>
                            <span>{formatCurrency(item.lineTotal)}</span>
                          </div>
                          <p>
                            {item.sizeLabel ? `${item.sizeLabel} - ` : ''}
                            {formatCurrency(item.unitTotal)} cada
                          </p>
                          {item.addonNames.length ? (
                            <p>
                              {item.addonLabel}: {item.addonNames.join(', ')}
                            </p>
                          ) : null}
                          {item.notes ? <p>Obs.: {item.notes}</p> : null}
                        </article>
                      ))}
                    </div>
                  </section>

                  <section className="admin-order-detail-section">
                    <div className="admin-order-detail-section-title">
                      <Icon name="phone" className="small-icon" />
                      <strong>Cliente e entrega</strong>
                    </div>
                    <ul className="admin-order-detail-list">
                      <li>
                        <span>Telefone</span>
                        <strong>{selectedOrder.customerPhone}</strong>
                      </li>
                      <li>
                        <span>Entrega</span>
                        <strong>{getOrderTypeLabel(selectedOrder)}</strong>
                      </li>
                      <li>
                        <span>Endereco</span>
                        <strong>{selectedOrder.address.formatted}</strong>
                      </li>
                      <li>
                        <span>Status logistica</span>
                        <strong>{selectedOrder.deliveryMessage}</strong>
                      </li>
                      <li>
                        <span>Previsao</span>
                        <strong>{selectedOrder.deliveryEta}</strong>
                      </li>
                    </ul>
                  </section>

                  <section className="admin-order-detail-section">
                    <div className="admin-order-detail-section-title">
                      <Icon name="card" className="small-icon" />
                      <strong>Financeiro</strong>
                    </div>
                    <ul className="admin-order-detail-list">
                      <li>
                        <span>Pagamento</span>
                        <strong>{getPaymentLabel(selectedOrder)}</strong>
                      </li>
                      {selectedOrder.changeFor ? (
                        <li>
                          <span>Troco para</span>
                          <strong>{selectedOrder.changeFor}</strong>
                        </li>
                      ) : null}
                      <li>
                        <span>Subtotal</span>
                        <strong>{formatCurrency(selectedOrder.subtotal)}</strong>
                      </li>
                      <li>
                        <span>Entrega</span>
                        <strong>{formatCurrency(selectedOrder.deliveryFee)}</strong>
                      </li>
                      <li>
                        <span>Total final</span>
                        <strong>{formatCurrency(selectedOrder.total)}</strong>
                      </li>
                    </ul>
                  </section>

                  {selectedOrder.notes ? (
                    <section className="admin-order-detail-section">
                      <div className="admin-order-detail-section-title">
                        <Icon name="edit" className="small-icon" />
                        <strong>Observacoes do cliente</strong>
                      </div>
                      <p className="admin-order-detail-notes">{selectedOrder.notes}</p>
                    </section>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="admin-inline-empty">
                Selecione um pedido no quadro para ver os detalhes completos.
              </div>
            )}
          </aside>
        </div>
      ) : (
        <div className="admin-inline-empty">
          Nenhum pedido encontrado com esse filtro.
        </div>
      )}
    </section>
  );
}
