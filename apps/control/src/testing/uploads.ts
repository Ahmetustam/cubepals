// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

import { gzipSync } from 'node:zlib'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import nbt from 'prismarine-nbt'

/** A Fabric mod's jar, declaring itself as a real one does; `fields` overrides its fabric.mod.json. */
export const fabricJar = (id: string, fields: Record<string, unknown> = {}): Uint8Array =>
  zipSync({
    'fabric.mod.json': strToU8(
      JSON.stringify({
        schemaVersion: 1,
        id,
        name: `Mod ${id}`,
        version: '1.0.0',
        environment: '*',
        depends: { minecraft: '>=26' },
        ...fields,
      }),
    ),
    [`net/example/${id}/Mod.class`]: new Uint8Array([0xca, 0xfe, 0xba, 0xbe, ...strToU8(id)]),
  })

/**
 * A Paper plugin's jar whose plugin.yml names its main class, compiled for one Java release: the
 * class holds the magic and the version a compiler writes, as BentoBox 3.23.3's holds Java 25's.
 */
export const pluginJar = (name: string, java: number): Uint8Array =>
  zipSync({
    'plugin.yml': strToU8(`name: ${name}\nmain: net.example.${name}.Plugin\nversion: 1.0\n`),
    [`net/example/${name}/Plugin.class`]: new Uint8Array([0xca, 0xfe, 0xba, 0xbe, 0, 0, 0, java + 44]),
  })

/** A zip holding the given text files: a jar with whatever metadata a test needs. */
export const zipOf = (files: Record<string, string>): Uint8Array =>
  zipSync(Object.fromEntries(Object.entries(files).map(([name, text]) => [name, strToU8(text)])))

/** A world's level.dat as the game writes it: gzipped NBT naming the version that saved it. */
export const levelDat = (version: string): Uint8Array =>
  gzipSync(
    nbt.writeUncompressed({
      type: 'compound',
      name: '',
      value: {
        Data: {
          type: 'compound',
          value: {
            DataVersion: { type: 'int', value: 5023 },
            Version: { type: 'compound', value: { Name: { type: 'string', value: version } } },
          },
        },
      },
    }),
  )

/** A zip of the given files, as a test uploads one: an app test never reaches for the zip library. */
export const zipBytes = (files: Record<string, Uint8Array>): Uint8Array => zipSync(files)

/** A zip's files by name, as a test reads what Blockly built. */
export const unzipBytes = (bytes: Uint8Array): Record<string, Uint8Array> => unzipSync(bytes)

export const utf8 = (text: string): Uint8Array => strToU8(text)
export const textOf = (bytes: Uint8Array): string => strFromU8(bytes)
