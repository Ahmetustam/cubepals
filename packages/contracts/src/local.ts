// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * The ports Blockly's own processes listen on: the one place each is written, for the control
 * plane's configuration, the web app and the scripts that drive them. Files that can't import,
 * such as `docker-compose.yml`, `.env.example`, `apps/web/package.json` and the Fly and Terraform
 * files, say the same numbers.
 */

/** The web app, as `next dev` and `next start` serve it (`apps/web/package.json`). */
export const WEB_PORT = 3000

/** The control plane's API, which the web app forwards `/api` to (`API_LISTEN`). */
export const API_PORT = 4000

/**
 * The control plane's internal listener, for the edge and machines on the private network
 * (`INTERNAL_LISTEN`); deployments listen on it too (`infra/fly/control.toml`).
 */
export const INTERNAL_PORT = 4001

/** Mailpit's web page, which shows the mail it caught: Mailpit's own default (`MP_UI_BIND_ADDR`). */
export const MAIL_PORT = 8025
