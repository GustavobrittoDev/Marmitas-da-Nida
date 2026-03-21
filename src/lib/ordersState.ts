import { RealtimeChannel } from '@supabase/supabase-js';
import { OrderRecord, OrderStatus } from '../types';
import { supabase } from './supabase';

type OrderRow = {
  id: string;
  code: string;
  status: OrderStatus;
  data: OrderRecord;
  created_at: string;
  updated_at: string;
  status_updated_at?: string;
  status_updated_by?: string | null;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: string }).code;
    const message = (error as { message?: string }).message ?? '';

    if (
      code === 'PGRST205' ||
      message.includes("Could not find the table 'public.orders' in the schema cache")
    ) {
      return 'A central de pedidos ainda nao foi ativada no Supabase. Rode novamente o arquivo supabase/setup.sql para criar a tabela public.orders.';
    }
  }

  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: string }).message;
    if (message) {
      return message;
    }
  }

  return fallback;
}

function mapOrderRow(row: OrderRow): OrderRecord {
  return {
    ...row.data,
    id: row.id,
    code: row.code,
    status: row.status,
    createdAt: row.data.createdAt || row.created_at,
    updatedAt: row.data.updatedAt || row.updated_at,
  };
}

export async function createRemoteOrder(order: OrderRecord) {
  if (!supabase) {
    return {
      error: 'Supabase nao configurado.',
    };
  }

  try {
    const { error } = await supabase.from('orders').insert({
      id: order.id,
      code: order.code,
      status: order.status,
      data: order,
    });

    if (error) {
      return {
        error: getErrorMessage(error, 'Nao foi possivel salvar o pedido online.'),
      };
    }

    return {
      error: null,
    };
  } catch (error) {
    return {
      error: getErrorMessage(error, 'Nao foi possivel salvar o pedido online.'),
    };
  }
}

export async function fetchRemoteOrders() {
  if (!supabase) {
    return {
      data: [] as OrderRecord[],
      error: 'Supabase nao configurado.',
    };
  }

  try {
    const { data, error } = await supabase
      .from('orders')
      .select('id, code, status, data, created_at, updated_at, status_updated_at, status_updated_by')
      .order('created_at', { ascending: false })
      .returns<OrderRow[]>();

    if (error) {
      return {
        data: [] as OrderRecord[],
        error: getErrorMessage(error, 'Nao foi possivel carregar os pedidos online.'),
      };
    }

    return {
      data: (data ?? []).map(mapOrderRow),
      error: null,
    };
  } catch (error) {
    return {
      data: [] as OrderRecord[],
      error: getErrorMessage(error, 'Nao foi possivel carregar os pedidos online.'),
    };
  }
}

export async function updateRemoteOrderStatus(order: OrderRecord, status: OrderStatus, userId?: string | null) {
  if (!supabase) {
    return {
      error: 'Supabase nao configurado.',
    };
  }

  const nextOrder: OrderRecord = {
    ...order,
    status,
    updatedAt: new Date().toISOString(),
  };

  try {
    const { error } = await supabase
      .from('orders')
      .update({
        status,
        data: nextOrder,
        status_updated_at: new Date().toISOString(),
        status_updated_by: userId ?? null,
      })
      .eq('id', order.id);

    if (error) {
      return {
        error: getErrorMessage(error, 'Nao foi possivel atualizar o status do pedido.'),
      };
    }

    return {
      error: null,
      data: nextOrder,
    };
  } catch (error) {
    return {
      error: getErrorMessage(error, 'Nao foi possivel atualizar o status do pedido.'),
    };
  }
}

export function subscribeToRemoteOrders(
  onData: (orders: OrderRecord[]) => void,
  onError?: (message: string) => void,
) {
  if (!supabase) {
    return () => undefined;
  }

  const supabaseClient = supabase;
  const channel: RealtimeChannel = supabaseClient
    .channel('orders-sync')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'orders',
      },
      async () => {
        const result = await fetchRemoteOrders();

        if (result.error) {
          onError?.(result.error);
          return;
        }

        onData(result.data);
      },
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        onError?.('Nao foi possivel acompanhar os pedidos em tempo real.');
      }
    });

  return () => {
    void supabaseClient.removeChannel(channel);
  };
}
