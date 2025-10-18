/**
 * ============================================================================
 * ARCHIVO: ./ARBITRAGEXPLUS2025/apps/alpha-flux-terminal/src/lib/utils.js
 * SERVICIO: apps
 * ============================================================================
 * 
 * 📥 ENTRADA DE DATOS:
 *   DEPENDENCIAS: tailwind-merge, clsx
 * 
 * 🔄 TRANSFORMACIÓN:
 *   FUNCIONES: cn
 * 
 * 📤 SALIDA DE DATOS:
 *   EXPORTS: cn
 * 
 * 🔗 DEPENDENCIAS:
 *   - tailwind-merge
 *   - clsx
 * 
 * ============================================================================
 */

import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
