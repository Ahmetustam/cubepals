// SPDX-FileCopyrightText: 2026 The Cubepals Authors
//
// SPDX-License-Identifier: AGPL-3.0-only

/** A Minecraft server's console over RCON, for the benches' probes inside Fly's network. */
import { Socket } from 'node:net'
import { MINUTE_MS } from '@blockly/contracts/durations'
import { RCON_PORT } from '../../apps/control/src/minecraft/ports.ts'

/** One RCON command (Source RCON: login, then the command); the server's reply. */
export function rcon(
  host: string,
  command: string,
  password = process.env.RCON_PASSWORD ?? '',
): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = new Socket()
    let bytes = Buffer.alloc(0)
    const send = (id: number, type: number, body: string) => {
      const payload = Buffer.from(body, 'utf8')
      const frame = Buffer.alloc(14 + payload.length)
      frame.writeInt32LE(10 + payload.length, 0)
      frame.writeInt32LE(id, 4)
      frame.writeInt32LE(type, 8)
      payload.copy(frame, 12)
      socket.write(frame)
    }
    socket.setTimeout(MINUTE_MS, () => {
      socket.destroy()
      reject(new Error(`rcon ${command}: timeout`))
    })
    socket.connect(RCON_PORT, host, () => send(1, 3, password))
    // The login's answer, then the command's.
    const answer = (id: number, body: string) => {
      if (id === 1) return send(2, 2, command)
      socket.destroy()
      if (id === 2) resolve(body)
      else reject(new Error('rcon: wrong password'))
    }
    socket.on('data', (chunk) => {
      bytes = Buffer.concat([bytes, chunk])
      while (bytes.length >= 4 && bytes.length >= 4 + bytes.readInt32LE(0)) {
        const length = bytes.readInt32LE(0)
        answer(bytes.readInt32LE(4), bytes.subarray(12, 4 + length - 2).toString('utf8'))
        bytes = bytes.subarray(4 + length)
      }
    })
    socket.on('error', reject)
  })
}
