/**
 * Mantiene al día los tres archivos de datos del repo:
 *
 *   jornada.json     el cartel de la jornada en curso
 *   historico.json   los carteles de las jornadas ya pasadas
 *   resultados.json  los 14 signos de cada jornada terminada
 *
 * Fuentes (las tres responden desde un runner de GitHub; la oficial de SELAE
 * no, ver README sección 7):
 *
 *   quinielista.es  número de jornada y temporada oficiales
 *   mundodeportivo  el cartel de la jornada que viene
 *   dataradar.es    marcador en vivo, de donde salen los signos al terminar
 *
 * Node 20+, sin dependencias.  Uso:  node tools/actualizar-jornada.mjs
 *   --dry-run  no escribe nada, solo enseña lo que haría
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";

const URL_JORNADA = "https://static.quinielista.es/quinielista/jornada_quiniela.json";
const URL_CARTEL = "https://www.mundodeportivo.com/servicios/quiniela";
const URL_MARCADOR = "https://static.dataradar.es/marcador/json/partidos.json";

const DESTINO = new URL("../jornada.json", import.meta.url);
const HISTORICO = new URL("../historico.json", import.meta.url);
const RESULTADOS = new URL("../resultados.json", import.meta.url);
const DRY = process.argv.includes("--dry-run");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const pedir = (u, tipo) =>
  fetch(u, { headers: { "User-Agent": UA, "Accept-Language": "es-ES,es;q=0.9" } }).then((r) => {
    if (!r.ok) throw new Error(`${u} respondió ${r.status}`);
    return tipo === "buffer" ? r.arrayBuffer() : r.json();
  });

const leer = (ruta, porDefecto) =>
  existsSync(ruta) ? JSON.parse(readFileSync(ruta, "utf8")) : porDefecto;

const escribir = (ruta, dato) => {
  if (!DRY) writeFileSync(ruta, JSON.stringify(dato, null, 2) + "\n");
};

/** quinielista numera la temporada por el año en que acaba: 2027 = 2026-2027. */
const temporadaTexto = (n) => `${n - 1}-${n}`;

/* ---------- el cartel, del HTML de mundodeportivo ---------- */

/** La página declara utf-8 pero sirve windows-1252. Si al decodificar como
 *  utf-8 aparecen caracteres de reemplazo, reintentamos con 1252. */
function decodificar(buf) {
  const utf8 = new TextDecoder("utf-8").decode(buf);
  if (!utf8.includes("�")) return utf8;
  return new TextDecoder("windows-1252").decode(buf);
}

const MAYUS = new Set(["FC", "CF", "CD", "SD", "UD", "RCD", "AD", "SAD", "B", "AIK"]);
function capitalizar(nombre) {
  return nombre
    .toLowerCase()
    .split(/(\s+|\.)/)
    .map((tr) => {
      if (/^\s+$/.test(tr) || tr === ".") return tr;
      const alta = tr.toUpperCase();
      if (MAYUS.has(alta)) return alta;
      return tr.charAt(0).toUpperCase() + tr.slice(1);
    })
    .join("");
}

function extraerCartel(html) {
  const nombres = [...html.matchAll(/<div class="bg-name">(.*?)<\/div>/gs)].map((m) =>
    m[1].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim()
  );
  // 16 entradas: los 14 de la quiniela + las dos mitades del Pleno al 15.
  if (nombres.length < 15) {
    throw new Error(`Esperaba al menos 15 nombres, encontré ${nombres.length}. ¿Cambió el HTML?`);
  }
  const partidos = nombres.slice(0, 14).map((n, i) => {
    const [local, visitante] = n.split(/\s+-\s+/);
    if (!local || !visitante) throw new Error(`Partido ${i + 1} ilegible: "${n}"`);
    return { partido: i + 1, local: capitalizar(local), visitante: capitalizar(visitante) };
  });
  const resto = nombres.slice(14);
  const pleno15 =
    resto.length >= 2
      ? { local: capitalizar(resto[0]), visitante: capitalizar(resto[1]) }
      : (() => {
          const [l, v] = resto[0].split(/\s+-\s+/);
          return { local: capitalizar(l), visitante: capitalizar(v) };
        })();
  return { partidos, pleno15 };
}

/* ================== a trabajar ================== */

