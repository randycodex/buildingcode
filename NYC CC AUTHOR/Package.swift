// swift-tools-version: 6.3

import PackageDescription

let package = Package(
    name: "NYCCCAuthor",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .executable(name: "NYCCCAuthor", targets: ["NYCCCAuthor"])
    ],
    targets: [
        .executableTarget(
            name: "NYCCCAuthor",
            path: "Sources/NYCCCAuthor"
        )
    ],
    swiftLanguageModes: [.v6]
)
