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

Cada cosa en su sitio:

| Qué | Dónde | Quién lo mantiene |
|---|---|---|
| Los 14 partidos de la jornada en curso | `jornada.json` | un bot, cada 3 horas |
| Los partidos de las jornadas pasadas | `historico.json` | el mismo bot, al cambiar de jornada |
| Los resultados de cada jornada | `resultados.json` | el mismo bot, al acabar los partidos |
| **Las apuestas** | la hoja del formulario | cada uno, desde el boleto |

Nadie tiene que tocar nada: cada uno guarda la suya desde el boleto y el resto va solo.

## El flujo de cada jornada

1. Los partidos de la jornada nueva **aparecen solos**.
2. Cada uno abre el boleto, marca sus 14 signos (y el Pleno al 15 si quiere) y pulsa
   **Guardar apuesta**. Se escribe sola en la hoja.
3. En el mismo boleto, al lado, se ven las tres apuestas juntas con las filas donde
   coincidís resaltadas: esa es la vista para echarla en TuLotero.
4. Cuando se juegue, **no hay que hacer nada**: los resultados se recogen solos y el
   dashboard se actualiza.

Los signos a medio marcar se guardan en el navegador, así que si alguien cierra la
página a mitad no pierde lo hecho. Se puede reenviar las veces que haga falta: **gana la
última** de cada jugador para esa jornada.

El **Pleno al 15** son los goles de cada equipo, donde `M` es 3 o más. Es opcional y no
cuenta para los 14 aciertos; se guarda pegado a los signos (`1,X,2,…,1|2-M`) y el bot
recoge también su resultado.

## El formulario (ya montado)

Una web en GitHub Pages no puede escribir en ningún sitio, así que el boleto manda las
apuestas a un **Google Form** que las vuelca en una hoja. Nadie ve ese formulario: es
fontanería. Si algún día hay que rehacerlo:

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

## De dónde salen los partidos y los resultados

Los actualiza `.github/workflows/jornada.yml` cada 3 horas, ejecutando
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
