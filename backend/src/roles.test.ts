import test from 'node:test'
import assert from 'node:assert/strict'

import { hasAnyModuleAccess, hasModuleAccess } from './roles'

test('admin tiene acceso a todos los módulos', () => {
  assert.equal(hasModuleAccess('admin', 'Resumen'), true)
  assert.equal(hasModuleAccess('admin', 'Inventario'), true)
  assert.equal(hasModuleAccess('admin', 'Ventas'), true)
  assert.equal(hasModuleAccess('admin', 'Quejas'), true)
  assert.equal(hasModuleAccess('admin', 'Clientes'), true)
})

test('quejas es exclusivo del administrador', () => {
  assert.equal(hasModuleAccess('admin', 'Quejas'), true)
  assert.equal(hasModuleAccess('gerente', 'Quejas'), false)
  assert.equal(hasModuleAccess('cocinero', 'Quejas'), false)
  assert.equal(hasModuleAccess('caja', 'Quejas'), false)
  assert.equal(hasModuleAccess('mesero', 'Quejas'), false)
})

test('cocinero no puede entrar a clientes ni quejas', () => {
  assert.equal(hasModuleAccess('cocinero', 'Resumen'), true)
  assert.equal(hasModuleAccess('cocinero', 'Inventario'), true)
  assert.equal(hasModuleAccess('cocinero', 'Ventas'), true)
  assert.equal(hasModuleAccess('cocinero', 'Clientes'), false)
  assert.equal(hasModuleAccess('cocinero', 'Quejas'), false)
})

test('caja solo ve ventas y clientes', () => {
  assert.equal(hasModuleAccess('caja', 'Ventas'), true)
  assert.equal(hasModuleAccess('caja', 'Clientes'), true)
  assert.equal(hasModuleAccess('caja', 'Inventario'), false)
  assert.equal(hasModuleAccess('caja', 'Quejas'), false)
})

test('ventas puede consultar clientes sin abrir el módulo de clientes', () => {
  assert.equal(hasAnyModuleAccess('cocinero', ['Clientes', 'Ventas']), true)
  assert.equal(hasModuleAccess('cocinero', 'Clientes'), false)
  assert.equal(hasAnyModuleAccess('mesero', ['Inventario', 'Clientes']), false)
})
