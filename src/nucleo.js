/**
 * Lo que sabe Mérida de una colección: convierte la lista de archivos de una
 * fuente en un catálogo y en las respuestas de stream de Stremio. Sin red ni
 * estado. El ID de IMDb sale del nombre de la carpeta: aquí no se adivina nada.
 *
 *   Series/<Título> (<año>) [ttXXXXXXX]/Temporada NN/<archivo con SxxEyy>.mkv
 *   Pelis/<Título> (<año>) [ttXXXXXXX]/<archivo>.mkv
 */

const VIDEO = /\.(mkv|mp4|m4v|webm|mov|avi)$/i;

/** @returns {{ id: string, nombre: string, anio?: string } | null} los datos de `Título (año) [ttXXX]` */
export function datosCarpeta(carpeta) {
  const m = carpeta.match(/^(.*?)\s*(?:\((\d{4})\)\s*)?\[(tt\d{5,})\]/);
  return m && { id: m[3], nombre: m[1], ...(m[2] && { anio: m[2] }) };
}

/**
 * Los capítulos de un nombre de archivo: S01E02, s1e2, S01E01E02, S01E01-E03.
 * @returns {{ temporada: number, episodios: number[] } | null}
 */
export function capitulos(nombre) {
  const m = nombre.match(/(?:^|[^a-z0-9])s(\d{1,2})[ ._-]?e(\d{1,3})((?:[ ._-]*-?[ ._-]*e\d{1,3})*)(?![a-z0-9])/i);
  if (!m) return null;
  const numeros = [m[2], ...[...m[3].matchAll(/\d+/g)].map((x) => x[0])].map(Number);
  const desde = Math.min(...numeros);
  const hasta = Math.max(...numeros);
  // Más de 10 de golpe no es un capítulo doble: mejor quedarse con el primero.
  const episodios = hasta - desde < 10 ? Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i) : [desde];
  return { temporada: Number(m[1]), episodios };
}

/** `alto=2160;audio=spa,eng` → { alto: '2160', audio: 'spa,eng' }. En OneDrive, el campo descripción. */
export function leerDescripcion(texto) {
  const d = {};
  for (const par of String(texto ?? '').split(';')) {
    const i = par.indexOf('=');
    if (i > 0) d[par.slice(0, i).trim()] = par.slice(i + 1).trim();
  }
  return d;
}

/**
 * La calidad, de lo que haya: la descripción que escribió quien subió el archivo
 * (lo único que sabe los idiomas), lo que midió Microsoft o el nombre del archivo.
 * El ancho cuenta tanto como el alto: una peli panorámica en 1080p mide 1920×800.
 */
export function calidad(nombre, ancho, alto) {
  const a = Number(ancho) || 0;
  const h = Number(alto) || 0;
  if (a >= 3000 || h >= 1800) return '2160p';
  if (a >= 1800 || h >= 1000) return '1080p';
  if (a >= 1200 || h >= 700) return '720p';
  if (a || h) return 'SD';
  if (/2160p|\b4k\b|\buhd\b/i.test(nombre)) return '2160p';
  if (/1080p/i.test(nombre)) return '1080p';
  if (/720p/i.test(nombre)) return '720p';
  return /\b(480p|576p|dvdrip)\b/i.test(nombre) ? 'SD' : null;
}

function codec(nombre, dicho) {
  if (dicho) return { hevc: 'HEVC', h265: 'HEVC', h264: 'H.264', avc: 'H.264', av1: 'AV1' }[dicho.toLowerCase()] ?? dicho.toUpperCase();
  if (/x\.?265|hevc|h\.?265/i.test(nombre)) return 'HEVC';
  if (/x\.?264|h\.?264|\bavc\b/i.test(nombre)) return 'H.264';
  return /\bav1\b/i.test(nombre) ? 'AV1' : null;
}

const IDIOMAS = { spa: 'Español', es: 'Español', 'es-es': 'Castellano', cas: 'Castellano', lat: 'Latino', 'es-419': 'Latino', eng: 'Inglés', en: 'Inglés', jpn: 'Japonés', ja: 'Japonés', fre: 'Francés', fra: 'Francés', ger: 'Alemán', deu: 'Alemán', ita: 'Italiano', por: 'Portugués', kor: 'Coreano', chi: 'Chino', zho: 'Chino', rus: 'Ruso' };
const idiomas = (audio) => (audio ? audio.split(',').filter((x) => x && x !== 'und').map((x) => IDIOMAS[x.toLowerCase()] ?? x) : []);

function gigas(n) {
  return `${(n / 1e9).toLocaleString('es-ES', { maximumFractionDigits: 1 })} GB`;
}

