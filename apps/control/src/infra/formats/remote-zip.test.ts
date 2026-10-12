// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * A zip read by ranges costs a bounded memory, however big its directory and however many are read
 * at once. Its everyday reading is in file-formats.test.ts.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { strToU8, zipSync } from 'fflate'
import { UnreadableFile } from '../../app/ports/formats.ts'
import { Cdn } from '../../testing/cdn.ts'
import { readRemoteZip } from './remote-zip.ts'

const MB = 1024 * 1024
/** A class file's header: Java 17's. */
const CLASS_FILE = new Uint8Array([0xca, 0xfe, 0xba, 0xbe, 0, 0, 0, 61])

describe('zips read by ranges, in a bounded memory', () => {
  const cdn = new Cdn()
  beforeAll(() => cdn.start())
  afterAll(() => cdn.close())

  // Create's jar lists 12,500 files. zip.js describes each in an object of several KB, and holding
  // every one while a jar was read took production's api past its 480 MB heap on 2026-10-11.
  test('a big jar read many times at once costs its names, not its whole directory', async () => {
    const files: Record<string, Uint8Array> = { 'fabric.mod.json': strToU8('{"id":"big"}') }
    for (let i = 0; i < 20_000; i++)
      files[`com/example/big/content/block/entity/Thing${i}Renderer.class`] = CLASS_FILE
    const file = cdn.file('big-mod', zipSync(files, { level: 0 }))
    Bun.gc(true)
    const before = process.memoryUsage().heapUsed
    let peak = before
    const sampling = setInterval(() => {
      peak = Math.max(peak, process.memoryUsage().heapUsed)
    }, 1)
    const counts = await Promise.all(
      Array.from({ length: 16 }, () =>
        readRemoteZip(file.url, { wanted: (name) => name === 'fabric.mod.json', maxEntryBytes: 1_000 }).then(
          (read) => read.names.length,
        ),
      ),
    )
    clearInterval(sampling)
    expect(counts).toEqual(Array(16).fill(20_001))
    // Reading the whole directory at once took 587 MB here; CI's runners measured up to 91 MB bounded.
    expect((peak - before) / MB).toBeLessThan(256)
  }, 120_000)

  // zip.js stops inflating at the size the records say, which is held to the size asked for.
  test('an entry that inflates past what its records say is unreadable', async () => {
    // 5,000 bytes deflated, whose records both say they inflate to 10.
    const zip = Buffer.from(zipSync({ 'big.txt': new Uint8Array(5_000).fill(65) }, { level: 9 }))
    const central = zip.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]))
    zip.writeUInt32LE(10, 22)
    zip.writeUInt32LE(10, central + 24)
    const file = cdn.file('liar', zip)
    await expect(
      readRemoteZip(file.url, { wanted: () => true, maxEntryBytes: 1_000 }),
    ).rejects.toBeInstanceOf(UnreadableFile)
  })
})
