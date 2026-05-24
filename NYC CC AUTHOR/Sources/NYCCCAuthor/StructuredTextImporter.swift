import Foundation

struct StructuredTextDocument {
    struct Group {
        let headerLine: String?
        let headingLine: String?
        let sections: [Section]
    }

    struct Section {
        let sectionNumber: String
        let titleLine: String
        let bodyText: String
        let attributedFullText: NSAttributedString?
        let headerLine: String?
        let headingLine: String?
        let isFirstInGroup: Bool

        var fullText: String {
            var components: [String] = []

            if isFirstInGroup {
                if let headerLine, !headerLine.isEmpty {
                    components.append(headerLine)
                }
                if let headingLine, !headingLine.isEmpty {
                    components.append(headingLine)
                }
            }

            components.append(titleLine)

            if !bodyText.isEmpty {
                components.append(bodyText)
            }

            return components.joined(separator: "\n")
        }
    }

    let groups: [Group]

    var sections: [Section] {
        groups.flatMap(\.sections)
    }
}

struct StructuredHierarchyDocument {
    struct CodeVersion {
        let name: String
        let codeSections: [CodeSection]
    }

    struct CodeSection {
        let name: String
        let chapters: [Chapter]
    }

    struct Chapter {
        let chapterNumber: String
        let title: String
        let bodyText: String
        let bodyAttributedText: NSAttributedString?
        let groups: [Group]
    }

    struct Group {
        let headerLine: String
        let headingLine: String?
        let headerAttributedText: NSAttributedString?
        let headingAttributedText: NSAttributedString?
        let bodyText: String
        let bodyAttributedText: NSAttributedString?
        let sections: [StructuredTextDocument.Section]
    }

    let codeVersions: [CodeVersion]
}

struct StructuredImportHierarchyDefaults {
    let codeVersionName: String?
    let codeSectionName: String?
}

enum StructuredTextImportError: LocalizedError {
    case noSections
    case noCodeVersions
    case titleOutsideGroup(String)
    case headingOutsideGroup(String)
    case chapterOutsideCodeSection(String)
    case codeSectionOutsideCodeVersion(String)
    case groupOutsideChapter(String)
    case invalidTitleLine(String)
    case invalidChapterLine(String)
    case duplicateSection(String)

    var errorDescription: String? {
        switch self {
        case .noSections:
            return "No titled sections were found. Use markers like ##, ###, and ####."
        case .noCodeVersions:
            return "No code versions were found. Start the file with '# CODE VERSION: ...'."
        case .titleOutsideGroup(let line):
            return "Found a titled section before a SECTION BC group: \(line)"
        case .headingOutsideGroup(let line):
            return "Found a chapter-section heading before a SECTION BC group: \(line)"
        case .chapterOutsideCodeSection(let line):
            return "Found a chapter before a code section: \(line)"
        case .codeSectionOutsideCodeVersion(let line):
            return "Found a code section before a code version: \(line)"
        case .groupOutsideChapter(let line):
            return "Found a SECTION BC group before a chapter: \(line)"
        case .invalidTitleLine(let line):
            return "Could not parse the titled section line: \(line)"
        case .invalidChapterLine(let line):
            return "Could not parse the chapter line: \(line)"
        case .duplicateSection(let sectionNumber):
            return "The import file contains the same section more than once: \(sectionNumber)"
        }
    }
}

enum StructuredTextImporter {
    private static let sectionNumberRegex = try! NSRegularExpression(
        pattern: #"^\s*[^A-Za-z0-9]*\s*(?:§\s*)?([A-Z]?\d+(?:-\d+)?(?:\.\d+[A-Za-z0-9.\-()*]*))(?:\s+.+)?$"#,
        options: []
    )
    private static let chapterDefinitionRegex = try! NSRegularExpression(
        pattern: #"^(CHAPTER|APPENDIX)\s+([A-Z]?\d+[A-Z]?|[A-Z])(?:\s*[:\-–—]\s*|\s+)(.+)$"#,
        options: [.caseInsensitive]
    )
    private static let sectionGroupDefinitionRegex = try! NSRegularExpression(
        pattern: #"^(?i)section\s+(?:(BC|FGC|MC|PC)\s+)?([A-Z0-9.\-()]+)(?:\s*[:\-–—]\s*(.*))?$"#,
        options: []
    )
    private static let ignorableParsingCharacters = CharacterSet(charactersIn: "\u{FEFF}\u{200B}\u{200C}\u{200D}\u{2060}")
    private static let inferredGroupHeading = "General"

    static func parse(_ rawText: String, codeSectionName: String? = nil) throws -> StructuredTextDocument {
        try parseSections(from: parsedLines(from: rawText), codeSectionName: codeSectionName)
    }

    static func parse(_ attributedText: NSAttributedString, codeSectionName: String? = nil) throws -> StructuredTextDocument {
        try parseSections(from: parsedLines(from: attributedText), codeSectionName: codeSectionName)
    }

