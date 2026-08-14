# Quiniela Millonarios

Dashboard de La Quiniela para **Henry, Pedro y Adri**. Sin build, sin dependencias:
tres archivos sueltos servidos por GitHub Pages, que leen los datos de un Google Sheet
publicado como CSV.

- `index.html` — dashboard: clasificación, evolución acumulada, aciertos por jornada,
  sesgo de signo 1/X/2 y el último boleto.
- `boleto.html` — formulario móvil para rellenar la jornada pendiente y mandarla por WhatsApp.
- `combinar.html` — las tres apuestas juntas, para pasarlas a TuLotero o a la hoja de una vez.
- `jornada.json` — los 14 partidos de la jornada en curso. Se actualiza solo. Ver sección 6.
- `tools/actualizar-jornada.mjs` + `.github/workflows/jornada.yml` — lo que lo actualiza.
- `README.md` — esto.

---

## 0. Cómo se guardan las cosas

Hay tres sitios, y cada uno guarda una cosa distinta:

Todo vive en el propio repo. No hace falta configurar nada para que funcione:

| Qué | Dónde | Quién lo mantiene |
|---|---|---|
| Los 14 partidos de la jornada en curso | `jornada.json` | un bot, dos veces al día |
| Los partidos de las jornadas ya pasadas | `historico.json` | el mismo bot, al cambiar de jornada |
| Los resultados de cada jornada | `resultados.json` | el mismo bot, al terminarse los partidos |
| **Las apuestas** | `apuestas.json` | **a mano, una vez por jornada** |

Lo único que se mete a mano son **las apuestas**: `combinar.html` te da el bloque ya
escrito y lo pegas en `apuestas.json`. Todo lo demás se actualiza solo.

Opcionalmente se puede montar un Google Form para que cada uno guarde la suya desde el
móvil y no haya ni que pegar (sección 4). No es obligatorio: si no lo montas, el repo
sigue siendo el sitio donde se guardan.

Si alguna vez el resultado automático viniera mal, se corrige a mano en `resultados.json`.

## 1. La hoja de cálculo

Crea un Google Sheet con una pestaña llamada **`boletos`** y esta cabecera exacta en la fila 1:

| temporada | jornada | partido | local | visitante | resultado | henry | pedro | adri |
|-----------|---------|---------|-------|-----------|-----------|-------|-------|------|
| 2025/26   | 1       | 1       | Betis | Sevilla   | 1         | 1     | X     | 1    |
| 2025/26   | 1       | 2       | Valencia | Girona | X         | 1     | X     | 2    |

Reglas:

- Una fila por partido: 14 filas por jornada.
- `resultado`, `henry`, `pedro`, `adri` son `1`, `X` o `2` (se acepta `x` minúscula).
- **Jornada no jugada = columna `resultado` vacía.** Es así como `boleto.html` detecta
  qué jornada hay que rellenar, y como el dashboard decide qué puntúa.
- Puedes dejar el pick de un jugador vacío: cuenta como fallo, no rompe nada.
- El orden de las columnas da igual; el de las filas también (se ordenan por `partido`).

## 2. Publicar la hoja como CSV

En el Google Sheet:

1. **Archivo → Compartir → Publicar en la Web**.
2. En el primer desplegable elige la pestaña **`boletos`** (no "Documento completo").
3. En el segundo elige **Valores separados por comas (.csv)**.
4. Pulsa **Publicar** y acepta.
5. Copia la URL. Tendrá esta pinta:

```
https://docs.google.com/spreadsheets/d/e/2PACX-1vSomethingLargo/pub?gid=0&single=true&output=csv
```

> Publicar en la web hace que **cualquiera con la URL pueda leer esos datos**. Es una
> quiniela entre amigos, pero no metas nada personal en la hoja.

Si prefieres no publicar, sirve también la URL de exportación de una hoja compartida
"con cualquiera que tenga el enlace":
`https://docs.google.com/spreadsheets/d/<ID>/gviz/tq?tqx=out:csv&sheet=boletos`

## 3. Configurar los archivos

Edita la constante que hay arriba del `<script>` en **los dos** archivos:

- `index.html` → `const CSV_URL = "...";`
- `boleto.html` → `var CSV_URL = "...";` y, opcionalmente,
  `var WHATSAPP_TO = "34600111222";` (prefijo de país, sin `+` ni espacios).
  Si lo dejas vacío, WhatsApp preguntará a quién enviar el mensaje.

Mientras `CSV_URL` siga con el texto `PEGA_AQUI_LA_URL_CSV` —o si la descarga falla—
ambas páginas funcionan con **datos de demostración** y muestran un aviso ámbar.
Así puedes ver el diseño antes de tener la hoja lista.

