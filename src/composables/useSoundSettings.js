import { reactive } from 'vue'
import { CONFIGURACION_SONORA } from '../modules/sonification/music.js'

// A y B comparten el mapeo: una misma profundidad conserva su registro.
export const ajustesSonoros = reactive({ ...CONFIGURACION_SONORA })
export function restablecerSonido() { Object.assign(ajustesSonoros, CONFIGURACION_SONORA) }