    static func parseHierarchy(
        _ rawText: String,
        defaults: StructuredImportHierarchyDefaults? = nil
    ) throws -> StructuredHierarchyDocument {
        try parseHierarchy(from: parsedLines(from: rawText), defaults: defaults)
    }

    static func parseHierarchy(
        _ attributedText: NSAttributedString,
        defaults: StructuredImportHierarchyDefaults? = nil
    ) throws -> StructuredHierarchyDocument {
        try parseHierarchy(from: parsedLines(from: attributedText), defaults: defaults)
    }

    static func containsHierarchyMarkers(in rawText: String) -> Bool {
        rawText
            .replacingOccurrences(of: "\r\n", with: "\n")
            .replacingOccurrences(of: "\r", with: "\n")
            .components(separatedBy: "\n")
            .contains {
                let trimmed = trimmedParsingText(for: $0)
                let uppercased = trimmed.uppercased()
                return uppercased.hasPrefix("# CODE VERSION:") ||
                    uppercased.hasPrefix("## CODE SECTION:") ||
                    uppercased.hasPrefix("### CHAPTER ") ||
                    uppercased.hasPrefix("#### SECTION BC ") ||
                    customMarkerContent(in: trimmed, marker: "#6") != nil ||
                    customMarkerContent(in: trimmed, marker: "#5") != nil ||
                    customMarkerContent(in: trimmed, marker: "#4") != nil ||
                    customMarkerContent(in: trimmed, marker: "#3") != nil ||
                    customMarkerContent(in: trimmed, marker: "#2") != nil ||
                    customMarkerContent(in: trimmed, marker: "#1") != nil ||
                    customMarkerContent(in: trimmed, marker: "#------") != nil ||
                    customMarkerContent(in: trimmed, marker: "#-----") != nil ||
                    customMarkerContent(in: trimmed, marker: "#----") != nil ||
                    customMarkerContent(in: trimmed, marker: "#---") != nil ||
                    customMarkerContent(in: trimmed, marker: "#--") != nil ||
                    customMarkerContent(in: trimmed, marker: "#-") != nil ||
                    parseChapterDefinition(from: trimmed) != nil ||
                    parseSectionGroupDefinition(from: trimmed) != nil
            }
    }

    static func containsHierarchyMarkers(in attributedText: NSAttributedString) -> Bool {
        containsHierarchyMarkers(in: attributedText.string)
    }

    private struct ParsedLine {
        let rawText: String
        let trimmedText: String
        let attributedText: NSAttributedString?
        let attributedFullLineText: NSAttributedString?
        let leadingWhitespaceUTF16Length: Int

        func attributedContent(afterMarkerPrefixLength markerPrefixLength: Int) -> NSAttributedString? {
            guard let attributedText else { return nil }
            let start = min(leadingWhitespaceUTF16Length + markerPrefixLength, attributedText.length)
            let range = NSRange(location: start, length: attributedText.length - start)
            return NSAttributedString(attributedString: attributedText.attributedSubstring(from: range))
        }

        func attributedContent(afterMarker marker: String) -> NSAttributedString? {
            guard let attributedText else { return nil }
            let start = min(contentStartUTF16Offset(afterMarker: marker), attributedText.length)
            let range = NSRange(location: start, length: attributedText.length - start)
            return NSAttributedString(attributedString: attributedText.attributedSubstring(from: range))
        }

        var isBlank: Bool {
            trimmedText.isEmpty
        }

        private func contentStartUTF16Offset(afterMarker marker: String) -> Int {
            var offset = 0
            let scalars = Array(rawText.unicodeScalars)
            var index = 0

            while index < scalars.count {
                let scalar = scalars[index]
                if CharacterSet.whitespacesAndNewlines.contains(scalar) ||
                    StructuredTextImporter.ignorableParsingCharacters.contains(scalar) {
                    offset += scalar.utf16.count
                    index += 1
                    continue
                }

                let remaining = String(String.UnicodeScalarView(scalars[index...]))
                if remaining.hasPrefix(marker) {
                    return offset + marker.utf16.count
                }
                break
            }

            return leadingWhitespaceUTF16Length + marker.utf16.count
        }
    }

