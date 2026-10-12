// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { NODE_NAME, nextName, nodeTarget, priceCents, readNodes, writeNodes } from './fleet-hetzner.ts'

describe('priceCents', () => {
  test('is whole US cents as given, and nothing else', () => {
    expect(priceCents('4200')).toBe(4200)
    expect(priceCents('0')).toBe(0)
    for (const given of [undefined, '', '-1', '12.5', '1e3', 'abc', '99999999999999999999'])
      expect(priceCents(given)).toBeNull()
  })
})

describe('the nodes file', () => {
  test('keeps its nodes sorted, so a change is one entry', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fleet-nodes-'))
    writeFileSync(join(dir, 'fleet-nodes.auto.tfvars.json'), '{\n  "fleet_nodes": {}\n}\n')
    writeNodes(dir, { b: { location: 'fsn1', type: 'ccx33' }, a: { location: 'hel1', type: 'ccx13' } })
    expect(Object.keys(readNodes(dir))).toEqual(['a', 'b'])
    expect(readFileSync(join(dir, 'fleet-nodes.auto.tfvars.json'), 'utf8')).toEndWith('}\n')
  })

  test('names a new node by where and what it is, with the first number free', () => {
    const taken = { 'fsn1-ccx33-1': { location: 'fsn1', type: 'ccx33' } }
    expect(nextName(taken, 'fsn1', 'ccx33')).toBe('fsn1-ccx33-2')
    expect(nextName(taken, 'hel1', 'ccx33')).toBe('hel1-ccx33-1')
    expect(NODE_NAME.test('fsn1-ccx33-2')).toBe(true)
    expect(NODE_NAME.test('Box_1')).toBe(false)
  })

  test("targets the node's module in an environment", () => {
    expect(nodeTarget('fsn1-ccx33-1')).toBe('module.environment.module.fleet_node["fsn1-ccx33-1"]')
  })
})
