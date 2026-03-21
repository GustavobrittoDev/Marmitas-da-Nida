import { ChangeEvent, DragEvent, FormEvent, ReactNode, useRef, useState } from 'react';
import { AdminOrdersManager } from './AdminOrdersManager';
import { uploadSiteImage } from '../lib/siteImages';
import { Category, CategoryIcon, MenuItem, OrderRecord, OrderStatus, SiteData } from '../types';
import { formatCurrency, slugify } from '../utils/format';
import { Icon, IconName } from './Icon';

type AdminPanelProps = {
  authenticated: boolean;
  authMode: 'local' | 'supabase';
  syncStatus: 'local' | 'connecting' | 'online' | 'saving' | 'error';
  syncError: string;
  adminUserEmail: string | null;
  onNavigateHome: () => void;
  onLogin: (
    username: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string }>;
  onLogout: () => Promise<void> | void;
  orders: OrderRecord[];
  ordersLoading: boolean;
  ordersError: string;
  onRefreshOrders: () => Promise<void> | void;
  onUpdateOrderStatus: (
    orderId: string,
    status: OrderStatus,
  ) => Promise<{ success: boolean; error?: string }>;
  siteData: SiteData;
  onChange: (next: SiteData) => void;
};

type AdminSectionKey = 'orders' | 'home' | 'menu' | 'settings';

type ItemVariantFormState = {
  id: string | null;
  sizeLabel: string;
  price: string;
  available: boolean;
};

type AdminMenuItemGroup = {
  id: string;
  sourceItemIds: string[];
  categoryId: string;
  baseName: string;
  description: string;
  image: string;
  prepTime: string;
  tags: string;
  usesGlobalGarnishes: boolean;
  addonTitle: string;
  addonOptions: string;
  featured: boolean;
  dishOfDay: boolean;
  variants: ItemVariantFormState[];
};

type ItemFormState = {
  groupId: string | null;
  sourceItemIds: string[];
  categoryId: string;
  baseName: string;
  description: string;
  image: string;
  prepTime: string;
  tags: string;
  usesGlobalGarnishes: boolean;
  addonTitle: string;
  addonOptions: string;
  featured: boolean;
  dishOfDay: boolean;
  variants: ItemVariantFormState[];
};

type AdminDrawerSectionProps = {
  sectionKey: AdminSectionKey;
  openSection: AdminSectionKey | null;
  onToggle: (section: AdminSectionKey) => void;
  icon: IconName;
  eyebrow: string;
  title: string;
  summary: string;
  meta?: string;
  children: ReactNode;
};

const categoryIcons: CategoryIcon[] = ['meal', 'plate', 'leaf', 'drink', 'dessert', 'plus'];

const emptyCategory: Category = {
  id: '',
  name: '',
  description: '',
  icon: 'meal',
};

const sizePattern = /\s*-\s*(Pequena|Media)$/i;

function normalizeSizeLabel(label: string) {
  const normalized = label.trim().toLowerCase();

  if (!normalized || normalized === 'unico') {
    return '';
  }

  if (normalized === 'pequena') {
    return 'Pequena';
  }

  if (normalized === 'media') {
    return 'Media';
  }

  return label.trim();
}

function createEmptyVariant(sizeLabel = ''): ItemVariantFormState {
  return {
    id: null,
    sizeLabel: normalizeSizeLabel(sizeLabel),
    price: '',
    available: true,
  };
}

function getDefaultVariants(categoryId?: string) {
  if (categoryId === 'especial-do-dia' || categoryId === 'pratos-fixos') {
    return [createEmptyVariant('Pequena'), createEmptyVariant('Media')];
  }

  return [createEmptyVariant()];
}

const emptyItem: ItemFormState = {
  groupId: null,
  sourceItemIds: [],
  categoryId: '',
  baseName: '',
  description: '',
  image: '',
  prepTime: '',
  tags: '',
  usesGlobalGarnishes: false,
  addonTitle: '',
  addonOptions: '',
  featured: false,
  dishOfDay: false,
  variants: [createEmptyVariant()],
};

function getBaseItemName(name: string) {
  return name.replace(sizePattern, '').trim();
}

function getItemSizeLabel(item: Pick<MenuItem, 'name' | 'tags'>) {
  const match = item.name.match(sizePattern);

  if (match) {
    return normalizeSizeLabel(match[1]);
  }

  return normalizeSizeLabel(item.tags.find((tag) => tag === 'Pequena' || tag === 'Media') ?? '');
}

function buildVariantName(baseName: string, sizeLabel: string) {
  const normalizedSizeLabel = normalizeSizeLabel(sizeLabel);
  return normalizedSizeLabel ? `${baseName} - ${normalizedSizeLabel}` : baseName;
}

function buildVariantId(baseName: string, sizeLabel: string) {
  const normalizedSizeLabel = normalizeSizeLabel(sizeLabel);
  const baseId = slugify(baseName);

  return normalizedSizeLabel ? `${baseId}-${slugify(normalizedSizeLabel)}` : baseId;
}

function sortVariants<T extends { sizeLabel: string }>(variants: T[]) {
  const order = new Map([
    ['Pequena', 0],
    ['Media', 1],
    ['', 2],
  ]);

  return [...variants].sort((left, right) => {
    const leftOrder = order.get(normalizeSizeLabel(left.sizeLabel)) ?? 3;
    const rightOrder = order.get(normalizeSizeLabel(right.sizeLabel)) ?? 3;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return normalizeSizeLabel(left.sizeLabel).localeCompare(normalizeSizeLabel(right.sizeLabel));
  });
}

function formatGroupTags(tags: string[]) {
  return tags.filter((tag) => tag !== 'Pequena' && tag !== 'Media').join(', ');
}

function groupMenuItemsForAdmin(menu: MenuItem[]): AdminMenuItemGroup[] {
  const groups = new Map<string, AdminMenuItemGroup>();

  menu.forEach((item) => {
    const groupId = item.id.replace(/-(pequena|media)$/i, '');
    const currentGroup = groups.get(groupId);
    const nextVariant: ItemVariantFormState = {
      id: item.id,
      sizeLabel: getItemSizeLabel(item),
      price: String(item.price),
      available: item.available,
    };

    if (!currentGroup) {
      groups.set(groupId, {
        id: groupId,
        sourceItemIds: [item.id],
        categoryId: item.categoryId,
        baseName: getBaseItemName(item.name),
        description: item.description,
        image: item.image,
        prepTime: item.prepTime,
        tags: formatGroupTags(item.tags),
        usesGlobalGarnishes: Boolean(item.usesGlobalGarnishes),
        addonTitle: item.addonTitle ?? '',
        addonOptions: formatAddonOptions(item.addonOptions),
        featured: item.featured,
        dishOfDay: item.dishOfDay,
        variants: [nextVariant],
      });
      return;
    }

    currentGroup.sourceItemIds.push(item.id);
    currentGroup.featured = currentGroup.featured || item.featured;
    currentGroup.dishOfDay = currentGroup.dishOfDay || item.dishOfDay;
    currentGroup.variants = sortVariants([...currentGroup.variants, nextVariant]);

    if (!currentGroup.image && item.image) {
      currentGroup.image = item.image;
    }
  });

  return [...groups.values()].map((group) => ({
    ...group,
    variants: sortVariants(group.variants),
  }));
}

