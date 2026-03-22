# Documentacao da Base - Marmitas da Nida

## 1. Visao geral do projeto

Este projeto foi construido como uma base profissional para marmitarias e negocios de refeicao por encomenda, com foco em:

- visual mobile-first com cara de app de delivery;
- fluxo rapido para montar pedido e enviar pelo WhatsApp;
- painel administrativo para editar o site sem depender de programador;
- central de pedidos para acompanhar o andamento da operacao;
- estrutura reaproveitavel para outras marmitarias.

Base atual publicada:

- Site: https://marmitas-da-nida-gustavobritto258-8143s-projects.vercel.app
- Painel admin: https://marmitas-da-nida-gustavobritto258-8143s-projects.vercel.app/#/admin
- GitHub: https://github.com/GustavobrittoDev/Marmitas-da-Nida

## 2. O que foi construido neste projeto

### 2.1 Loja online / site publico

Foi criado um site em formato de aplicativo, priorizando celular, com:

- identidade visual baseada em laranja e azul escuro;
- logo personalizada;
- cabecalho com imagem de fundo;
- home com visual de app;
- cardapio logo no topo para acelerar a conversao;
- categorias em formato facil de navegar;
- itens do cardapio em gavetas;
- tamanhos Pequena e Media dentro do mesmo produto;
- escolha de guarnicoes e adicionais;
- carrinho em barra flutuante;
- checkout com nome, telefone, endereco, tipo de entrega e pagamento;
- envio automatico do pedido para o WhatsApp;
- calculo de taxa de entrega;
- rodape com contato e informacoes da marmitaria.

### 2.2 Cardapio

O cardapio foi adaptado para o funcionamento real da marmitaria:

- pratos fixos;
- especial do dia;
- bebidas;
- saladas;
- extras;
- guarnicoes opcionais;
- tamanhos agrupados no mesmo bloco;
- imagens por item;
- disponibilidade por item;
- prato do dia;
- precos editaveis.

### 2.3 Carrinho e checkout

Foi implementado um carrinho funcional com:

- adicionar item;
- remover item;
- aumentar e diminuir quantidade;
- editar tamanho, observacoes e opcoes escolhidas;
- subtotal;
- taxa de entrega;
- total final;
- observacoes do pedido;
- geracao de mensagem pronta para o WhatsApp.

### 2.4 Integracao com WhatsApp

O projeto monta automaticamente a mensagem do pedido com:

- itens;
- quantidades;
- precos;
- subtotal;
- taxa;
- total;
- dados do cliente;
- endereco;
- tipo de entrega;
- forma de pagamento;
- troco;
- observacoes finais.

Ao finalizar, o cliente e levado para o WhatsApp com a mensagem pronta.

### 2.5 Painel administrativo

O painel foi evoluido para virar uma pagina separada do site, com foco em operacao. Hoje ele permite:

- login administrativo;
- edicao da home;
- edicao do cardapio;
- criacao de novos itens;
- edicao de itens existentes;
- remocao de itens;
- edicao de categorias;
- upload de imagem por arrastar e soltar ou escolher arquivo;
- controle de disponibilidade;
- controle de prato do dia;
- configuracao de guarnicoes globais;
- uso ou nao de guarnicoes por item;
- configuracoes gerais da operacao.

### 2.6 Central de pedidos

Tambem foi criada uma central de pedidos dentro do admin. Ela foi pensada para o fluxo da marmitaria:

- o pedido vai para o WhatsApp;
- o mesmo pedido tambem fica salvo no sistema;
- os pedidos aparecem no painel;
- a equipe pode acompanhar e alterar o status.

Status disponiveis:

- Recebido
- Em preparo
- A caminho
- Finalizado
- Cancelado

Os blocos da central funcionam como gavetas para reduzir poluicao visual.

### 2.7 Sincronizacao online

O sistema deixou de depender somente do navegador local. Hoje ele pode funcionar online para todos via Supabase, com:

- dados do site salvos em banco;
- pedidos salvos em banco;
- imagens salvas em storage;
- autenticacao do admin;
- leitura sincronizada para todos os usuarios.

