Ajustar o tamanho da logo no header da Landing Page para que fique proporcional à altura do menu (h-16 = 64px).

Atualmente a logo está com `h-9 w-auto sm:h-10` (36–40px), o que a deixa pequena demais dentro do header, com muito espaço vazio acima e abaixo.

Ajuste proposto:
- Aumentar para `h-10 w-auto sm:h-12` ou `h-11 w-auto sm:h-12` (44–48px), mantendo a proporção com `w-auto`.
- Verificar o resultado visual no preview, incluindo no menu mobile (Sheet).
- Sem alterações em outros elementos ou seções.

Arquivo: `src/components/landing/LandingPage.tsx` (componente `Logo`).