    private static func parseSections(from lines: [ParsedLine], codeSectionName: String? = nil) throws -> StructuredTextDocument {
        var groups: [StructuredTextDocument.Group] = []
        var currentHeaderLine: String?
        var currentHeaderAttributedText: NSAttributedString?
        var currentHeadingLine: String?
        var currentHeadingAttributedText: NSAttributedString?
        var currentSections: [StructuredTextDocument.Section] = []
        var currentTitleLine: String?
        var currentTitleAttributedText: NSAttributedString?
        var currentSectionNumber: String?
        var currentBodyLines: [ParsedLine] = []
        var seenSectionNumbers: Set<String> = []

        func finishCurrentSection() throws {
            guard let titleLine = currentTitleLine,
                  let sectionNumber = currentSectionNumber else { return }

            defer {
                currentTitleLine = nil
                currentTitleAttributedText = nil
                currentSectionNumber = nil
                currentBodyLines = []
            }

            let bodyLines = trimBlankLines(currentBodyLines)
            let bodyText = bodyLines.map(\.rawText).joined(separator: "\n")
            let duplicateKey = normalizedDuplicateKey(for: sectionNumber)
            if seenSectionNumbers.contains(duplicateKey) {
                if !bodyText.isEmpty,
                   let existingIndex = currentSections.firstIndex(where: {
                       normalizedDuplicateKey(for: $0.sectionNumber) == duplicateKey && $0.bodyText.isEmpty
                   }) {
                    currentSections.remove(at: existingIndex)
                } else {
                    return
                }
            } else {
                seenSectionNumbers.insert(duplicateKey)
            }

            let attributedBodyText = joinedAttributedLines(bodyLines)
            let attributedFullText = joinedAttributedComponents(
                [
                    currentSections.isEmpty ? currentHeaderAttributedText : nil,
                    currentSections.isEmpty ? currentHeadingAttributedText : nil,
                    currentTitleAttributedText,
                    attributedBodyText?.length ?? 0 > 0 ? attributedBodyText : nil
                ]
            )

            currentSections.append(
                StructuredTextDocument.Section(
                    sectionNumber: sectionNumber,
                    titleLine: titleLine,
                    bodyText: bodyText,
                    attributedFullText: attributedFullText,
                    headerLine: currentHeaderLine,
                    headingLine: currentHeadingLine,
                    isFirstInGroup: currentSections.isEmpty
                )
            )
        }

        func finishCurrentGroup() throws {
            try finishCurrentSection()
            guard currentHeaderLine != nil || currentHeadingLine != nil || !currentSections.isEmpty else { return }

            groups.append(
                StructuredTextDocument.Group(
                    headerLine: currentHeaderLine,
                    headingLine: currentHeadingLine,
                    sections: currentSections
                )
            )

            currentHeaderLine = nil
            currentHeaderAttributedText = nil
            currentHeadingLine = nil
            currentHeadingAttributedText = nil
            currentSections = []
        }

        for line in lines {
            if let customTitleLine = customMarkerContent(in: line.trimmedText, marker: "#7") ??
                customMarkerContent(in: line.trimmedText, marker: "#6") ??
                customMarkerContent(in: line.trimmedText, marker: "#5") ??
                customMarkerContent(in: line.trimmedText, marker: "#4") ??
                customMarkerContent(in: line.trimmedText, marker: "#3") ??
                customMarkerContent(in: line.trimmedText, marker: "#-------") ??
                customMarkerContent(in: line.trimmedText, marker: "#------") ??
                customMarkerContent(in: line.trimmedText, marker: "#-----") ??
                customMarkerContent(in: line.trimmedText, marker: "#----") ??
                customMarkerContent(in: line.trimmedText, marker: "#---") {
                guard currentHeaderLine != nil || currentHeadingLine != nil || !currentSections.isEmpty else {
                    throw StructuredTextImportError.titleOutsideGroup(line.trimmedText)
                }
                try finishCurrentSection()

                guard let sectionNumber = parseSectionNumber(from: customTitleLine, currentGroupHeaderLine: currentHeaderLine) else {
                    throw StructuredTextImportError.invalidTitleLine(customTitleLine)
                }

                currentTitleLine = customTitleLine
                currentTitleAttributedText = attributedContent(
                    for: line,
                    marker: customTitleMarker(in: line.trimmedText)
                )
                currentSectionNumber = sectionNumber
            } else if line.trimmedText.hasPrefix("#### ") || (currentHeaderLine != nil && parseSectionNumber(from: line.trimmedText, currentGroupHeaderLine: currentHeaderLine) != nil) {
                guard currentHeaderLine != nil || currentHeadingLine != nil || !currentSections.isEmpty else {
                    throw StructuredTextImportError.titleOutsideGroup(line.trimmedText)
                }
                try finishCurrentSection()

                let titleLine = line.trimmedText.hasPrefix("#### ")
                    ? String(line.trimmedText.dropFirst(5)).trimmingCharacters(in: .whitespacesAndNewlines)
                    : line.trimmedText
                guard let sectionNumber = parseSectionNumber(from: titleLine, currentGroupHeaderLine: currentHeaderLine) else {
                    throw StructuredTextImportError.invalidTitleLine(titleLine)
                }

                currentTitleLine = titleLine
                currentTitleAttributedText = line.trimmedText.hasPrefix("#### ")
                    ? line.attributedContent(afterMarker: "#### ")
                    : line.attributedText
                currentSectionNumber = sectionNumber
            } else if line.trimmedText.hasPrefix("### ") {
                try finishCurrentSection()
                currentHeadingLine = String(line.trimmedText.dropFirst(4)).trimmingCharacters(in: .whitespacesAndNewlines)
                currentHeadingAttributedText = line.attributedContent(afterMarkerPrefixLength: 4)
            } else if let customGroupLine = customMarkerContent(in: line.trimmedText, marker: "#2") ??
                      customMarkerContent(in: line.trimmedText, marker: "#--"),
                      let naturalGroup = parseSectionGroupDefinition(from: customGroupLine, codeSectionName: codeSectionName) {
                try finishCurrentGroup()
                currentHeaderLine = naturalGroup.headerLine
                currentHeaderAttributedText = metadataAttributedText(
                    matching: naturalGroup.headerLine,
                    from: line.attributedText
                )
                currentHeadingLine = naturalGroup.headingLine
                currentHeadingAttributedText = metadataAttributedText(
                    matching: naturalGroup.headingLine,
                    from: line.attributedText
                )
            } else if line.trimmedText.hasPrefix("## ") {
                try finishCurrentGroup()
                currentHeaderLine = String(line.trimmedText.dropFirst(3)).trimmingCharacters(in: .whitespacesAndNewlines)
                currentHeaderAttributedText = line.attributedContent(afterMarkerPrefixLength: 3)
            } else if let naturalGroup = parseSectionGroupDefinition(from: line.trimmedText, codeSectionName: codeSectionName) {
                try finishCurrentGroup()
                currentHeaderLine = naturalGroup.headerLine
                currentHeaderAttributedText = metadataAttributedText(
                    matching: naturalGroup.headerLine,
                    from: line.attributedText
                )
                currentHeadingLine = naturalGroup.headingLine
                currentHeadingAttributedText = metadataAttributedText(
                    matching: naturalGroup.headingLine,
                    from: line.attributedText
                )
            } else if currentTitleLine != nil {
                currentBodyLines.append(line)
            }
        }

        try finishCurrentGroup()

        guard !groups.isEmpty, groups.contains(where: { !$0.sections.isEmpty }) else {
            throw StructuredTextImportError.noSections
        }

        return StructuredTextDocument(groups: groups)
    }