Tambem existe fallback local para nao quebrar o projeto se o Supabase nao estiver configurado.

## 3. Tecnologias, sistemas e programas utilizados

### 3.1 Frontend

- React 18
- TypeScript
- Vite
- CSS customizado

### 3.2 Banco, autenticacao e arquivos

- Supabase Database
- Supabase Auth
- Supabase Storage
- Supabase Realtime

### 3.3 Publicacao

- Git
- GitHub
- Vercel

### 3.4 Ambiente de desenvolvimento

- Node.js 18+
- npm
- PowerShell

### 3.5 Integracoes

- WhatsApp via link com mensagem automatica
- Geocodificacao e calculo de taxa de entrega no frontend

## 4. Estrutura tecnica principal do projeto

Arquivos principais:

- `src/App.tsx`
  Loja publica, carrinho, checkout, rotas simples e sincronizacao do estado.

- `src/components/AdminPanel.tsx`
  Pagina principal do painel administrativo.

- `src/components/AdminOrdersManager.tsx`
  Central de pedidos do admin.

- `src/lib/siteState.ts`
  Leitura e gravacao do estado do site no Supabase.

- `src/lib/ordersState.ts`
  Leitura, criacao e atualizacao dos pedidos no Supabase.

- `src/lib/siteImages.ts`
  Upload de imagens para o Supabase Storage.

- `src/utils/whatsapp.ts`
  Montagem da mensagem pronta para envio ao WhatsApp.

- `src/utils/delivery.ts`
  Calculo de taxa de entrega.

- `src/utils/orders.ts`
  Estrutura e transformacao dos dados de pedidos.

- `src/data/seedData.ts`
  Conteudo inicial da loja, categorias, itens e configuracoes padrao.

- `src/index.css`
  Estilizacao completa do site e do painel.

- `supabase/setup.sql`
  Script principal para criar tabelas, politicas e storage.

- `supabase/orders-setup.sql`
  Script isolado para ativar a tabela de pedidos.

- `vercel.json`
  Configuracao de deploy no Vercel.

## 5. Como o sistema funciona hoje

### 5.1 Fluxo do cliente

1. O cliente acessa o site.
2. Visualiza o cardapio logo no topo.
3. Abre um item do cardapio.
4. Escolhe tamanho, guarnicoes e observacoes.
5. Adiciona ao carrinho.
6. Abre o carrinho pela barra flutuante.
7. Finaliza com endereco e pagamento.
8. O site monta o pedido automaticamente.
9. O pedido abre no WhatsApp.
10. O pedido tambem e salvo na central administrativa.

### 5.2 Fluxo da marmitaria

1. A equipe entra no painel admin.
2. Visualiza pedidos novos na central.
3. Muda o status do pedido conforme o andamento.
4. Edita cardapio, fotos, precos e disponibilidade quando precisar.
5. As alteracoes ficam visiveis para todos quando o Supabase esta ativo.

## 6. Recursos importantes ja prontos para reutilizar

Esta base ja esta pronta para ser reutilizada em outras marmitarias porque possui:

- identidade visual facilmente trocavel;
- logo trocavel;
- cores centralizadas no CSS;
- home editavel;
- cardapio editavel;
- painel admin reutilizavel;
- central de pedidos reutilizavel;
- integracao com WhatsApp;
- deploy facil no Vercel;
- persistencia online com Supabase.

## 7. Passo a passo para replicar para outras marmitarias

### Etapa 1 - Duplicar a base

1. Clonar este repositorio.
2. Renomear o projeto para o nome da nova marmitaria.
3. Atualizar o nome no `package.json`.
4. Criar um novo repositorio no GitHub para o novo cliente.

### Etapa 2 - Instalar o projeto localmente

1. Instalar Node.js 18+.
2. Instalar Git.
3. Rodar:

```bash
npm install
```

4. Rodar:

```bash
npm run dev
```

### Etapa 3 - Trocar identidade visual

1. Substituir logo em `public/`.
2. Substituir imagens principais da home.
3. Ajustar cores em `src/index.css`.
4. Ajustar textos principais em `src/data/seedData.ts`.
5. Atualizar nome, telefone, endereco e WhatsApp.

