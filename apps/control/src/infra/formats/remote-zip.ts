// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * A zip at a URL read by byte ranges (`FileFormats.readRemoteZip`), in memory that stays small
 * whatever the zip holds and however many are asked for at once: a few reads at a time across the
 * process, the directory walked one entry at a time with only its names kept, and every range and
 * entry held to a size. zip.js describes each entry in an object of several KB, so holding a whole
 * directory costs about 100 MB for Create's 12,500 files, and a handful of those at once took the api
 * past its heap on 2026-10-11.
 *
 * It doesn't check a zip as hostile input the way an uploaded pack is (`pack-archives.ts`): it
 * reads a catalog's files, and only refuses what would cost too much to read.
 */
import { type FileEntry, HttpRangeReader, Reader, Uint8ArrayWriter, ZipReader } from '@zip.js/zip.js'
import { UnreadableFile } from '../../app/ports/formats.ts'

/** Zips read at once, whoever asks; the rest wait their turn. */
const READS_AT_ONCE = 4
/** A directory past this lists more than any jar or pack does: about 150,000 files. */
const MAX_DIRECTORY_BYTES = 16 * 1024 * 1024
const MAX_RECORDS = 150_000
/** Deflate never grows what it stores by more than a few bytes in every 16 KB block. */
const DEFLATE_SLACK = 64 * 1024

let reading = 0
const waiting: Array<() => void> = []

/** A remote zip's names, and the entries `wanted` picks, each up to `maxEntryBytes`. */
export async function readRemoteZip(
  url: string,
  options: { wanted(name: string): boolean; maxEntryBytes: number },
): Promise<{ names: string[]; entries: Map<string, Uint8Array> }> {
  if (reading >= READS_AT_ONCE) await new Promise<void>((resolve) => waiting.push(resolve))
  reading++
  try {
    return await read(url, options)
  } finally {
    reading--
    waiting.shift()?.()
  }
}

async function read(
  url: string,
  options: { wanted(name: string): boolean; maxEntryBytes: number },
): Promise<{ names: string[]; entries: Map<string, Uint8Array> }> {
  const reader = new ZipReader(new HeldRangeReader(url))
  try {
    const names: string[] = []
    const wanted: FileEntry[] = []
    // Each entry is let go as the next is read; only its name stays, and the entries wanted.
    for await (const entry of reader.getEntriesGenerator()) {
      if (names.length >= MAX_RECORDS)
        throw new UnreadableFile(`More than ${MAX_RECORDS} files, more than a jar or pack holds`)
      names.push(entry.filename)
      if (entry.directory || !options.wanted(entry.filename)) continue
      if (
        entry.uncompressedSize > options.maxEntryBytes ||
        entry.compressedSize > options.maxEntryBytes + DEFLATE_SLACK
      )
        throw new UnreadableFile(
          `${entry.filename} is ${entry.uncompressedSize} bytes, more than ${options.maxEntryBytes}`,
        )
      wanted.push(entry)
    }
    const entries = new Map<string, Uint8Array>()
    for (const entry of wanted) entries.set(entry.filename, await entry.getData(new Uint8ArrayWriter()))
    return { names, entries }
  } catch (error) {
    if (error instanceof UnreadableFile) throw error
    throw new UnreadableFile(`Not a zip that can be read by ranges: ${messageOf(error)}`)
  } finally {
    await reader.close()
  }
}

/**
 * Ranges of a URL, none longer than a directory can be. zip.js reads a directory in one range of
 * the length the zip declares, and an entry's bytes in chunks of 256 KB, through this.
 */
class HeldRangeReader extends Reader<string> {
  readonly #http: HttpRangeReader

  constructor(url: string) {
    super(url)
    this.#http = new HttpRangeReader(url)
  }

  override async init(): Promise<void> {
    await this.#http.init?.()
    this.size = this.#http.size
    await super.init?.()
  }

  override readUint8Array(index: number, length: number): Promise<Uint8Array> {
    if (length > MAX_DIRECTORY_BYTES)
      return Promise.reject(
        new UnreadableFile(`Asked for ${length} bytes at once, more than a jar or pack's directory`),
      )
    return this.#http.readUint8Array(index, length)
  }
}

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error))
