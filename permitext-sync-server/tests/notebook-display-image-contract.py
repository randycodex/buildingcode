#!/usr/bin/env python3
"""Execute the production ImageIO decoder with synthetic images on macOS."""
from pathlib import Path
import subprocess
import tempfile
ROOT = Path(__file__).resolve().parents[2]
source = (ROOT / 'NYC CC APP/permitext/Views/NotebookView.swift').read_text()
helper = source[source.index('private enum NotebookDisplayImageDecoder'):source.index('private struct NotebookAssetImage: View')]
swift = '''import Foundation
import ImageIO
import CoreGraphics
''' + helper + r'''
func fixture(_ width: Int, _ height: Int, _ orientation: Int) -> Data {
    let context = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8,
        bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
    context.setFillColor(CGColor(red: 0.8, green: 0.1, blue: 0.2, alpha: 1))
    context.fill(CGRect(x: 0, y: 0, width: width, height: height))
    let data = NSMutableData()
    let destination = CGImageDestinationCreateWithData(data, "public.jpeg" as CFString, 1, nil)!
    CGImageDestinationAddImage(destination, context.makeImage()!,
        [kCGImagePropertyOrientation: orientation] as CFDictionary)
    precondition(CGImageDestinationFinalize(destination))
    return data as Data
}
for (w, h, orientation, target, expectedW, expectedH) in [
    (6000, 4000, 1, 900, 900, 600),
    (2000, 8000, 1, 900, 900, 3600),
    (6000, 4000, 6, 900, 900, 1350),
    (6000, 4000, 8, 900, 900, 1350),
    (6000, 4000, 2, 900, 900, 600),
    (6000, 4000, 5, 900, 900, 1350),
    (320, 160, 1, 900, 320, 160)
] {
    let original = fixture(w, h, orientation)
    let copy = original
    let decoded = NotebookDisplayImageDecoder.decode(original, pixelWidth: target)!
    precondition(abs(decoded.width - expectedW) <= 1 && abs(decoded.height - expectedH) <= 1,
        "Wrong dimensions: \(decoded.width)x\(decoded.height), expected \(expectedW)x\(expectedH)")
    precondition(original == copy, "Original bytes changed")
    if w > target { precondition(decoded.bytesPerRow * decoded.height < w * h * 4) }
}
precondition(NotebookDisplayImageDecoder.decode(Data([0, 1, 2]), pixelWidth: 900) == nil)
precondition(NotebookDisplayImageDecoder.decode(Data(), pixelWidth: 0) == nil)
print("Production Notebook display decoder: 7 image fixtures plus corrupt/zero-width checks passed")
'''
with tempfile.TemporaryDirectory(prefix='permitext-notebook-image-') as directory:
    path = Path(directory) / 'main.swift'
    path.write_text(swift)
    binary = Path(directory) / 'check'
    subprocess.run(['xcrun', 'swiftc', str(path), '-o', str(binary)], check=True)
    subprocess.run([str(binary)], check=True)
