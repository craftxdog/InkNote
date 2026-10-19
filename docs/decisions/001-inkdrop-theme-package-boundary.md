# ADR-001: Publicar el tema de Inkdrop como paquete independiente

## Estado

Propuesto — 2026-10-19

## Contexto

InkNote es una aplicación de notas local-first basada en Electron. El renderer
actual separa navegación, lista de notas, editor y preview, pero el editor y el
preview todavía son placeholders y el contenido de navegación/notas proviene de
mocks. No existe integración de tiempo de ejecución con Inkdrop.

Inkdrop 6 carga sus temas como paquetes instalables propios. Un paquete de tema
declara `theme: true`, su apariencia y sus hojas de estilo en `package.json`; el
CSS se integra en las capas `theme`, `theme.ui`, `theme.syntax` y
`theme.preview`. Por tanto, el contrato de variables CSS de Inkdrop no es el
contrato CSS interno de InkNote.

Mezclar ese paquete con el `package.json`, el empaquetado Electron o los
workflows de release de InkNote produciría dos productos con dependencias,
metadatos y destinos de publicación incompatibles.

Fuentes de diseño:

- [Crear un tema para Inkdrop](https://developers.inkdrop.app/guides/create-a-theme)
- [Publicar un paquete de Inkdrop](https://developers.inkdrop.app/guides/plugin-word-count#publishing)

## Decisión

Crear el tema como un repositorio y paquete npm/IPM independiente de InkNote.
El primer alcance es un tema publicable para Inkdrop 6; no incluye una pantalla
de "Theme Studio" ni un selector de temas dentro de InkNote.

InkNote puede servir como referencia visual, pero no como dependencia de
compilación ni como lugar donde se publica el tema. Sus variables `--color-*`
no se copian ni se exponen como una API de Inkdrop: el nuevo paquete define sus
propios tokens con un prefijo exclusivo del tema.

## Estructura propuesta del nuevo repositorio

El nombre definitivo se elegirá antes de inicializarlo. La estructura debe
partir del scaffold que crea `ipm init <nombre> --type theme`; ese scaffold es
la fuente de verdad para rutas y campos exactos del manifiesto.

```text
inkdrop-<nombre>-theme/
├── styles/
│   ├── palette.css      # tokens compartidos, cuando hagan falta
│   ├── ui.css           # @layer theme.ui
│   ├── syntax.css       # @layer theme.syntax
│   └── preview.css      # @layer theme.preview
├── package.json
├── README.md
├── LICENSE
└── .gitignore
```

El manifiesto del paquete debe declarar, como mínimo:

- metadatos públicos: `name`, `description`, `repository` y versión;
- `theme: true`;
- `themeAppearance` con `dark` o `light`;
- `styleSheets`, respetando las rutas creadas por el scaffold;
- `engines.inkdrop` compatible con Inkdrop 6.

No se añaden `electron`, `electron-builder`, `electron-vite`, React ni el
preload de InkNote al paquete de tema.

## Contrato de estilos

1. `palette.css` contiene únicamente tokens reutilizables del tema y se carga
   antes que las demás hojas. Se encapsula en `@layer theme` cuando redefina
   los tokens de color/rampas que Inkdrop comparte entre superficies.
2. `ui.css` vive en `@layer theme.ui` y cubre la interfaz general de Inkdrop.
3. `syntax.css` vive en `@layer theme.syntax` y cubre el editor CodeMirror 6.
4. `preview.css` vive en `@layer theme.preview` y cubre el Markdown renderizado.
5. Cada token se define una vez. Las excepciones locales (por ejemplo, un color
   de un bloque de código) se documentan junto a la regla que las usa.

No se debe reutilizar un nombre genérico de CSS de InkNote suponiendo que tenga
el mismo significado en Inkdrop. El mapeo desde la intención visual (fondo,
texto, foco, selección, acento, borde) hacia las variables oficiales de Inkdrop
se valida dentro de Inkdrop durante el desarrollo.

## Límites entre productos

| Responsabilidad | InkNote | Paquete de tema de Inkdrop |
| --- | --- | --- |
| Ventana, IPC y empaquetado de escritorio | Sí | No |
| Navegación/lista de notas y datos locales | Sí | No |
| CSS de la aplicación InkNote | Sí | No se importa |
| Variables y capas CSS de Inkdrop | No | Sí |
| Instalación con `ipm link --dev` | No | Sí |
| Publicación en IPM | No | Sí |
| Release multiplataforma de Electron | Sí | No |

Si en el futuro InkNote ofrece una herramienta para diseñar o previsualizar
temas, será una capacidad independiente (`features/appearance` o
`features/theme-studio`). Su responsabilidad será editar/generar archivos del
paquete externo; no debe convertir el renderer de InkNote en el runtime del
tema de Inkdrop.

## Flujo de desarrollo y publicación del tema

1. Crear el repositorio independiente e inicializarlo con `ipm init`.
2. Instalar sus dependencias y enlazarlo localmente con `ipm link --dev`.
3. Activar el modo de desarrollo de Inkdrop y ajustar los estilos con su
   servidor de desarrollo/hot reload.
4. Comprobar manualmente UI, editor y preview antes de cada versión.
5. Ejecutar una comprobación de empaquetado y `ipm publish --dry-run` antes de
   publicar.
6. Publicar sólo después de revisar el diff, actualizar la versión y crear el
   tag correspondiente. Las credenciales de IPM/GitHub se configuran en el
   entorno o como secretos del repositorio del tema, nunca en este repositorio.

La primera publicación será manual y reproducible. La automatización de
publicación en CI se decide después de que el paquete haya pasado la validación
local y de que se definan los secretos mínimos necesarios para ese repositorio.

## Revisión de la arquitectura actual de InkNote

### Fortalezas que se preservan

- Hay un límite claro entre proceso principal, preload y renderer; el preload
  expone una API mínima y tipada.
- El renderer ya organiza navegación y notas por feature, y `WorkspaceLayout`
  recibe sus paneles mediante composición.
- Los tokens globales de geometría y de UI comienzan en un único archivo de
  estilos, una base útil para una futura capa de apariencia propia de InkNote.
- El CI actual valida lint, tipos, pruebas, build y empaquetado en macOS,
  Windows y Linux para pull requests.

### Preparación necesaria, pero fuera de este paquete de tema

- Sustituir los mocks por un modelo de notas y persistencia real.
- Implementar editor Markdown/CodeMirror y preview renderizado antes de intentar
  compartir una experiencia visual completa con otra aplicación.
- Extraer progresivamente los colores hardcodeados de los estilos de features a
  tokens semánticos de InkNote cuando se implemente una preferencia visual de la
  propia app. Esto no debe bloquear el paquete de tema externo.
- Añadir pruebas de comportamiento para las futuras preferencias de apariencia;
  las pruebas actuales cubren principalmente el montaje del workspace y el
  actualizador.

## Criterios de aceptación del paquete de tema

- Es un repositorio nuevo sin dependencia de código, lockfile ni workflows de
  InkNote.
- Inkdrop reconoce el paquete enlazado en desarrollo.
- Las tres superficies (UI, editor y preview) se ven coherentes y no presentan
  variables CSS sin resolver.
- El manifiesto declara el tipo de paquete, apariencia, hojas de estilo y motor
  de Inkdrop requeridos por la guía oficial.
- `ipm publish --dry-run` y la comprobación de empaquetado terminan con éxito.
- README explica instalación, desarrollo local, compatibilidad y cómo reportar
  problemas.

## Alternativas descartadas

### Añadir el tema dentro de `InkNote`

Se descarta porque Electron y el tema se distribuyen por herramientas y
registros diferentes. También acoplaría las versiones y haría que la app
instalara dependencias que no utiliza.

### Construir un Theme Studio antes del tema

Se descarta en la primera versión porque no hay editor Markdown, preview real ni
persistencia en InkNote. Multiplicaría el alcance antes de validar que el tema
se integra correctamente con Inkdrop.

### Copiar los valores CSS actuales de InkNote como API compartida

Se descarta porque son detalles internos de una interfaz aún en evolución y no
equivalen a las variables oficiales de Inkdrop. Se puede usar su dirección
visual como referencia, no sus selectores o nombres como contrato.

## Preguntas para resolver antes de implementar

1. ¿Cuál será el nombre público, repositorio GitHub y licencia del tema?
2. ¿La primera versión será sólo oscura, sólo clara o habrá dos paquetes?
3. ¿La dirección visual inicial debe replicar la UI actual de InkNote o partir
   de una paleta nueva?
4. ¿Tras publicar la primera versión deseas planificar una herramienta opcional
   de creación/preview de temas dentro de InkNote?
