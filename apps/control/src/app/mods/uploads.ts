// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

import { type Queryable, schema } from '@blockly/db'
import { and, desc, eq, inArray, ne, sql } from 'drizzle-orm'
import type { PinnedMod } from '../../domain/mods/artifact.ts'
import { fits, type ModMetadata, type VersionRange } from '../../minecraft/uploads.ts'
import { offeredVersions } from '../../minecraft/versions.ts'
import { AppError } from '../errors.ts'

const uploads = schema.modUploads
const stored = schema.storedArtifacts

/** A jar someone uploaded, with what it says about itself and where its bytes are kept. */
export interface ModUploadRecord {
  id: string
  ownerId: string
  sha512: string
  fileName: string
  metadata: ModMetadata
  /** The stored artifact's key and size. */
  key: string
  sizeBytes: number
  createdAt: Date
}

const columns = {
  id: uploads.id,
  ownerId: uploads.ownerId,
  sha512: uploads.sha512,
  fileName: uploads.fileName,
  metadata: uploads.loaderMetadata,
  key: stored.key,
  sizeBytes: stored.sizeBytes,
  createdAt: uploads.createdAt,
}

const toRecord = (
  row: Omit<ModUploadRecord, 'metadata'> & { metadata: Record<string, unknown> },
): ModUploadRecord => ({
  ...row,
  // Written by insertModUpload, from minecraft/'s reading of the jar.
  metadata: row.metadata as unknown as ModMetadata,
})

export async function insertModUpload(
  q: Queryable,
  upload: { ownerId: string; sha512: string; fileName: string; metadata: ModMetadata },
): Promise<string> {
  const [row] = await q
    .insert(uploads)
    .values({
      ownerId: upload.ownerId,
      sha512: upload.sha512,
      fileName: upload.fileName,
      loaderMetadata: { ...upload.metadata },
    })
    .returning({ id: uploads.id })
  if (!row) throw new Error('The upload just recorded is missing')
  return row.id
}

/** The owner's upload of these bytes, if they uploaded them before. */
export async function findModUpload(
  q: Queryable,
  ownerId: string,
  sha512: string,
): Promise<ModUploadRecord | null> {
  const [row] = await q
    .select(columns)
    .from(uploads)
    .innerJoin(stored, eq(stored.sha512, uploads.sha512))
    .where(and(eq(uploads.ownerId, ownerId), eq(uploads.sha512, sha512)))
    .limit(1)
  return row ? toRecord(row) : null
}

export async function loadModUploads(q: Queryable, ids: readonly string[]): Promise<ModUploadRecord[]> {
  if (ids.length === 0) return []
  const rows = await q
    .select(columns)
    .from(uploads)
    .innerJoin(stored, eq(stored.sha512, uploads.sha512))
    .where(inArray(uploads.id, [...ids]))
  return rows.map(toRecord)
}

export async function listModUploads(q: Queryable, ownerId: string): Promise<ModUploadRecord[]> {
  const rows = await q
    .select(columns)
    .from(uploads)
    .innerJoin(stored, eq(stored.sha512, uploads.sha512))
    .where(eq(uploads.ownerId, ownerId))
    .orderBy(desc(uploads.createdAt))
  return rows.map(toRecord)
}

export async function deleteModUpload(q: Queryable, id: string): Promise<void> {
  await q.delete(uploads).where(eq(uploads.id, id))
}

/** Whether a revision of a server that isn't purged pins this upload (§15.2). */
export async function uploadInUse(q: Queryable, uploadId: string): Promise<boolean> {
  const [row] = await q
    .select({ id: schema.serverRevisions.id })
    .from(schema.serverRevisions)
    .innerJoin(schema.minecraftServers, eq(schema.minecraftServers.id, schema.serverRevisions.serverId))
    .where(
      and(
        ne(schema.minecraftServers.status, 'purged'),
        // Served by the jsonb_path_ops index on mods.
        sql`${schema.serverRevisions.mods} @> ${JSON.stringify([{ source: { uploadId } }])}::jsonb`,
      ),
    )
    .limit(1)
  return row !== undefined
}

/** An upload, pinned as it is: its own bytes from the store, and the facts its jar declares. */
export function pinUpload(upload: ModUploadRecord): PinnedMod {
  const { metadata } = upload
  return {
    source: { catalog: 'upload', uploadId: upload.id },
    name: metadata.name,
    versionLabel: metadata.version || upload.fileName,
    artifact: {
      ref: { kind: 'stored', key: upload.key },
      sha512: upload.sha512,
      sizeBytes: upload.sizeBytes,
      fileName: upload.fileName,
    },
    environment: metadata.environment === 'server' ? 'server' : 'both',
    loaders: metadata.loaders,
    gameVersions: gameVersionsOf(metadata.gameVersions),
    origin: 'user',
    requiredBy: [],
  }
}

/**
 * The releases Blockly offers that a declared range allows. Empty means "any", so a range that
 * allows none of them lists what it names instead, which no server offers.
 */
export function gameVersionsOf(range: VersionRange): string[] {
  if (range.length === 0) return []
  const offered = offeredVersions()
    .map((v) => v.id)
    .filter((id) => fits(range, id))
  if (offered.length > 0) return offered
  const named = range.flat().filter((b) => b.op !== '<' && b.op !== '>')
  return [...new Set((named.length > 0 ? named : range.flat()).map((b) => b.version))]
}

/** The bytes at a URL, refusing more than the upload said it would be. */
export async function readAll(url: string, sizeBytes: number): Promise<Uint8Array> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Reading the upload back answered ${response.status}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.length !== sizeBytes)
    throw new AppError('invalid_upload', 'The file didn’t arrive whole. Upload it again.')
  return bytes
}