    private static func parseHierarchy(
        from lines: [ParsedLine],
        defaults: StructuredImportHierarchyDefaults?
    ) throws -> StructuredHierarchyDocument {
        var codeVersions: [StructuredHierarchyDocument.CodeVersion] = []

        var currentCodeVersionName: String? = defaults?.codeVersionName?.trimmingCharacters(in: .whitespacesAndNewlines)
        var currentCodeSections: [StructuredHierarchyDocument.CodeSection] = []

        var currentCodeSectionName: String? = defaults?.codeSectionName?.trimmingCharacters(in: .whitespacesAndNewlines)
        var currentChapters: [StructuredHierarchyDocument.Chapter] = []

        var currentChapterNumber: String?
        var currentChapterTitle: String?
        var currentChapterBodyLines: [ParsedLine] = []
        var currentGroups: [StructuredHierarchyDocument.Group] = []

        var currentGroupHeaderLine: String?
        var currentGroupHeaderAttributedText: NSAttributedString?
        var currentGroupHeadingLine: String?
        var currentGroupHeadingAttributedText: NSAttributedString?
        var currentGroupBodyLines: [ParsedLine] = []
        var currentSections: [StructuredTextDocument.Section] = []

        var currentTitleLine: String?
        var currentTitleAttributedText: NSAttributedString?
        var currentSectionNumber: String?
        var currentBodyLines: [ParsedLine] = []
        var seenSectionNumbers: Set<String> = []

        func finishCurrentSection() throws {
            guard let titleLine = currentTitleLine,
                  let sectionNumber = currentSectionNumber else { return }

            defer {
                currentTitleLine = nil
                currentTitleAttributedText = nil
                currentSectionNumber = nil
                currentBodyLines = []
            }

            let bodyLines = trimBlankLines(currentBodyLines)
            let bodyText = bodyLines.map(\.rawText).joined(separator: "\n")
            let duplicateKey = normalizedDuplicateKey(for: sectionNumber)
            if seenSectionNumbers.contains(duplicateKey) {
                if !bodyText.isEmpty,
                   let existingIndex = currentSections.firstIndex(where: {
                       normalizedDuplicateKey(for: $0.sectionNumber) == duplicateKey && $0.bodyText.isEmpty
                   }) {
                    currentSections.remove(at: existingIndex)
                } else {
                    return
                }
            } else {
                seenSectionNumbers.insert(duplicateKey)
            }

            let attributedBodyText = joinedAttributedLines(bodyLines)
            let attributedFullText = joinedAttributedComponents(
                [
                    currentTitleAttributedText,
                    attributedBodyText?.length ?? 0 > 0 ? attributedBodyText : nil
                ]
            )

            currentSections.append(
                StructuredTextDocument.Section(
                    sectionNumber: sectionNumber,
                    titleLine: titleLine,
                    bodyText: bodyText,
                    attributedFullText: attributedFullText,
                    headerLine: currentGroupHeaderLine,
                    headingLine: currentGroupHeadingLine,
                    isFirstInGroup: currentSections.isEmpty
                )
            )
        }

        func finishCurrentGroup() throws {
            try finishCurrentSection()
            guard let headerLine = currentGroupHeaderLine else { return }
            let bodyLines = trimBlankLines(currentGroupBodyLines)
            let bodyText = bodyLines.map(\.rawText).joined(separator: "\n")

            currentGroups.append(
                StructuredHierarchyDocument.Group(
                    headerLine: headerLine,
                    headingLine: currentGroupHeadingLine,
                    headerAttributedText: currentGroupHeaderAttributedText,
                    headingAttributedText: currentGroupHeadingAttributedText,
                    bodyText: bodyText,
                    bodyAttributedText: joinedAttributedLines(bodyLines),
                    sections: currentSections
                )
            )

            currentGroupHeaderLine = nil
            currentGroupHeaderAttributedText = nil
            currentGroupHeadingLine = nil
            currentGroupHeadingAttributedText = nil
            currentGroupBodyLines = []
            currentSections = []
        }

        func finishCurrentChapter() throws {
            try finishCurrentGroup()
            guard let chapterNumber = currentChapterNumber,
                  let chapterTitle = currentChapterTitle else { return }
            let bodyLines = trimBlankLines(currentChapterBodyLines)
            let bodyText = bodyLines.map(\.rawText).joined(separator: "\n")
            if currentGroups.isEmpty {
                let chapterLabel = chapterNumber.rangeOfCharacter(from: .letters) == nil
                    ? "Chapter \(chapterNumber)"
                    : "Appendix \(chapterNumber)"
                let titleLine = chapterTitle.localizedCaseInsensitiveContains(chapterLabel)
                    ? chapterTitle
                    : "\(chapterLabel): \(chapterTitle)"
                currentGroups.append(
                    StructuredHierarchyDocument.Group(
                        headerLine: chapterLabel,
                        headingLine: nil,
                        headerAttributedText: nil,
                        headingAttributedText: nil,
                        bodyText: "",
                        bodyAttributedText: nil,
                        sections: [
                            StructuredTextDocument.Section(
                                sectionNumber: chapterNumber,
                                titleLine: titleLine,
                                bodyText: bodyText,
                                attributedFullText: joinedAttributedLines(bodyLines),
                                headerLine: chapterLabel,
                                headingLine: nil,
                                isFirstInGroup: true
                            )
                        ]
                    )
                )
            }

            currentChapters.append(
                StructuredHierarchyDocument.Chapter(
                    chapterNumber: chapterNumber,
                    title: chapterTitle,
                    bodyText: bodyText,
                    bodyAttributedText: joinedAttributedLines(bodyLines),
                    groups: currentGroups
                )
            )

            currentChapterNumber = nil
            currentChapterTitle = nil
            currentChapterBodyLines = []
            currentGroups = []
            seenSectionNumbers.removeAll(keepingCapacity: true)
        }

        func finishCurrentCodeSection() throws {
            try finishCurrentChapter()
            guard let codeSectionName = currentCodeSectionName else { return }

            currentCodeSections.append(
                StructuredHierarchyDocument.CodeSection(
                    name: codeSectionName,
                    chapters: currentChapters
                )
            )

            currentCodeSectionName = nil
            currentChapters = []
        }

        func finishCurrentCodeVersion() throws {
            try finishCurrentCodeSection()
            guard let codeVersionName = currentCodeVersionName else { return }

            codeVersions.append(
                StructuredHierarchyDocument.CodeVersion(
                    name: codeVersionName,
                    codeSections: currentCodeSections
                )
            )

            currentCodeVersionName = nil
            currentCodeSections = []
        }

        for line in lines {
            let uppercased = line.trimmedText.uppercased()
            let customTitleLine = customMarkerContent(in: line.trimmedText, marker: "#6") ??
                customMarkerContent(in: line.trimmedText, marker: "#5") ??
                customMarkerContent(in: line.trimmedText, marker: "#4") ??
                customMarkerContent(in: line.trimmedText, marker: "#3") ??
                customMarkerContent(in: line.trimmedText, marker: "#------") ??
                customMarkerContent(in: line.trimmedText, marker: "#-----") ??
                customMarkerContent(in: line.trimmedText, marker: "#----") ??
                customMarkerContent(in: line.trimmedText, marker: "#---")
            let customGroupLine = customMarkerContent(in: line.trimmedText, marker: "#2") ??
                customMarkerContent(in: line.trimmedText, marker: "#--")
            let customChapterLine: String?
            if customTitleLine != nil || customGroupLine != nil {
                customChapterLine = nil
            } else {
                customChapterLine = customMarkerContent(in: line.trimmedText, marker: "#1") ??
                    customMarkerContent(in: line.trimmedText, marker: "#-")
            }

            if uppercased.hasPrefix("# CODE VERSION:") {
                try finishCurrentCodeVersion()
                currentCodeVersionName = String(line.trimmedText.dropFirst("# CODE VERSION:".count)).trimmingCharacters(in: .whitespacesAndNewlines)
            } else if uppercased.hasPrefix("## CODE SECTION:") {
                guard currentCodeVersionName != nil else {
                    throw StructuredTextImportError.codeSectionOutsideCodeVersion(line.trimmedText)
                }
                try finishCurrentCodeSection()
                currentCodeSectionName = String(line.trimmedText.dropFirst("## CODE SECTION:".count)).trimmingCharacters(in: .whitespacesAndNewlines)
            } else if uppercased.hasPrefix("### ") || customChapterLine != nil {
                guard currentCodeSectionName != nil else {
                    throw StructuredTextImportError.chapterOutsideCodeSection(line.trimmedText)
                }
                try finishCurrentChapter()
                let chapterDefinition = if uppercased.hasPrefix("### ") {
                    String(line.trimmedText.dropFirst(4)).trimmingCharacters(in: .whitespacesAndNewlines)
                } else {
                    customChapterLine ?? ""
                }
                guard let chapter = parseChapterDefinition(from: chapterDefinition) else {
                    throw StructuredTextImportError.invalidChapterLine(chapterDefinition)
                }
                currentChapterNumber = chapter.number
                currentChapterTitle = chapter.title
            } else if let customGroupLine,
                      let naturalGroup = parseSectionGroupDefinition(
                from: customGroupLine,
                codeSectionName: currentCodeSectionName
            ) {
                guard currentChapterNumber != nil else {
                    throw StructuredTextImportError.groupOutsideChapter(line.trimmedText)
                }
                try finishCurrentGroup()
                currentGroupHeaderLine = naturalGroup.headerLine
                currentGroupHeaderAttributedText = metadataAttributedText(
                    matching: naturalGroup.headerLine,
                    from: line.attributedText
                )
                currentGroupHeadingLine = naturalGroup.headingLine
                currentGroupHeadingAttributedText = metadataAttributedText(
                    matching: naturalGroup.headingLine,
                    from: line.attributedText
                )
            } else if uppercased.hasPrefix("#### ") {
                guard currentChapterNumber != nil else {
                    throw StructuredTextImportError.groupOutsideChapter(line.trimmedText)
                }
                try finishCurrentGroup()
                currentGroupHeaderLine = String(line.trimmedText.dropFirst(5)).trimmingCharacters(in: .whitespacesAndNewlines)
                currentGroupHeaderAttributedText = line.attributedContent(afterMarker: "#### ")
            } else if uppercased.hasPrefix("##### ") {
                if currentGroupHeaderLine == nil {
                    guard let currentChapterNumber else {
                        throw StructuredTextImportError.headingOutsideGroup(line.trimmedText)
                    }
                    currentGroupHeaderLine = inferredGroupHeader(
                        from: currentChapterNumber ?? "",
                        codeSectionName: currentCodeSectionName
                    )
                    currentGroupHeadingLine = inferredGroupHeading
                }
                try finishCurrentSection()
                currentGroupHeadingLine = String(line.trimmedText.dropFirst(6)).trimmingCharacters(in: .whitespacesAndNewlines)
                currentGroupHeadingAttributedText = line.attributedContent(afterMarker: "##### ")
            } else if customTitleLine != nil || uppercased.hasPrefix("###### ") {
                try finishCurrentSection()
                let titleLine = if let customTitleLine {
                    customTitleLine
                } else {
                    String(line.trimmedText.dropFirst(7)).trimmingCharacters(in: .whitespacesAndNewlines)
                }
                guard let sectionNumber = parseSectionNumber(from: titleLine, currentGroupHeaderLine: currentGroupHeaderLine) else {
                    throw StructuredTextImportError.invalidTitleLine(titleLine)
                }
                if currentGroupHeaderLine == nil {
                    currentGroupHeaderLine = inferredGroupHeader(
                        from: sectionNumber,
                        codeSectionName: currentCodeSectionName
                    )
                    currentGroupHeadingLine = inferredGroupHeading
                }
                currentTitleLine = titleLine
                if customTitleLine != nil {
                    currentTitleAttributedText = attributedContent(
                        for: line,
                        marker: customTitleMarker(in: line.trimmedText)
                    )
                } else {
                    currentTitleAttributedText = uppercased.hasPrefix("###### ")
                        ? line.attributedContent(afterMarker: "###### ")
                        : line.attributedText
                }
                currentSectionNumber = sectionNumber
            } else if currentTitleLine != nil {
                currentBodyLines.append(line)
            } else if currentGroupHeaderLine != nil {
                currentGroupBodyLines.append(line)
            } else if currentChapterNumber != nil {
                currentChapterBodyLines.append(line)
            }
        }

        try finishCurrentCodeVersion()

        guard !codeVersions.isEmpty else {
            throw StructuredTextImportError.noCodeVersions
        }

        return StructuredHierarchyDocument(codeVersions: codeVersions)
    }

