# Releases de escritorio en GitHub

InkNote publica instaladores sin firma en GitHub Releases. Están destinados a
una distribución independiente y a actualizaciones manuales: las personas
descargan la versión que corresponde a su sistema desde la página de releases.
No requiere una cuenta Apple Developer, Developer ID ni notarización.

InkNote genera los instaladores desde runners nativos:

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
arquitectura indicada y usa `--publish never`.

En macOS, el empaquetado elimina cualquier firma ad-hoc interna heredada del
binario de Electron. El resultado se comprueba con `codesign` antes de crear
los artefactos: queda coherentemente **sin firmar**, en lugar de conservar una
firma parcial que Gatekeeper pueda interpretar como una aplicación dañada.

Ejecuta `package:mac` en macOS; genera tanto Intel como Apple Silicon. Ejecuta
`package:win` en Windows y `package:linux` en Ubuntu. InkNote incluye
`better-sqlite3`, cuyo módulo nativo no puede recompilarse entre sistemas
operativos desde macOS. Por ello, la matriz de CI utiliza runners nativos y no
una compilación cruzada poco fiable.

## Publicar una release

La workflow `Release` se activa al publicar una etiqueta semántica. No requiere
secretos de Apple, Microsoft ni claves de actualización:

```bash
git tag v0.1.0
git push origin v0.1.0
```

La matriz crea los paquetes en macOS, Windows y Ubuntu respectivamente. Al
terminar, un único job adjunta los nueve artefactos a la GitHub Release de esa
etiqueta:

- 4 de macOS: DMG y ZIP para Apple Silicon e Intel.
- 2 de Windows: instalador NSIS y ZIP.
- 3 de Linux: AppImage, DEB y ZIP.

Las releases no incluyen actualización automática dentro de la aplicación. Esto
evita publicar manifiestos de actualización sin firma; las actualizaciones se
realizan descargando una versión nueva desde GitHub Releases.

## Advertencias esperadas

Los instaladores son funcionales, pero los sistemas operativos no pueden
atribuirlos a una entidad verificada:

- En macOS, Gatekeeper puede pedir una apertura explícita desde Ajustes del
  sistema o mediante clic secundario y **Abrir**. Para instalar una copia
  descargada desde GitHub sin un certificado Apple, mueve `InkNote.app` a
  Aplicaciones y ejecuta una sola vez en Terminal:

  ```bash
  xattr -dr com.apple.quarantine "/Applications/InkNote.app"
  ```

  Después abre InkNote normalmente. Este comando solo elimina la cuarentena de
  macOS; no sustituye una firma ni una notarización. Si Gatekeeper vuelve a
  indicar que la aplicación está dañada, no continúes: descarga la versión más
  reciente y verifica que su release haya superado la validación de paquete.
- En Windows, SmartScreen puede mostrar un aviso de editor desconocido y pedir
  **Más información** y después **Ejecutar de todas formas**.
- Linux no necesita firma para descargar los formatos publicados.

Estos avisos no cambian el contenido ni la procedencia del archivo: cada
release procede del repositorio y de la etiqueta de Git que la desencadenó.
