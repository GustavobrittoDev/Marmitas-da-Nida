import { AddonOption, MenuItem, SiteConfig } from '../types';

const legacyGarnishOptionIds = new Set(['farofa', 'macarrao-com-molho', 'chuchu-refogado']);

type OptionCarrier = Pick<MenuItem, 'usesGlobalGarnishes' | 'addonTitle' | 'addonOptions'> | null | undefined;

export type ItemOptionConfig = {
  title: string;
  options: AddonOption[];
  maxSelections: number;
  source: 'garnish' | 'addon';
};

export function isLegacyGarnishOptionSet(options?: AddonOption[] | null) {
  return (options?.length ?? 0) > 0 && options!.every((option) => legacyGarnishOptionIds.has(option.id));
}

export function getItemOptionConfig(siteConfig: Pick<SiteConfig, 'garnishConfig'>, item?: OptionCarrier) {
  if (!item) {
    return null;
  }

  const garnishConfig = siteConfig.garnishConfig;

  if (item.usesGlobalGarnishes && garnishConfig?.options?.length) {
    return {
      title: garnishConfig.title || 'Guarnicoes',
      options: garnishConfig.options,
      maxSelections: Math.min(
        Math.max(0, garnishConfig.maxSelections || 0),
        garnishConfig.options.length,
      ),
      source: 'garnish' as const,
    };
  }

  if (!item.addonOptions?.length) {
    return null;
  }

  return {
    title: item.addonTitle || 'Adicionais',
    options: item.addonOptions,
    maxSelections: item.addonOptions.length,
    source: 'addon' as const,
  };
}

export function normalizeOptionSelection(selectedIds: string[], config?: ItemOptionConfig | null) {
  if (!config || !config.maxSelections) {
    return [];
  }

  const validIds = selectedIds.filter((selectedId) =>
    config.options.some((option) => option.id === selectedId),
  );

  return validIds.slice(0, config.maxSelections);
}
