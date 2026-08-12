# Quiniela Millonarios

Dashboard de La Quiniela para **Henry, Pedro y Adri**. Sin build, sin dependencias:
tres archivos sueltos servidos por GitHub Pages, que leen los datos de un Google Sheet
publicado como CSV.

- `index.html` — dashboard: clasificación, evolución acumulada, aciertos por jornada,
  sesgo de signo 1/X/2 y el último boleto.
- `boleto.html` — formulario móvil para rellenar la jornada pendiente y mandarla por WhatsApp.
- `README.md` — esto.

---

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

## 4. Desplegar en GitHub Pages

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

## 5. El flujo de cada jornada

1. Metes en la hoja las 14 filas de la jornada nueva con `local`, `visitante` y
   `resultado` **vacío**.
2. Pasas el enlace de `boleto.html` al grupo. Cada uno marca sus 14 signos.
3. Cada jugador pulsa **Copiar signos** (te llegan los 14 en vertical, listos para pegar
   de un tirón en su columna) o **Enviar por WhatsApp**, que manda el resumen legible
   más un código compacto tipo `[J9|Adri|1,X,2,1,1,X,...]`.
4. Pegas los signos en la hoja. Cuando se juegue la jornada, rellenas `resultado`.
5. El dashboard se actualiza solo al recargar.

Los signos a medio rellenar se guardan en el navegador (`localStorage`), así que si
alguien cierra la página a mitad no pierde lo marcado.

## 6. Detalles técnicos

- React 18 + PapaParse + Babel standalone, todo desde cdnjs; los gráficos son SVG
  escritos a mano, sin librería de charts.
- Paleta: fondo `#0C1512`, verde `#35C46B` (1), ámbar `#E9B949` (X), azul `#4A9DE0` (2).
  Tipografías Archivo y JetBrains Mono desde Google Fonts.
- `boleto.html` es JavaScript plano (sin React) para que arranque rápido en el móvil.
- Babel compila el JSX en el navegador: cómodo para editar, pero implica ~1s de arranque.
  Si algún día molesta, la alternativa es precompilar — a costa de necesitar un build.
