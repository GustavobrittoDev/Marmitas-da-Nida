# Marmitas da Nida

Aplicativo web mobile-first para pedidos da marmitaria, com cardapio editavel, carrinho, checkout e envio automatico para o WhatsApp.

## Rodar localmente

1. Instale o Node.js 18+.
2. Execute `npm install`.
3. Copie `.env.example` para `.env` se quiser ativar o Supabase localmente.
4. Execute `npm run dev`.
5. Abra o endereco exibido pelo Vite.

## Modos do painel administrativo

### Modo local

Se o projeto estiver sem Supabase configurado, o painel continua funcionando em `localStorage`.

- Login: `admin`
- Senha: `nida123`
- As alteracoes ficam salvas apenas no navegador onde foram feitas.

### Modo online com Supabase

Se as variaveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` estiverem configuradas, o painel passa a funcionar online.

- O login do painel usa `email + senha` do Supabase Auth.
- As alteracoes no painel sao gravadas na tabela `public.site_state`.
- Todo mundo passa a ver os mesmos dados.
- O site acompanha mudancas em tempo real quando a tabela estiver na publicacao `supabase_realtime`.

## Como ativar o Supabase

1. Crie um projeto no Supabase.
2. Abra o SQL Editor e rode o arquivo [supabase/setup.sql](C:\Users\nicks\OneDrive\Documents\Marmitas da Nida\supabase\setup.sql).
   Se voce so precisar ativar a central de pedidos, pode rodar apenas [supabase/orders-setup.sql](C:\Users\nicks\OneDrive\Documents\Marmitas da Nida\supabase\orders-setup.sql).
3. No Supabase Auth, crie o usuario administrador com email e senha.
4. Copie a URL do projeto e a publishable key.
5. Configure as variaveis abaixo no Vercel e tambem no arquivo `.env` local:

```bash
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua-chave-publica
```

6. Faça um novo deploy no Vercel.

## Publicacao no Vercel

Depois de configurar as variaveis de ambiente no projeto da Vercel, todo push novo no `main` gera deploy com o painel online habilitado.

## O que o projeto inclui

- Home com visual de app de delivery
- Cardapio por categorias
- Prato do dia e banner promocional
- Carrinho funcional com adicionais e observacoes
- Checkout com dados de entrega, pagamento e troco
- Mensagem automatica para WhatsApp
- Painel administrativo em gavetas
- Persistencia local como fallback
- Persistencia online com Supabase quando configurado
- Manifesto PWA e service worker simples