    private static func parsedLines(from rawText: String) -> [ParsedLine] {
        let normalizedText = rawText
            .replacingOccurrences(of: "\r\n", with: "\n")
            .replacingOccurrences(of: "\r", with: "\n")

        return normalizedText.components(separatedBy: "\n").map { rawLine in
            ParsedLine(
                rawText: rawLine,
                trimmedText: trimmedParsingText(for: rawLine),
                attributedText: nil,
                attributedFullLineText: nil,
                leadingWhitespaceUTF16Length: rawLine.prefix { $0.isWhitespace }.utf16.count
            )
        }
    }

    private static func parsedLines(from attributedText: NSAttributedString) -> [ParsedLine] {
        let source = attributedText.string as NSString
        var lines: [ParsedLine] = []
        var location = 0

        while location < source.length {
            let fullLineRange = source.lineRange(for: NSRange(location: location, length: 0))
            let contentRange = lineContentRange(for: fullLineRange, in: source)
            let rawLine = source.substring(with: contentRange)
            lines.append(
                ParsedLine(
                    rawText: rawLine,
                    trimmedText: trimmedParsingText(for: rawLine),
                    attributedText: NSAttributedString(attributedString: attributedText.attributedSubstring(from: contentRange)),
                    attributedFullLineText: NSAttributedString(attributedString: attributedText.attributedSubstring(from: fullLineRange)),
                    leadingWhitespaceUTF16Length: rawLine.prefix { $0.isWhitespace }.utf16.count
                )
            )
            location = NSMaxRange(fullLineRange)
        }

        if source.length == 0 {
            return [
                ParsedLine(
                    rawText: "",
                    trimmedText: "",
                    attributedText: NSAttributedString(string: ""),
                    attributedFullLineText: NSAttributedString(string: ""),
                    leadingWhitespaceUTF16Length: 0
                )
            ]
        }

        return lines
    }

