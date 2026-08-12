/**
 * Actualiza jornada.json con los 14 partidos de la quiniela en curso.
 *
 * Fuente: mundodeportivo.com/servicios/quiniela — se usa esta y no la oficial
 * de SELAE porque SELAE está detrás de Akamai y devuelve 403 a cualquier cosa
 * que no sea un navegador real en conexión doméstica (ver README, sección 6).
 * Se comprobó que el orden de los 15 partidos coincide con el oficial.
 *
 * Node 20+, sin dependencias.  Uso:  node tools/actualizar-jornada.mjs
 *   --dry-run  no escribe nada, solo enseña lo que haría
 *   --seed     reescribe los partidos SIN subir el número de jornada. Sirve para
 *              fijar la base con la nomenclatura de la fuente, o para corregir a
 *              mano el número de jornada y volver a sincronizar.
 */

import { readFileSync, writeFileSync } from "node:fs";

const URL_FUENTE = "https://www.mundodeportivo.com/servicios/quiniela";
const DESTINO = new URL("../jornada.json", import.meta.url);
const DRY = process.argv.includes("--dry-run");
const SEED = process.argv.includes("--seed");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** La página declara utf-8 pero sirve windows-1252. Si al decodificar como
 *  utf-8 aparecen caracteres de reemplazo, reintentamos con 1252. */
function decodificar(buf) {
  const utf8 = new TextDecoder("utf-8").decode(buf);
  if (!utf8.includes("�")) return utf8;
  return new TextDecoder("windows-1252").decode(buf);
}

const MAYUS = new Set(["FC", "CF", "CD", "SD", "UD", "RCD", "AD", "SAD", "B"]);
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

function extraerPartidos(html) {
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
  const pleno15 = resto.length >= 2
    ? { local: capitalizar(resto[0]), visitante: capitalizar(resto[1]) }
    : (() => {
        const [l, v] = resto[0].split(/\s+-\s+/);
        return { local: capitalizar(l), visitante: capitalizar(v) };
      })();
  return { partidos, pleno15 };
}

/* Cuántos de los 14 partidos han cambiado.
   No basta con comparar nombres exactos: la fuente los retoca de vez en cuando
   ("Celta B" pasó a "Celta Fortuna" a media tarde) y eso no es una jornada
   nueva. Una jornada nueva cambia casi los 14 a la vez, así que decidimos por
   umbral: pocos cambios = mismo cartel con otro nombre. */
const UMBRAL_JORNADA_NUEVA = 5;

const norm = (s) =>
  s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9]/g, "");

const cuantosCambian = (a, b) =>
  a.length !== b.length
    ? Infinity
    : a.reduce(
        (n, p, i) =>
          n + (norm(p.local) !== norm(b[i].local) || norm(p.visitante) !== norm(b[i].visitante) ? 1 : 0),
        0
      );

const res = await fetch(URL_FUENTE, {
  headers: { "User-Agent": UA, "Accept-Language": "es-ES,es;q=0.9" },
});
if (!res.ok) throw new Error(`La fuente respondió ${res.status}`);
const html = decodificar(await res.arrayBuffer());

const { partidos, pleno15 } = extraerPartidos(html);
const previo = JSON.parse(readFileSync(DESTINO, "utf8"));

const cambios = cuantosCambian(partidos, previo.partidos);
const jornadaNueva = !SEED && cambios >= UMBRAL_JORNADA_NUEVA;

if (!SEED && cambios === 0) {
  console.log(`Sin cambios: sigue la J${previo.jornada} (${partidos[0].local} – ${partidos[0].visitante}).`);
  process.exit(0);
}
if (!SEED && !jornadaNueva) {
  // Solo han retocado nombres. Reescribir aquí haría que el bot commiteara
  // ida y vuelta cada vez que la fuente cambia de nodo de caché, así que
  // dejamos el fichero como está: el cartel es el mismo.
  console.log(
    `${cambios} partido(s) solo con el nombre retocado: sigue la J${previo.jornada}, no toco nada.`
  );
  process.exit(0);
}

// El número de jornada de la fuente es su propia numeración, no la de SELAE,
// así que lo llevamos nosotros: cartel nuevo = jornada siguiente.
// Al empezar temporada hay que poner jornada 0 y temporada nueva a mano.
const salida = {
  ...previo,
  _comentario:
    "Generado por tools/actualizar-jornada.mjs. No editar a mano salvo el número " +
    "de jornada o la temporada. Respaldo de boleto.html cuando la hoja aún no " +
    "tiene cargada la jornada. Ver README, sección 6.",
  _fuente: URL_FUENTE,
  _actualizado: new Date().toISOString().slice(0, 10),
  jornada: jornadaNueva ? previo.jornada + 1 : previo.jornada,
  partidos,
  pleno15,
};
delete salida.fecha_sorteo;
delete salida.cierre;

if (jornadaNueva) console.log(`Jornada nueva: J${previo.jornada} → J${salida.jornada}`);
else if (SEED) console.log(`Base fijada en J${salida.jornada} (sin subir jornada).`);
for (const p of partidos) console.log(`  ${String(p.partido).padStart(2)}. ${p.local} – ${p.visitante}`);
console.log(`  P15. ${pleno15.local} – ${pleno15.visitante}`);

if (DRY) {
  console.log("\n--dry-run: no se ha escrito nada.");
} else {
  writeFileSync(DESTINO, JSON.stringify(salida, null, 2) + "\n");
  console.log("\njornada.json actualizado.");
}
