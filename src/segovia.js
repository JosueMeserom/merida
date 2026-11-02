/**
 * La fuente de la colección: una carpeta de OneDrive a través de Segovia.
 *
 * Otra fuente (una carpeta local, el día que haya NAS) solo tiene que dar lo mismo:
 * `listar()` con { nombre, ruta, url, tamano, descripcion, video, modificado }. El
 * progreso de Stremio va por ID de IMDb, que sale de las carpetas, así que cambiar
 * de fuente no hace perder a nadie por dónde iba.
 */
export function fuenteSegovia({ url, clave, ruta = '' }) {
  const pedir = (camino, c) => fetch(url.replace(/\/$/, '') + camino, { headers: { authorization: `Bearer ${c}` } });
  return {
    async listar() {
      const r = await pedir(`/api/lista?profundo=1&ruta=${encodeURIComponent(ruta)}`, clave);
      if (!r.ok) throw new Error(`Segovia responde ${r.status}: ${(await r.text()).slice(0, 200)}`);
      return (await r.json()).archivos;
    },
    /** Quien pide refrescar se identifica con su clave de Segovia: así aquí no hay otro secreto más que guardar. */
    claveValida: async (c) => (await pedir('/api/archivo?ruta=', c)).status === 200,
  };
}