## 4. El formulario (opcional)

Las apuestas se guardan en `apuestas.json` pegando el bloque que te da `combinar.html`.
Eso ya funciona sin montar nada.

Lo que aporta el formulario es quitarte ese pegado: cada uno le da a **Guardar apuesta**
en su móvil y se escribe sola en una hoja. Si te compensa, se monta así.

### Crear el formulario

1. En [forms.google.com](https://forms.google.com), formulario en blanco.
2. Tres preguntas, todas de tipo **Respuesta corta**, tituladas **exactamente** así
   (en minúscula, sin acentos): `jornada`, `nombre`, `signos`.
3. Arriba, en **Respuestas**, pulsa el icono de Sheets para volcarlas a una hoja.

### Sacar la URL y los tres `entry.N`

1. Botón **Enviar** → pestaña del enlace `< >` → copia el HTML incrustado, o abre el
   formulario y mira el código fuente de la página.
2. Busca `entry.` y verás tres números, uno por pregunta, en el mismo orden en que las
   creaste. Por ejemplo `entry.1234567890`.
3. La URL de envío es la del formulario cambiando el final `/viewform` por
   `/formResponse`.

### Rellenar las constantes

En **`boleto.html`** y en **`combinar.html`** (las mismas dos líneas en los dos):

```js
var FORM_ACTION = "https://docs.google.com/forms/d/e/TU_ID/formResponse";
var FORM_CAMPOS = { jornada: "entry.111", nombre: "entry.222", signos: "entry.333" };
```

En el boleto sale el botón **Guardar apuesta**, que manda la de quien lo rellena. En el
combinador sale **Guardar las 3**, que manda de golpe todas las columnas completas:
sirve para cuando te llegan por WhatsApp y las juntas tú. Mientras estas constantes
estén vacías, en su lugar salen los botones de WhatsApp de siempre.

Publica la hoja de respuestas como CSV (sección 2, pero eligiendo la pestaña de
respuestas) y pega esa URL en **`combinar.html`** y en **`index.html`**:

```js
var   CSV_APUESTAS = "https://docs.google.com/spreadsheets/d/e/.../pub?gid=...&output=csv";
const CSV_APUESTAS = "https://docs.google.com/spreadsheets/d/e/.../pub?gid=...&output=csv";
```

Con `CSV_APUESTAS` puesto, el dashboard lee de ahí y `CSV_URL` deja de usarse: ya no
hace falta la pestaña `boletos` con una fila por partido.

**Las apuestas de la J1** (las de Adri y Pedro, que se hicieron antes de que existiera
el formulario) están en `semilla-J1.csv`. Cuando tengas la hoja, pega esas dos filas
debajo de la cabecera y el dashboard ya las contará.

Un par de detalles de cómo se comporta:

- Google no deja leer la respuesta del envío desde otro dominio, así que el boleto sabe
  si el envío **salió**, pero no lo que Google contestó. Si falla la red sí se entera y
  te ofrece reintentar.
- Se puede reenviar las veces que haga falta: al leerlas, **gana la última** de cada
  jugador para esa jornada. Si alguien se equivoca, que la vuelva a mandar y ya está.
- Si tocas un signo después de guardar, el botón vuelve a "Guardar apuesta" para que no
  te quedes con una corrección sin enviar.

## 5. Desplegar en GitHub Pages

Ya está hecho en este repo, pero si empiezas de cero:

```bash
git init && git add . && git commit -m "Dashboard de la quiniela"
gh repo create quiniela-millonarios --public --source=. --push
gh api -X POST repos/:owner/quiniela-millonarios/pages -f "source[branch]=main" -f "source[path]=/"
```

O por la web: **Settings → Pages → Source: Deploy from a branch → `main` / `root` → Save**.

En un minuto tendrás:

- Dashboard: `https://<usuario>.github.io/quiniela-millonarios/`
- Boleto: `https://<usuario>.github.io/quiniela-millonarios/boleto.html`

Cada `git push` a `main` republica el sitio. No hay build: lo que subes es lo que se sirve.

## 6. El flujo de cada jornada

1. No haces nada: los partidos de la jornada nueva aparecen solos.
2. Pasas el enlace de `boleto.html` al grupo. Cada uno marca sus 14 signos.
3. Cada jugador pulsa **Enviar por WhatsApp**, que manda un código compacto tipo
   `[J9|Adri|1,X,2,1,1,X,...]`. (Con el formulario montado, en su lugar sale **Guardar
   apuesta** y no hay que mandar nada.)
4. Abres **`combinar.html`** y pegas los mensajes — vale la conversación entera de golpe,
   solo busca los códigos. Te deja las tres en una tabla, una columna por jugador:
   - La tabla en pantalla es la vista para ir metiéndolas en **TuLotero**: las filas
     donde los tres coinciden salen resaltadas.
   - **Copiar para guardar** te da el bloque de `apuestas.json`. Pulsas *Abrir
     apuestas.json*, lo pegas justo debajo del `[`, y **Commit changes**. Ya están
     guardadas y el dashboard las coge.
   - El botón **copiar** de cada cabecera te da esa columna sola, en vertical.
   - Cualquier casilla se corrige tocándola (`1 → X → 2 → vacío`).
5. Cuando se juegue la jornada, **tampoco haces nada**: el bot recoge los resultados del
   marcador en cuanto termina el último partido, y el dashboard se actualiza solo.

Los signos a medio rellenar se guardan en el navegador (`localStorage`), así que si
alguien cierra la página a mitad no pierde lo marcado.

## 7. Los partidos de la jornada (`jornada.json`)

`boleto.html` usa la hoja como fuente principal, pero si la hoja todavía no tiene
cargada la jornada pendiente, tira de **`jornada.json`**, que lleva los 14 partidos
reales. Así se puede rellenar el boleto en cuanto salen los partidos, sin que nadie
haya tocado el Sheet.

Lo actualiza solo `.github/workflows/jornada.yml`, dos veces al día, ejecutando
`tools/actualizar-jornada.mjs`. Solo hace commit si los partidos cambian de verdad.
Para lanzarlo a mano: pestaña **Actions → Actualizar jornada → Run workflow**, o en local:

```bash
node tools/actualizar-jornada.mjs --dry-run
```

### De dónde salen (y por qué no de la fuente oficial)

Los partidos oficiales salen de este servicio de SELAE:

```
https://www.loteriasyapuestas.es/servicios/fechav3?game_id=LAQU&fecha_sorteo=AAAAMMDD
```

Devuelve la jornada, los 15 partidos (14 + Pleno al 15) y, una vez jugada, el `signo`
de cada uno. Pero está detrás de Akamai y se comprobó que:

- No manda cabeceras CORS → la web **no** puede leerlo desde el navegador del usuario.
- Rechaza con **403** cualquier cliente que no sea un navegador real (curl, fetch de servidor…).
- Rechaza con **403** incluso un Chromium real si sale desde una IP de datacenter
  (probado en GitHub Actions).

O sea: ni GitHub Pages ni GitHub Actions pueden descargarlo. Solo pasa un navegador de
verdad en una conexión doméstica — o sea, tú, abriendo esa URL a mano.

Por eso el script tira de **mundodeportivo.com/servicios/quiniela**, que sí responde
desde un runner. Se comprobó que publica los mismos 15 partidos y en el mismo orden
que SELAE.

### Dos cosas que hay que saber

**El número de jornada lo llevamos nosotros.** La fuente usa su propia numeración
(llamaba "76" a la que SELAE numera como 1 de la temporada 2026-2027), así que el script
lo lleva por su cuenta: cartel nuevo = jornada + 1. Dos consecuencias:

- Al empezar temporada hay que editar `jornada.json` a mano (`jornada` y `temporada`).
- Si alguna vez se descuadra, se corrige el número a mano y ya sigue bien.

**Un renombrado no es una jornada nueva.** La fuente alterna nombres según el nodo de
caché (se la pilló cambiando "Celta B" por "Celta Fortuna" y volviendo). Por eso el
script cuenta cuántos de los 14 cambian: a partir de 5 lo da por cartel nuevo, y por
debajo lo trata como un simple renombrado y no toca el fichero.

Si un día la fuente cambia el HTML, el script fallará en voz alta (el workflow sale en
rojo) en vez de escribir basura, y `jornada.json` se queda como estaba. Para
arreglarlo, el selector está en una sola línea: `<div class="bg-name">`.

## 8. Detalles técnicos

- React 18 + PapaParse + Babel standalone, todo desde cdnjs; los gráficos son SVG
  escritos a mano, sin librería de charts.
- Paleta: fondo `#0C1512`, verde `#35C46B` (1), ámbar `#E9B949` (X), azul `#4A9DE0` (2).
  Tipografías Archivo y JetBrains Mono desde Google Fonts.
- `boleto.html` es JavaScript plano (sin React) para que arranque rápido en el móvil.
- Babel compila el JSX en el navegador: cómodo para editar, pero implica ~1s de arranque.
  Si algún día molesta, la alternativa es precompilar — a costa de necesitar un build.
