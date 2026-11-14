import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import mysql from 'mysql2/promise'
import { DEMO_USERS, hasAnyModuleAccess, hasModuleAccess } from './roles'

const db = mysql.createPool({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASS, database: 'sabores_barrio', dateStrings: true })
const q = async (sql: string, p: any[] = []) => (await db.query(sql, p))[0] as any[]
const h = (f: (r: any) => Promise<any>) => async (req: any, res: any) => {
  try { res.json(await f(req)) } catch (e: any) { res.status(e.status || 500).json({ error: e.message }) }
}

const httpError = (message: string, status: number) => Object.assign(new Error(message), { status })

const tokens = new Map<string, (typeof DEMO_USERS)[number]>()

const requireAuth = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  const user = token ? tokens.get(token) : null

  if (!user) {
    return res.status(401).json({ error: 'No autorizado. Inicia sesión primero.' })
  }

  req.user = user
  next()
}

const requireModule = (moduleName: string) => (req: any, res: any, next: any) => {
  const user = req.user
  if (!user || !hasModuleAccess(user.role, moduleName)) {
    return res.status(403).json({ error: 'No tienes permisos para este módulo.' })
  }
  next()
}

const requireAnyModule = (...moduleNames: string[]) => (req: any, res: any, next: any) => {
  if (!req.user || !hasAnyModuleAccess(req.user.role, moduleNames)) {
    return res.status(403).json({ error: 'No tienes permisos para consultar estos datos.' })
  }
  next()
}

const app = express()
app.use(cors(), express.json())

app.post('/api/login', h(async (req: any) => {
  const { email, password } = req.body || {}
  const user = DEMO_USERS.find((u) => u.email === email && u.password === password)

  if (!user) {
    throw new Error('Credenciales inválidas.')
  }

  const token = `sabores-${user.role}-${Date.now()}`
  tokens.set(token, user)

  return {
    token,
    user: {
      id: user.id,
      nombre: user.nombre,
      email: user.email,
      rol: user.role
    }
  }
}))

app.get('/api/me', requireAuth, h(async (req: any) => ({ user: { id: req.user.id, nombre: req.user.nombre, email: req.user.email, rol: req.user.role } })))

// ---- Inventario, compras y desperdicio
app.get('/api/ingredientes', requireAuth, requireModule('Inventario'), h(() => q('SELECT * FROM ingredientes ORDER BY nombre')))
app.post('/api/ingredientes', requireAuth, requireModule('Inventario'), h(async r => {
  const b = r.body || {}
  const nombre = String(b.nombre || '').trim()
  const unidad = String(b.unidad || '').trim()
  const stock = Number(b.stock)
  const stockMinimo = Number(b.stock_minimo)
  if (!nombre || !unidad || nombre.length > 80 || unidad.length > 10 || !Number.isFinite(stock) || stock < 0 || !Number.isFinite(stockMinimo) || stockMinimo < 0) {
    throw httpError('Revisa nombre, unidad, stock y mínimo.', 400)
  }
  await q('INSERT INTO ingredientes(nombre,unidad,stock,stock_minimo) VALUES(?,?,?,?)', [nombre, unidad, stock, stockMinimo])
  return { ok: true }
}))
app.patch('/api/ingredientes/:id', requireAuth, requireModule('Inventario'), h(async r => {
  const b = r.body || {}
  const nombre = String(b.nombre || '').trim()
  const unidad = String(b.unidad || '').trim()
  const stockMinimo = Number(b.stock_minimo)
  if (!nombre || !unidad || nombre.length > 80 || unidad.length > 10 || !Number.isFinite(stockMinimo) || stockMinimo < 0) {
    throw httpError('Revisa nombre, unidad y stock mínimo.', 400)
  }
  const [ingrediente] = await q('SELECT id FROM ingredientes WHERE id=?', [r.params.id])
  if (!ingrediente) throw httpError('No se encontró el ingrediente.', 404)
  await q('UPDATE ingredientes SET nombre=?, unidad=?, stock_minimo=? WHERE id=?', [nombre, unidad, stockMinimo, r.params.id])
  return { ok: true }
}))
app.delete('/api/ingredientes/:id', requireAuth, requireModule('Inventario'), h(async r => {
  const [ingrediente] = await q('SELECT id FROM ingredientes WHERE id=?', [r.params.id])
  if (!ingrediente) throw httpError('No se encontró el ingrediente.', 404)
  const [recetas] = await q('SELECT COUNT(*) total FROM recetas WHERE ingrediente_id=?', [r.params.id])
  const [mermas] = await q('SELECT COUNT(*) total FROM mermas WHERE ingrediente_id=?', [r.params.id])
  if (Number(recetas.total) > 0 || Number(mermas.total) > 0) {
    throw httpError('No se puede borrar: este ingrediente aparece en recetas o mermas.', 409)
  }
  await q('DELETE FROM ingredientes WHERE id=?', [r.params.id])
  return { ok: true }
}))
app.post('/api/compras', requireAuth, requireModule('Inventario'), h(async r => {
  await q('UPDATE ingredientes SET stock=stock+? WHERE id=?', [r.body.cantidad, r.body.ingrediente_id])
  return { ok: true }
}))
app.post('/api/mermas', requireAuth, requireModule('Inventario'), h(async r => {
  const b = r.body
  await q('INSERT INTO mermas(ingrediente_id,cantidad,motivo,fecha) VALUES(?,?,?,NOW())', [b.ingrediente_id, b.cantidad, b.motivo])
  await q('UPDATE ingredientes SET stock=stock-? WHERE id=?', [b.cantidad, b.ingrediente_id])
  return { ok: true }
}))

