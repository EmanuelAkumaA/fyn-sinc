## Objetivo

Quando todas as mensalidades de uma recorrência forem geradas (status fica `inativo` e `installments_generated >= installments_total`), o campo "Data da 1ª mensalidade" deve voltar a ser editável. Ao alterar a data e salvar, a recorrência é reativada e o botão Zap volta a gerar mensalidades a partir da nova data — sem precisar recriar do zero.

## Mudanças

**Arquivo:** `src/routes/_app/recorrencias.tsx` (apenas)

### 1. Formulário de edição (`RecForm`)

- Calcular `isCompleted = initial?.installments_total != null && generated >= initial.installments_total`.
- Trocar `startDateLocked = generated > 0` por `startDateLocked = generated > 0 && !isCompleted`.
- Quando `isCompleted`, trocar o texto de ajuda abaixo do campo para algo como: *"Recorrência concluída. Altere a data para reiniciar a geração."*
- Manter a validação de quantidade ≥ geradas apenas quando `startDateLocked` (ciclo em andamento). Quando `isCompleted`, permitir qualquer `qtd ≥ 1` (será um novo ciclo).

### 2. Mutation de atualização (linhas ~105-112)

Adicionar caminho para "reset por nova data" quando o contrato estiver concluído:

```ts
const generatedNow = editing.installments_generated ?? 0;
const wasCompleted =
  editing.installments_total != null && generatedNow >= editing.installments_total;
const startChanged = p.start_date !== editing.start_date;

if (wasCompleted && startChanged) {
  // Reiniciar ciclo: novas mensalidades começam da nova data
  update.next_due_date = p.start_date;
  update.installments_generated = 0;
  update.status = "ativo";
} else if (generatedNow === 0) {
  update.next_due_date = p.start_date;
}
```

Isso mantém as transações já geradas no histórico financeiro (não apaga nada) e simplesmente abre um novo ciclo na recorrência. O botão Zap volta a funcionar normalmente porque `status="ativo"` e `installments_generated=0`.

### 3. Card da listagem

Sem alterações de comportamento. Após salvar com nova data, o card volta a aparecer como "Ativo" com `Geradas: 0/N` e o botão Zap habilitado.

## Fora de escopo

- Apagar/regenerar mensalidades antigas.
- Histórico de ciclos anteriores.
- Alteração automática sem o usuário trocar a data (manter exigência de mudar a data para reativar).