    private static func parseSectionNumber(from titleLine: String) -> String? {
        parseSectionNumber(from: titleLine, currentGroupHeaderLine: nil)
    }

    private static func parseSectionNumber(from titleLine: String, currentGroupHeaderLine: String?) -> String? {
        let range = NSRange(location: 0, length: titleLine.utf16.count)
        guard let match = sectionNumberRegex.firstMatch(in: titleLine, range: range),
              let sectionRange = Range(match.range(at: 1), in: titleLine) else {
            return nil
        }
        let sectionNumber = String(titleLine[sectionRange])
        if requiresAppendixQPrefixedTitle(currentGroupHeaderLine: currentGroupHeaderLine),
           sectionNumber.first?.uppercased() != "Q" {
            return nil
        }
        return sectionNumber
    }

    private static func inferredGroupHeader(from sectionNumber: String, codeSectionName: String?) -> String {
        let trimmed = sectionNumber.trimmingCharacters(in: .whitespacesAndNewlines)
        let majorComponent = trimmed.split(separator: ".").first.map(String.init) ?? trimmed
        return CodeSectionGroupHeaderFormatting.formattedSectionHeader(
            explicitPrefix: nil,
            sectionID: majorComponent,
            codeSectionName: codeSectionName
        )
    }

    private static func requiresAppendixQPrefixedTitle(currentGroupHeaderLine: String?) -> Bool {
        guard let currentGroupHeaderLine else { return false }
        return currentGroupHeaderLine
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .uppercased()
            .hasPrefix("SECTION BC Q")
    }

