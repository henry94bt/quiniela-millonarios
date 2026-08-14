# Quiniela Millonarios

La quiniela de **Henry, Pedro y Adri**. Dos páginas, sin build y sin dependencias,
servidas por GitHub Pages:

- **[Dashboard](https://henry94bt.github.io/quiniela-millonarios/)** (`index.html`) —
  clasificación, evolución, estadísticas y el boleto de la jornada.
- **[Boleto](https://henry94bt.github.io/quiniela-millonarios/boleto.html)** (`boleto.html`) —
  donde cada uno marca sus 14 signos, y donde se ven las tres apuestas juntas para
  echarla en TuLotero.

---

## Cómo se guardan las cosas

Todo vive en el propio repo. No hay nada que configurar para que funcione:

| Qué | Dónde | Quién lo mantiene |
|---|---|---|
| Los 14 partidos de la jornada en curso | `jornada.json` | un bot, dos veces al día |
| Los partidos de las jornadas pasadas | `historico.json` | el mismo bot, al cambiar de jornada |
| Los resultados de cada jornada | `resultados.json` | el mismo bot, al acabar los partidos |
| **Las apuestas** | `apuestas.json` | **a mano, una vez por jornada** |

Lo único que se mete a mano son las apuestas.

## El flujo de cada jornada

1. Los partidos de la jornada nueva **aparecen solos**.
2. Pasas el enlace del boleto al grupo. Cada uno marca sus 14 y le da a
   **Enviar por WhatsApp**, que manda un código tipo `[J9|Adri|1,X,2,...]`.
3. Abres el boleto, pulsas **Pegar de WhatsApp** y pegas los mensajes — vale la
   conversación entera, solo busca los códigos. Las tres apuestas quedan en la tabla de
   al lado, con las filas donde coincidís los tres resaltadas: esa es la vista para ir
   metiéndolas en TuLotero.
4. Pulsas **Copiar para guardar**, luego **Abrir apuestas.json**, pegas el bloque justo
   debajo del `[` y le das a *Commit changes*. Ya están guardadas.
5. Cuando se juegue, **no hay que hacer nada**: los resultados se recogen solos y el
   dashboard se actualiza.

Los signos a medio marcar se guardan en el navegador, así que si alguien cierra la
página a mitad no pierde lo hecho.

## Quitarse los pasos 2, 3 y 4 (opcional)

Todo eso existe porque una web en GitHub Pages no puede escribir en ningún sitio. Con un
**Google Form** de por medio, cada uno le da a *Guardar apuesta* en su móvil y se acabó:
ni WhatsApp, ni pegar, ni commits.

1. En [forms.google.com](https://forms.google.com), formulario en blanco con tres
   preguntas de **Respuesta corta**, tituladas exactamente `jornada`, `nombre`, `signos`.
   En Configuración, que **no** pida iniciar sesión ni recopilar correos.
2. Pestaña **Respuestas** → icono de Sheets, para volcarlas a una hoja.
3. Publica esa hoja: **Archivo → Compartir → Publicar en la Web** → pestaña de
   respuestas, formato **CSV**.
4. Rellena en `boleto.html` y en `index.html`:

```js
var FORM_ACTION = "https://docs.google.com/forms/d/e/TU_ID/formResponse";
var FORM_CAMPOS = { jornada: "entry.111", nombre: "entry.222", signos: "entry.333" };
var CSV_APUESTAS = "https://docs.google.com/spreadsheets/d/e/.../pub?gid=...&output=csv";
```

Los `entry.N` salen del código fuente del formulario, y `FORM_ACTION` es su URL
cambiando `/viewform` por `/formResponse`.

Detalles de cómo se comporta:

- Google no deja leer su respuesta desde otro dominio, así que el boleto sabe si el envío
  **salió**, pero no lo que Google contestó. Si falla la red sí se entera y te deja
  reintentar.
- Se puede reenviar: al leerlas **gana la última** de cada jugador para esa jornada.
- Lo de la hoja manda sobre lo de `apuestas.json`, por ser más reciente.

## De dónde salen los partidos y los resultados

Los actualiza `.github/workflows/jornada.yml` dos veces al día, ejecutando
`tools/actualizar-jornada.mjs`. A mano: pestaña **Actions → Actualizar jornada → Run
workflow**, o en local:

```bash
node tools/actualizar-jornada.mjs --dry-run
```

Tres fuentes, las tres accesibles desde un runner:

- **quinielista.es** → número de jornada y temporada oficiales.
- **mundodeportivo.com** → el cartel de la jornada que viene.
- **dataradar.es** → el marcador, de donde salen los signos al terminar los partidos.

La fuente oficial de SELAE (`loteriasyapuestas.es/servicios/fechav3`) sería la ideal,
pero está detrás de Akamai y se comprobó que devuelve **403** a todo lo que no sea un
navegador de verdad en una conexión doméstica — ni a curl, ni a un Chromium real desde
GitHub Actions. Por eso no se usa.

Si un día cambia el HTML de mundodeportivo, el workflow sale **en rojo** y los datos se
quedan como estaban, en vez de escribirse basura. El selector está en una línea:
`<div class="bg-name">`.

## Desplegar

Ya está hecho. Cada `git push` a `main` republica el sitio; no hay build, lo que subes es
lo que se sirve. Si empezaras de cero:

```bash
gh repo create quiniela-millonarios --public --source=. --push
gh api -X POST repos/:owner/quiniela-millonarios/pages -f "source[branch]=main" -f "source[path]=/"
```

Desde el móvil se puede añadir a la pantalla de inicio y queda como una app, que abre
directamente en el boleto.

## Detalles técnicos

- El dashboard es React 18 + PapaParse + Babel desde cdnjs; los gráficos son SVG escritos
  a mano, sin librería. El boleto es JavaScript plano, para que arranque rápido en el
  móvil.
- Paleta: fondo `#0C1512`, verde `#35C46B` (1), ámbar `#E9B949` (X), azul `#4A9DE0` (2).
  Tipografías Archivo y JetBrains Mono.
- Las páginas hay que abrirlas **por la URL publicada**, no con doble clic sobre el
  archivo: con `file://` el navegador bloquea la lectura de los `.json` y no cargan los
  partidos. Si pasa, la propia página lo avisa.
- `semilla-J1.csv` son las apuestas de la J1 en el formato de la hoja del formulario, por
  si algún día se monta.
