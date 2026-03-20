import { FormEvent, ReactNode, useState } from 'react';
import { Category, CategoryIcon, MenuItem, SiteData } from '../types';
import { formatCurrency, slugify } from '../utils/format';
import { Icon, IconName } from './Icon';

type AdminPanelProps = {
  open: boolean;
  authenticated: boolean;
  onClose: () => void;
  onLogin: (username: string, password: string) => boolean;
  onLogout: () => void;
  siteData: SiteData;
  onChange: (next: SiteData) => void;
};

type AdminSectionKey = 'overview' | 'home' | 'menu' | 'settings';

type ItemFormState = {
  id: string | null;
  categoryId: string;
  name: string;
  description: string;
  price: string;
  image: string;
  prepTime: string;
  tags: string;
  addonTitle: string;
  addonOptions: string;
  available: boolean;
  featured: boolean;
  dishOfDay: boolean;
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

const emptyItem: ItemFormState = {
  id: null,
  categoryId: '',
  name: '',
  description: '',
  price: '',
  image: '',
  prepTime: '',
  tags: '',
  addonTitle: '',
  addonOptions: '',
  available: true,
  featured: false,
  dishOfDay: false,
};

function mapItemToForm(item: MenuItem): ItemFormState {
  return {
    id: item.id,
    categoryId: item.categoryId,
    name: item.name,
    description: item.description,
    price: String(item.price),
    image: item.image,
    prepTime: item.prepTime,
    tags: item.tags.join(', '),
    addonTitle: item.addonTitle ?? '',
    addonOptions:
      item.addonOptions?.map((option) => `${option.name}: ${option.price.toFixed(2)}`).join('\n') ??
      '',
    available: item.available,
    featured: item.featured,
    dishOfDay: item.dishOfDay,
  };
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
  open,
  authenticated,
  onClose,
  onLogin,
  onLogout,
  siteData,
  onChange,
}: AdminPanelProps) {
  const [openSection, setOpenSection] = useState<AdminSectionKey | null>('overview');
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [categoryForm, setCategoryForm] = useState<Category>(emptyCategory);
  const [categoryEditorId, setCategoryEditorId] = useState<string | 'new' | null>(null);
  const [itemForm, setItemForm] = useState<ItemFormState>({
    ...emptyItem,
    categoryId: siteData.categories[0]?.id ?? '',
  });
  const [itemEditorId, setItemEditorId] = useState<string | 'new' | null>(null);

  if (!open) {
    return null;
  }

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
    });
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
    setItemForm({
      ...emptyItem,
      categoryId: categoryId ?? siteData.categories[0]?.id ?? '',
    });
    setItemEditorId('new');
  };

  const startEditItem = (item: MenuItem) => {
    setItemForm(mapItemToForm(item));
    setItemEditorId(item.id);
  };

  const cancelItemEdit = () => {
    resetItemForm();
    setItemEditorId(null);
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

    if (!itemForm.categoryId) {
      return;
    }

    const nextItem: MenuItem = {
      id: itemForm.id || slugify(itemForm.name),
      categoryId: itemForm.categoryId,
      name: itemForm.name,
      description: itemForm.description,
      price: Number(itemForm.price.replace(',', '.')),
      image: itemForm.image,
      prepTime: itemForm.prepTime,
      tags: itemForm.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      addonTitle: itemForm.addonTitle.trim() || undefined,
      addonOptions: parseAddonOptions(itemForm.addonOptions),
      available: itemForm.available,
      featured: itemForm.featured,
      dishOfDay: itemForm.dishOfDay,
    };

    const menuBase = nextItem.dishOfDay
      ? siteData.menu.map((item) => ({ ...item, dishOfDay: false }))
      : siteData.menu;
    const exists = menuBase.some((item) => item.id === nextItem.id);

    commit({
      ...siteData,
      menu: exists
        ? menuBase.map((item) => (item.id === nextItem.id ? nextItem : item))
        : [...menuBase, nextItem],
    });

    resetItemForm();
    setItemEditorId(null);
  };

  const removeItem = (itemId: string) => {
    if (!window.confirm('Deseja remover este item do cardapio?')) {
      return;
    }

    commit({
      ...siteData,
      menu: siteData.menu.filter((item) => item.id !== itemId),
    });

    if (itemForm.id === itemId) {
      resetItemForm();
      setItemEditorId(null);
    }
  };

  const handleLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!onLogin(loginForm.username, loginForm.password)) {
      setLoginError('Login ou senha incorretos.');
      return;
    }

    setLoginError('');
    setLoginForm({ username: '', password: '' });
  };

  const availableCount = siteData.menu.filter((item) => item.available).length;
  const dishOfDay = siteData.menu.find((item) => item.dishOfDay)?.name ?? 'Nao definido';
  const deliverySummary = `Base ${formatCurrency(siteData.site.deliveryPricing.baseFee)} + ${formatCurrency(
    siteData.site.deliveryPricing.feeStep,
  )} a cada ${siteData.site.deliveryPricing.stepDistanceKm} km`;
  const menuGroups = siteData.categories.map((category) => ({
    category,
    items: siteData.menu.filter((item) => item.categoryId === category.id),
  }));
  const uncategorizedItems = siteData.menu.filter(
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
          value={itemForm.name}
          onChange={(event) => setItemForm((current) => ({ ...current, name: event.target.value }))}
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
      <label className="field">
        <span>Preco</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={itemForm.price}
          onChange={(event) => setItemForm((current) => ({ ...current, price: event.target.value }))}
          required
        />
      </label>
      <label className="field">
        <span>Imagem opcional</span>
        <input
          value={itemForm.image}
          onChange={(event) => setItemForm((current) => ({ ...current, image: event.target.value }))}
          placeholder="/images/produtos/meu-prato.jpg"
        />
      </label>
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
      <label className="field">
        <span>Titulo dos adicionais</span>
        <input
          value={itemForm.addonTitle}
          onChange={(event) =>
            setItemForm((current) => ({ ...current, addonTitle: event.target.value }))
          }
        />
      </label>
      <label className="field full-span">
        <span>Adicionais</span>
        <textarea
          rows={4}
          value={itemForm.addonOptions}
          onChange={(event) =>
            setItemForm((current) => ({ ...current, addonOptions: event.target.value }))
          }
          placeholder="Um por linha: Nome: 4.50"
        />
      </label>
      <div className="toggle-group full-span">
        <label className="toggle-option">
          <input
            type="checkbox"
            checked={itemForm.available}
            onChange={(event) =>
              setItemForm((current) => ({ ...current, available: event.target.checked }))
            }
          />
          <span>Disponivel</span>
        </label>
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
            checked={itemForm.dishOfDay}
            onChange={(event) =>
              setItemForm((current) => ({ ...current, dishOfDay: event.target.checked }))
            }
          />
          <span>Prato do dia</span>
        </label>
      </div>
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
    <div className="overlay-shell">
      <div className="admin-panel">
        <div className="overlay-header">
          <div>
            <p className="eyebrow">Painel administrativo</p>
            <h2>Edite o site em gavetas, de forma mais rapida e organizada</h2>
          </div>
          <button type="button" className="icon-button ghost-button" onClick={onClose}>
            <Icon name="close" className="tiny-icon" />
          </button>
        </div>

        {!authenticated ? (
          <div className="admin-login-card">
            <div className="login-badge">
              <Icon name="lock" className="section-icon" />
              <span>Acesso restrito</span>
            </div>
            <h3>Faca login para editar a Marmitas da Nida</h3>
            <p>
              Credenciais iniciais do projeto: <strong>admin</strong> / <strong>nida123</strong>.
            </p>
            <form className="admin-grid" onSubmit={handleLogin}>
              <label className="field">
                <span>Login</span>
                <input
                  value={loginForm.username}
                  onChange={(event) =>
                    setLoginForm((current) => ({ ...current, username: event.target.value }))
                  }
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
              <button type="submit" className="primary-button wide-button">
                Entrar
              </button>
            </form>
          </div>
        ) : (
          <>
            <div className="admin-panel-toolbar">
              <div className="admin-toolbar-copy">
                <span className="pill-label">Edicao por gavetas</span>
                <strong>Abra um topico, ajuste os campos e siga para o proximo sem trocar de tela.</strong>
                <p>Todas as alteracoes feitas aqui ficam salvas automaticamente.</p>
              </div>
              <button type="button" className="secondary-button" onClick={onLogout}>
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
                <article className="stat-card">
                  <span>Prato do dia</span>
                  <strong>{dishOfDay}</strong>
                </article>
              </div>

              <div className="admin-section-list">
                <AdminDrawerSection
                  sectionKey="overview"
                  openSection={openSection}
                  onToggle={toggleSection}
                  icon="sparkles"
                  eyebrow="Resumo"
                  title="Visao geral da operacao"
                  summary="Tenha uma visao rapida do projeto antes de editar os blocos abaixo."
                  meta={`${siteData.menu.length} itens cadastrados no total`}
                >
                  <section className="admin-section">
                    <div className="admin-card">
                      <h3>Resumo do projeto</h3>
                      <ul className="plain-list admin-bullet-list">
                        <li>Home, banner e destaques ficam concentrados na gaveta Home.</li>
                        <li>Categorias e itens do cardapio ficam juntos na gaveta Cardapio.</li>
                        <li>Contato, horario, entrega e acesso ao painel ficam em Configuracoes.</li>
                      </ul>
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
                  summary={`${siteData.categories.length} categorias e ${siteData.menu.length} itens cadastrados`}
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
                                    <img src={item.image} alt={item.name} />
                                  ) : (
                                    <div className="menu-admin-image-placeholder">Sem imagem</div>
                                  )}
                                  <div>
                                    <div className="menu-admin-header">
                                      <strong>{item.name}</strong>
                                      <span>{formatCurrency(item.price)}</span>
                                    </div>
                                    <p>{item.description}</p>
                                    <div className="chip-row">
                                      <span
                                        className={`mini-chip ${
                                          item.available ? 'success-chip' : 'muted-chip'
                                        }`}
                                      >
                                        {item.available ? 'Disponivel' : 'Indisponivel'}
                                      </span>
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
                                      onClick={() => removeItem(item.id)}
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
                                    <img src={item.image} alt={item.name} />
                                  ) : (
                                    <div className="menu-admin-image-placeholder">Sem imagem</div>
                                  )}
                                  <div>
                                    <div className="menu-admin-header">
                                      <strong>{item.name}</strong>
                                      <span>{formatCurrency(item.price)}</span>
                                    </div>
                                    <p>{item.description}</p>
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
                                      onClick={() => removeItem(item.id)}
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
                  </section>
                </AdminDrawerSection>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