function mapItemGroupToForm(itemGroup: AdminMenuItemGroup): ItemFormState {
  return {
    groupId: itemGroup.id,
    sourceItemIds: itemGroup.sourceItemIds,
    categoryId: itemGroup.categoryId,
    baseName: itemGroup.baseName,
    description: itemGroup.description,
    image: itemGroup.image,
    prepTime: itemGroup.prepTime,
    tags: itemGroup.tags,
    usesGlobalGarnishes: itemGroup.usesGlobalGarnishes,
    addonTitle: itemGroup.addonTitle,
    addonOptions: itemGroup.addonOptions,
    featured: itemGroup.featured,
    dishOfDay: itemGroup.dishOfDay,
    variants: itemGroup.variants,
  };
}

function getGroupPriceRangeLabel(itemGroup: AdminMenuItemGroup) {
  const prices = itemGroup.variants
    .map((variant) => Number(variant.price.replace(',', '.')))
    .filter((price) => !Number.isNaN(price));

  if (!prices.length) {
    return 'Sem preco';
  }

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  if (minPrice === maxPrice) {
    return formatCurrency(minPrice);
  }

  return `${formatCurrency(minPrice)} a ${formatCurrency(maxPrice)}`;
}

function parseAddonOptions(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, priceText] = line.split(':');
      const parsedPrice = Number(priceText?.replace(',', '.').trim() ?? '0');

      return {
        id: slugify(name),
        name: name.trim(),
        price: Number.isNaN(parsedPrice) ? 0 : parsedPrice,
      };
    })
    .filter((option) => option.name);
}

function formatAddonOptions(options?: { name: string; price: number }[]) {
  return options?.map((option) => `${option.name}: ${option.price.toFixed(2)}`).join('\n') ?? '';
}

function AdminDrawerSection({
  sectionKey,
  openSection,
  onToggle,
  icon,
  eyebrow,
  title,
  summary,
  meta,
  children,
}: AdminDrawerSectionProps) {
  const isOpen = openSection === sectionKey;

  return (
    <section className={`admin-section-drawer ${isOpen ? 'is-open' : ''}`}>
      <button
        type="button"
        className="admin-drawer-trigger"
        onClick={() => onToggle(sectionKey)}
        aria-expanded={isOpen}
        aria-controls={`admin-section-${sectionKey}`}
      >
        <div className="admin-drawer-main">
          <div className="admin-drawer-icon">
            <Icon name={icon} className="small-icon" />
          </div>
          <div className="admin-drawer-copy">
            <span className="pill-label admin-drawer-eyebrow">{eyebrow}</span>
            <h3>{title}</h3>
            <p>{summary}</p>
            {meta ? <strong>{meta}</strong> : null}
          </div>
        </div>
        <span className="drawer-toggle" aria-hidden="true">
          <Icon name={isOpen ? 'minus' : 'plus'} className="drawer-toggle-icon" />
        </span>
      </button>

      <div
        id={`admin-section-${sectionKey}`}
        className={`admin-drawer-content ${isOpen ? 'is-open' : ''}`}
      >
        {children}
      </div>
    </section>
  );
}

