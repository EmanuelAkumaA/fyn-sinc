## Plano para resolver o login que conecta e desconecta

O login está autenticando com sucesso no Supabase, mas logo depois algum fluxo local está levando o usuário de volta para `/login`. Vou corrigir isso em três pontos do fluxo de sessão.

### 1. Tornar o `/login` seguro contra sessão antiga/corrompida
- Ajustar `src/routes/login.tsx` para não redirecionar automaticamente para `/dashboard` em visitas normais a `/login`.
- Só auto-redirecionar quando existir `?next=...`, por exemplo `/login?next=/admin`.
- Se o Supabase detectar erro de refresh token antigo (`refresh_token_not_found`), limpar apenas a sessão local antes de permitir novo login.

### 2. Evitar logout falso no layout do app
- Ajustar `src/routes/_app.tsx` para não navegar imediatamente para `/login` ao receber evento `SIGNED_OUT`.
- Antes de redirecionar, confirmar se ainda não existe uma sessão válida, evitando corrida entre restauração de sessão antiga e login novo.
- Manter o timer de expiração de 1 hora, mas garantir que ele não use estado antigo logo após o login.

### 3. Reduzir invalidações de rota durante troca de autenticação
- Revisar `src/routes/__root.tsx` para evitar invalidações agressivas do roteador em eventos de autenticação que acontecem durante a hidratação da sessão.
- Invalidar cache/rotas apenas em eventos relevantes, sem forçar uma navegação que possa competir com o login recém-concluído.

### Resultado esperado
- Email/senha válidos continuam mostrando “Bem-vindo de volta”.
- O usuário permanece no `/dashboard` quando clicar em “Acessar o App”.
- O usuário vai para `/admin` quando entrar por `/login?next=/admin`, se tiver permissão.
- Sessões antigas ou tokens inválidos deixam de derrubar o usuário imediatamente após autenticar.