# Distribución de escritorio

InkNote genera los instaladores desde runners nativos, igual que las
arquitecturas y formatos que ofrece Inkdrop:

| Plataforma | Arquitectura   | Artefactos          |
| ---------- | -------------- | ------------------- |
| macOS      | `arm64`, `x64` | DMG y ZIP           |
| Windows    | `x64`          | NSIS (`.exe`) y ZIP |
| Linux      | `x64`          | AppImage, DEB y ZIP |

Los artefactos se escriben en `release/build/` y no se versionan. Sus nombres
tienen el patrón `InkNote-<version>-<arch>-<os>.<ext>`.

## Compilar sin publicar

Ejecuta el script del sistema operativo de destino:

```bash
npm run package:mac
npm run package:win
npm run package:linux
```

Cada script construye el renderer, recompila las dependencias nativas para la
arquitectura indicada y usa `--publish never`. `package:mac` omite la
notarización deliberadamente para que sirva como artefacto interno de prueba.

Ejecuta `package:mac` en macOS; genera tanto Intel como Apple Silicon. Ejecuta
`package:win` en Windows y `package:linux` en Ubuntu. InkNote incluye
`better-sqlite3`, cuyo módulo nativo no puede recompilarse entre sistemas
operativos desde macOS. Por ello, la matriz de CI utiliza runners nativos y no
una compilación cruzada poco fiable.

## Releases firmadas

Las releases se ejecutan únicamente por plataforma:

```bash
npm run release:mac
npm run release:win
npm run release:linux
```

Los scripts de release fuerzan la comprobación de firma. No se debe usar un
artefacto de `package:*` como distribución pública.

La workflow `Release` se activa al publicar una etiqueta `v<semver>` y requiere
estos secretos de GitHub:

| Plataforma | Secretos                                                                     |
| ---------- | ---------------------------------------------------------------------------- |
| Todas      | `ELECTRON_BUILDER_UPDATE_SIGN_KEY`                                           |
| macOS      | `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_ID_PASS`, `APPLE_TEAM_ID` |
| Windows    | `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD`                                       |

`CSC_LINK` almacena el certificado Developer ID para macOS. `WIN_CSC_LINK`
almacena el certificado Authenticode para Windows. Ambos deben configurarse
como secretos; nunca se guardan certificados ni contraseñas en el repositorio.

La release de macOS exige notarización y falla cuando faltan credenciales de
Apple. La de Windows exige una firma Authenticode válida. Linux no tiene una
firma de ejecutable equivalente en este flujo, pero sí requiere la clave de
firma de manifiestos de actualización.