const meta = await pedir(URL_JORNADA);
const actual = meta && meta.Quiniela && meta.Quiniela.jornada_actual;
if (!actual || !actual.num) throw new Error("No pude leer la jornada actual de quinielista");

const jornada = Number(actual.num);
const temporada = temporadaTexto(Number(actual.temporada));
const previo = leer(DESTINO, null);

console.log(`Jornada en juego según quinielista: J${jornada} (${temporada}).`);

/* ---------- 1. cartel ---------- */
// El número lo manda quinielista, así que ya no hay que adivinarlo contando
// carteles: si cambia el par (temporada, jornada), es jornada nueva y punto.
const esJornadaNueva = !previo || previo.jornada !== jornada || previo.temporada !== temporada;

if (!esJornadaNueva) {
  console.log("Sigue siendo la misma jornada: no toco el cartel.");
} else {
  const { partidos, pleno15 } = extraerCartel(decodificar(await pedir(URL_CARTEL, "buffer")));

  if (previo) {
    const hist = leer(HISTORICO, []);
    const yaEsta = hist.some(
      (h) => h.jornada === previo.jornada && h.temporada === previo.temporada
    );
    if (!yaEsta) {
      hist.push({
        temporada: previo.temporada,
        jornada: previo.jornada,
        partidos: previo.partidos,
        pleno15: previo.pleno15,
      });
      hist.sort(
        (a, b) => String(a.temporada).localeCompare(String(b.temporada)) || a.jornada - b.jornada
      );
      escribir(HISTORICO, hist);
      console.log(`J${previo.jornada} archivada en historico.json (${hist.length} guardadas).`);
    }
  }

  escribir(DESTINO, {
    _comentario:
      "Generado por tools/actualizar-jornada.mjs. No editar a mano: se reescribe solo. " +
      "Respaldo de boleto.html cuando la hoja aún no tiene cargada la jornada. " +
      "Ver README, sección 7.",
    _fuentes: { jornada: URL_JORNADA, cartel: URL_CARTEL },
    _actualizado: new Date().toISOString().slice(0, 10),
    temporada,
    jornada,
    partidos,
    pleno15,
  });
  console.log(`Cartel nuevo escrito para la J${jornada}:`);
  for (const p of partidos) console.log(`  ${String(p.partido).padStart(2)}. ${p.local} – ${p.visitante}`);
  console.log(`  P15. ${pleno15.local} – ${pleno15.visitante}`);
}

/* ---------- 2. resultados ---------- */
// El marcador solo tiene la jornada que se está jugando, así que hay que
// pillarla cuando termina. Como cada partido dice a qué jornada pertenece, no
// hay que adivinar nada: se guarda bajo la suya.
const marcador = await pedir(URL_MARCADOR);
const partidosM = (Array.isArray(marcador) ? marcador : [])
  .filter((p) => p && p.orden >= 1 && p.orden <= 14)
  .sort((a, b) => a.orden - b.orden);

if (partidosM.length !== 14) {
  console.log(`El marcador trae ${partidosM.length} partidos de los 14: no guardo resultados.`);
} else {
  const terminados = partidosM.filter((p) => p.estado === "Finalizado").length;
  const jm = Number(partidosM[0].jornada);
  const tm = temporadaTexto(Number(partidosM[0].temporada));
  const signos = partidosM.map((p) => String(p.signo || "").trim().toUpperCase());
  const validos = signos.every((s) => s === "1" || s === "X" || s === "2");

  if (terminados < 14 || !validos) {
    console.log(`J${jm} (${tm}): ${terminados}/14 terminados. Todavía no hay resultado que guardar.`);
  } else {
    const res = leer(RESULTADOS, []);
    const yaEsta = res.some((r) => r.jornada === jm && r.temporada === tm);
    if (yaEsta) {
      console.log(`J${jm} (${tm}): el resultado ya estaba guardado.`);
    } else {
      res.push({ temporada: tm, jornada: jm, signos: signos.join(",") });
      res.sort((a, b) => String(a.temporada).localeCompare(String(b.temporada)) || a.jornada - b.jornada);
      escribir(RESULTADOS, res);
      console.log(`J${jm} (${tm}) terminada: guardado ${signos.join(",")}`);
    }
  }
}

if (DRY) console.log("\n--dry-run: no se ha escrito nada.");
