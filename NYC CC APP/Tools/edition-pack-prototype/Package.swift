// swift-tools-version: 6.0
import PackageDescription
let package = Package(name: "EditionPackPrototype", platforms: [.macOS(.v13)], products: [.library(name: "EditionPackPrototype", targets: ["EditionPackPrototype"])], targets: [.executableTarget(name: "edition-pack", dependencies: ["EditionPackPrototype"]), .target(name: "EditionPackPrototype"), .testTarget(name: "EditionPackPrototypeTests", dependencies: ["EditionPackPrototype"])])