export function AdminPanel({
  authenticated,
  authMode,
  syncStatus,
  syncError,
  adminUserEmail,
  onNavigateHome,
  onLogin,
  onLogout,
  orders,
  ordersLoading,
  ordersError,
  onRefreshOrders,
  onUpdateOrderStatus,
  siteData,
  onChange,
}: AdminPanelProps) {
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [openSection, setOpenSection] = useState<AdminSectionKey | null>('orders');
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [categoryForm, setCategoryForm] = useState<Category>(emptyCategory);
  const [categoryEditorId, setCategoryEditorId] = useState<string | 'new' | null>(null);
  const [itemForm, setItemForm] = useState<ItemFormState>({
    ...emptyItem,
    categoryId: siteData.categories[0]?.id ?? '',
    variants: getDefaultVariants(siteData.categories[0]?.id),
  });
  const [itemEditorId, setItemEditorId] = useState<string | 'new' | null>(null);
  const [imageDropActive, setImageDropActive] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState('');

  const commit = (next: SiteData) => {
    onChange({
      ...next,
      updatedAt: new Date().toISOString(),
    });
  };

  const toggleSection = (section: AdminSectionKey) => {
    setOpenSection((current) => (current === section ? null : section));
  };

  const resetCategoryForm = () => {
    setCategoryForm(emptyCategory);
  };

  const resetItemForm = () => {
    setItemForm({
      ...emptyItem,
      categoryId: siteData.categories[0]?.id ?? '',
      variants: getDefaultVariants(siteData.categories[0]?.id),
    });
    setImageDropActive(false);
    setImageLoading(false);
    setImageError('');

    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  const startNewCategory = () => {
    resetCategoryForm();
    setCategoryEditorId('new');
  };

  const startEditCategory = (category: Category) => {
    setCategoryForm(category);
    setCategoryEditorId(category.id);
  };

  const cancelCategoryEdit = () => {
    resetCategoryForm();
    setCategoryEditorId(null);
  };

  const startNewItem = (categoryId?: string) => {
    const resolvedCategoryId = categoryId ?? siteData.categories[0]?.id ?? '';

    setItemForm({
      ...emptyItem,
      categoryId: resolvedCategoryId,
      variants: getDefaultVariants(resolvedCategoryId),
    });
    setItemEditorId('new');
    setImageDropActive(false);
    setImageLoading(false);
    setImageError('');
  };

  const startEditItem = (itemGroup: AdminMenuItemGroup) => {
    setItemForm(mapItemGroupToForm(itemGroup));
    setItemEditorId(itemGroup.id);
    setImageDropActive(false);
    setImageLoading(false);
    setImageError('');
  };

  const cancelItemEdit = () => {
    resetItemForm();
    setItemEditorId(null);
  };

  const updateVariant = (
    index: number,
    updater: (current: ItemVariantFormState) => ItemVariantFormState,
  ) => {
    setItemForm((current) => ({
      ...current,
      variants: current.variants.map((variant, variantIndex) =>
        variantIndex === index ? updater(variant) : variant,
      ),
    }));
  };

  const addVariant = () => {
    const existingLabels = itemForm.variants.map((variant) => normalizeSizeLabel(variant.sizeLabel));
    const nextSuggestedLabel = !existingLabels.includes('Pequena')
      ? 'Pequena'
      : !existingLabels.includes('Media')
        ? 'Media'
        : '';

    setItemForm((current) => ({
      ...current,
      variants: sortVariants([...current.variants, createEmptyVariant(nextSuggestedLabel)]),
    }));
  };

  const removeVariant = (index: number) => {
    setItemForm((current) => {
      if (current.variants.length === 1) {
        return {
          ...current,
          variants: [createEmptyVariant()],
        };
      }

      return {
        ...current,
        variants: current.variants.filter((_, variantIndex) => variantIndex !== index),
      };
    });
  };

  const saveCategory = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextCategory = {
      ...categoryForm,
      id: categoryForm.id || slugify(categoryForm.name),
    };

    const exists = siteData.categories.some((category) => category.id === nextCategory.id);

    commit({
      ...siteData,
      categories: exists
        ? siteData.categories.map((category) =>
            category.id === nextCategory.id ? nextCategory : category,
          )
        : [...siteData.categories, nextCategory],
    });

    resetCategoryForm();
    setCategoryEditorId(null);
  };

  const removeCategory = (categoryId: string) => {
    if (!window.confirm('Deseja remover esta categoria e seus itens?')) {
      return;
    }

    commit({
      ...siteData,
      categories: siteData.categories.filter((category) => category.id !== categoryId),
      menu: siteData.menu.filter((item) => item.categoryId !== categoryId),
    });

    if (categoryForm.id === categoryId) {
      resetCategoryForm();
      setCategoryEditorId(null);
    }

    if (itemForm.categoryId === categoryId) {
      resetItemForm();
      setItemEditorId(null);
    }
  };

  const moveCategory = (categoryId: string, direction: -1 | 1) => {
    const index = siteData.categories.findIndex((category) => category.id === categoryId);
    const nextIndex = index + direction;

    if (index < 0 || nextIndex < 0 || nextIndex >= siteData.categories.length) {
      return;
    }

    const reordered = [...siteData.categories];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(nextIndex, 0, moved);

    commit({
      ...siteData,
      categories: reordered,
    });
  };

  const saveItem = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!itemForm.categoryId || !itemForm.baseName.trim()) {
      return;
    }

    const cleanedBaseName = itemForm.baseName.trim();
    const commonTags = itemForm.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
      .filter((tag) => tag !== 'Pequena' && tag !== 'Media');
    const validVariants = sortVariants(
      itemForm.variants
        .map((variant) => ({
          ...variant,
          sizeLabel: normalizeSizeLabel(variant.sizeLabel),
          price: variant.price.trim(),
        }))
        .filter((variant) => variant.price),
    );

    if (!validVariants.length) {
      window.alert('Adicione pelo menos um tamanho com preco para salvar este item.');
      return;
    }

    const seenSizeLabels = new Set<string>();
    const duplicatedSize = validVariants.find((variant) => {
      const key = normalizeSizeLabel(variant.sizeLabel) || 'unico';

      if (seenSizeLabels.has(key)) {
        return true;
      }

      seenSizeLabels.add(key);
      return false;
    });

    if (duplicatedSize) {
      window.alert('Nao repita o mesmo tamanho no mesmo item.');
      return;
    }

    const nextItems: MenuItem[] = validVariants.map((variant) => {
      const sizeLabel = normalizeSizeLabel(variant.sizeLabel);

      return {
        id: buildVariantId(cleanedBaseName, sizeLabel),
        categoryId: itemForm.categoryId,
        name: buildVariantName(cleanedBaseName, sizeLabel),
        description: itemForm.description,
        price: Number(variant.price.replace(',', '.')),
        image: itemForm.image,
        prepTime: itemForm.prepTime,
        tags: sizeLabel ? [...commonTags, sizeLabel] : commonTags,
        usesGlobalGarnishes: itemForm.usesGlobalGarnishes,
        addonTitle: itemForm.usesGlobalGarnishes ? undefined : itemForm.addonTitle.trim() || undefined,
        addonOptions: itemForm.usesGlobalGarnishes ? undefined : parseAddonOptions(itemForm.addonOptions),
        available: variant.available,
        featured: itemForm.featured,
        dishOfDay: itemForm.dishOfDay,
      };
    });

    const sourceItemIds = itemForm.sourceItemIds;
    const filteredMenu = siteData.menu.filter((item) => !sourceItemIds.includes(item.id));
    const menuBase = itemForm.dishOfDay
      ? filteredMenu.map((item) => ({ ...item, dishOfDay: false }))
      : filteredMenu;

    commit({
      ...siteData,
      menu: [...menuBase, ...nextItems],
    });

    resetItemForm();
    setItemEditorId(null);
  };

  const applyImageFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setImageError('Escolha um arquivo de imagem valido.');
      return;
    }

    setImageLoading(true);
    setImageError('');

    try {
      const itemName = itemForm.baseName || 'item-cardapio';
      const result = await uploadSiteImage(file, 'menu-items', itemName);
      setItemForm((current) => ({ ...current, image: result.url }));
      setImageError(result.warning || '');
    } catch {
      setImageError('Nao foi possivel preparar a imagem. Tente outro arquivo.');
    } finally {
      setImageLoading(false);

      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
    }
  };

  const handleImageInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    void applyImageFile(file);
  };

  const handleImageDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setImageDropActive(false);

    const file = event.dataTransfer.files?.[0];

    if (!file) {
      return;
    }

    void applyImageFile(file);
  };

  const removeItemImage = () => {
    setItemForm((current) => ({ ...current, image: '' }));
    setImageError('');

    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  const removeItem = (itemGroup: AdminMenuItemGroup) => {
    if (!window.confirm('Deseja remover este item do cardapio e todos os tamanhos dele?')) {
      return;
    }

    commit({
      ...siteData,
      menu: siteData.menu.filter((item) => !itemGroup.sourceItemIds.includes(item.id)),
    });

    if (itemForm.groupId === itemGroup.id) {
      resetItemForm();
      setItemEditorId(null);
    }
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setLoginLoading(true);
    let result: { success: boolean; error?: string };

    try {
      result = await onLogin(loginForm.username, loginForm.password);
    } catch {
      setLoginLoading(false);
      setLoginError('Nao foi possivel entrar no painel.');
      return;
    }

    setLoginLoading(false);

    if (!result.success) {
      setLoginError(result.error || 'Nao foi possivel entrar no painel.');
      return;
    }

    setLoginError('');
    setLoginForm({ username: '', password: '' });
  };

  const groupedMenuItems = groupMenuItemsForAdmin(siteData.menu);
  const availableCount = groupedMenuItems.filter((item) =>
    item.variants.some((variant) => variant.available),
  ).length;
  const garnishConfig = siteData.site.garnishConfig ?? {
    title: 'Guarnicoes',
    maxSelections: 2,
    options: [],
  };
  const deliverySummary = `Base ${formatCurrency(siteData.site.deliveryPricing.baseFee)} + ${formatCurrency(
    siteData.site.deliveryPricing.feeStep,
  )} a cada ${siteData.site.deliveryPricing.stepDistanceKm} km`;
  const syncBadgeLabel =
    syncStatus === 'local'
      ? 'Modo local'
      : syncStatus === 'connecting'
        ? 'Conectando'
        : syncStatus === 'saving'
          ? 'Salvando online'
          : syncStatus === 'error'
            ? 'Erro de sincronizacao'
            : 'Sincronizado online';
  const syncDescription =
    authMode === 'supabase'
      ? 'As alteracoes salvas aqui vao para o banco online e aparecem para todos.'
      : 'Sem Supabase configurado, as alteracoes ficam somente neste navegador.';
  const menuGroups = siteData.categories.map((category) => ({
    category,
    items: groupedMenuItems.filter((item) => item.categoryId === category.id),
  }));
  const uncategorizedItems = groupedMenuItems.filter(
    (item) => !siteData.categories.some((category) => category.id === item.categoryId),
  );

  const renderCategoryForm = (submitLabel: string) => (
    <form className="admin-grid two-columns top-gap inline-editor-form" onSubmit={saveCategory}>
      <label className="field">
        <span>Nome</span>
        <input
          value={categoryForm.name}
          onChange={(event) =>
            setCategoryForm((current) => ({ ...current, name: event.target.value }))
          }
          required
        />
      </label>
      <label className="field">
        <span>Descricao</span>
        <input
          value={categoryForm.description}
          onChange={(event) =>
            setCategoryForm((current) => ({
              ...current,
              description: event.target.value,
            }))
          }
          required
        />
      </label>
      <label className="field">
        <span>Icone</span>
        <select
          value={categoryForm.icon}
          onChange={(event) =>
            setCategoryForm((current) => ({
              ...current,
              icon: event.target.value as CategoryIcon,
            }))
          }
        >
          {categoryIcons.map((icon) => (
            <option key={icon} value={icon}>
              {icon}
            </option>
          ))}
        </select>
      </label>
      <div className="field action-row align-end">
        <button type="submit" className="primary-button">
          {submitLabel}
        </button>
        <button type="button" className="secondary-button" onClick={cancelCategoryEdit}>
          Cancelar
        </button>
      </div>
    </form>
  );

  const renderItemForm = (submitLabel: string) => (
    <form className="admin-grid two-columns top-gap inline-editor-form" onSubmit={saveItem}>
      <label className="field">
        <span>Categoria</span>
        <select
          value={itemForm.categoryId}
          onChange={(event) =>
            setItemForm((current) => ({ ...current, categoryId: event.target.value }))
          }
          required
        >
          <option value="" disabled>
            Escolha uma categoria
          </option>
          {siteData.categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Nome</span>
        <input
          value={itemForm.baseName}
          onChange={(event) =>
            setItemForm((current) => ({ ...current, baseName: event.target.value }))
          }
          required
        />
      </label>
      <label className="field full-span">
        <span>Descricao</span>
        <textarea
          rows={3}
          value={itemForm.description}
          onChange={(event) =>
            setItemForm((current) => ({ ...current, description: event.target.value }))
          }
          required
        />
      </label>
      <label className="field full-span">
        <span>Imagem opcional</span>
        <div className="image-upload-field">
          <input
            ref={imageInputRef}
            className="image-upload-input"
            type="file"
            accept="image/*"
            onChange={handleImageInputChange}
          />
          <div
            className={`image-dropzone ${imageDropActive ? 'is-dragging' : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => imageInputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                imageInputRef.current?.click();
              }
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setImageDropActive(true);
            }}
            onDragEnter={(event) => {
              event.preventDefault();
              setImageDropActive(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();

              if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
                return;
              }

              setImageDropActive(false);
            }}
            onDrop={handleImageDrop}
          >
            {itemForm.image ? (
              <div className="image-upload-preview">
                <img
                  src={itemForm.image}
                  alt={`Preview de ${itemForm.baseName || 'imagem do item'}`}
                />
              </div>
            ) : (
              <div className="image-upload-empty">
                <div className="image-upload-empty-icon">
                  <Icon name="image" className="small-icon" />
                </div>
                <strong>Arraste a imagem aqui</strong>
                <p>Ou toque no botao abaixo para escolher na galeria.</p>
              </div>
            )}
          </div>
          <div className="image-upload-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => imageInputRef.current?.click()}
              disabled={imageLoading}
            >
              {imageLoading ? 'Enviando imagem...' : 'Escolher imagem'}
            </button>
            {itemForm.image ? (
              <button type="button" className="ghost-button" onClick={removeItemImage}>
                Remover imagem
              </button>
            ) : null}
          </div>
          <p className="image-upload-note">
            A imagem enviada fica salva no item e aparece no site assim que voce salvar.
          </p>
          <input
            value={itemForm.image}
            onChange={(event) => setItemForm((current) => ({ ...current, image: event.target.value }))}
            placeholder="Ou cole aqui a URL de uma imagem"
          />
          {imageError ? <p className="error-text">{imageError}</p> : null}
        </div>
      </label>
      <div className="field full-span">
        <span>Tamanhos e precos</span>
        <div className="admin-size-list">
          {itemForm.variants.map((variant, index) => (
            <div key={`${variant.id ?? 'novo'}-${index}`} className="admin-size-row">
              <label className="field">
                <span>Tamanho</span>
                <select
                  value={normalizeSizeLabel(variant.sizeLabel) || 'unico'}
                  onChange={(event) =>
                    updateVariant(index, (current) => ({
                      ...current,
                      sizeLabel: event.target.value === 'unico' ? '' : event.target.value,
                    }))
                  }
                >
                  <option value="unico">Item unico</option>
                  <option value="Pequena">Pequena</option>
                  <option value="Media">Media</option>
                </select>
              </label>
              <label className="field">
                <span>Preco</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={variant.price}
                  onChange={(event) =>
                    updateVariant(index, (current) => ({
                      ...current,
                      price: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="toggle-option admin-size-toggle">
                <input
                  type="checkbox"
                  checked={variant.available}
                  onChange={(event) =>
                    updateVariant(index, (current) => ({
                      ...current,
                      available: event.target.checked,
                    }))
                  }
                />
                <span>Disponivel</span>
              </label>
              <button
                type="button"
                className="ghost-button danger-button"
                onClick={() => removeVariant(index)}
                disabled={itemForm.variants.length === 1}
              >
                Remover tamanho
              </button>
            </div>
          ))}
        </div>
        <div className="action-row top-gap">
          <button type="button" className="secondary-button" onClick={addVariant}>
            Adicionar tamanho
          </button>
        </div>
      </div>
      <label className="field">
        <span>Tempo de preparo</span>
        <input
          value={itemForm.prepTime}
          onChange={(event) =>
            setItemForm((current) => ({ ...current, prepTime: event.target.value }))
          }
          required
        />
      </label>
      <label className="field">
        <span>Tags</span>
        <input
          value={itemForm.tags}
          onChange={(event) => setItemForm((current) => ({ ...current, tags: event.target.value }))}
        />
      </label>
      <div className="toggle-group full-span">
        <label className="toggle-option">
          <input
            type="checkbox"
            checked={itemForm.featured}
            onChange={(event) =>
              setItemForm((current) => ({ ...current, featured: event.target.checked }))
            }
          />
          <span>Destaque</span>
        </label>
        <label className="toggle-option">
          <input
            type="checkbox"
            checked={itemForm.usesGlobalGarnishes}
            onChange={(event) =>
              setItemForm((current) => ({
                ...current,
                usesGlobalGarnishes: event.target.checked,
              }))
            }
          />
          <span>Usa guarnicoes globais</span>
        </label>
        <label className="toggle-option">
          <input
            type="checkbox"
            checked={itemForm.dishOfDay}
            onChange={(event) =>
              setItemForm((current) => ({ ...current, dishOfDay: event.target.checked }))
            }
          />
          <span>Prato do dia</span>
        </label>
      </div>
      {itemForm.usesGlobalGarnishes ? (
        <div className="admin-inline-empty full-span">
          Este item usa as guarnicoes globais definidas em Configuracoes. Se desmarcar, voce pode cadastrar adicionais proprios abaixo.
        </div>
      ) : (
        <>
          <label className="field">
            <span>Titulo dos adicionais</span>
            <input
              value={itemForm.addonTitle}
              onChange={(event) =>
                setItemForm((current) => ({ ...current, addonTitle: event.target.value }))
              }
              placeholder="Ex.: Adicionais"
            />
          </label>
          <label className="field full-span">
            <span>Adicionais do item</span>
            <textarea
              rows={4}
              value={itemForm.addonOptions}
              onChange={(event) =>
                setItemForm((current) => ({ ...current, addonOptions: event.target.value }))
              }
              placeholder="Um por linha: Nome: 4.50"
            />
          </label>
        </>
      )}
      <div className="field action-row full-span">
        <button type="submit" className="primary-button" disabled={!siteData.categories.length}>
          {submitLabel}
        </button>
        <button type="button" className="secondary-button" onClick={cancelItemEdit}>
          Cancelar
        </button>
      </div>
    </form>
  );

  return (
    <div className="admin-page-shell">
      <div className="admin-page-frame">
        <div className="admin-page-header">
          <div>
            <p className="eyebrow">Painel administrativo</p>
            <h1>Gerencie cardapio, pedidos e operacao em uma pagina dedicada</h1>
            <p className="admin-page-subtitle">
              O WhatsApp continua sendo usado no atendimento, mas os pedidos agora podem ficar
              salvos aqui para acompanhamento da marmitaria.
            </p>
          </div>
          <button type="button" className="secondary-button" onClick={onNavigateHome}>
            Voltar ao site
          </button>
        </div>

        <div className="admin-panel admin-page-panel">

        {!authenticated ? (
          <div className="admin-login-card">
            <div className="login-badge">
              <Icon name="lock" className="section-icon" />
              <span>Acesso restrito</span>
            </div>
            <h3>Faca login para editar a Marmitas da Nida</h3>
            <p>
              {authMode === 'supabase'
                ? 'Use o email e a senha cadastrados no Supabase Auth para publicar alteracoes para todos.'
                : (
                    <>
                      Credenciais iniciais do projeto: <strong>admin</strong> /{' '}
                      <strong>nida123</strong>.
                    </>
                  )}
            </p>
            <form className="admin-grid" onSubmit={handleLogin}>
              <label className="field">
                <span>{authMode === 'supabase' ? 'Email' : 'Login'}</span>
                <input
                  value={loginForm.username}
                  onChange={(event) =>
                    setLoginForm((current) => ({ ...current, username: event.target.value }))
                  }
                  type={authMode === 'supabase' ? 'email' : 'text'}
                  required
                />
              </label>
              <label className="field">
                <span>Senha</span>
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(event) =>
                    setLoginForm((current) => ({ ...current, password: event.target.value }))
                  }
                  required
                />
              </label>
              {loginError ? <p className="error-text">{loginError}</p> : null}
              {authMode === 'supabase' && syncStatus === 'error' ? (
                <p className="error-text">
                  {syncError || 'Configure o Supabase para habilitar o painel online.'}
                </p>
              ) : null}
              <button type="submit" className="primary-button wide-button" disabled={loginLoading}>
                {loginLoading ? 'Entrando...' : 'Entrar'}
              </button>
            </form>
          </div>
        ) : (
          <>
            <div className="admin-panel-toolbar">
              <div className="admin-toolbar-copy">
                <span className="pill-label">{syncBadgeLabel}</span>
                <strong>Edite um topico por vez e salve direto no mesmo bloco.</strong>
                <p>{syncDescription}</p>
                {adminUserEmail ? <p>Logado como {adminUserEmail}.</p> : null}
                {syncStatus === 'error' && syncError ? <p className="error-text">{syncError}</p> : null}
              </div>
              <button type="button" className="secondary-button" onClick={() => void onLogout()}>
                Sair
              </button>
            </div>

            <div className="admin-content">
              <div className="stats-grid admin-stats-grid">
                <article className="stat-card">
                  <span>Itens disponiveis</span>
                  <strong>{availableCount}</strong>
                </article>
                <article className="stat-card">
                  <span>Categorias</span>
                  <strong>{siteData.categories.length}</strong>
                </article>
              </div>

              <div className="admin-section-list">
                <AdminDrawerSection
                  sectionKey="orders"
                  openSection={openSection}
                  onToggle={toggleSection}
                  icon="cart"
                  eyebrow="Pedidos"
                  title="Painel de pedidos da marmitaria"
                  summary="Veja tudo o que entrou no site, acompanhe o andamento e altere o status sem sair desta pagina."
                  meta={`${orders.length} pedido(s) salvo(s) no sistema`}
                >
                  <section className="admin-section">
                    <div className="admin-card">
                      <div className="admin-card-header">
                        <div className="admin-section-heading">
                          <h3>Central de pedidos</h3>
                          <p>
                            Todo pedido finalizado continua indo para o WhatsApp, mas tambem fica
                            salvo aqui para a equipe visualizar, organizar e mudar o andamento.
                          </p>
                        </div>
                      </div>
                      <AdminOrdersManager
                        orders={orders}
                        loading={ordersLoading}
                        error={ordersError}
                        onRefresh={onRefreshOrders}
                        onStatusChange={onUpdateOrderStatus}
                      />
                    </div>
                  </section>
                </AdminDrawerSection>

                <AdminDrawerSection
                  sectionKey="home"
                  openSection={openSection}
                  onToggle={toggleSection}
                  icon="sparkles"
                  eyebrow="Home"
                  title="Textos e banner principal"
                  summary={siteData.home.heroTitle}
                  meta={`${siteData.home.highlights.length} destaques rapidos cadastrados`}
                >
                  <section className="admin-section">
                    <div className="admin-card">
                      <h3>Textos e banner da home</h3>
                      <div className="admin-grid two-columns">
                        <label className="field">
                          <span>Titulo principal</span>
                          <textarea
                            rows={3}
                            value={siteData.home.heroTitle}
                            onChange={(event) =>
                              commit({
                                ...siteData,
                                home: { ...siteData.home, heroTitle: event.target.value },
                              })
                            }
                          />
                        </label>
                        <label className="field">
                          <span>Subtitulo</span>
                          <textarea
                            rows={3}
                            value={siteData.home.heroSubtitle}
                            onChange={(event) =>
                              commit({
                                ...siteData,
                                home: { ...siteData.home, heroSubtitle: event.target.value },
                              })
                            }
                          />
                        </label>
                        <label className="field">
                          <span>Texto de apoio</span>
                          <input
                            value={siteData.home.heroNote}
                            onChange={(event) =>
                              commit({
                                ...siteData,
                                home: { ...siteData.home, heroNote: event.target.value },
                              })
                            }
                          />
                        </label>
                        <label className="field">
                          <span>Imagem do banner</span>
                          <input
                            value={siteData.home.bannerImage}
                            onChange={(event) =>
                              commit({
                                ...siteData,
                                home: { ...siteData.home, bannerImage: event.target.value },
                              })
                            }
                          />
                        </label>
                        <label className="field">
                          <span>Selo do banner</span>
                          <input
                            value={siteData.home.bannerLabel}
                            onChange={(event) =>
                              commit({
                                ...siteData,
                                home: { ...siteData.home, bannerLabel: event.target.value },
                              })
                            }
                          />
                        </label>
                        <label className="field">
                          <span>Titulo do banner</span>
                          <input
                            value={siteData.home.bannerTitle}
                            onChange={(event) =>
                              commit({
                                ...siteData,
                                home: { ...siteData.home, bannerTitle: event.target.value },
                              })
                            }
                          />
                        </label>
                        <label className="field full-span">
                          <span>Texto do banner</span>
                          <textarea
                            rows={3}
                            value={siteData.home.bannerText}
                            onChange={(event) =>
                              commit({
                                ...siteData,
                                home: { ...siteData.home, bannerText: event.target.value },
                              })
                            }
                          />
                        </label>
                        <label className="field">
                          <span>Titulo da promocao</span>
                          <input
                            value={siteData.home.promoTitle}
                            onChange={(event) =>
                              commit({
                                ...siteData,
                                home: { ...siteData.home, promoTitle: event.target.value },
                              })
                            }
                          />
                        </label>
                        <label className="field">
                          <span>Texto da promocao</span>
                          <textarea
                            rows={3}
                            value={siteData.home.promoText}
                            onChange={(event) =>
                              commit({
                                ...siteData,
                                home: { ...siteData.home, promoText: event.target.value },
                              })
                            }
                          />
                        </label>
                        <label className="field full-span">
                          <span>Destaques rapidos</span>
                          <input
                            value={siteData.home.highlights.join(', ')}
                            onChange={(event) =>
                              commit({
                                ...siteData,
                                home: {
                                  ...siteData.home,
                                  highlights: event.target.value
                                    .split(',')
                                    .map((item) => item.trim())
                                    .filter(Boolean),
                                },
                              })
                            }
                          />
                        </label>
                      </div>
                    </div>
                  </section>
                </AdminDrawerSection>
                <AdminDrawerSection
                  sectionKey="menu"
                  openSection={openSection}
                  onToggle={toggleSection}
                  icon="plate"
                  eyebrow="Cardapio"
                  title="Categorias e itens do cardapio"
                  summary={`${siteData.categories.length} categorias e ${groupedMenuItems.length} itens cadastrados`}
                  meta="Tudo abre e edita no mesmo lugar da lista."
                >
                  <section className="admin-section">
                    <div className="admin-card">
                      <div className="admin-card-header">
                        <div className="admin-section-heading">
                          <h3>Categorias</h3>
                          <p>As categorias ficam todas nesta lista e cada edicao abre no proprio bloco.</p>
                        </div>
                        <button type="button" className="secondary-button" onClick={startNewCategory}>
                          Nova categoria
                        </button>
                      </div>

                      {categoryEditorId === 'new' ? (
                        <div className="inline-edit-card top-gap">
                          <div className="inline-edit-header">
                            <strong>Nova categoria</strong>
                            <p>Crie uma nova gaveta do cardapio sem sair desta area.</p>
                          </div>
                          {renderCategoryForm('Adicionar categoria')}
                        </div>
                      ) : null}

                      <div className="stack-list top-gap">
                        {siteData.categories.map((category, index) => (
                          <div
                            key={category.id}
                            className={`admin-row-card ${categoryEditorId === category.id ? 'is-editing' : ''}`}
                          >
                            <div className="admin-inline-block">
                              <div className="row-main">
                                <div className="category-badge">
                                  <Icon name={category.icon} className="small-icon" />
                                </div>
                                <div>
                                  <strong>{category.name}</strong>
                                  <p>{category.description}</p>
                                </div>
                              </div>
                              <div className="row-actions">
                                <button
                                  type="button"
                                  className="ghost-button"
                                  onClick={() => moveCategory(category.id, -1)}
                                  disabled={index === 0}
                                >
                                  Subir
                                </button>
                                <button
                                  type="button"
                                  className="ghost-button"
                                  onClick={() => moveCategory(category.id, 1)}
                                  disabled={index === siteData.categories.length - 1}
                                >
                                  Descer
                                </button>
                                <button
                                  type="button"
                                  className="ghost-button"
                                  onClick={() => startEditCategory(category)}
                                >
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  className="ghost-button danger-button"
                                  onClick={() => removeCategory(category.id)}
                                >
                                  Remover
                                </button>
                              </div>
                            </div>

                            {categoryEditorId === category.id ? (
                              <div className="inline-edit-card">
                                <div className="inline-edit-header">
                                  <strong>Editando categoria</strong>
                                  <p>As alteracoes feitas aqui substituem esta categoria na hora.</p>
                                </div>
                                {renderCategoryForm('Salvar categoria')}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="admin-card">
                      <div className="admin-card-header">
                        <div className="admin-section-heading">
                          <h3>Itens do cardapio</h3>
                          <p>
                            Os itens ficam agrupados por categoria para voce encontrar e editar tudo no
                            proprio lugar.
                          </p>
                        </div>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => startNewItem(siteData.categories[0]?.id)}
                          disabled={!siteData.categories.length}
                        >
                          Novo item
                        </button>
                      </div>

                      {!siteData.categories.length ? (
                        <div className="inline-edit-card top-gap">
                          <div className="inline-edit-header">
                            <strong>Crie uma categoria primeiro</strong>
                            <p>O novo item precisa de uma categoria para aparecer no cardapio.</p>
                          </div>
                        </div>
                      ) : null}

                      <div className="stack-list top-gap">
                        {menuGroups.map(({ category, items }) => (
                          <section key={category.id} className="admin-group-card">
                            <div className="admin-group-header">
                              <div className="admin-group-copy">
                                <div className="category-badge">
                                  <Icon name={category.icon} className="small-icon" />
                                  <span>{category.name}</span>
                                </div>
                                <p>{items.length} item(ns) nesta categoria</p>
                              </div>
                              <button
                                type="button"
                                className="ghost-button"
                                onClick={() => startNewItem(category.id)}
                              >
                                Novo item nesta categoria
                              </button>
                            </div>

                            {itemEditorId === 'new' && itemForm.categoryId === category.id ? (
                              <div className="inline-edit-card top-gap">
                                <div className="inline-edit-header">
                                  <strong>Novo item do cardapio</strong>
                                  <p>Preencha os campos abaixo e o novo item entra nesta categoria.</p>
                                </div>
                                {renderItemForm('Adicionar item')}
                              </div>
                            ) : null}

                            <div className="menu-admin-grid">
                              {items.map((item) => (
                                <article
                                  key={item.id}
                                  className={`menu-admin-card ${itemEditorId === item.id ? 'is-editing' : ''}`}
                                >
                                  {item.image ? (
                                    <img src={item.image} alt={item.baseName} />
                                  ) : (
                                    <div className="menu-admin-image-placeholder">Sem imagem</div>
                                  )}
                                  <div>
                                    <div className="menu-admin-header">
                                      <strong>{item.baseName}</strong>
                                      <span>{getGroupPriceRangeLabel(item)}</span>
                                    </div>
                                    <p>{item.description}</p>
                                    <div className="chip-row">
                                      {item.variants.map((variant) => (
                                        <span key={`${item.id}-${variant.sizeLabel || 'unico'}`} className="mini-chip muted-chip">
                                          {normalizeSizeLabel(variant.sizeLabel) || 'Item unico'}:{' '}
                                          {formatCurrency(Number(variant.price.replace(',', '.')) || 0)}
                                        </span>
                                      ))}
                                    </div>
                                    <div className="chip-row">
                                      <span
                                        className={`mini-chip ${
                                          item.variants.some((variant) => variant.available)
                                            ? 'success-chip'
                                            : 'muted-chip'
                                        }`}
                                      >
                                        {item.variants.some((variant) => variant.available)
                                          ? 'Disponivel'
                                          : 'Indisponivel'}
                                      </span>
                                      {item.usesGlobalGarnishes ? (
                                        <span className="mini-chip muted-chip">Guarnicao global</span>
                                      ) : null}
                                      {item.dishOfDay ? (
                                        <span className="mini-chip accent-chip">Prato do dia</span>
                                      ) : null}
                                      {item.featured ? (
                                        <span className="mini-chip accent-chip">Destaque</span>
                                      ) : null}
                                    </div>
                                  </div>
                                  <div className="row-actions">
                                    <button
                                      type="button"
                                      className="ghost-button"
                                      onClick={() => startEditItem(item)}
                                    >
                                      Editar
                                    </button>
                                    <button
                                      type="button"
                                      className="ghost-button danger-button"
                                      onClick={() => removeItem(item)}
                                    >
                                      Remover
                                    </button>
                                  </div>

                                  {itemEditorId === item.id ? (
                                    <div className="inline-edit-card">
                                      <div className="inline-edit-header">
                                        <strong>Editando item</strong>
                                        <p>As opcoes deste prato abrem no mesmo card para facilitar a edicao.</p>
                                      </div>
                                      {renderItemForm('Salvar item')}
                                    </div>
                                  ) : null}
                                </article>
                              ))}
                            </div>

                            {!items.length ? (
                              <div className="admin-inline-empty">
                                Nenhum item cadastrado nesta categoria ainda.
                              </div>
                            ) : null}
                          </section>
                        ))}

                        {uncategorizedItems.length ? (
                          <section className="admin-group-card">
                            <div className="admin-group-header">
                              <div className="admin-group-copy">
                                <div className="category-badge">
                                  <Icon name="plus" className="small-icon" />
                                  <span>Sem categoria</span>
                                </div>
                                <p>Itens antigos ou sem categoria vinculada.</p>
                              </div>
                            </div>

                            <div className="menu-admin-grid">
                              {uncategorizedItems.map((item) => (
                                <article
                                  key={item.id}
                                  className={`menu-admin-card ${itemEditorId === item.id ? 'is-editing' : ''}`}
                                >
                                  {item.image ? (
                                    <img src={item.image} alt={item.baseName} />
                                  ) : (
                                    <div className="menu-admin-image-placeholder">Sem imagem</div>
                                  )}
                                  <div>
                                    <div className="menu-admin-header">
                                      <strong>{item.baseName}</strong>
                                      <span>{getGroupPriceRangeLabel(item)}</span>
                                    </div>
                                    <p>{item.description}</p>
                                    <div className="chip-row">
                                      {item.variants.map((variant) => (
                                        <span key={`${item.id}-${variant.sizeLabel || 'unico'}`} className="mini-chip muted-chip">
                                          {normalizeSizeLabel(variant.sizeLabel) || 'Item unico'}:{' '}
                                          {formatCurrency(Number(variant.price.replace(',', '.')) || 0)}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                  <div className="row-actions">
                                    <button
                                      type="button"
                                      className="ghost-button"
                                      onClick={() => startEditItem(item)}
                                    >
                                      Editar
                                    </button>
                                    <button
                                      type="button"
                                      className="ghost-button danger-button"
                                      onClick={() => removeItem(item)}
                                    >
                                      Remover
                                    </button>
                                  </div>

                                  {itemEditorId === item.id ? (
                                    <div className="inline-edit-card">
                                      <div className="inline-edit-header">
                                        <strong>Editando item sem categoria</strong>
                                        <p>Escolha uma categoria e salve para organizar este prato.</p>
                                      </div>
                                      {renderItemForm('Salvar item')}
                                    </div>
                                  ) : null}
                                </article>
                              ))}
                            </div>
                          </section>
                        ) : null}
                      </div>
                    </div>
                  </section>
                </AdminDrawerSection>
                <AdminDrawerSection
                  sectionKey="settings"
                  openSection={openSection}
                  onToggle={toggleSection}
                  icon="lock"
                  eyebrow="Configuracoes"
                  title="Contato, horario, entrega e acesso"
                  summary={`${siteData.site.businessName} - ${siteData.site.phone}`}
                  meta={deliverySummary}
                >
                  <section className="admin-section">
                    <div className="admin-card">
                      <h3>Informacoes da marmitaria</h3>
                      <div className="admin-grid two-columns">
                        <label className="field">
                          <span>Nome</span>
                          <input
                            value={siteData.site.businessName}
                            onChange={(event) =>
                              commit({
                                ...siteData,
                                site: { ...siteData.site, businessName: event.target.value },
                              })
                            }
                          />
                        </label>
                        <label className="field">
                          <span>Slogan</span>
                          <input
                            value={siteData.site.tagline}
                            onChange={(event) =>
                              commit({
                                ...siteData,
                                site: { ...siteData.site, tagline: event.target.value },
                              })
                            }
                          />
                        </label>
                        <label className="field">
                          <span>WhatsApp</span>
                          <input
                            value={siteData.site.whatsappNumber}
                            onChange={(event) =>
                              commit({
                                ...siteData,
                                site: { ...siteData.site, whatsappNumber: event.target.value },
                              })
                            }
                          />
                        </label>
                        <label className="field">
                          <span>Telefone</span>
                          <input
                            value={siteData.site.phone}
                            onChange={(event) =>
                              commit({
                                ...siteData,
                                site: { ...siteData.site, phone: event.target.value },
                              })
                            }
                          />
                        </label>
                        <label className="field">
                          <span>Endereco</span>
                          <input
                            value={siteData.site.address}
                            onChange={(event) =>
                              commit({
                                ...siteData,
                                site: { ...siteData.site, address: event.target.value },
                              })
                            }
                          />
                        </label>
                        <label className="field">
                          <span>Aviso de taxa</span>
                          <input
                            value={siteData.site.deliveryNotice}
                            onChange={(event) =>
                              commit({
                                ...siteData,
                                site: { ...siteData.site, deliveryNotice: event.target.value },
                              })
                            }
                          />
                        </label>
                        <label className="field">
                          <span>Instagram</span>
                          <input
                            value={siteData.site.instagram}
                            onChange={(event) =>
                              commit({
                                ...siteData,
                                site: { ...siteData.site, instagram: event.target.value },
                              })
                            }
                          />
                        </label>
                        <label className="field">
                          <span>Facebook</span>
                          <input
                            value={siteData.site.facebook}
                            onChange={(event) =>
                              commit({
                                ...siteData,
                                site: { ...siteData.site, facebook: event.target.value },
                              })
                            }
                          />
                        </label>
                      </div>
                    </div>

                    <div className="admin-card">
                      <h3>Guarnicoes globais</h3>
                      <p>
                        Edite aqui uma vez so. Todos os itens marcados com guarnicoes globais passam a usar estas opcoes.
                      </p>
                      <div className="admin-grid two-columns">
                        <label className="field">
                          <span>Titulo</span>
                          <input
                            value={garnishConfig.title}
                            onChange={(event) =>
                              commit({
                                ...siteData,
                                site: {
                                  ...siteData.site,
                                  garnishConfig: {
                                    ...garnishConfig,
                                    title: event.target.value,
                                  },
                                },
                              })
                            }
                          />
                        </label>
                        <label className="field">
                          <span>Maximo de escolhas</span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={garnishConfig.maxSelections}
                            onChange={(event) =>
                              commit({
                                ...siteData,
                                site: {
                                  ...siteData.site,
                                  garnishConfig: {
                                    ...garnishConfig,
                                    maxSelections: Number(event.target.value),
                                  },
                                },
                              })
                            }
                          />
                        </label>
                        <label className="field full-span">
                          <span>Opcoes de guarnicao</span>
                          <textarea
                            rows={4}
                            value={formatAddonOptions(garnishConfig.options)}
                            onChange={(event) =>
                              commit({
                                ...siteData,
                                site: {
                                  ...siteData.site,
                                  garnishConfig: {
                                    ...garnishConfig,
                                    options: parseAddonOptions(event.target.value),
                                  },
                                },
                              })
                            }
                            placeholder="Um por linha: Farofa: 0.00"
                          />
                        </label>
                      </div>
                    </div>

                    <div className="admin-card">
                      <h3>Horarios de funcionamento</h3>
                      <div className="stack-list">
                        {siteData.site.hours.map((hour) => (
                          <div key={hour.day} className="hours-row admin-hours-row">
                            <label className="toggle-option">
                              <input
                                type="checkbox"
                                checked={hour.enabled}
                                onChange={(event) =>
                                  commit({
                                    ...siteData,
                                    site: {
                                      ...siteData.site,
                                      hours: siteData.site.hours.map((item) =>
                                        item.day === hour.day
                                          ? { ...item, enabled: event.target.checked }
                                          : item,
                                      ),
                                    },
                                  })
                                }
                              />
                              <span>{hour.label}</span>
                            </label>
                            <div className="admin-hours-inputs">
                              <input
                                type="time"
                                value={hour.open}
                                onChange={(event) =>
                                  commit({
                                    ...siteData,
                                    site: {
                                      ...siteData.site,
                                      hours: siteData.site.hours.map((item) =>
                                        item.day === hour.day ? { ...item, open: event.target.value } : item,
                                      ),
                                    },
                                  })
                                }
                              />
                              <input
                                type="time"
                                value={hour.close}
                                onChange={(event) =>
                                  commit({
                                    ...siteData,
                                    site: {
                                      ...siteData.site,
                                      hours: siteData.site.hours.map((item) =>
                                        item.day === hour.day ? { ...item, close: event.target.value } : item,
                                      ),
                                    },
                                  })
                                }
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="admin-card">
                      <h3>Taxa por distancia</h3>
                      <p>
                        Regra atual: taxa base e acrescimo automatico a cada faixa de quilometragem.
                      </p>
                      <div className="admin-grid two-columns">
                        <label className="field">
                          <span>Taxa inicial</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={siteData.site.deliveryPricing.baseFee}
                            onChange={(event) =>
                              commit({
                                ...siteData,
                                site: {
                                  ...siteData.site,
                                  deliveryPricing: {
                                    ...siteData.site.deliveryPricing,
                                    baseFee: Number(event.target.value),
                                  },
                                },
                              })
                            }
                          />
                        </label>
                        <label className="field">
                          <span>Acrescimo por faixa</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={siteData.site.deliveryPricing.feeStep}
                            onChange={(event) =>
                              commit({
                                ...siteData,
                                site: {
                                  ...siteData.site,
                                  deliveryPricing: {
                                    ...siteData.site.deliveryPricing,
                                    feeStep: Number(event.target.value),
                                  },
                                },
                              })
                            }
                          />
                        </label>
                        <label className="field">
                          <span>Faixa em km</span>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={siteData.site.deliveryPricing.stepDistanceKm}
                            onChange={(event) =>
                              commit({
                                ...siteData,
                                site: {
                                  ...siteData.site,
                                  deliveryPricing: {
                                    ...siteData.site.deliveryPricing,
                                    stepDistanceKm: Number(event.target.value),
                                  },
                                },
                              })
                            }
                          />
                        </label>
                        <label className="field">
                          <span>Tempo base (min)</span>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={siteData.site.deliveryPricing.baseEtaMinutes}
                            onChange={(event) =>
                              commit({
                                ...siteData,
                                site: {
                                  ...siteData.site,
                                  deliveryPricing: {
                                    ...siteData.site.deliveryPricing,
                                    baseEtaMinutes: Number(event.target.value),
                                  },
                                },
                              })
                            }
                          />
                        </label>
                        <label className="field">
                          <span>Acrescimo de tempo</span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={siteData.site.deliveryPricing.etaStepMinutes}
                            onChange={(event) =>
                              commit({
                                ...siteData,
                                site: {
                                  ...siteData.site,
                                  deliveryPricing: {
                                    ...siteData.site.deliveryPricing,
                                    etaStepMinutes: Number(event.target.value),
                                  },
                                },
                              })
                            }
                          />
                        </label>
                        <label className="field">
                          <span>Latitude da marmitaria</span>
                          <input
                            type="number"
                            step="0.0000001"
                            value={siteData.site.restaurantLocation.coordinates.lat}
                            onChange={(event) =>
                              commit({
                                ...siteData,
                                site: {
                                  ...siteData.site,
                                  restaurantLocation: {
                                    ...siteData.site.restaurantLocation,
                                    coordinates: {
                                      ...siteData.site.restaurantLocation.coordinates,
                                      lat: Number(event.target.value),
                                    },
                                  },
                                },
                              })
                            }
                          />
                        </label>
                        <label className="field">
                          <span>Longitude da marmitaria</span>
                          <input
                            type="number"
                            step="0.0000001"
                            value={siteData.site.restaurantLocation.coordinates.lon}
                            onChange={(event) =>
                              commit({
                                ...siteData,
                                site: {
                                  ...siteData.site,
                                  restaurantLocation: {
                                    ...siteData.site.restaurantLocation,
                                    coordinates: {
                                      ...siteData.site.restaurantLocation.coordinates,
                                      lon: Number(event.target.value),
                                    },
                                  },
                                },
                              })
                            }
                          />
                        </label>
                      </div>
                    </div>

                    {authMode === 'local' ? (
                      <div className="admin-card">
                        <h3>Acesso ao painel</h3>
                        <div className="admin-grid two-columns">
                          <label className="field">
                            <span>Login</span>
                            <input
                              value={siteData.site.adminCredentials.username}
                              onChange={(event) =>
                                commit({
                                  ...siteData,
                                  site: {
                                    ...siteData.site,
                                    adminCredentials: {
                                      ...siteData.site.adminCredentials,
                                      username: event.target.value,
                                    },
                                  },
                                })
                              }
                            />
                          </label>
                          <label className="field">
                            <span>Senha</span>
                            <input
                              value={siteData.site.adminCredentials.password}
                              onChange={(event) =>
                                commit({
                                  ...siteData,
                                  site: {
                                    ...siteData.site,
                                    adminCredentials: {
                                      ...siteData.site.adminCredentials,
                                      password: event.target.value,
                                    },
                                  },
                                })
                              }
                            />
                          </label>
                        </div>
                      </div>
                    ) : (
                      <div className="admin-card">
                        <h3>Acesso ao painel</h3>
                        <p>
                          O acesso online agora e controlado pelo Supabase Auth. Crie ou convide os
                          administradores pelo painel do Supabase para publicar alteracoes para todos.
                        </p>
                      </div>
                    )}
                  </section>
                </AdminDrawerSection>
              </div>
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  );
}
