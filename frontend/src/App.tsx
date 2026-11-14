import { Fragment, useEffect, useMemo, useState } from 'react'

const $ = (n: number) => '$' + Number(n || 0).toLocaleString('es-CO')
const DIAS = ['', 'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MODULES = ['Resumen', 'Inventario', 'Ventas', 'Quejas', 'Clientes'] as const

type Role = 'admin' | 'gerente' | 'cocinero' | 'caja' | 'mesero'
type User = { id: number; nombre: string; email: string; rol: Role }
const FONDOS = ['papel', 'hojas', 'terracota'] as const
type Fondo = (typeof FONDOS)[number]

const getFondo = (): Fondo => {
  const guardado = localStorage.getItem('sabores-fondo')
  return FONDOS.includes(guardado as Fondo) ? guardado as Fondo : 'papel'
}

function useImageAvailable(src: string) {
  const [available, setAvailable] = useState<boolean | null>(null)

  useEffect(() => {
    if (!src) {
      setAvailable(false)
      return
    }

    const img = new Image()
    img.onload = () => setAvailable(true)
    img.onerror = () => setAvailable(false)
    img.src = src
  }, [src])

  return available
}

type Campo = { n: string; l: string; t?: string; o?: [any, string][]; r?: boolean; min?: number }

const getStoredUser = (): User | null => {
  try {
    const raw = localStorage.getItem('sabores-user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const getToken = () => localStorage.getItem('sabores-token') || ''

const api = async (u: string, m = 'GET', b?: any) => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetch('/api' + u, {
    method: m,
    headers,
    body: b ? JSON.stringify(b) : undefined
  })

  const data = await response.json().catch(() => ({}))
  if (response.status === 401) window.dispatchEvent(new Event('sabores:unauthorized'))
  if (!response.ok) throw new Error(data.error || 'Error de solicitud')
  return data
}

const ROLE_MODULES: Record<Role, string[]> = {
  admin: [...MODULES],
  gerente: ['Resumen', 'Inventario', 'Ventas', 'Clientes'],
  cocinero: ['Resumen', 'Inventario', 'Ventas'],
  caja: ['Resumen', 'Ventas', 'Clientes'],
  mesero: ['Resumen', 'Ventas']
}

const hasAccess = (role: Role | undefined, moduleName: string) => {
  if (!role) return false
  return (ROLE_MODULES[role] || []).includes(moduleName)
}

function TituloModulo({ etiqueta, titulo, descripcion }: { etiqueta: string; titulo: string; descripcion: string }) {
  return <div className="module-heading"><p className="eyebrow">{etiqueta}</p><h2>{titulo}</h2><p>{descripcion}</p></div>
}

function Form({ campos, ok, btn }: { campos: Campo[]; ok: (d: any) => Promise<any>; btn: string }) {
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  return (
    <form className="data-form" onSubmit={async e => {
      e.preventDefault()
      const form = e.currentTarget
      setGuardando(true)
      setError('')
      try {
        await ok(Object.fromEntries(new FormData(form)))
        form.reset()
      } catch (reason: any) {
        setError(reason.message || 'No se pudo guardar. Intenta de nuevo.')
      } finally {
        setGuardando(false)
      }
    }}>
      {campos.map(c => c.o
        ? <select key={c.n} name={c.n} required={!c.r} aria-label={c.l}><option value="">{c.l}</option>{c.o.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
        : <input key={c.n} name={c.n} placeholder={c.l} aria-label={c.l} type={c.t || 'text'} step="any" min={c.min} required={!c.r} />)}
      <button disabled={guardando}>{guardando ? 'Guardando…' : btn}</button>
      {error && <p className="form-feedback" role="alert">{error}</p>}
    </form>
  )
}

function Tabla({ cols, filas }: { cols: string[]; filas: any[][] }) {
  if (!filas.length) return <p className="empty-state">Aún no hay registros.</p>
  return <div className="table-scroll"><table><thead><tr>{cols.map(c => <th key={c}>{c}</th>)}</tr></thead>
    <tbody>{filas.map((f, i) => <tr key={i}>{f.map((x, j) => <td key={j}>{x}</td>)}</tr>)}</tbody></table></div>
}

function ErrorDatos({ mensaje, re }: { mensaje: string; re: () => void }) {
  return <section className="data-error" role="alert">
    <h2>No se pudieron cargar los datos</h2>
    <p>{mensaje}</p>
    <button type="button" onClick={re}>Reintentar</button>
  </section>
}

function useDatos(rutas: string[], k: number) {
  const [d, setD] = useState<any[]>(rutas.map(() => null))
  useEffect(() => {
    Promise.all(rutas.map(r => api(r))).then(setD).catch((reason: any) => {
      setD(rutas.map(() => ({ __error: reason.message || 'Error al consultar la API.' })))
    })
  }, [k])
  return d
}

function Dashboard({ k, re }: { k: number; re: () => void }) {
  const [r] = useDatos(['/reportes'], k)
  if (!r) return <p>Cargando…</p>
  if (r.__error || !Array.isArray(r.porDia) || !Array.isArray(r.alertas) || !Array.isArray(r.top) || !Array.isArray(r.porCanal)) {
    return <ErrorDatos mensaje={r.__error || 'La API devolvió un resumen incompleto.'} re={re} />
  }
  const max = Math.max(...r.porDia.map((d: any) => Number(d.total)), 1)
  const mejor = r.porDia.find((d: any) => Number(d.total) === max)
  return <>
    <TituloModulo etiqueta="Vista general" titulo="Resumen" descripcion="Un vistazo rápido a la operación del restaurante." />
    <div className="kpis">
      <div><b>{mejor ? DIAS[mejor.dia] : '—'}</b>día que más gana</div>
      <div><b className={r.demora > 45 ? 'mal' : 'bien'}>{r.demora ?? '—'} min</b>demora promedio domicilios</div>
      <div><b>{r.quejasAbiertas}</b>quejas sin resolver</div>
      <div><b>{r.mermas}</b>mermas registradas</div>
    </div>
    {r.alertas.length > 0 && <><h2>Comprar pronto</h2>
      {r.alertas.map((a: any) => <div className="alerta" key={a.nombre}>{a.nombre}: quedan {a.stock} {a.unidad} (mínimo {a.stock_minimo})</div>)}</>}
    <div className="dashboard-panels">
      <section className="dashboard-panel"><h3>Ventas por día de la semana</h3>
        {r.porDia.map((d: any) => <div className="barra" key={d.dia}><span>{DIAS[d.dia]}</span>
          <i className={Number(d.total) === max ? 'max' : ''} style={{ width: (Number(d.total) / max) * 60 + '%' }} />{$(d.total)}</div>)}
      </section>
      <section className="dashboard-panel"><h3>Platos más vendidos</h3>
        <Tabla cols={['Plato', 'Unidades']} filas={r.top.map((t: any) => [t.nombre, t.cant])} />
      </section>
      <section className="dashboard-panel"><h3>Ingresos por canal</h3>
        <Tabla cols={['Canal', 'Total']} filas={r.porCanal.map((c: any) => [c.canal, $(c.total)])} />
      </section>
    </div>
  </>
}

function Inventario({ k, re }: { k: number; re: () => void }) {
  const [ing] = useDatos(['/ingredientes'], k)
  const [buscar, setBuscar] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const [editando, setEditando] = useState<number | null>(null)
  const [mensaje, setMensaje] = useState('')
  if (ing?.__error) return <ErrorDatos mensaje={ing.__error} re={re} />
  if (!ing) return <p>Cargando inventario…</p>
  const opts = ing.map((i: any) => [i.id, `${i.nombre} (${i.unidad})`] as [any, string])
  const bajos = ing.filter((i: any) => Number(i.stock) <= Number(i.stock_minimo)).length
  const visibles = ing
    .filter((i: any) => `${i.nombre} ${i.unidad}`.toLowerCase().includes(buscar.trim().toLowerCase()))
    .filter((i: any) => filtro === 'todos' || (filtro === 'bajo' ? Number(i.stock) <= Number(i.stock_minimo) : Number(i.stock) > Number(i.stock_minimo)))
    .sort((a: any, b: any) => a.nombre.localeCompare(b.nombre, 'es'))

  const guardarEdicion = async (e: React.FormEvent<HTMLFormElement>, id: number) => {
    e.preventDefault()
    const data = Object.fromEntries(new FormData(e.currentTarget))
    try {
      await api(`/ingredientes/${id}`, 'PATCH', data)
      setEditando(null)
      setMensaje('Ingrediente actualizado.')
      re()
    } catch (error: any) {
      setMensaje(error.message)
    }
  }

  const borrar = async (id: number, nombre: string) => {
    if (!confirm(`¿Borrar ${nombre}? Esta acción no se puede deshacer.`)) return
    try {
      await api(`/ingredientes/${id}`, 'DELETE')
      setMensaje('Ingrediente eliminado.')
      re()
    } catch (error: any) {
      setMensaje(error.message)
    }
  }

  const ejecutar = async (accion: () => Promise<any>, texto: string) => {
    try {
      await accion()
      setMensaje(texto)
      re()
    } catch (error: any) {
      setMensaje(error.message)
      throw error
    }
  }

  return <>
    <div className="section-heading">
      <div><p className="eyebrow">Control de existencias</p><h2>Inventario</h2><p>Consulta niveles, registra movimientos y mantén tus ingredientes al día.</p></div>
    </div>
    <div className="inventory-stats">
      <div><span>Ingredientes</span><strong>{ing.length}</strong></div>
      <div className={bajos ? 'needs-attention' : ''}><span>Por reponer</span><strong>{bajos}</strong></div>
      <div><span>Unidades registradas</span><strong>{ing.reduce((total: number, i: any) => total + Number(i.stock), 0).toLocaleString('es-CO')}</strong></div>
    </div>

    <section className="inventory-actions" aria-label="Acciones de inventario">
      <details className="inventory-action" open>
        <summary><span>Registrar compra</span><small>Aumenta existencias</small></summary>
        <Form btn="Sumar al stock" campos={[{ n: 'ingrediente_id', l: 'Ingrediente', o: opts }, { n: 'cantidad', l: 'Cantidad', t: 'number', min: 0.01 }]}
          ok={async d => ejecutar(() => api('/compras', 'POST', d), 'Compra registrada.')} />
      </details>
      <details className="inventory-action">
        <summary><span>Registrar merma</span><small>Descuenta producto dañado</small></summary>
        <Form btn="Registrar merma" campos={[{ n: 'ingrediente_id', l: 'Ingrediente', o: opts }, { n: 'cantidad', l: 'Cantidad', t: 'number', min: 0.01 }, { n: 'motivo', l: 'Motivo (vencido, preparación…)' }]}
          ok={async d => ejecutar(() => api('/mermas', 'POST', d), 'Merma registrada.')} />
      </details>
      <details className="inventory-action">
        <summary><span>Nuevo ingrediente</span><small>Agrega un producto al catálogo</small></summary>
        <Form btn="Agregar ingrediente" campos={[{ n: 'nombre', l: 'Nombre' }, { n: 'unidad', l: 'Unidad (kg, l)' }, { n: 'stock', l: 'Stock inicial', t: 'number', min: 0 }, { n: 'stock_minimo', l: 'Mínimo', t: 'number', min: 0 }]}
          ok={async d => ejecutar(() => api('/ingredientes', 'POST', d), 'Ingrediente agregado.')} />
      </details>
    </section>

    {mensaje && <p className="inventory-message" role="status">{mensaje}<button type="button" aria-label="Cerrar mensaje" onClick={() => setMensaje('')}>×</button></p>}

    <section className="inventory-list">
      <div className="list-heading"><div><h3>Ingredientes registrados</h3><span>{visibles.length} de {ing.length}</span></div>
        <div className="table-tools">
          <input aria-label="Buscar ingrediente" placeholder="Buscar ingrediente…" value={buscar} onChange={e => setBuscar(e.target.value)} />
          <select aria-label="Filtrar por estado" value={filtro} onChange={e => setFiltro(e.target.value)}>
            <option value="todos">Todos los estados</option><option value="bajo">Por reponer</option><option value="ok">Stock suficiente</option>
          </select>
        </div>
      </div>
      {visibles.length === 0 ? <p className="empty-state">No hay ingredientes que coincidan con la búsqueda.</p> :
        <div className="table-scroll"><table>
          <thead><tr><th>Ingrediente</th><th>Existencia</th><th>Stock mínimo</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>{visibles.map((i: any) => <Fragment key={i.id}>
            <tr>
              <td><strong>{i.nombre}</strong></td><td>{i.stock} {i.unidad}</td><td>{i.stock_minimo} {i.unidad}</td>
              <td>{Number(i.stock) <= Number(i.stock_minimo) ? <span className="stock-status low">Por reponer</span> : <span className="stock-status good">Suficiente</span>}</td>
              <td className="row-actions"><button type="button" onClick={() => setEditando(editando === i.id ? null : i.id)}>{editando === i.id ? 'Cancelar' : 'Editar'}</button><button type="button" className="delete-action" onClick={() => borrar(i.id, i.nombre)}>Borrar</button></td>
            </tr>
            {editando === i.id && <tr className="edit-row"><td colSpan={5}>
              <form className="edit-ingredient" onSubmit={e => guardarEdicion(e, i.id)}>
                <label>Nombre<input name="nombre" defaultValue={i.nombre} required maxLength={80} /></label>
                <label>Unidad<input name="unidad" defaultValue={i.unidad} required maxLength={10} /></label>
                <label>Stock mínimo<input name="stock_minimo" type="number" min="0" step="any" defaultValue={i.stock_minimo} required /></label>
                <button type="submit">Guardar cambios</button>
              </form>
            </td></tr>}
          </Fragment>)}</tbody>
        </table></div>}
    </section>
  </>
}

function Ventas({ k, re }: { k: number; re: () => void }) {
  const [v, pl, cl] = useDatos(['/ventas', '/platos', '/clientes'], k)
  const [buscar, setBuscar] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  if (v?.__error) return <ErrorDatos mensaje={v.__error} re={re} />
  if (!v) return <p>Cargando…</p>
  const pendientes = v.filter((x: any) => x.canal === 'domicilio' && !x.hora_entrega).length
  const totalVisible = v.reduce((total: number, x: any) => total + Number(x.total || 0), 0)
  const filtradas = v.filter((x: any) => {
    const texto = `${x.plato} ${x.cliente || ''} ${x.canal}`.toLowerCase()
    const fecha = String(x.fecha || '').slice(0, 10)
    return texto.includes(buscar.trim().toLowerCase()) && (!desde || fecha >= desde) && (!hasta || fecha <= hasta)
  })
  return <>
    <TituloModulo etiqueta="Operación" titulo="Ventas" descripcion="Registra pedidos y revisa entregas recientes." />
    <div className="module-kpis"><div><span>Ventas cargadas</span><strong>{v.length}</strong></div><div><span>Entregas pendientes</span><strong>{pendientes}</strong></div><div><span>Total visible</span><strong>{$(totalVisible)}</strong></div></div>
    <details className="module-action" open><summary>Nueva venta <small>Registrar un pedido</small></summary>
      <Form btn="Registrar venta" campos={[
        { n: 'plato_id', l: 'Plato', o: pl.map((p: any) => [p.id, `${p.nombre} – ${$(p.precio)}`]) },
        { n: 'cantidad', l: 'Cantidad', t: 'number', min: 1 },
        { n: 'canal', l: 'Canal', o: [['mesa', 'Mesa'], ['domicilio', 'Domicilio'], ['evento', 'Evento']] },
        { n: 'cliente_id', l: 'Cliente (opcional)', r: true, o: cl.map((c: any) => [c.id, c.nombre]) }]}
        ok={async d => { await api('/ventas', 'POST', d); re() }} />
    </details>
    <div className="list-heading"><div><h3>Ventas recientes</h3><span>{filtradas.length} de {v.length}</span></div>
      <div className="table-tools sales-filters">
        <input aria-label="Buscar venta" placeholder="Plato, cliente o canal…" value={buscar} onChange={e => setBuscar(e.target.value)} />
        <label>Desde<input aria-label="Fecha inicial" type="date" value={desde} onChange={e => setDesde(e.target.value)} /></label>
        <label>Hasta<input aria-label="Fecha final" type="date" value={hasta} onChange={e => setHasta(e.target.value)} /></label>
      </div>
    </div>
    <Tabla cols={['#', 'Fecha', 'Plato', 'Cant.', 'Canal', 'Cliente', 'Total', 'Entrega']}
      filas={filtradas.map((x: any) => [x.id, x.fecha, x.plato, x.cantidad, x.canal, x.cliente || '—', $(x.total),
        x.canal !== 'domicilio' ? '—' : x.hora_entrega
          ? <span className={x.demora > 45 ? 'mal' : 'bien'}>{x.demora} min</span>
          : <button onClick={async () => { await api(`/ventas/${x.id}/entregar`, 'PATCH'); re() }}>Marcar entregado</button>])} />
  </>
}

function Quejas({ k, re }: { k: number; re: () => void }) {
  const [q, cl] = useDatos(['/quejas', '/clientes'], k)
  const [buscar, setBuscar] = useState('')
  const [estado, setEstado] = useState('todas')
  const [mensaje, setMensaje] = useState('')
  if (q?.__error) return <ErrorDatos mensaje={q.__error} re={re} />
  if (!q) return <p>Cargando…</p>
  const cambiar = async (id: number, estado: string) => {
    const aprendizaje = estado === 'resuelta' ? prompt('¿Qué aprendimos y qué vamos a mejorar?') : null
    if (estado === 'resuelta' && aprendizaje === null) return
    try { await api('/quejas/' + id, 'PATCH', { estado, aprendizaje }); setMensaje('Estado de queja actualizado.'); re() }
    catch (error: any) { setMensaje(error.message) }
  }
  const abiertas = q.filter((x: any) => x.estado !== 'resuelta').length
  const visibles = q.filter((x: any) => (estado === 'todas' || (estado === 'pendientes' ? x.estado !== 'resuelta' : x.estado === estado)) && `${x.descripcion} ${x.cliente || ''} ${x.origen}`.toLowerCase().includes(buscar.trim().toLowerCase()))
  return <>
    <TituloModulo etiqueta="Seguimiento" titulo="Quejas" descripcion="Prioriza los casos abiertos y registra lo aprendido." />
    <div className="module-kpis"><div><span>Total de casos</span><strong>{q.length}</strong></div><div><span>Pendientes</span><strong>{abiertas}</strong></div><div><span>Resueltas</span><strong>{q.length - abiertas}</strong></div></div>
    <details className="module-action"><summary>Registrar queja <small>Agregar un nuevo caso</small></summary>
      <Form btn="Guardar queja" campos={[
        { n: 'cliente_id', l: 'Cliente (opcional)', r: true, o: cl.map((c: any) => [c.id, c.nombre]) },
        { n: 'origen', l: 'Dónde ocurrió', o: [['local', 'Local'], ['domicilio', 'Domicilio'], ['redes', 'Redes sociales']] },
        { n: 'viral', l: '¿Es viral?', r: true, o: [[0, 'No'], [1, 'Sí, se volvió viral']] },
        { n: 'descripcion', l: 'Qué pasó' }]}
        ok={async d => { await api('/quejas', 'POST', d); re() }} />
    </details>
    {mensaje && <p className="inventory-message" role="status">{mensaje}<button type="button" aria-label="Cerrar mensaje" onClick={() => setMensaje('')}>×</button></p>}
    <div className="list-heading"><div><h3>Casos registrados</h3><span>{visibles.length} de {q.length}</span></div>
      <div className="table-tools"><input aria-label="Buscar queja" placeholder="Buscar caso…" value={buscar} onChange={e => setBuscar(e.target.value)} />
        <select aria-label="Filtrar quejas" value={estado} onChange={e => setEstado(e.target.value)}><option value="pendientes">Pendientes</option><option value="abierta">Abiertas</option><option value="en_gestion">En gestión</option><option value="resuelta">Resueltas</option><option value="todas">Todas</option></select>
      </div>
    </div>
    <Tabla cols={['Fecha', 'Cliente', 'Origen', 'Queja', 'Estado', 'Aprendizaje', 'Acción']}
      filas={visibles.map((x: any) => [x.fecha, x.cliente || '—', x.origen, (x.viral ? 'Viral: ' : '') + x.descripcion, x.estado, x.aprendizaje || '—',
        x.estado === 'resuelta' ? '' : <>
          <button onClick={() => cambiar(x.id, 'en_gestion')}>En gestión</button>
          <button onClick={() => cambiar(x.id, 'resuelta')}>Resolver</button></>])} />
  </>
}

function Clientes({ k, re }: { k: number; re: () => void }) {
  const [c] = useDatos(['/clientes'], k)
  const [buscar, setBuscar] = useState('')
  if (c?.__error) return <ErrorDatos mensaje={c.__error} re={re} />
  if (!c) return <p>Cargando…</p>
  const filtrados = c.filter((x: any) => `${x.nombre} ${x.telefono}`.toLowerCase().includes(buscar.trim().toLowerCase()))
  const puntos = c.reduce((total: number, x: any) => total + Number(x.puntos || 0), 0)
  return <>
    <TituloModulo etiqueta="Relaciones" titulo="Clientes" descripcion="Consulta clientes frecuentes y registra nuevos contactos." />
    <div className="module-kpis"><div><span>Clientes registrados</span><strong>{c.length}</strong></div><div><span>Puntos acumulados</span><strong>{puntos.toLocaleString('es-CO')}</strong></div><div><span>Programa</span><strong>1 punto / $1.000</strong></div></div>
    <details className="module-action"><summary>Nuevo cliente <small>Agregar un contacto</small></summary>
      <Form btn="Agregar cliente" campos={[{ n: 'nombre', l: 'Nombre' }, { n: 'telefono', l: 'Teléfono', t: 'tel' }]} ok={async d => { await api('/clientes', 'POST', d); re() }} />
    </details>
    <div className="list-heading"><div><h3>Clientes frecuentes</h3><span>{filtrados.length} de {c.length}</span></div>
      <div className="table-tools"><input aria-label="Buscar cliente" placeholder="Nombre o teléfono…" value={buscar} onChange={e => setBuscar(e.target.value)} /></div>
    </div>
    <Tabla cols={['Cliente', 'Teléfono', 'Puntos', 'Nivel']}
      filas={filtrados.map((x: any) => [x.nombre, x.telefono, x.puntos, x.puntos >= 100 ? 'Oro' : x.puntos >= 30 ? 'Plata' : 'Nuevo'])} />
  </>
}

export default function App() {
  const [screen, setScreen] = useState<'landing' | 'login' | 'app'>('landing')
  const [user, setUser] = useState<User | null>(getStoredUser)
  const [tab, setTab] = useState('Resumen')
  const [k, setK] = useState(0)
  const [error, setError] = useState('')
  const [fondo, setFondo] = useState<Fondo>(getFondo)
  const landingBgAvailable = useImageAvailable('/images/landing-bg.png')
  const logoAvailable = useImageAvailable('/images/logo.png')

  useEffect(() => {
    if (user) {
      localStorage.setItem('sabores-user', JSON.stringify(user))
      setScreen('app')
    } else {
      localStorage.removeItem('sabores-user')
    }
  }, [user])

  useEffect(() => {
    if (!user) {
      localStorage.removeItem('sabores-token')
    }
  }, [user])

  useEffect(() => {
    const cerrarSesionVencida = () => {
      localStorage.removeItem('sabores-token')
      localStorage.removeItem('sabores-user')
      setUser(null)
      setScreen('login')
      setError('La sesión venció. Inicia sesión nuevamente.')
    }
    window.addEventListener('sabores:unauthorized', cerrarSesionVencida)
    return () => window.removeEventListener('sabores:unauthorized', cerrarSesionVencida)
  }, [])

  useEffect(() => { localStorage.setItem('sabores-fondo', fondo) }, [fondo])

  const re = () => setK(n => n + 1)
  const modules = useMemo(() => user ? MODULES.filter(m => hasAccess(user.rol, m)) : [], [user])
  const landingStyle = landingBgAvailable === true
    ? { backgroundImage: "linear-gradient(90deg, rgba(28,38,30,.91) 0%, rgba(28,38,30,.78) 48%, rgba(28,38,30,.4) 100%), url('/images/landing-bg.png')" }
    : { backgroundImage: 'linear-gradient(90deg, rgba(28,38,30,.91) 0%, rgba(28,38,30,.78) 48%, rgba(28,38,30,.4) 100%), url("https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=2000&q=85")' }
  const loginStyle = landingBgAvailable === true
    ? { backgroundImage: "linear-gradient(rgba(38,63,48,.84), rgba(38,63,48,.88)), url('/images/landing-bg.png')" }
    : { backgroundImage: 'linear-gradient(rgba(38,63,48,.84), rgba(38,63,48,.88)), url("https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=1200&q=85")' }

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const email = String(form.get('email') || '')
    const password = String(form.get('password') || '')

    try {
      const data = await api('/login', 'POST', { email, password })
      localStorage.setItem('sabores-token', data.token)
      setUser({
        id: data.user.id,
        nombre: data.user.nombre,
        email: data.user.email,
        rol: data.user.rol
      })
      setError('')
      e.currentTarget.reset()
    } catch (err: any) {
      setError(err.message || 'No se pudo iniciar sesión.')
    }
  }

  const logout = () => {
    localStorage.removeItem('sabores-token')
    setUser(null)
    setScreen('landing')
    setTab('Resumen')
    setError('')
  }

  const appView = (
    <div className="app-shell" data-fondo={fondo}>
      <header>
        <h1>Sabores del Barrio</h1>
        <nav>{modules.map(m => <button key={m} className={m === tab ? 'on' : ''} onClick={() => setTab(m)}>{m}</button>)}</nav>
        <div className="user-box">
          <span>{user?.nombre} <small className="role-tag">{user?.rol}</small></span>
          <label className="wallpaper-control"><span>Fondo</span><select aria-label="Fondo de pantalla" value={fondo} onChange={e => setFondo(e.target.value as Fondo)}><option value="papel">Papel</option><option value="hojas">Hojas</option><option value="terracota">Terracota</option></select></label>
          <button className="logout" onClick={logout}>Salir</button>
        </div>
      </header>
      <main>
        {tab === 'Resumen' && <Dashboard k={k} re={re} />}
        {tab === 'Inventario' && <Inventario k={k} re={re} />}
        {tab === 'Ventas' && <Ventas k={k} re={re} />}
        {tab === 'Quejas' && <Quejas k={k} re={re} />}
        {tab === 'Clientes' && <Clientes k={k} re={re} />}
      </main>
    </div>
  )

  if (screen === 'app' && user) return appView

  return (
    <div className="auth-shell" data-screen={screen}>
      {screen === 'landing' ? (
        <section className="landing-page" style={landingStyle}>
          <div className="landing-topline">{logoAvailable === true ? <img className="brand-mark brand-mark-image" src="/images/logo.png" alt="" /> : <span className="brand-mark">SB</span>}<span>Sabores del Barrio</span></div>
          <div className="landing-content">
            <div className="hero-copy">
              <p className="eyebrow">Gestión hecha para el día a día</p>
              <h1>El sabor del barrio, en buenas manos.</h1>
              <p>Organiza el restaurante desde un solo lugar. Cada persona ve únicamente las herramientas que necesita para su trabajo.</p>
              <div className="hero-actions">
                <button className="primary" onClick={() => setScreen('login')}>Iniciar sesión <span aria-hidden="true">→</span></button>
              </div>
            </div>
            <div className="feature-grid">
              <div><span className="feature-number">01</span><strong>Inventario</strong><span>Stock y alertas de ingredientes.</span></div>
              <div><span className="feature-number">02</span><strong>Ventas</strong><span>Pedidos, canales y domicilios.</span></div>
              <div><span className="feature-number">03</span><strong>Clientes</strong><span>Registro y puntos por compra.</span></div>
              <div><span className="feature-number">04</span><strong>Quejas</strong><span>Seguimiento reservado a Admin.</span></div>
            </div>
          </div>
          <footer className="landing-footer"><span>Control claro. Servicio cercano.</span><span>Acceso seguro por rol</span></footer>
        </section>
      ) : (
        <section className="login-layout">
          <div className="login-aside" style={loginStyle}>
            <div className="landing-topline">{logoAvailable === true ? <img className="brand-mark brand-mark-image" src="/images/logo.png" alt="" /> : <span className="brand-mark">SB</span>}<span>Sabores del Barrio</span></div>
            <div>
              <p className="eyebrow">Tu restaurante, organizado</p>
              <h1>Qué bueno tenerte de vuelta.</h1>
              <p>Ingresa con tu cuenta para abrir los módulos asignados a tu rol.</p>
            </div>
            <button className="back-link" onClick={() => { setScreen('landing'); setError('') }}>← Volver a la página principal</button>
          </div>
          <div className="login-box">
            <p className="eyebrow">Acceso del personal</p>
            <h2>Iniciar sesión</h2>
            <form onSubmit={handleLogin}>
              <label>
                <span>Correo electrónico</span>
                <input name="email" type="email" placeholder="nombre@restaurante.com" autoComplete="username" required />
              </label>
              <label>
                <span>Contraseña</span>
                <input name="password" type="password" placeholder="Ingresa tu contraseña" autoComplete="current-password" required />
              </label>
              {error && <p className="error" role="alert">{error}</p>}
              <button className="primary" type="submit">Entrar al sistema <span aria-hidden="true">→</span></button>
            </form>
          </div>
        </section>
      )}
    </div>
  )
}