    private static func customMarkerContent(in line: String, marker: String) -> String? {
        guard line.hasPrefix(marker) else { return nil }
        let remainder = line.dropFirst(marker.count).trimmingCharacters(in: .whitespacesAndNewlines)
        guard !remainder.isEmpty else { return nil }
        return remainder
    }

    private static func customTitleMarker(in line: String) -> String {
        if line.hasPrefix("#7") {
            return "#7"
        }
        if line.hasPrefix("#6") {
            return "#6"
        }
        if line.hasPrefix("#-------") {
            return "#-------"
        }
        if line.hasPrefix("#5") {
            return "#5"
        }
        if line.hasPrefix("#4") {
            return "#4"
        }
        if line.hasPrefix("#3") {
            return "#3"
        }
        if line.hasPrefix("#------") {
            return "#------"
        }
        if line.hasPrefix("#-----") {
            return "#-----"
        }
        if line.hasPrefix("#----") {
            return "#----"
        }
        return "#---"
    }

    private static func attributedContent(for line: ParsedLine, marker: String) -> NSAttributedString? {
        line.attributedContent(afterMarker: marker)
    }

    private static func metadataAttributedText(matching expectedText: String?, from attributedText: NSAttributedString?) -> NSAttributedString? {
        guard let attributedText,
              let expectedText else { return nil }

        let normalizedExpected = expectedText.trimmingCharacters(in: .whitespacesAndNewlines)
        let normalizedActual = attributedText.string.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalizedExpected.isEmpty,
              normalizedActual.compare(normalizedExpected, options: [.caseInsensitive, .diacriticInsensitive]) == .orderedSame else {
            return nil
        }

        return attributedText
    }

