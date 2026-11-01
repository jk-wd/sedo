// Render the Sedo shield into the two 1024 px images the macOS app icon needs.
//
//   swift render-app-icon.swift <shield.png> <out-dir>
//
// The source is design/icon-dark-bg.png: the shield on black, with an edge
// that reads on black. tile.png places that artwork on a black rounded tile
// inside Apple's 824 px icon grid. layer.png is the same artwork on a
// transparent canvas; macOS 26 fills the tile black behind it.
import AppKit

let args = CommandLine.arguments
guard args.count == 3, let shield = NSImage(contentsOfFile: args[1]) else {
  FileHandle.standardError.write("usage: render-app-icon.swift <shield.png> <out-dir>\n".data(using: .utf8)!)
  exit(1)
}
let outDir = URL(fileURLWithPath: args[2], isDirectory: true)
let canvas: CGFloat = 1024

func render(_ name: String, draw: (CGRect) -> Void) {
  let rep = NSBitmapImageRep(
    bitmapDataPlanes: nil, pixelsWide: Int(canvas), pixelsHigh: Int(canvas),
    bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
    colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
  NSGraphicsContext.current?.imageInterpolation = .high
  draw(CGRect(x: 0, y: 0, width: canvas, height: canvas))
  NSGraphicsContext.restoreGraphicsState()
  let png = rep.representation(using: .png, properties: [:])!
  try! png.write(to: outDir.appendingPathComponent(name))
}

func drawShield(height: CGFloat, centeredIn box: CGRect) {
  let size = shield.size
  let width = height * size.width / size.height
  let rect = CGRect(
    x: box.midX - width / 2, y: box.midY - height / 2, width: width, height: height)
  shield.draw(in: rect, from: .zero, operation: .sourceOver, fraction: 1)
}

render("tile.png") { full in
  let tile = full.insetBy(dx: 100, dy: 100)
  let path = NSBezierPath(roundedRect: tile, xRadius: 185, yRadius: 185)
  NSGraphicsContext.saveGraphicsState()
  let shadow = NSShadow()
  shadow.shadowColor = NSColor.black.withAlphaComponent(0.3)
  shadow.shadowBlurRadius = 28
  shadow.shadowOffset = NSSize(width: 0, height: -12)
  shadow.set()
  NSColor.black.setFill()
  path.fill()
  NSGraphicsContext.restoreGraphicsState()
  drawShield(height: 600, centeredIn: tile)
}

render("layer.png") { full in
  drawShield(height: 760, centeredIn: full)
}
