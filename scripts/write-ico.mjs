import { app, nativeImage } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

function flipBGRA(buf, width, height) {
  const row = width * 4
  const out = Buffer.alloc(row * height)
  for (let y = 0; y < height; y++) {
    buf.copy(out, (height - 1 - y) * row, y * row, y * row + row)
  }
  return out
}

function makeIco(parts) {
  const count = parts.length
  let offset = 6 + 16 * count
  const dirs = []
  const images = []
  for (const part of parts) {
    const xor = part.dib
    const maskStride = Math.ceil(part.w / 32) * 4
    const andMask = Buffer.alloc(maskStride * part.h)
    const header = Buffer.alloc(40)
    header.writeInt32LE(40, 0)
    header.writeInt32LE(part.w, 4)
    header.writeInt32LE(part.h * 2, 8)
    header.writeInt16LE(1, 12)
    header.writeInt16LE(32, 14)
    header.writeInt32LE(0, 16)
    header.writeInt32LE(xor.length + andMask.length, 20)
    const image = Buffer.concat([header, xor, andMask])
    dirs.push({
      w: part.w >= 256 ? 0 : part.w,
      h: part.h >= 256 ? 0 : part.h,
      size: image.length,
      offset,
    })
    images.push(image)
    offset += image.length
  }
  const file = Buffer.alloc(6 + 16 * count)
  file.writeUInt16LE(0, 0)
  file.writeUInt16LE(1, 2)
  file.writeUInt16LE(count, 4)
  dirs.forEach((entry, i) => {
    const at = 6 + i * 16
    file.writeUInt8(entry.w, at)
    file.writeUInt8(entry.h, at + 1)
    file.writeUInt16LE(1, at + 4)
    file.writeUInt16LE(32, at + 6)
    file.writeUInt32LE(entry.size, at + 8)
    file.writeUInt32LE(entry.offset, at + 12)
  })
  return Buffer.concat([file, ...images])
}

app.whenReady().then(() => {
  const src = nativeImage.createFromPath(path.join(root, 'public/icon.png'))
  if (src.isEmpty()) throw new Error('icon png was empty')
  const parts = [16, 32, 48, 256].map((size) => {
    const resized = src.resize({ width: size, height: size, quality: 'best' })
    const { width, height } = resized.getSize()
    return { w: width, h: height, dib: flipBGRA(resized.toBitmap(), width, height) }
  })
  const ico = makeIco(parts)
  fs.writeFileSync(path.join(root, 'build/icon.ico'), ico)
  fs.writeFileSync(path.join(root, 'electron/icon.ico'), ico)
  console.log('wrote ico', ico.length)
  app.quit()
})