    private static func parseChapterDefinition(from line: String) -> (number: String, title: String)? {
        let range = NSRange(location: 0, length: line.utf16.count)
        guard let match = chapterDefinitionRegex.firstMatch(in: line, range: range),
              let numberRange = Range(match.range(at: 2), in: line),
              let titleRange = Range(match.range(at: 3), in: line) else {
            return nil
        }

        let number = String(line[numberRange]).trimmingCharacters(in: .whitespacesAndNewlines)
        let title = String(line[titleRange]).trimmingCharacters(in: .whitespacesAndNewlines)
        guard !number.isEmpty, !title.isEmpty else { return nil }
        return (number, title)
    }

    private static func parseSectionGroupDefinition(
        from line: String,
        codeSectionName: String? = nil
    ) -> (headerLine: String, headingLine: String?)? {
        let range = NSRange(location: 0, length: line.utf16.count)
        guard let match = sectionGroupDefinitionRegex.firstMatch(in: line, range: range),
              let idRange = Range(match.range(at: 2), in: line) else {
            return nil
        }

        let explicitPrefix: String?
        if match.range(at: 1).location != NSNotFound, let prefixRange = Range(match.range(at: 1), in: line) {
            explicitPrefix = String(line[prefixRange])
        } else {
            explicitPrefix = nil
        }

        let sectionID = String(line[idRange])
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !sectionID.isEmpty else { return nil }

        let headingLine: String?
        if match.range(at: 3).location != NSNotFound, let trailingRange = Range(match.range(at: 3), in: line) {
            let trailing = String(line[trailingRange]).trimmingCharacters(in: .whitespacesAndNewlines)
            headingLine = trailing.isEmpty ? nil : trailing.uppercased()
        } else {
            headingLine = nil
        }

        let headerLine = CodeSectionGroupHeaderFormatting.formattedSectionHeader(
            explicitPrefix: explicitPrefix,
            sectionID: sectionID,
            codeSectionName: codeSectionName
        )
        return (headerLine: headerLine, headingLine: headingLine)
    }

    private static func trimBlankLines(_ lines: [ParsedLine]) -> [ParsedLine] {
        guard let firstIndex = lines.firstIndex(where: { !$0.isBlank }),
              let lastIndex = lines.lastIndex(where: { !$0.isBlank }) else {
            return []
        }
        return Array(lines[firstIndex...lastIndex])
    }

    private static func lineContentRange(for fullLineRange: NSRange, in text: NSString) -> NSRange {
        var length = fullLineRange.length
        while length > 0 {
            let character = text.substring(with: NSRange(location: fullLineRange.location + length - 1, length: 1))
            if character == "\n" || character == "\r" {
                length -= 1
            } else {
                break
            }
        }
        return NSRange(location: fullLineRange.location, length: length)
    }

    private static func joinedAttributedLines(_ lines: [ParsedLine]) -> NSAttributedString? {
        guard !lines.isEmpty else { return nil }

        if lines.allSatisfy({ $0.attributedFullLineText != nil }) {
            let mutable = NSMutableAttributedString()
            for line in lines {
                if let attributedFullLineText = line.attributedFullLineText {
                    mutable.append(attributedFullLineText)
                }
            }
            return mutable.length > 0 || lines.contains(where: \.isBlank) ? mutable : nil
        }

        let mutable = NSMutableAttributedString()
        var lastKnownAttributes: [NSAttributedString.Key: Any] = [:]

        for (index, line) in lines.enumerated() {
            if index > 0 {
                mutable.append(NSAttributedString(string: "\n", attributes: lastKnownAttributes))
            }

            if let attributedText = line.attributedText, attributedText.length > 0 {
                lastKnownAttributes = attributedText.attributes(
                    at: max(attributedText.length - 1, 0),
                    effectiveRange: nil
                )
                mutable.append(attributedText)
            }
        }

        return mutable.length > 0 || lines.contains(where: \.isBlank) ? mutable : nil
    }

    private static func joinedAttributedComponents(_ components: [NSAttributedString?]) -> NSAttributedString? {
        let nonEmptyComponents = components.compactMap { component -> NSAttributedString? in
            guard let component, component.length > 0 else { return nil }
            return component
        }

        guard let first = nonEmptyComponents.first else { return nil }

        let mutable = NSMutableAttributedString(attributedString: first)
        for component in nonEmptyComponents.dropFirst() {
            let newlineAttributes = mutable.length > 0
                ? mutable.attributes(at: max(mutable.length - 1, 0), effectiveRange: nil)
                : component.attributes(at: 0, effectiveRange: nil)
            mutable.append(NSAttributedString(string: "\n", attributes: newlineAttributes))
            mutable.append(component)
        }
        return mutable
    }

    private static func trimmedParsingText(for rawLine: String) -> String {
        let sanitizedScalars = rawLine.unicodeScalars.filter { !ignorableParsingCharacters.contains($0) }
        return String(String.UnicodeScalarView(sanitizedScalars))
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func normalizedDuplicateKey(for sectionNumber: String) -> String {
        sectionNumber
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .uppercased()
    }
}
