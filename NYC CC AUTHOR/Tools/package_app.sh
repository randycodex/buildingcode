#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_DIR="$PROJECT_DIR/.build"
DIST_DIR="$PROJECT_DIR/dist"
APP_NAME="NYC CC AUTHOR"
EXECUTABLE_NAME="NYCCCAuthor"
STAGING_DIR="$(mktemp -d /tmp/${EXECUTABLE_NAME}.XXXXXX)"

cleanup() {
    rm -rf "$STAGING_DIR"
}
trap cleanup EXIT

APP_BUNDLE="$STAGING_DIR/$APP_NAME.app"
INSTALL_DIR="/Applications/$APP_NAME.app"
CONTENTS_DIR="$APP_BUNDLE/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"
RESOURCES_DIR="$CONTENTS_DIR/Resources"
EXECUTABLE_PATH="$BUILD_DIR/arm64-apple-macosx/release/$EXECUTABLE_NAME"
PLIST_PATH="$CONTENTS_DIR/Info.plist"
APP_ICON_NAME="NYCCCAuthorIcon"
ICONSET_DIR="$DIST_DIR/$APP_ICON_NAME.iconset"
ICNS_PATH="$RESOURCES_DIR/$APP_ICON_NAME.icns"
BASE_ICON_PATH="$DIST_DIR/$APP_ICON_NAME.png"

mkdir -p "$DIST_DIR"
touch "$DIST_DIR/.metadata_never_index"
rm -rf "$ICONSET_DIR" "$BASE_ICON_PATH"

env SWIFT_MODULECACHE_PATH=/tmp/nyc-author-swift-modcache \
    CLANG_MODULE_CACHE_PATH=/tmp/nyc-author-clang-modcache \
    swift build -c release --package-path "$PROJECT_DIR"

mkdir -p "$MACOS_DIR" "$RESOURCES_DIR"
cp "$EXECUTABLE_PATH" "$MACOS_DIR/$EXECUTABLE_NAME"
chmod +x "$MACOS_DIR/$EXECUTABLE_NAME"

/usr/bin/swift - <<SWIFT
import AppKit

let outputPath = "$BASE_ICON_PATH"
let size = CGSize(width: 1024, height: 1024)
let image = NSImage(size: size)
image.lockFocus()

let background = NSColor(calibratedRed: 0.09, green: 0.10, blue: 0.13, alpha: 1.0)
background.setFill()
NSBezierPath(roundedRect: NSRect(origin: .zero, size: size), xRadius: 220, yRadius: 220).fill()

let panelRect = NSRect(x: 84, y: 84, width: 856, height: 856)
NSColor(calibratedRed: 0.15, green: 0.17, blue: 0.21, alpha: 1.0).setFill()
NSBezierPath(roundedRect: panelRect, xRadius: 150, yRadius: 150).fill()

NSColor(calibratedRed: 0.95, green: 0.95, blue: 0.94, alpha: 1.0).setFill()
NSBezierPath(roundedRect: NSRect(x: 178, y: 170, width: 384, height: 684), xRadius: 48, yRadius: 48).fill()

NSColor(calibratedRed: 0.19, green: 0.45, blue: 0.93, alpha: 1.0).setFill()
NSBezierPath(roundedRect: NSRect(x: 612, y: 170, width: 234, height: 684), xRadius: 48, yRadius: 48).fill()

let paragraph = NSMutableParagraphStyle()
paragraph.alignment = .left

let titleAttributes: [NSAttributedString.Key: Any] = [
    .font: NSFont.systemFont(ofSize: 154, weight: .bold),
    .foregroundColor: NSColor.white,
    .paragraphStyle: paragraph
]

let subtitleAttributes: [NSAttributedString.Key: Any] = [
    .font: NSFont.systemFont(ofSize: 72, weight: .semibold),
    .foregroundColor: NSColor(calibratedWhite: 0.88, alpha: 1.0),
    .paragraphStyle: paragraph
]

