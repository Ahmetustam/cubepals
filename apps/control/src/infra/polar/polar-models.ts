// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Polar's shapes as `@polar-sh/sdk` types them for API 2026-10, for the adapter's schemas and for
 * what stands in for Polar in tests, which build its answers and deliveries from these types
 * rather than outside the adapter importing the SDK. Types only: requests are PolarBilling's.
 */
import type { z } from 'zod'

export type { models, webhooks } from '@polar-sh/sdk/2026-10'

/**
 * The fields a schema reads from one of Polar's shapes, by the names the SDK's `models` give them;
 * a union's from any of its members. A schema `satisfies` it, so a field Polar renames or drops
 * fails the build rather than reading as missing.
 */
export type Fields<T> = Partial<Record<T extends unknown ? keyof T : never, z.ZodType>>
