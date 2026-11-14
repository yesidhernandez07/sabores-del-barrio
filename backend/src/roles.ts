export const MODULES = ['Resumen', 'Inventario', 'Ventas', 'Quejas', 'Clientes'] as const

export type ModuleName = (typeof MODULES)[number]
export type RoleName = 'admin' | 'gerente' | 'cocinero' | 'caja' | 'mesero'

export const ROLE_MODULES: Record<RoleName, ModuleName[]> = {
  admin: ['Resumen', 'Inventario', 'Ventas', 'Quejas', 'Clientes'],
  gerente: ['Resumen', 'Inventario', 'Ventas', 'Clientes'],
  cocinero: ['Resumen', 'Inventario', 'Ventas'],
  caja: ['Resumen', 'Ventas', 'Clientes'],
  mesero: ['Resumen', 'Ventas']
}

export function hasModuleAccess(role: RoleName | string | undefined, moduleName: ModuleName | string): boolean {
  const safeRole = String(role || '').toLowerCase()
  const safeModule = String(moduleName)
  if (!safeRole || !safeModule) return false

  const allowed = ROLE_MODULES[safeRole as RoleName]
  return !!allowed && allowed.includes(safeModule as ModuleName)
}

export function hasAnyModuleAccess(role: RoleName | string | undefined, moduleNames: string[]): boolean {
  return moduleNames.some(moduleName => hasModuleAccess(role, moduleName))
}

export const DEMO_USERS = [
  { id: 1, nombre: 'Administrador', email: 'admin@saboresdelbarrio.com', password: 'admin123', role: 'admin' },
  { id: 2, nombre: 'Gerente', email: 'gerente@saboresdelbarrio.com', password: 'gerente123', role: 'gerente' },
  { id: 3, nombre: 'Cocina', email: 'cocina@saboresdelbarrio.com', password: 'cocina123', role: 'cocinero' },
  { id: 4, nombre: 'Caja', email: 'caja@saboresdelbarrio.com', password: 'caja123', role: 'caja' },
  { id: 5, nombre: 'Mesero', email: 'mesero@saboresdelbarrio.com', password: 'mesero123', role: 'mesero' }
] as const