// ---- Ventas y domicilios
app.get('/api/platos', requireAuth, requireModule('Ventas'), h(() => q('SELECT * FROM platos')))
app.get('/api/ventas', requireAuth, requireModule('Ventas'), h(() => q(`SELECT v.*, p.nombre plato, c.nombre cliente,
  TIMESTAMPDIFF(MINUTE, v.hora_pedido, v.hora_entrega) demora
  FROM ventas v JOIN platos p ON p.id=v.plato_id LEFT JOIN clientes c ON c.id=v.cliente_id ORDER BY v.id DESC LIMIT 50`)))
app.post('/api/ventas', requireAuth, requireModule('Ventas'), h(async r => {
  const { plato_id, cantidad, canal, cliente_id } = r.body
  const [plato] = await q('SELECT precio FROM platos WHERE id=?', [plato_id])
  const total = plato.precio * cantidad
  await q('INSERT INTO ventas(plato_id,cantidad,canal,cliente_id,total,fecha,hora_pedido) VALUES(?,?,?,?,?,NOW(),NOW())',
    [plato_id, cantidad, canal, cliente_id || null, total])
  await q('UPDATE ingredientes i JOIN recetas r ON r.ingrediente_id=i.id SET i.stock=i.stock-r.cantidad*? WHERE r.plato_id=?', [cantidad, plato_id])
  if (cliente_id) await q('UPDATE clientes SET puntos=puntos+FLOOR(?/1000) WHERE id=?', [total, cliente_id])
  return { ok: true }
}))
app.patch('/api/ventas/:id/entregar', requireAuth, requireModule('Ventas'), h(async r => { await q('UPDATE ventas SET hora_entrega=NOW() WHERE id=?', [r.params.id]); return { ok: true } }))

// ---- Clientes
app.get('/api/clientes', requireAuth, requireAnyModule('Clientes', 'Ventas', 'Quejas'), h(() => q('SELECT * FROM clientes ORDER BY puntos DESC')))
app.post('/api/clientes', requireAuth, requireModule('Clientes'), h(async r => { await q('INSERT INTO clientes(nombre,telefono) VALUES(?,?)', [r.body.nombre, r.body.telefono]); return { ok: true } }))

// ---- Quejas
app.get('/api/quejas', requireAuth, requireModule('Quejas'), h(() => q('SELECT q.*, c.nombre cliente FROM quejas q LEFT JOIN clientes c ON c.id=q.cliente_id ORDER BY q.viral DESC, q.id DESC')))
app.post('/api/quejas', requireAuth, requireModule('Quejas'), h(async r => {
  const b = r.body
  await q('INSERT INTO quejas(cliente_id,origen,descripcion,viral,fecha) VALUES(?,?,?,?,NOW())', [b.cliente_id || null, b.origen, b.descripcion, b.viral || 0])
  return { ok: true }
}))
app.patch('/api/quejas/:id', requireAuth, requireModule('Quejas'), h(async r => {
  await q('UPDATE quejas SET estado=?, aprendizaje=COALESCE(?,aprendizaje) WHERE id=?', [r.body.estado, r.body.aprendizaje || null, r.params.id])
  return { ok: true }
}))

// ---- Reportes
app.get('/api/reportes', requireAuth, requireModule('Resumen'), h(async () => ({
  porDia: await q('SELECT DAYOFWEEK(fecha) dia, SUM(total) total FROM ventas GROUP BY dia ORDER BY dia'),
  porCanal: await q('SELECT canal, SUM(total) total FROM ventas GROUP BY canal'),
  top: await q('SELECT p.nombre, SUM(v.cantidad) cant FROM ventas v JOIN platos p ON p.id=v.plato_id GROUP BY p.id ORDER BY cant DESC LIMIT 5'),
  demora: (await q("SELECT ROUND(AVG(TIMESTAMPDIFF(MINUTE,hora_pedido,hora_entrega))) m FROM ventas WHERE canal='domicilio' AND hora_entrega IS NOT NULL"))[0].m,
  alertas: await q('SELECT nombre, stock, unidad, stock_minimo FROM ingredientes WHERE stock<=stock_minimo'),
  mermas: (await q('SELECT COUNT(*) n FROM mermas'))[0].n,
  quejasAbiertas: (await q("SELECT COUNT(*) n FROM quejas WHERE estado<>'resuelta'"))[0].n,
})))

app.listen(process.env.PORT || 3001, () => console.log('API lista en http://localhost:' + (process.env.PORT || 3001)))
