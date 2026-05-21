# GitHub Pages - Modo Convidado

Este sistema está configurado para funcionar no GitHub Pages apenas em **modo convidado**.

## Como Funciona

- **Modo Convidado**: Todos os dados são salvos localmente no navegador usando localStorage
- **Sem Servidor**: Não há necessidade de servidor backend quando em modo convidado
- **Dados Locais**: Todos os eventos, equipamentos, cabos e outros itens são armazenados apenas no seu navegador

## Acesso

Ao acessar o sistema via GitHub Pages, você será automaticamente direcionado para o modo convidado.
Todos os dados criados ficam salvos no localStorage do seu navegador.

## Limitações

- Os dados são locais ao navegador - se limpar o cache do navegador, os dados serão perdidos
- Os dados não são compartilhados entre dispositivos ou navegadores diferentes
- Não é possível fazer login com usuário/senha no modo GitHub Pages

## Para Implantação com Servidor

Para usar o sistema completo com autenticação de usuários e banco de dados Cloudflare:
- Use o servidor Node.js (server.js) ou
- Use Cloudflare Workers (wrangler)

Veja o README principal para mais informações.
