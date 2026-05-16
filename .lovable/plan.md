## Ajustes no formulário de Cliente

Arquivo: `src/routes/_app/clientes.tsx` (componente `ClientForm`)

### Mudanças

1. **Label "Nome" → "Nome da Empresa"**
   - Trocar o texto do `<Label>` do campo `name`.

2. **CPF/CNPJ com máscara dinâmica**
   - Aplicar máscara conforme o tipo selecionado:
     - PF → `000.000.000-00` (CPF, 11 dígitos)
     - PJ → `00.000.000/0000-00` (CNPJ, 14 dígitos)
   - Formatar no `onChange` removendo não-dígitos e reinserindo separadores.
   - `inputMode="numeric"` e `maxLength` adequado.
   - Validação no submit: se preenchido, exigir o tamanho correto de dígitos.

3. **E-mail com validação real**
   - Manter `type="email"`.
   - Validar com regex no submit (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`). Mostrar `toast.error` se inválido e bloquear submit.

4. **Telefone com máscara BR**
   - Formato dinâmico:
     - 10 dígitos: `(00) 0000-0000` (fixo)
     - 11 dígitos: `(00) 00000-0000` (celular)
   - Formatar no `onChange`, `inputMode="tel"`, `maxLength={15}`.

### Detalhes técnicos

- Criar helpers locais (ou em `src/lib/masks.ts`) puros:
  - `maskCPF(v)`, `maskCNPJ(v)`, `maskDocument(v, type)`, `maskPhone(v)`, `isValidEmail(v)`, `isValidDocument(v, type)`.
- Salvar no banco o valor mascarado (consistente com o que já é exibido) — mantém o comportamento atual de não mexer no schema.
- Reaplicar a máscara do documento quando o usuário trocar o `type` (PF↔PJ) para evitar formato inconsistente.
- Validações executadas no `handleSubmit` antes de chamar `onSubmit`, com `toast.error` específico por campo.

### Fora do escopo

- Schema do banco, RLS, e o card de pré-visualização (continua usando o telefone já formatado).
