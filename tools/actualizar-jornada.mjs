/**
 * Mantiene al día los cuatro archivos de datos del repo:
 *
 *   jornada.json     el cartel de la jornada en curso
 *   historico.json   los carteles de las jornadas ya pasadas
 *   resultados.json  los 14 signos de cada jornada terminada
 *   escrutinio.json  los premios en euros de cada jornada terminada
 *
 * Fuentes (todas responden desde un runner de GitHub; la oficial de SELAE
 * no, ver README sección 7):
 *
 *   quinielista.es    número de jornada y temporada oficiales
 *   mundodeportivo    el cartel de la jornada que viene
 *   dataradar.es      marcador en vivo, de donde salen los signos al terminar
 *   eduardolosilla.es escrutinio (premios por categoría) de jornadas cerradas
 *
 * Node 20+, sin dependencias.  Uso:  node tools/actualizar-jornada.mjs
 *   --dry-run  no escribe nada, solo enseña lo que haría
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";

const URL_JORNADA = "https://static.quinielista.es/quinielista/jornada_quiniela.json";
const URL_CARTEL = "https://www.mundodeportivo.com/servicios/quiniela";
const URL_MARCADOR = "https://static.dataradar.es/marcador/json/partidos.json";
const URL_ESCRUTINIO = (n) => `https://www.eduardolosilla.es/quiniela/ayudas/escrutinio/jornada_${n}`;

const DESTINO = new URL("../jornada.json", import.meta.url);
const HISTORICO = new URL("../historico.json", import.meta.url);
const RESULTADOS = new URL("../resultados.json", import.meta.url);
const ESCRUTINIO = new URL("../escrutinio.json", import.meta.url);
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
  // La cabecera del boleto dice de qué jornada es el cartel. Hace falta para no
  // guardar el cartel viejo con el número nuevo: quinielista puede pasar de
  // jornada antes de que mundodeportivo cambie el boleto.
  const num = html.match(/class="js-num-jornada">\s*(\d+)\s*</);
  if (!num) throw new Error("No encontré el número de jornada del cartel. ¿Cambió el HTML?");
  const jornadaCartel = Number(num[1]);

  const nombres =[...html.matchAll(/<div class="bg-name">(.*?)<\/div>/gs)].map((m) =>
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
  return { jornadaCartel, partidos, pleno15 };
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
// Un cartel sin verificar (o guardado antes de que existiera la comprobación)
// se vuelve a pedir en cada pasada hasta que mundodeportivo sirva el de esta
// jornada.
const cartelVerificado = !esJornadaNueva && previo.cartelJornada === jornada;

const cartel = cartelVerificado
  ? null
  : extraerCartel(decodificar(await pedir(URL_CARTEL, "buffer")));

if (cartelVerificado) {
  console.log("Sigue siendo la misma jornada y el cartel ya es el suyo: no lo toco.");
} else if (cartel.jornadaCartel !== jornada) {
  console.log(`mundodeportivo todavía sirve el cartel de la J${cartel.jornadaCartel}, ` +
              `no el de la J${jornada}: no lo guardo, reintento en la próxima pasada.`);
} else {
  const { partidos, pleno15 } = cartel;

  if (previo && esJornadaNueva) {
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
    cartelJornada: cartel.jornadaCartel,
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
const todosM = Array.isArray(marcador) ? marcador : [];
const partidosM = todosM
  .filter((p) => p && p.orden >= 1 && p.orden <= 14)
  .sort((a, b) => a.orden - b.orden);

/* El Pleno al 15 son los goles de cada equipo, y M es "3 o más". La fuente los
   da pegados ("01", "12"…), así que se separan y se recorta a M. */
function plenoDelMarcador() {
  const p15 = todosM.filter((p) => p && p.orden === 15)[0];
  if (!p15 || p15.estado !== "Finalizado") return "";
  const golesA = (n) => (n === "0" || n === "1" || n === "2" ? n : "M");
  const bruto = String(p15.signo_goles || "").trim();
  if (bruto.length >= 2) return golesA(bruto[0]) + "-" + golesA(bruto[1]);
  const l = p15.local_goles, v = p15.visitante_goles;
  if (l == null || v == null) return "";
  return golesA(String(Math.min(Number(l), 3))) + "-" + golesA(String(Math.min(Number(v), 3)));
}

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
      const pleno = plenoDelMarcador();
      res.push({ temporada: tm, jornada: jm, signos: signos.join(","), pleno });
      res.sort((a, b) => String(a.temporada).localeCompare(String(b.temporada)) || a.jornada - b.jornada);
      escribir(RESULTADOS, res);
      console.log(`J${jm} (${tm}) terminada: guardado ${signos.join(",")}` +
                  (pleno ? ` | pleno ${pleno}` : " | sin pleno"));
    }
  }
}