NSAttributedString(string: "CC", attributes: titleAttributes).draw(in: NSRect(x: 628, y: 520, width: 220, height: 170))
NSAttributedString(string: "AUTHOR", attributes: subtitleAttributes).draw(in: NSRect(x: 628, y: 424, width: 280, height: 90))

let textLineColor = NSColor(calibratedRed: 0.14, green: 0.16, blue: 0.19, alpha: 1.0)
textLineColor.setStroke()
for y in stride(from: 762.0, through: 280.0, by: -74.0) {
    let path = NSBezierPath()
    path.lineWidth = 8
    path.move(to: NSPoint(x: 220, y: y))
    path.line(to: NSPoint(x: 520, y: y))
    path.stroke()
}

image.unlockFocus()

guard let tiff = image.tiffRepresentation,
      let bitmap = NSBitmapImageRep(data: tiff),
      let pngData = bitmap.representation(using: .png, properties: [:]) else {
    fputs("Failed to generate app icon\n", stderr)
    exit(1)
}

try pngData.write(to: URL(fileURLWithPath: outputPath))
SWIFT

mkdir -p "$ICONSET_DIR"
for size in 16 32 64 128 256 512; do
    /usr/bin/sips -z "$size" "$size" "$BASE_ICON_PATH" --out "$ICONSET_DIR/icon_${size}x${size}.png" >/dev/null
done
/usr/bin/sips -z 32 32 "$BASE_ICON_PATH" --out "$ICONSET_DIR/icon_16x16@2x.png" >/dev/null
/usr/bin/sips -z 64 64 "$BASE_ICON_PATH" --out "$ICONSET_DIR/icon_32x32@2x.png" >/dev/null
/usr/bin/sips -z 256 256 "$BASE_ICON_PATH" --out "$ICONSET_DIR/icon_128x128@2x.png" >/dev/null
/usr/bin/sips -z 512 512 "$BASE_ICON_PATH" --out "$ICONSET_DIR/icon_256x256@2x.png" >/dev/null
/usr/bin/sips -z 1024 1024 "$BASE_ICON_PATH" --out "$ICONSET_DIR/icon_512x512@2x.png" >/dev/null
/usr/bin/iconutil -c icns "$ICONSET_DIR" -o "$ICNS_PATH"

cat > "$PLIST_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>en</string>
    <key>CFBundleExecutable</key>
    <string>$EXECUTABLE_NAME</string>
    <key>CFBundleIdentifier</key>
    <string>com.randycodex.NYCCCAuthor</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleIconFile</key>
    <string>$APP_ICON_NAME</string>
    <key>CFBundleName</key>
    <string>$APP_NAME</string>
    <key>CFBundleDisplayName</key>
    <string>$APP_NAME</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>LSMinimumSystemVersion</key>
    <string>14.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>NSPrincipalClass</key>
    <string>NSApplication</string>
    <key>CFBundleDocumentTypes</key>
    <array>
        <dict>
            <key>CFBundleTypeName</key>
            <string>HTML</string>
            <key>LSHandlerRank</key>
            <string>Alternate</string>
            <key>LSItemContentTypes</key>
            <array>
                <string>public.html</string>
            </array>
        </dict>
    </array>
</dict>
</plist>
PLIST

/usr/bin/xattr -cr "$APP_BUNDLE"
/usr/bin/codesign --force --deep --sign - "$APP_BUNDLE" >/dev/null
/bin/rm -rf "$INSTALL_DIR"
/usr/bin/ditto "$APP_BUNDLE" "$INSTALL_DIR"
/usr/bin/xattr -cr "$INSTALL_DIR"
/usr/bin/codesign --force --deep --sign - "$INSTALL_DIR" >/dev/null
/usr/bin/touch "$INSTALL_DIR" "$INSTALL_DIR/Contents" "$INSTALL_DIR/Contents/Info.plist" "$INSTALL_DIR/Contents/MacOS/$EXECUTABLE_NAME"

echo "Installed app bundle at:"
echo "$INSTALL_DIR"
