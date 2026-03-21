import { RealtimeChannel } from '@supabase/supabase-js';
import { SiteData } from '../types';
import { supabase } from './supabase';

const SITE_STATE_ID = 'main';

type SiteStateRow = {
  id: string;
  data: SiteData;
  updated_at?: string;
  updated_by?: string | null;
};

export type RemoteSiteDataResult = {
  data: SiteData | null;
  error: string | null;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: string }).message;
    if (message) {
      return message;
    }
  }

  return fallback;
}

export async function fetchRemoteSiteData(): Promise<RemoteSiteDataResult> {
  if (!supabase) {
    return {
      data: null,
      error: 'Supabase nao configurado.',
    };
  }

  try {
    const { data, error } = await supabase
      .from('site_state')
      .select('id, data, updated_at, updated_by')
      .eq('id', SITE_STATE_ID)
      .maybeSingle<SiteStateRow>();

    if (error) {
      return {
        data: null,
        error: getErrorMessage(error, 'Nao foi possivel carregar os dados online.'),
      };
    }

    return {
      data: data?.data ?? null,
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: getErrorMessage(error, 'Nao foi possivel carregar os dados online.'),
    };
  }
}

export async function saveRemoteSiteData(siteData: SiteData, userId?: string | null) {
  if (!supabase) {
    return {
      error: 'Supabase nao configurado.',
    };
  }

  try {
    const { error } = await supabase.from('site_state').upsert(
      {
        id: SITE_STATE_ID,
        data: siteData,
        updated_by: userId ?? null,
      },
      { onConflict: 'id' },
    );

    if (error) {
      return {
        error: getErrorMessage(error, 'Nao foi possivel salvar os dados online.'),
      };
    }

    return {
      error: null,
    };
  } catch (error) {
    return {
      error: getErrorMessage(error, 'Nao foi possivel salvar os dados online.'),
    };
  }
}

export function subscribeToRemoteSiteData(
  onData: (siteData: SiteData) => void,
  onError?: (message: string) => void,
) {
  if (!supabase) {
    return () => undefined;
  }

  const supabaseClient = supabase;
  const channel: RealtimeChannel = supabaseClient
    .channel('site-state-sync')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'site_state',
        filter: `id=eq.${SITE_STATE_ID}`,
      },
      (payload) => {
        const nextData = (payload.new as SiteStateRow | undefined)?.data;

        if (nextData) {
          onData(nextData);
        }
      },
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        onError?.('Nao foi possivel acompanhar as atualizacoes em tempo real.');
      }
    });

  return () => {
    void supabaseClient.removeChannel(channel);
  };
}