### Etapa 4 - Configurar o cardapio da nova marmitaria

1. Editar categorias em `seedData`.
2. Editar itens.
3. Editar tamanhos.
4. Editar precos.
5. Editar descricoes.
6. Definir se cada item usa ou nao guarnicoes.
7. Definir guarnicoes globais.

Se preferir, tambem e possivel fazer isso pelo painel admin depois de publicar.

### Etapa 5 - Configurar entrega e pagamento

1. Atualizar endereco base da marmitaria.
2. Ajustar regra de taxa de entrega.
3. Atualizar horarios de funcionamento.
4. Atualizar formas de pagamento.
5. Atualizar Pix, se houver.

### Etapa 6 - Criar projeto no Supabase

1. Criar um novo projeto no Supabase.
2. Abrir o SQL Editor.
3. Rodar o arquivo `supabase/setup.sql`.
4. Criar o usuario admin em `Authentication > Users`.
5. Confirmar o usuario, se necessario.
6. Copiar:
   - Project URL
   - Publishable key

### Etapa 7 - Configurar variaveis de ambiente

Criar `.env` local e configurar no Vercel:

```bash
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua-chave-publica
```

### Etapa 8 - Publicar no Vercel

1. Conectar o repositorio do GitHub ao Vercel.
2. Configurar:
   - Framework: Vite
   - Install command: `npm install`
   - Build command: `npm run build`
   - Output directory: `dist`
3. Adicionar as variaveis de ambiente.
4. Fazer deploy.

### Etapa 9 - Testar o fluxo completo

Checklist minimo:

- site abre no mobile;
- logo e identidade visual corretas;
- cardapio correto;
- itens aparecem no site;
- imagens aparecem no site;
- carrinho funciona;
- checkout funciona;
- mensagem do WhatsApp abre pronta;
- pedido entra na central;
- status do pedido muda no painel;
- edicoes no admin aparecem para todos.

### Etapa 10 - Entregar para a nova marmitaria

1. Cadastrar login do admin.
2. Ensinar como editar cardapio e fotos.
3. Ensinar como acompanhar pedidos.
4. Validar numero do WhatsApp.
5. Validar endereco e taxa de entrega.
6. Publicar link final.

## 8. O que precisa ser trocado em cada novo cliente

Sempre revisar estes pontos:

- nome da marmitaria;
- logo;
- paleta de cores;
- telefone;
- WhatsApp;
- endereco;
- bairros de entrega;
- regra de taxa;
- horarios;
- cardapio;
- guarnicoes;
- adicionais;
- formas de pagamento;
- Pix;
- fotos;
- textos da home;
- banner principal;
- imagens de destaque.

## 9. Boas praticas para usar esta base comercialmente

- manter uma copia-base limpa para futuros clientes;
- criar um repositorio separado por marmitaria;
- criar um projeto Supabase separado por cliente;
- criar um projeto Vercel separado por cliente;
- usar bucket e banco separados por cliente;
- nunca compartilhar credenciais entre negocios diferentes;
- documentar endereco, WhatsApp, horarios e taxa logo no inicio do projeto.

## 10. Limitacoes e melhorias futuras

Melhorias que podem ser adicionadas depois:

- notificacao sonora para pedido novo;
- impressao de comanda;
- painel de estoque;
- bloqueio automatico quando estiver fechado;
- cupom de desconto;
- varios usuarios admin;
- relatorios de vendas;
- API de mapa mais robusta para taxa de entrega;
- dominio proprio por cliente.

## 11. Resumo final

Esta base ja esta em nivel suficiente para ser reutilizada como produto para outras marmitarias. Ela entrega:

- site profissional;
- experiencia mobile-first;
- cardapio editavel;
- painel admin;
- central de pedidos;
- integracao com WhatsApp;
- armazenamento online com Supabase;
- deploy facil com GitHub e Vercel.

Com pequenas adaptacoes de identidade visual, cardapio e configuracoes de entrega, ela pode virar rapidamente um novo projeto comercial para outro cliente.
