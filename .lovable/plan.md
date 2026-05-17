## Plano: Ocultar scrollbars globalmente (mantendo scroll funcional)

Adicionar uma regra CSS global em `src/styles.css` para esconder as scrollbars em todos os navegadores, preservando a rolagem normal (mouse wheel, trackpad, teclado, touch).

### Alteração

Arquivo único: `src/styles.css` — adicionar ao final:

```css
/* Hide scrollbars globally, keep scrolling functional */
* {
  scrollbar-width: none;        /* Firefox */
  -ms-overflow-style: none;     /* IE/Edge legado */
}
*::-webkit-scrollbar {
  display: none;                /* Chrome, Safari, Edge */
}
```

### Fora de escopo

- Nenhuma alteração em componentes, layouts ou lógica.
- Sem mudança no comportamento de rolagem — apenas o indicador visual some.

### Observação

Se mais tarde você quiser **mostrar** scrollbars em alguma área específica (ex: tabela longa), basta criar uma classe utilitária `.show-scrollbar` que reverta as regras naquele container. Posso adicionar isso se precisar.