/* ---------- 3. escrutinio (premios en euros) ---------- */
// eduardolosilla.es publica, para cada jornada, cuántos acertantes hubo y
// cuánto se lleva cada boleto en las categorías de 15 (14 signos + pleno),
// 14, 13, 12 y 11 aciertos. Tarda unos días en publicarse tras jugarse la
// jornada, así que se reintenta en cada pasada hasta que aparezca.
const CATEGORIAS_PREMIO = ["15", "14", "13", "12", "11"];

function euros(txt) {
  return Number(String(txt).trim().replace(/\./g, "").replace(",", "."));
}

/** Aún si la página carga, el escrutinio no está listo hasta que SELAE lo
 *  publica: mientras tanto todas las categorías, incluida la de "10
 *  aciertos" (que con miles de apostantes nunca es cero de verdad), salen a
 *  0. Ese es el aviso de "todavía no": ni se guarda ni se reintenta ya. */
function extraerEscrutinio(html, jornadaEsperada, temporadaEsperada) {
  // El selector de jornadas de la página lista TODAS las jornadas como
  // opciones (cada una con su propio title="QUINIELA JORNADA N"), así que no
  // sirve para confirmar cuál se ha servido. El <link rel="canonical"> sí es
  // único por página.
  if (html.indexOf(`rel="canonical" href="https://www.eduardolosilla.es/quiniela/ayudas/escrutinio/jornada_${jornadaEsperada}"`) === -1) {
    throw new Error(`la página no confirma ser la jornada ${jornadaEsperada}`);
  }
  // La URL no lleva temporada: sirve la de la temporada en curso. Si
  // resultados.json guarda una jornada de una temporada ya cerrada (el
  // número se repite cada temporada), hay que comprobar la temporada en el
  // título ("JORNADA 5 - 26/27") para no colar el escrutinio equivocado.
  const cap = html.match(/JORNADA\s+\d+\s*-\s*(\d{2})\/(\d{2})/);
  if (!cap) throw new Error("no encontré la temporada en la página");
  const temporadaPagina = `20${cap[1]}-20${cap[2]}`;
  if (temporadaPagina !== temporadaEsperada) {
    throw new Error(`la página es de la temporada ${temporadaPagina}, no ${temporadaEsperada}`);
  }
  const porCategoria = {};
  for (const m of html.matchAll(
    /aciertos__qty">(\d+)<\/span>Aciertos[\s\S]*?acertantes">\s*([\d.]+)\s*<[\s\S]*?premio">\s*([\d.,]+)\s*€/g
  )) {
    porCategoria[m[1]] = { acertantes: Number(m[2].replace(/\./g, "")), premio: euros(m[3]) };
  }
  const diez = porCategoria["10"];
  if (!diez || diez.acertantes === 0) return null;

  const categorias = {};
  CATEGORIAS_PREMIO.forEach((c) => { if (porCategoria[c]) categorias[c] = porCategoria[c]; });
  return categorias;
}

const escrutinio = leer(ESCRUTINIO, []);
const resultadosCerrados = leer(RESULTADOS, []);
const pendientesEscrutinio = resultadosCerrados.filter(
  (r) => !escrutinio.some((e) => e.jornada === r.jornada && e.temporada === r.temporada)
);

for (const r of pendientesEscrutinio) {
  try {
    const html = decodificar(await pedir(URL_ESCRUTINIO(r.jornada), "buffer"));
    const categorias = extraerEscrutinio(html, r.jornada, r.temporada);
    if (!categorias) {
      console.log(`J${r.jornada}: escrutinio todavía no publicado.`);
      continue;
    }
    escrutinio.push({ temporada: r.temporada, jornada: r.jornada, categorias });
    escrutinio.sort(
      (a, b) => String(a.temporada).localeCompare(String(b.temporada)) || a.jornada - b.jornada
    );
    escribir(ESCRUTINIO, escrutinio);
    console.log(`J${r.jornada}: escrutinio guardado (categorías ${Object.keys(categorias).join(", ")}).`);
  } catch (e) {
    console.log(`J${r.jornada}: no se pudo leer el escrutinio (${e.message}).`);
  }
}

if (DRY) console.log("\n--dry-run: no se ha escrito nada.");
