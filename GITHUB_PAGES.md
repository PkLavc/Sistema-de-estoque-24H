# GitHub Pages - Modo Convidado

Este sistema está configurado para funcionar no GitHub Pages apenas em **modo convidado**.

## Como Funciona

- **Modo Convidado**: Todos os dados são salvos localmente no navegador usando localStorage
- **Sem Servidor**: Não há necessidade de servidor backend quando em modo convidado
- **Dados Locais**: Todos os eventos, equipamentos, cabos e outros itens são armazenados apenas no seu navegador

## Configuração do GitHub Pages

1. Vá para as configurações do seu repositório no GitHub
2. Na seção "Pages", escolha:
   - Source: GitHub Actions (recomendado)
   - Ou Branch: main, Folder: /public
3. O workflow `.github/workflows/deploy-pages.yml` já está configurado

## Acesso

Ao acessar o sistema via GitHub Pages:
- Você será redirecionado automaticamente para `/login/`
- Clique em "Entrar como Convidado"
- Todos os dados criados ficam salvos no localStorage do seu navegador

## Estrutura de Arquivos

Após a reorganização:
- `public/index.html` - Página principal (antiga dashboard.html)
- `public/login/index.html` - Página de login (apenas modo convidado)
- `public/eventos/index.html` - Página de eventos
- `public/entrada/index.html` - Página de entrada
- `public/saida/index.html` - Página de saída

## Limitações do Modo Convidado

- Os dados são locais ao navegador - se limpar o cache do navegador, os dados serão perdidos
- Os dados não são compartilhados entre dispositivos ou navegadores diferentes
- Não é possível fazer login com usuário/senha no modo GitHub Pages

## Para Implantação com Servidor

Para usar o sistema completo com autenticação de usuários e banco de dados Cloudflare:
- Use o servidor Node.js (server.js) ou
- Use Cloudflare Workers (wrangler)

Veja o README principal para mais informações.

## Alterações Realizadas

### 1. Reorganização de Arquivos
- HTML files movidos para pastas próprias (login/index.html, eventos/index.html, etc.)
- dashboard.html renomeado para index.html na raiz do public/

### 2. Tela de Login
- Logo ajustada para ocupar máximo horizontal com limite vertical
- Removido acesso admin (adm/adm)
- Apenas modo convidado disponível

### 3. Dashboard Principal
- Logo posicionada mais próxima ao topo
- Barra de scroll removida da sidebar
- Ícone de configurações aumentado

### 4. Sistema de Cores
- Cores primária/secundária aplicadas em todo o sistema
- Variáveis CSS atualizadas no theme.css
- Filtros de cor aplicados aos ícones Lottie

### 5. Armazenamento
- Modo convidado usa exclusivamente localStorage
- Sem chamadas ao Cloudflare Database no modo convidado
- storage.js já implementa separação correta

### 6. GitHub Pages
- Workflow configurado para deploy automático
- Sistema funciona completamente offline após carregamento inicial
