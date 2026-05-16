# Upload de logo + cor automática no cadastro de cliente

## Objetivo
No modal "Novo cliente" / "Editar cliente", permitir enviar a logo direto do dispositivo (galeria/arquivos), salvar no Supabase Storage e extrair automaticamente a cor predominante da imagem para preencher o campo "Cor da marca" — mantendo o HEX editável manualmente a qualquer momento.

## Comportamento esperado

1. Campo "Logo do cliente" passa a ter duas formas de uso:
   - Botão **"Enviar imagem"** (abre seletor de arquivos / galeria no mobile, aceita PNG/JPG/WebP/SVG até ~2 MB).
   - Campo de URL continua disponível (colar link externo) como alternativa.
2. Ao escolher uma imagem:
   - Upload imediato para o bucket `client-logos` do Supabase Storage, dentro da pasta `{organization_id}/{client_id_ou_temp}-{timestamp}.{ext}`.
   - `logo_url` recebe a URL pública retornada.
   - Pré-visualização da logo aparece acima do campo.
   - A cor dominante da imagem é extraída no cliente e preenche `brand_color` **apenas se o campo estiver vazio ou não tiver sido editado manualmente** (sem sobrescrever escolha do usuário).
3. Botão **"Recalcular cor"** ao lado do swatch — reextrai a cor a partir da logo atual (útil se o usuário trocou a imagem ou quer voltar à cor automática).
4. Campo HEX e color picker continuam funcionando como hoje — edição manual sempre vence.
5. Botão **"Remover"** limpa logo + reseta brand_color (opcional, só se houver logo).

## Mudanças técnicas

### 1. Supabase Storage (migration)
- Criar bucket público `client-logos` (`public = true`, limite 2 MB, mime types de imagem).
- Policies em `storage.objects` para o bucket `client-logos`:
  - `SELECT`: público (bucket já é público, mas policy explícita para autenticados também).
  - `INSERT` / `UPDATE` / `DELETE`: apenas para `authenticated` cujo `(storage.foldername(name))[1]` seja uma `organization_id` da qual o usuário é membro (via função `is_org_member` já existente).

### 2. Extração de cor
- Adicionar dependência `colorthief` (puro JS, roda no navegador).
- Util `src/lib/extract-brand-color.ts`:
  - Recebe `File` ou URL, carrega num `<img>` (com `crossOrigin="anonymous"` quando URL), passa pelo ColorThief e devolve HEX em maiúsculas.
  - Trata falhas (CORS, SVG) retornando `null` silenciosamente.

### 3. Componente de upload
- Novo `src/components/client-logo-upload.tsx`:
  - Props: `value` (url atual), `orgId`, `onChange(url, extractedColor?)`, `onRemove()`.
  - Usa `<input type="file" accept="image/*" />` escondido + botão estilizado.
  - Faz upload via `supabase.storage.from("client-logos").upload(...)` + `getPublicUrl`.
  - Mostra preview, loading state, e botão "Recalcular cor".

### 4. Modal de cliente (`src/routes/_app/clientes.tsx`)
- Substituir o input atual de `logo_url` pelo novo componente, mantendo o input de URL como fallback (accordion "Usar URL externa" ou simples link "Colar URL no lugar").
- Adicionar flag local `brandColorTouched` para não sobrescrever cor digitada pelo usuário.
- Ao receber `extractedColor` do upload: se `!brandColorTouched` ou campo vazio → setar `brand_color`.
- Ao usuário digitar/escolher cor manualmente → marcar `brandColorTouched = true`.
- Botão "Recalcular cor" reseta `brandColorTouched` e re-extrai.

### 5. Limpeza opcional
- Sem deleção automática de arquivos antigos no Storage nesta iteração (evita complexidade). Documentar para futuro.

## Fora de escopo
- Crop/edição da imagem.
- Limpeza retroativa de logos órfãs.
- Mudanças no schema da tabela `clients` (campos `logo_url` e `brand_color` já existem).
- Aplicar mesma extração em contratos/transações.

## Arquivos afetados
- **Novo**: `src/lib/extract-brand-color.ts`, `src/components/client-logo-upload.tsx`, migration do bucket + policies.
- **Editado**: `src/routes/_app/clientes.tsx`.
- **Dependência**: `bun add colorthief`.