/** El stream de Stremio para un archivo. */
export function aStream(a, { etiqueta = '🏠 Mérida', modo = 'proxy' } = {}) {
  const d = leerDescripcion(a.descripcion);
  const q = calidad(a.nombre, d.ancho ?? a.video?.width, d.alto ?? a.video?.height);
  const hdr = d.hdr ? d.hdr.toUpperCase() : a.nombre.match(/hdr10\+?|dolby.?vision|\bhdr\b/i)?.[0].toUpperCase();
  const voces = idiomas(d.audio);
  const lineas = [[q, codec(a.nombre, d.video), hdr, a.tamano && gigas(a.tamano)].filter(Boolean).join(' · ')];
  if (voces.length) lineas.push(`🔊 ${voces.join(', ')}`);
  const texto = lineas.join('\n');
  return {
    name: etiqueta,
    // Solo uno de los dos: en las apps nuevas `title` es un alias de `description`, y
    // mandar ambos es un campo duplicado que hace descartar la respuesta entera. Este
    // lo leen todas; las antiguas no conocen el otro.
    title: texto,
    url: a.url + (modo === 'redirect' ? '?m=redirect' : ''),
    behaviorHints: {
      // No es MP4: en el navegador tiene que pasar por el servidor de streaming de Stremio.
      notWebReady: true,
      // Mismo grupo = el siguiente capítulo entra solo, con la misma calidad.
      bingeGroup: `merida-${q ?? 'sin-calidad'}`,
      // Con esto aciertan los addons de subtítulos.
      filename: a.nombre,
      ...(a.tamano && { videoSize: a.tamano }),
    },
  };
}

/** Dónde va un archivo; null si no es un vídeo de la colección. */
export function clasificar(a) {
  if (!VIDEO.test(a.nombre)) return null;
  if (a.tamano === 0) return null; // el hueco que deja OneDrive mientras hay una subida a medias
  const carpetas = a.ruta.split('/').slice(0, -1);
  if (carpetas.some((c) => c.startsWith('.'))) return null; // carpetas ocultas: pruebas y demás
  const datos = carpetas.map(datosCarpeta).findLast(Boolean);
  if (!datos) return null;
  const caps = capitulos(a.nombre);
  if (caps) return { ...datos, type: 'series', ...caps };
  // Una carpeta de temporada con un archivo sin SxxEyy es un extra, no una peli.
  return carpetas.some((c) => /^temporada\s*\d+$/i.test(c)) ? null : { ...datos, type: 'movie' };
}

// Por orden de calidad y, a igualdad, el más pesado: lo normal es querer el mejor.
function ordenar(streams) {
  const peso = (s) => ({ '2160p': 4, '1080p': 3, '720p': 2, SD: 1 })[s.behaviorHints.bingeGroup.slice(7)] ?? 0;
  return streams.sort((a, b) => peso(b) - peso(a) || (b.behaviorHints.videoSize ?? 0) - (a.behaviorHints.videoSize ?? 0));
}

/**
 * @param {Array<{ nombre: string, ruta: string, url: string, tamano?: number, descripcion?: string, video?: object, modificado?: string }>} archivos
 * @returns {{ catalogos: { movie: object[], series: object[] }, streams: Map<string, object[]> }}
 */
export function indexar(archivos, opciones) {
  const titulos = new Map();
  const streams = new Map();
  const poner = (clave, s) => streams.set(clave, [...(streams.get(clave) ?? []), s]);
  const dentro = archivos.map((a) => ({ a, c: clasificar(a) })).filter((x) => x.c);
  // Si un título tiene capítulos es una serie: lo demás de su carpeta son extras.
  const series = new Set(dentro.filter((x) => x.c.type === 'series').map((x) => x.c.id));

  for (const { a, c } of dentro) {
    if (c.type === 'movie' && series.has(c.id)) continue;
    const t = titulos.get(c.id) ?? { id: c.id, type: c.type, name: c.nombre, ...(c.anio && { releaseInfo: c.anio }), poster: `https://images.metahub.space/poster/medium/${c.id}/img`, reciente: '' };
    if ((a.modificado ?? '') > t.reciente) t.reciente = a.modificado;
    titulos.set(c.id, t);
    const s = aStream(a, opciones);
    if (c.type === 'movie') poner(c.id, s);
    else for (const e of c.episodios) poner(`${c.id}:${c.temporada}:${e}`, s);
  }
  for (const lista of streams.values()) ordenar(lista);

  // Lo último que ha llegado, primero.
  const metas = [...titulos.values()].sort((a, b) => b.reciente.localeCompare(a.reciente)).map(({ reciente, ...m }) => m);
  return { catalogos: { movie: metas.filter((m) => m.type === 'movie'), series: metas.filter((m) => m.type === 'series') }, streams };
}
