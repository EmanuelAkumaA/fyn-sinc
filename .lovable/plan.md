## Objetivo
Aplicar máscara de moeda BRL (R$) em tempo real em todos os inputs de valores monetários do sistema. Conforme o usuário digita só os dígitos, o campo formata automaticamente para `R$ 1.234,56`.

## Abordagem
Criar um componente reutilizável `CurrencyInput` baseado no `<Input>` do shadcn, com máscara automática, e substituir os inputs `type="number"` que representam dinheiro pelos novos.

Campos de **percentual** (ex.: comissão %), **dias** (vencimento, extensão de trial) e **quantidade** continuam `type="number"`. A máscara é apenas para valores em R$.

## Implementação

### 1. Helpers em `src/lib/masks.ts`
Adicionar:
- `maskCurrencyBRL(input: string): string` — recebe string com dígitos/lixo, retorna `R$ 1.234,56` (sempre 2 casas, baseado em centavos).
- `parseCurrencyBRL(masked: string): number` — converte de volta para `number` (ex.: `12.34`).

Regra: extrai dígitos, divide por 100, formata com `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`. String vazia → `""`.

### 2. Novo componente `src/components/ui/currency-input.tsx`
```
type Props = Omit<InputProps, 'value' | 'onChange' | 'type'> & {
  value: number | string | null | undefined;   // valor numérico do form
  onValueChange: (value: number) => void;       // emite número (ex.: 1234.56)
};
```
- Estado interno guarda string mascarada; sincroniza com `value` prop.
- `onChange`: aplica `maskCurrencyBRL`, atualiza estado, chama `onValueChange(parseCurrencyBRL(...))`.
- `inputMode="decimal"`, placeholder `R$ 0,00`.

### 3. Substituições (apenas campos monetários R$)
Trocar `<Input type="number" step="0.01" ...>` por `<CurrencyInput value={...} onValueChange={(n) => setForm({ ...form, campo: n })} />` nos arquivos:

- `src/components/assignment-form.tsx` — `fixed_amount`, `manual_revenue` (NÃO o `percentage`).
- `src/components/pay-transaction-dialog.tsx` — `feeAmount`.
- `src/routes/_app/servicos.tsx` — `default_value`.
- `src/routes/_app/planos.tsx` — `amount_received_from_client`, `amount_paid_to_supplier`, `full_value`, `commission_value`, `cashback_expected`, `cashback_received` (NÃO `commission_pct`).
- `src/routes/_app/bancos.tsx` — `initial_balance`.
- `src/routes/_app/recorrencias.tsx` — `amount` (linha 527) e os dois `type="number"` de valor (linhas 412 e 558, confirmar que são monetários ao editar).
- `src/routes/_app/aportes.tsx` — `amount` (3 ocorrências) e `cashback_expected`.
- `src/routes/_app/financeiro.tsx` — `amount_gross`, `cashback.amount`.
- `src/routes/_app/despesas-planejamento.tsx` — `amount` (valor previsto). `dueDay` permanece numérico.

### 4. Ajuste de estado nos formulários
Atualmente os forms guardam strings (`form.amount: ""`). Como o `CurrencyInput` emite `number`, atualizar os tipos/estados afetados para `number | null` e ajustar os `Number(form.xxx || 0)` correspondentes. Onde já existe `Number(...)` no submit, fica mais limpo.

### 5. Verificação
- Build/typecheck.
- Abrir Bancos, Serviços, Recorrências, Financeiro, Aportes e validar visualmente: digitar `1234` → mostra `R$ 12,34`; digitar `12345678` → `R$ 123.456,78`.

## Fora do escopo
- Inputs de % (comissão), dias e quantidades.
- Tabelas/labels de exibição (já usam `formatBRL`).
- Inputs de valor em telas admin que não representam dinheiro.