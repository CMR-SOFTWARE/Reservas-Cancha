# 01 · Design System

Todos los valores viven en `tokens.css`. Este documento explica cómo usarlos.

## Paleta

| Rol | Token | Hex | Uso |
| --- | --- | --- | --- |
| Verde primario | `--c-brand-700` | `#15703F` | Botón principal, anillo de foco, borde de selección, links |
| Verde hover | `--c-brand-800` | `#0F5730` | Hover del botón principal |
| Verde profundo | `--c-brand-900` | `#0B3D22` | Header, footer, títulos de sección |
| Verde acento | `--c-brand-600` | `#1C8A4E` | Íconos, puntos de estado |
| Verde claro | `--c-brand-50` | `#E8F5EE` | Fondo de "disponible" y de éxito |
| Texto título | `--c-ink-900` | `#0E2233` | h1–h3 |
| Texto cuerpo | `--c-ink-700` | `#2B3F4F` | Párrafos, labels |
| Texto secundario | `--c-ink-500` | `#566A79` | Subtítulos, ayuda |
| Fondo | `--c-bg` | `#F4F6F8` | Fondo de página |
| Superficie | `--c-surface` | `#FFFFFF` | Cards, modal |
| Borde | `--c-border` | `#DDE4EA` | Separadores, borde de card |

Contrastes verificados: `#15703F` sobre blanco = 5.1:1 (AA para texto normal, AAA para
texto grande). Blanco sobre `#15703F` = 5.1:1. `#2B3F4F` sobre `#F4F6F8` = 10.8:1.
`#566A79` sobre blanco = 5.0:1. **No usar `--c-ink-400` para texto informativo**, sólo
para placeholders.

Regla de color: máximo **dos** colores de fondo por pantalla (`--c-bg` + `--c-surface`).
El verde aparece sólo en: header, botón primario, estado disponible, foco y badges de
éxito. Sin gradientes. Sin sombras de color.

## Tipografía

Fuente: **stack del sistema** (`--font-sans`). Cero bytes de descarga, se ve nativa en
cada dispositivo y es la opción más rápida — decisión tomada por el requisito de
rendimiento. No agregar webfonts.

| Elemento | Tamaño | Peso | Line-height | Color |
| --- | --- | --- | --- | --- |
| h1 (mobile / desktop) | 30 / 36px | 700 | 1.2 | `--c-ink-900` |
| Subtítulo de h1 | 16 / 18px | 400 | 1.55 | `--c-ink-500` |
| h2 (título de card) | 20px | 600 | 1.35 | `--c-brand-900` |
| h3 / paso del formulario | 18px | 600 | 1.35 | `--c-ink-900` |
| Label de campo | 16px | 600 | 1.35 | `--c-ink-700` |
| Cuerpo | 16px | 400 | 1.55 | `--c-ink-700` |
| Texto de ayuda | 14px | 400 | 1.5 | `--c-ink-500` |
| Slot de horario | 18px | 700 | 1 | según estado |
| Texto de botón | 16px | 600 | 1 | — |
| Badge | 13px | 600 | 1 | según estado |

Nada por debajo de 13px, y 13px sólo para metadatos. `text-wrap: pretty` en párrafos,
`text-wrap: balance` en h1/h2.

## Espaciado y layout

Escala base 4: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64.

- Ancho máximo de contenido: **1040px**, centrado.
- Padding de página: 16px mobile, 24px ≥768px, 32px ≥1280px.
- Separación entre cards: 16px mobile, 20px desktop.
- Padding interno de card: 16px mobile, 24px desktop.
- Separación label→control: 8px. Entre campos: 16px. Entre grupos: 24px.
- Altura de línea de aire arriba del footer: 40px.

Breakpoints: `≥640px` (sm), `≥768px` (md), `≥1024px` (lg). Mobile es el caso por defecto:
todo en una columna, sin scroll horizontal nunca.

## Radios y sombras

- Badge/chip: 8px · Input, botón, slot: 12px · Card y modal: 16px · Avatar: 50%.
- Card en reposo: `--sh-xs`. Card elevada / dropdown: `--sh-sm`. Modal: `--sh-md`.
- Nada más profundo que `--sh-md`. Sin sombras internas.

## Foco y estados

Foco visible obligatorio y **con el mismo tratamiento en toda la app**:

```css
:where(a, button, input, select, textarea, [tabindex]):focus-visible {
  outline: 2px solid var(--c-brand-700);
  outline-offset: 2px;
  box-shadow: var(--sh-focus);
}
```

- **Hover**: cambio de fondo un paso más oscuro, 150 ms. Nunca `transform: scale` en
  botones.
- **Active**: `transform: translateY(1px)`.
- **Disabled**: `opacity: 1` + fondo `--c-busy-bg`, texto `--c-busy-text`, borde
  `--c-border`, `cursor: not-allowed`. Nunca opacidad baja: un botón deshabilitado tiene
  que seguir siendo legible.
- **Selected**: borde de 2px `--c-brand-700` + fondo `--c-brand-50` + ícono de check.

## Movimiento

Sólo microinteracciones: hover de botón, selección de horario, aparición de mensajes
(`opacity` + `translateY(4px)`), apertura de modal (`opacity` + `scale(0.98→1)`).
Duración 150–250 ms, `ease-out`. Nada de parallax, fondos animados ni loops.
Respetar `prefers-reduced-motion` (ya incluido en `tokens.css`).

## Iconografía

SVG inline, trazo 2px, `stroke-linecap="round"`, `currentColor`, 20×20 o 24×24.
Set completo necesario (10 íconos): usuario, calendario, reloj, check, x, alerta,
candado, teléfono, chevron-down, whatsapp. Nada más. Sin emojis en la interfaz: los
estados llevan ícono SVG + texto.
