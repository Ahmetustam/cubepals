// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

/** Reading the Java a jar asks for out of its class files, from bytes recorded off real jars. */
import { describe, expect, test } from 'bun:test'
import { classesToRead, fabricModOf, javaOfClass, javaOfClasses } from './class-files.ts'
import { javaFor, oldestReleaseOn } from './versions.ts'

/** The first bytes of BentoBox 3.23.3's main class, as Modrinth serves it: class file 69. */
const BENTOBOX_3_23_3 = Uint8Array.from(Buffer.from('cafebabe0000004503b40a00020003', 'hex'))

describe('class files', () => {
  test('a class file says the Java it needs', () => {
    expect(javaOfClass(BENTOBOX_3_23_3)).toBe(25)
    expect(javaOfClass(Uint8Array.from(Buffer.from('cafebabe00000041', 'hex')))).toBe(21)
    expect(javaOfClass(Uint8Array.from(Buffer.from('cafebabe00000034', 'hex')))).toBe(8)
    expect(javaOfClass(Uint8Array.from(Buffer.from('504b030400000045', 'hex')))).toBeNull()
    expect(javaOfClass(new Uint8Array(4))).toBeNull()
    // The magic, then text where the version would be.
    expect(javaOfClass(Uint8Array.from([0xca, 0xfe, 0xba, 0xbe, ...Buffer.from('graves')]))).toBeNull()
  })

  test('the classes read are the entry classes a jar names, where it holds them', () => {
    const names = ['org/bstats/Metrics.class', 'world/bentobox/bentobox/BentoBox.class', 'plugin.yml']
    expect(classesToRead(names, { 'plugin.yml': { main: 'world.bentobox.bentobox.BentoBox' } })).toEqual([
      'world/bentobox/bentobox/BentoBox.class',
    ])
    // A BentoBox addon names its own in addon.yml, a Fabric mod its entrypoints.
    expect(
      classesToRead(['world/bentobox/bskyblock/BSkyBlock.class'], {
        'addon.yml': { main: 'world.bentobox.bskyblock.BSkyBlock' },
      }),
    ).toEqual(['world/bentobox/bskyblock/BSkyBlock.class'])
    expect(
      classesToRead(['a/Mod.class', 'a/Server.class'], {
        'fabric.mod.json': { entrypoints: { main: ['a.Mod'], server: [{ value: 'a.Server::init' }] } },
      }),
    ).toEqual(['a/Mod.class', 'a/Server.class'])
    expect(classesToRead(['a/Run.class'], {}, 'Manifest-Version: 1.0\nMain-Class: a.Run\n')).toEqual([
      'a/Run.class',
    ])
  })

  test('a jar naming none has a few classes read, never the ones only newer Java loads', () => {
    const names = ['META-INF/versions/25/a/A.class', 'a/A.class', 'a/B.class', 'a/C.class', 'a/D.class']
    expect(classesToRead(names, {})).toEqual(['a/A.class', 'a/B.class', 'a/C.class'])
    expect(javaOfClasses([Uint8Array.from(Buffer.from('cafebabe00000034', 'hex')), BENTOBOX_3_23_3])).toBe(25)
    expect(javaOfClasses([])).toBeNull()
  })

  test('a jar built for Java 25 needs a release whose server runs it', () => {
    expect(javaFor('1.21.11')).toBe(21)
    expect(oldestReleaseOn(25)).toBe('26.1.2')
    expect(oldestReleaseOn(21)).toBe('1.21.1')
    expect(oldestReleaseOn(26)).toBeNull()
  })
})

describe('a Fabric mod’s own metadata', () => {
  test('says the mods it requires that neither Fabric Loader nor its own jar holds', () => {
    // spark 1.10.187-fabric's fabric.mod.json, as Modrinth served it on 2026-10-11 (version e3hsPc1o).
    const spark = {
      id: 'spark',
      depends: {
        fabricloader: '>=0.18.4',
        minecraft: '>=26.1',
        'fabric-api-base': '*',
        'fabric-command-api-v2': '*',
        'fabric-lifecycle-events-v1': '*',
        'fabric-permissions-api-v0': '*',
      },
      jars: [{ file: 'META-INF/jars/fabric-permissions-api-0.7.0.jar' }],
    }
    expect(fabricModOf({ 'fabric.mod.json': spark })).toEqual({
      ids: ['spark'],
      depends: ['fabric-api-base', 'fabric-command-api-v2', 'fabric-lifecycle-events-v1'],
      carriesJars: true,
    })
    expect(fabricModOf({ 'fabric.mod.json': { id: 'lithium', provides: ['lithium-api'] } })).toEqual({
      ids: ['lithium', 'lithium-api'],
      depends: [],
      carriesJars: false,
    })
    expect(fabricModOf({ 'plugin.yml': { main: 'a.Plugin' } })).toBeNull()
  })
})
