// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "native-reader-inventory",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .library(
            name: "NativeReaderInventoryCore",
            targets: ["NativeReaderInventoryCore"]
        ),
        .executable(
            name: "native-reader-inventory",
            targets: ["native-reader-inventory"]
        )
    ],
    targets: [
        .target(name: "NativeReaderInventoryCore"),
        .executableTarget(
            name: "native-reader-inventory",
            dependencies: ["NativeReaderInventoryCore"]
        ),
        .testTarget(
            name: "NativeReaderInventoryCoreTests",
            dependencies: ["NativeReaderInventoryCore"]
        )
    ]
)
