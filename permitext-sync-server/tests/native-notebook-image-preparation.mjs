// Host ImageIO execution of the production upload preparer; synthetic pixels only.
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdtemp, rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const source = await readFile(new URL('../../NYC CC APP/permitext/Views/NotebookView.swift', import.meta.url),'utf8');
const start = source.indexOf('private enum NotebookUploadImagePreparer {');
assert.ok(start >= 0);
const end = source.indexOf('\n}',start)+2;
const declaration = source.slice(start,end);
const backend = await readFile(new URL('../app.mjs',import.meta.url),'utf8');
assert.match(backend,/const maxNotebookAssetBytes = 8 \* 1024 \* 1024;/);
const fixture = `import Foundation
import ImageIO
import CoreGraphics
${declaration}
func imageData(width: Int, height: Int, orientation: Int = 1) -> Data {
 var pixels = [UInt8](repeating: 0, count: width * height * 4)
 var value: UInt32 = 0xabcdef01
 for index in stride(from: 0, to: pixels.count, by: 4) {
  value ^= value << 13; value ^= value >> 17; value ^= value << 5
  pixels[index] = UInt8(truncatingIfNeeded: value)
  pixels[index+1] = UInt8(truncatingIfNeeded: value >> 8)
  pixels[index+2] = UInt8(truncatingIfNeeded: value >> 16)
  pixels[index+3] = 255
 }
 let provider = CGDataProvider(data: Data(pixels) as CFData)!
 let image = CGImage(width: width,height: height,bitsPerComponent: 8,bitsPerPixel: 32,bytesPerRow: width*4,
  space: CGColorSpaceCreateDeviceRGB(),bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.noneSkipLast.rawValue),provider: provider,decode: nil,shouldInterpolate: false,intent: .defaultIntent)!
 let bytes = NSMutableData()
 let destination = CGImageDestinationCreateWithData(bytes,"public.jpeg" as CFString,1,nil)!
 CGImageDestinationAddImage(destination,image,[kCGImageDestinationLossyCompressionQuality: 0.95, kCGImagePropertyOrientation: orientation] as CFDictionary)
 precondition(CGImageDestinationFinalize(destination))
 return bytes as Data
}
@main struct Main {
 static func main() async throws {
  let small = imageData(width: 320,height: 240)
  let prepared = try NotebookUploadImagePreparer.prepare(small)
  precondition(prepared.width == 320 && prepared.height == 240,"Small images must not upscale")
  let rotated = try NotebookUploadImagePreparer.prepare(imageData(width: 320,height: 240,orientation: 6))
  precondition(rotated.width == 240 && rotated.height == 320,"EXIF orientation must become display pixels")
  let large = imageData(width: 5000,height: 3000)
  let bounded = try NotebookUploadImagePreparer.prepare(large)
  precondition(max(bounded.width,bounded.height) <= 4096,"Camera decode must be bounded")
  precondition(bounded.data.count <= 8 * 1024 * 1024,"Upload must fit backend cap")
  let constrained = try NotebookUploadImagePreparer.prepare(large,maximumBytes: 700_000)
  precondition(constrained.data.count <= 700_000,"Lower byte budget must shrink payload")
  do { _ = try NotebookUploadImagePreparer.prepare(Data("invalid".utf8)); preconditionFailure("Invalid image accepted") }
  catch NotebookUploadImagePreparer.PreparationError.invalidImage {}
  do { _ = try NotebookUploadImagePreparer.prepare(small,maximumBytes: 1); preconditionFailure("Impossible limit accepted") }
  catch NotebookUploadImagePreparer.PreparationError.tooLarge {}
  let cancelled = Task {
   while !Task.isCancelled { await Task.yield() }
   return try NotebookUploadImagePreparer.prepare(small)
  }
  cancelled.cancel()
  do { _ = try await cancelled.value; preconditionFailure("Cancelled work accepted") }
  catch is CancellationError {}
  print("PASS: small image, orientation, 15MP camera input, bounded pixels/bytes, invalid input, too-small budget and cancellation")
 }
}
`;
const dir = await mkdtemp(join(tmpdir(),'permitext-image-preparation-'));
try {
 await writeFile(join(dir,'verify.swift'),fixture);
 execFileSync('xcrun',['swiftc','-O','-parse-as-library',join(dir,'verify.swift'),'-o',join(dir,'verify')],{stdio:'inherit'});
 execFileSync(join(dir,'verify'),[],{stdio:'inherit'});
} finally { await rm(dir,{recursive:true,force:true}); }
