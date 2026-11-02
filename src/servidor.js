/**
 * Mérida: addon de Stremio. Solo contesta JSON; los vídeos los sirve la fuente.
 *
 *   /<token>/manifest.json
 *   /<token>/catalog/<tipo>/<id>.json
 *   /<token>/stream/<tipo>/<id>.json
 *   POST /refrescar   con `Authorization: Bearer <clave de Segovia>`
 *   /logo.png
 */
import { readFileSync } from 'node:fs';
import { timingSafeEqual } from 'node:crypto';
import { indexar } from './nucleo.js';

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
const LOGO = readFileSync(new URL('../assets/logo.png', import.meta.url));

function iguales(a, b) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * @param {{ token: string, fuente: { listar: () => Promise<object[]>, claveValida: (c: string) => Promise<boolean> }, nombre?: string, etiqueta?: string, modo?: string }} op
 */
export function crearAddon({ token, fuente, nombre = 'Mérida', etiqueta, modo }) {
  let indice = { catalogos: { movie: [], series: [] }, streams: new Map() };
  let listo = false;
  let curso = Promise.resolve();

  // En fila: lo que se pida mientras otro lee puede venir de una subida recién
  // acabada, y ese listado ya no la vería. Si falla, se sigue con lo que había.
  const refrescar = () => {
    const este = curso.catch(() => {}).then(async () => {
      indice = indexar(await fuente.listar(), { etiqueta, modo });
      listo = true;
    });
    curso = este;
    return este;
  };

  const manifest = {
    id: 'community.merida',
    version,
    name: nombre,
    description: 'Tu colección de series y pelis, guardada en tu propio OneDrive.',
    resources: ['catalog', 'stream'],
    types: ['movie', 'series'],
    idPrefixes: ['tt'],
    catalogs: [
      { type: 'movie', id: 'merida-pelis', name: nombre },
      { type: 'series', id: 'merida-series', name: nombre },
    ],
  };

  /** @returns {{ status: number, datos: any }} */
  async function responder(metodo, ruta, autorizacion, base) {
    if (ruta === '/refrescar') {
      if (metodo !== 'POST') return { status: 405, datos: { error: 'Solo POST.' } };
      const clave = autorizacion?.match(/^Bearer (.+)$/)?.[1];
      if (!clave || !(await fuente.claveValida(clave))) return { status: 401, datos: { error: 'Falta una clave válida.' } };
      await refrescar();
      return { status: 200, datos: { titulos: indice.catalogos.movie.length + indice.catalogos.series.length } };
    }
    const [, t, recurso, tipo, resto] = ruta.split('/');
    if (metodo !== 'GET' || !t || !iguales(t, token)) return { status: 404, datos: { error: 'No existe.' } };
    // El logo tiene que ser una URL absoluta, y este servidor solo sabe su dirección por la petición.
    if (recurso === 'manifest.json') return { status: 200, datos: { ...manifest, ...(base && { logo: `${base}/logo.png` }) } };
    // Recién arrancado aún no hay índice: mejor esperar la primera lectura que decir que no hay nada.
    if (!listo) await curso.catch(() => {});
    const id = decodeURIComponent(resto ?? '').replace(/\.json$/, '');
    if (recurso === 'catalog') return { status: 200, datos: { metas: indice.catalogos[tipo] ?? [] } };
    if (recurso === 'stream') return { status: 200, datos: { streams: indice.streams.get(id) ?? [] } };
    return { status: 404, datos: { error: 'No existe.' } };
  }

  return {
    refrescar,
    get listo() {
      return listo;
    },
    responder,
    escuchar: async (req, res) => {
      const cabeceras = { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'cache-control': 'no-store' };
      if (req.method === 'OPTIONS') return res.writeHead(204, cabeceras).end();
      const ruta = new URL(req.url, 'http://x').pathname;
      if (ruta === '/logo.png') return res.writeHead(200, { 'content-type': 'image/png', 'access-control-allow-origin': '*', 'cache-control': 'max-age=86400' }).end(LOGO);
      const base = `${req.headers['x-forwarded-proto'] ?? 'http'}://${req.headers.host}`;
      const { status, datos } = await responder(req.method, ruta, req.headers.authorization, base).catch((e) => {
        console.error(e);
        return { status: 502, datos: { error: 'No se ha podido leer la colección.' } };
      });
      // El token abre el catálogo: no se escribe en el registro.
      console.log(`${req.method} ${ruta.replace(token, '…')} ${status}`);
      res.writeHead(status, cabeceras).end(JSON.stringify(datos));
    },
  };
}
