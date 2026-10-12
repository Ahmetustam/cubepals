// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { BackupView } from '@blockly/contracts'

const TRIGGERS: Record<BackupView['trigger'], string> = {
  scheduled: 'Daily backup',
  sleep: 'When everyone left',
  manual: 'Backed up by you',
  pre_apply: 'Before a change',
  pre_restore: 'Before a restore',
  pre_relocate: 'Before a move',
  uploaded: 'Uploaded by you',
  stored: 'Kept while it rested',
}

const ARCHIVES: Record<BackupView['trigger'], string> = {
  scheduled: 'Weekly download',
  sleep: 'Download',
  manual: 'Download',
  pre_apply: 'Download',
  pre_restore: 'Download',
  pre_relocate: 'Download',
  uploaded: 'Uploaded by you',
  stored: 'Kept while it rested',
}

export const backupTitle = (backup: BackupView): string =>
  backup.tier === 'archive' ? ARCHIVES[backup.trigger] : TRIGGERS[backup.trigger]
