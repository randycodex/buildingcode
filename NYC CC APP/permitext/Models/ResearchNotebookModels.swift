import Foundation

// MARK: - Research

struct ResearchConversationListRequest: Codable, Hashable, Sendable {
    let auth: BackendAuthContext
}

struct ResearchConversationGetRequest: Codable, Hashable, Sendable {
    let auth: BackendAuthContext
    let conversationID: String
}

struct ResearchConversationRefreshRequest: Codable, Hashable, Sendable {
    let auth: BackendAuthContext
    let conversationID: String
}

struct ResearchProjectContextReviewRequest: Codable, Hashable, Sendable {
    let auth: BackendAuthContext
    let conversationID: String
    let projectID: String
    let facts: [String]
}

struct ResearchSelectionRequest: Codable, Hashable, Sendable {
    let sectionID: String
    let selectedText: String
    var savedItemID: String? = nil
    var richSourceIDs: [String]? = nil
    var visualSourceIDs: [String]? = nil
    var visualReviewConfirmed: Bool? = nil
}

struct ResearchSelectionReviewRequest: Codable, Hashable, Sendable {
    let auth: BackendAuthContext
    let sectionID: String
    let selectedText: String
}

struct ResearchVisualSource: Codable, Hashable, Identifiable, Sendable {
    let id: String
    let kind: String
    let assetName: String
    let assetURL: String
    let mediaType: String
    let contentHash: String
    let byteLength: Int
    var displayWidth: Double? = nil
    var displayHeight: Double? = nil

    var resolvedAssetURL: URL? {
        if let absolute = URL(string: assetURL), absolute.scheme != nil {
            return absolute
        }
        let configuration = PermitextBackendConfiguration.load()
        guard let baseURLString = configuration.apiBaseURLString,
              let baseURL = URL(string: baseURLString)
        else { return nil }
        return URL(string: assetURL, relativeTo: baseURL)?.absoluteURL
    }
}

struct ResearchSelectionReviewResponse: Codable, Hashable, Sendable {
    let selection: ResearchSelectionRequest
    let requiresVisualReview: Bool
    let maximumVisualSelections: Int
    let visualSources: [ResearchVisualSource]
}

struct ResearchConversationCreateRequest: Codable, Hashable, Sendable {
    let auth: BackendAuthContext
    let projectID: String?
    let selections: [ResearchSelectionRequest]?
    let originSurface: String
}

struct ResearchConversationEvidenceRequest: Codable, Hashable, Sendable {
    let auth: BackendAuthContext
    let conversationID: String
    let selections: [ResearchSelectionRequest]
    let originSurface: String
}

struct ResearchConversationMessageRequest: Codable, Hashable, Sendable {
    let auth: BackendAuthContext
    let conversationID: String
    let question: String
    let requestID: String
}

struct ResearchFeedbackRequest: Codable, Hashable, Sendable {
    let auth: BackendAuthContext
    let conversationID: String
    let answerID: String
    let category: String
    var comment: String? = nil
    var professionalRole: String? = nil
    var supportingReference: String? = nil
}

struct ResearchFeedbackResponse: Codable, Hashable, Sendable {
    let feedback: ResearchFeedback
}

struct ResearchConversationRenameRequest: Codable, Hashable, Sendable {
    let auth: BackendAuthContext
    let conversationID: String
    let title: String
}

struct ResearchConversationDeleteRequest: Codable, Hashable, Sendable {
    let auth: BackendAuthContext
    let conversationID: String
}

struct ResearchConversationAssignProjectRequest: Codable, Hashable, Sendable {
    let auth: BackendAuthContext
    let conversationID: String
    let projectID: String?
    let confirmMove: Bool
}

struct ResearchConversationListResponse: Codable, Hashable, Sendable {
    let conversations: [ResearchConversationSummary]
}

struct ResearchConversationResponse: Codable, Hashable, Sendable {
    let conversation: ResearchConversation
}

struct ResearchConversationEvidenceResponse: Codable, Hashable, Sendable {
    let conversation: ResearchConversation
    var replayed: Bool? = nil
    var addedSelectionCount: Int? = nil
}

struct ResearchConversationMessageResponse: Codable, Hashable, Sendable {
    let conversation: ResearchConversation
    var replayed: Bool? = nil
    var requestID: String? = nil
}

struct ResearchConversationDeleteResponse: Codable, Hashable, Sendable {
    let deleted: Bool
}

struct ResearchConversationSummary: Codable, Hashable, Identifiable, Sendable {
    let id: String
    let title: String
    let createdAt: String
    let updatedAt: String
    var historyHiddenAt: String? = nil
    var sourceCount: Int = 0
    var sourceSectionIDs: [String] = []
    var messageCount: Int = 0
    var primaryProjectID: String? = nil
    var starterQuestion: String? = nil
    var projectContextReviewRequired: Bool = false
    var sourceStatus: String = "current"
}

struct ResearchConversation: Codable, Hashable, Identifiable, Sendable {
    let id: String
    var title: String
    let createdAt: String
    var updatedAt: String
    var primaryProjectID: String? = nil
    var projectContext: ResearchProjectContext? = nil
    var projectInformation: ResearchProjectInformation? = nil
    var projectContextReviewRequired: Bool = false
    var sourceStatus: String = "current"
    var sources: [ResearchSource] = []
    var messages: [ResearchMessage] = []

    var summary: ResearchConversationSummary {
        ResearchConversationSummary(
            id: id,
            title: title,
            createdAt: createdAt,
            updatedAt: updatedAt,
            sourceCount: sources.filter { $0.kind == "selection" }.count,
            sourceSectionIDs: Array(Set(sources.compactMap(\.sectionID))).sorted(),
            messageCount: messages.count,
            primaryProjectID: primaryProjectID,
            starterQuestion: messages.first(where: { $0.role == "user" })?.question,
            projectContextReviewRequired: projectContextReviewRequired,
            sourceStatus: sourceStatus
        )
    }
}

struct ResearchProjectContext: Codable, Hashable, Sendable {
    var projectID: String? = nil
    var facts: [String]? = nil
    var source: String? = nil
    var updatedAt: String? = nil
}

/// The current saved Project information returned alongside a Research
/// conversation. These facts are assembled by the server and are the same
/// Project context made available to the Research pipeline.
struct ResearchProjectInformation: Codable, Hashable, Sendable {
    var address: String? = nil
    var description: String? = nil
    var facts: [String]? = nil
}

struct ResearchSource: Codable, Hashable, Identifiable, Sendable {
    let id: String
    let kind: String
    var relationship: String? = nil
    var sectionID: String? = nil
    var sectionNumber: String? = nil
    var title: String? = nil
    var codePrefix: String? = nil
    var selectedText: String? = nil
}

struct ResearchMessage: Codable, Hashable, Identifiable, Sendable {
    let id: String
    let role: String
    var question: String? = nil
    var answer: ResearchAnswer? = nil
    var requestID: String? = nil
    var feedback: ResearchFeedback? = nil
    let createdAt: String
}

struct ResearchFeedback: Codable, Hashable, Sendable {
    let id: String
    var status: String? = nil
    let category: String
    var userComment: String? = nil
    var professionalRole: String? = nil
    var supportingReference: String? = nil
    var updatedAt: String? = nil

    var displayStatus: String {
        switch status {
        case "under_review", "triaged": return "Under review"
        case "resolved": return "Resolved"
        case "closed": return "Closed"
        default: return "Received"
        }
    }
}

struct ResearchAnswer: Codable, Hashable, Sendable {
    var mode: String? = nil
    var answerText: String? = nil
    var conclusion: String = ""
    var explanation: String = ""
    var authorityStatus: String? = nil
    var authorityLabel: String? = nil
    var codeEdition: String? = nil
    var codeBasis: ResearchCodeBasis? = nil
    var sourceAsOf: String? = nil
    var sourceSummary: ResearchSourceSummary? = nil
    var factUsage: ResearchFactUsage? = nil
    var supportedPoints: [ResearchSupportedPoint] = []
    var assumptions: [String] = []
    var missingFacts: [String] = []
    var evidenceLimitations: [String] = []
    var followUpQuestions: [String] = []
    var additionalEvidenceNeeded: [String] = []
    var supportingSources: [ResearchSupportingSource]? = nil
    var citations: [ResearchCitation] = []
    var disclaimer: String? = nil
}

struct ResearchCodeBasis: Codable, Hashable, Sendable {
    var disclosure: String? = nil
    var limitation: String? = nil
    var searchedCorpora: [ResearchCorpusBasis]? = nil
    var pinnedCorpora: [ResearchCorpusBasis]? = nil
}

struct ResearchCorpusBasis: Codable, Hashable, Sendable {
    var id: String? = nil
    var label: String? = nil
    var codeEdition: String? = nil
    var codeVersion: String? = nil
    var codeYear: Int? = nil
    var applicabilityStatus: String? = nil
    var routeReason: String? = nil
    var blockedReason: String? = nil
    var codePrefixes: [String]? = nil
}

struct ResearchSourceSummary: Codable, Hashable, Sendable {
    var projectFactCount: Int? = nil
    var sourcedProjectFactCount: Int? = nil
    var enactedProvisionCount: Int? = nil
    var contextualProvisionCount: Int? = nil
    var citedProvisionCount: Int? = nil
    var governingCitationCount: Int? = nil
    var supportingCitationCount: Int? = nil
    var contextualCitationCount: Int? = nil
    var reviewedOnlyProvisionCount: Int? = nil
    var userPinnedCount: Int? = nil
    var permitextDiscoveredCount: Int? = nil
    var crossReferenceCount: Int? = nil
    var supportingWebSourceCount: Int? = nil
    var unresolvedProjectFactCount: Int? = nil
}

struct ResearchFactUsage: Codable, Hashable, Sendable {
    var projectContext: [String]? = nil
    var conversation: [String]? = nil
    var other: [String]? = nil
}

struct ResearchSupportingSource: Codable, Hashable, Sendable {
    var id: String? = nil
    var title: String? = nil
    var publisher: String? = nil
    var url: String? = nil
    var authorityClass: String? = nil
    var role: String? = nil
    var claim: String? = nil

    var displayTitle: String {
        [title, publisher]
            .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .first(where: { !$0.isEmpty }) ?? "Supporting source"
    }

    var webURL: URL? {
        guard
            let value = url?.trimmingCharacters(in: .whitespacesAndNewlines),
            !value.isEmpty,
            let resolved = URL(string: value),
            resolved.scheme?.lowercased() == "https",
            resolved.host != nil
        else {
            return nil
        }
        return resolved
    }
}

extension ResearchAnswer {
    var researchAuthorityLabel: String? {
        if let supplied = authorityLabel?.trimmingCharacters(in: .whitespacesAndNewlines), !supplied.isEmpty {
            return supplied
        }
        switch authorityStatus {
        case "supported_by_enacted_text": return "Supported by enacted text"
        case "official_supporting_guidance": return "Official supporting guidance — noncontrolling"
        case "conditional": return "Conditional on Project facts"
        case "insufficient_evidence": return "Insufficient enacted evidence"
        case "project_context": return "Project facts only — not code authority"
        default: return nil
        }
    }

    func researchMetadataText(sourceStatus: String) -> String {
        var parts: [String] = []
        if let edition = codeEdition?.trimmingCharacters(in: .whitespacesAndNewlines), !edition.isEmpty {
            parts.append("Edition: \(edition)")
        }
        let normalizedStatus = sourceStatus.trimmingCharacters(in: .whitespacesAndNewlines)
        if !normalizedStatus.isEmpty {
            parts.append("Source status: \(normalizedStatus == "changed" ? "Changed — review before relying" : "Current when researched")")
        }
        if let date = researchSourceDateLabel {
            parts.append("Sources checked: \(date)")
        }
        return parts.joined(separator: " · ")
    }

    func structuredCopyText(sourceStatus: String) -> String {
        var sections: [String] = ["Permitext Research"]
        if let label = researchAuthorityLabel { sections.append(label) }

        let narrative = (answerText?.trimmingCharacters(in: .whitespacesAndNewlines)).flatMap { $0.isEmpty ? nil : $0 }
            ?? [conclusion, explanation].filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }.joined(separator: "\n\n")
        if !narrative.isEmpty { sections.append(narrative) }

        let metadata = researchMetadataText(sourceStatus: sourceStatus)
        if !metadata.isEmpty { sections.append(metadata) }
        if let disclosure = codeBasis?.disclosure, !disclosure.isEmpty { sections.append("Code basis\n\(disclosure)") }
        if let limitation = codeBasis?.limitation, !limitation.isEmpty { sections.append("Code-basis limitation\n\(limitation)") }
        if !researchCorpusMetadataLines.isEmpty {
            sections.append("Corpus basis\n" + researchCorpusMetadataLines.map { "• \($0)" }.joined(separator: "\n"))
        }

        func appendList(_ title: String, _ items: [String]) {
            let cleaned = items.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
            if !cleaned.isEmpty { sections.append(title + "\n" + cleaned.map { "• \($0)" }.joined(separator: "\n")) }
        }
        appendList("Assumptions", assumptions)
        appendList("Missing Project facts", missingFacts)
        appendList("Limitations", evidenceLimitations)
        appendList("Follow-up questions", followUpQuestions)
        appendList("Additional evidence needed", additionalEvidenceNeeded)

        if !citations.isEmpty {
            let lines = citations.map { citation in
                var identity = [citation.corpusLabel, citation.codePrefix, citation.sectionNumber, citation.title]
                    .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
                    .filter { !$0.isEmpty }
                    .joined(separator: " · ")
                let detail = [citation.codeEdition, citation.applicabilityStatus, citation.relevance]
                    .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
                    .filter { !$0.isEmpty }
                    .joined(separator: " · ")
                if !detail.isEmpty { identity += " — \(detail)" }
                return "• \(identity)"
            }
            sections.append("Citations\n" + lines.joined(separator: "\n"))
        }

        let warning = disclaimer?.trimmingCharacters(in: .whitespacesAndNewlines)
        sections.append((warning?.isEmpty == false ? warning! + "\n" : "") + "Permitext is AI-assisted research, not an official interpretation. Verify the cited sources before filing, design, permitting, or construction reliance.")
        return sections.joined(separator: "\n\n")
    }

    var researchSourceDateLabel: String? {
        guard
            let value = sourceAsOf?.trimmingCharacters(in: .whitespacesAndNewlines),
            !value.isEmpty
        else {
            return nil
        }

        let parsingOptions: [ISO8601DateFormatter.Options] = [
            [.withInternetDateTime, .withFractionalSeconds],
            [.withInternetDateTime],
            [.withFullDate]
        ]
        let parsedDate = parsingOptions.lazy.compactMap { options -> Date? in
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = options
            formatter.timeZone = TimeZone(secondsFromGMT: 0)
            return formatter.date(from: value)
        }.first
        guard let parsedDate else { return nil }

        let displayFormatter = DateFormatter()
        displayFormatter.calendar = Calendar(identifier: .gregorian)
        displayFormatter.locale = Locale(identifier: "en_US_POSIX")
        displayFormatter.timeZone = TimeZone(secondsFromGMT: 0)
        displayFormatter.dateFormat = "yyyy-MM-dd"
        return displayFormatter.string(from: parsedDate)
    }

    var researchCorpusMetadataLines: [String] {
        let entries = (codeBasis?.searchedCorpora ?? []).map { ("Searched", $0) }
            + (codeBasis?.pinnedCorpora ?? []).map { ("Explicit evidence", $0) }
        return entries.map { kind, corpus in
            let identity = [corpus.label, corpus.id]
                .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
                .first(where: { !$0.isEmpty }) ?? "Research corpus"
            let edition = corpus.codeEdition?.trimmingCharacters(in: .whitespacesAndNewlines)
            let editionLabel = if let edition, !edition.isEmpty {
                "Edition: \(edition)"
            } else {
                "Edition not provided"
            }
            return [
                kind,
                identity,
                editionLabel,
                "Applicability: \(researchApplicabilityStatusLabel(corpus.applicabilityStatus))"
            ].joined(separator: " · ")
        }
    }

    private func researchApplicabilityStatusLabel(_ value: String?) -> String {
        let status = value?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() ?? ""
        switch status {
        case "current-enacted-edition": return "Current enacted edition"
        case "historical": return "Historical"
        case "future-effective": return "Future effective"
        case "": return "Applicability status not provided"
        default:
            return status
                .replacingOccurrences(of: "-", with: " ")
                .replacingOccurrences(of: "_", with: " ")
                .split(separator: " ")
                .map { $0.prefix(1).uppercased() + $0.dropFirst() }
                .joined(separator: " ")
        }
    }

    var researchSourceBoundaryText: String {
        let summary = sourceSummary
        let cited = summary?.citedProvisionCount ?? 0
        let reviewed = summary?.reviewedOnlyProvisionCount ?? 0
        let supporting = summary?.supportingCitationCount ?? 0
        let contextual = summary?.contextualProvisionCount ?? 0
        let unresolved = summary?.unresolvedProjectFactCount ?? missingFacts.count
        let limits = evidenceLimitations.count
        var parts: [String] = []

        if authorityStatus == "official_supporting_guidance" {
            let fallbackOfficialSourceKeys = Set(
                (supportingSources ?? []).compactMap { source -> String? in
                    let sourceID = source.id?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                    if !sourceID.isEmpty {
                        return sourceID
                    }
                    let sourceURL = source.url?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                    return sourceURL.isEmpty ? nil : sourceURL
                }
            )
            let officialSources = fallbackOfficialSourceKeys.isEmpty
                ? summary?.supportingWebSourceCount ?? 0
                : fallbackOfficialSourceKeys.count
            if officialSources > 0 {
                parts.append("Based on \(officialSources) approved official supporting \(officialSources == 1 ? "source" : "sources")")
            } else {
                parts.append("Based on approved official supporting guidance")
            }
            parts.append("No enacted provision cited")
        } else if mode == "project_context", let projectFacts = summary?.projectFactCount, projectFacts > 0 {
            parts.append("Based on \(projectFacts) saved Project \(projectFacts == 1 ? "fact" : "facts")")
        } else if cited > 0 {
            parts.append("Cited \(cited) enacted \(cited == 1 ? "provision" : "provisions")")
            if supporting > 0 {
                parts.append("\(supporting) supporting \(supporting == 1 ? "citation" : "citations")")
            }
            if reviewed > 0 {
                parts.append("\(reviewed) additional \(reviewed == 1 ? "provision" : "provisions") reviewed")
            }
        } else if let enacted = summary?.enactedProvisionCount, enacted > 0 {
            parts.append("Based on \(enacted) enacted \(enacted == 1 ? "provision" : "provisions")")
            if let pinned = summary?.userPinnedCount, pinned > 0 {
                parts.append("\(pinned) pinned by you")
            }
            if let discovered = summary?.permitextDiscoveredCount, discovered > 0 {
                parts.append("\(discovered) identified by Permitext")
            }
            if let crossReferences = summary?.crossReferenceCount, crossReferences > 0 {
                parts.append("\(crossReferences) cross-references reviewed")
            }
        } else {
            parts.append("Grounded in the cited Research sources")
        }

        if contextual > 0, cited == 0, authorityStatus != "official_supporting_guidance" {
            parts.append("\(contextual) contextual \(contextual == 1 ? "provision" : "provisions") reviewed separately")
        }
        parts.append(unresolved == 0
            ? "No unresolved project facts identified"
            : "\(unresolved) project \(unresolved == 1 ? "fact remains" : "facts remain") unresolved")
        parts.append(limits == 0
            ? "No additional evidence limits identified"
            : "\(limits) evidence \(limits == 1 ? "limit" : "limits")")
        return parts.joined(separator: " · ")
    }
}

struct ResearchSupportedPoint: Codable, Hashable, Sendable {
    var heading: String = ""
    var explanation: String? = nil
    var sectionID: String? = nil
    var sourceIDs: [String]? = nil
    var evidenceRole: String? = nil
}

struct ResearchCitation: Codable, Hashable, Identifiable, Sendable {
    var sourceID: String? = nil
    var sectionID: String? = nil
    var sourceIDs: [String]? = nil
    var codePrefix: String? = nil
    var sectionNumber: String? = nil
    var title: String? = nil
    var evidenceRole: String? = nil
    var relevance: String? = nil
    var codeVersion: String? = nil
    var codeEdition: String? = nil
    var corpusID: String? = nil
    var corpusLabel: String? = nil
    var applicabilityStatus: String? = nil

    var id: String {
        let boundIdentity = [sectionID, sourceIDs?.sorted().joined(separator: ",")]
            .compactMap { $0 }
            .filter { !$0.isEmpty }
            .joined(separator: ":")
        if !boundIdentity.isEmpty { return boundIdentity }
        return sourceID ?? [codePrefix, sectionNumber, title].compactMap { $0 }.joined(separator: ":")
    }
}

// MARK: - Notebook

struct NotebookAccess: Codable, Hashable, Sendable {
    let role: String
    let readOnly: Bool
}

struct NotebookCardListRequest: Codable, Hashable, Sendable {
    let auth: BackendAuthContext
    let projectID: String
}

struct NotebookCardGetRequest: Codable, Hashable, Sendable {
    let auth: BackendAuthContext
    let projectID: String
    let cardID: String
}

struct NotebookCardSaveRequest: Codable, Hashable, Sendable {
    let auth: BackendAuthContext
    let projectID: String
    let cardID: String?
    let expectedVersion: Int
    let cardType: String
    let title: String
    let document: NotebookDocument
    var evidenceLinks: [NotebookEvidenceLink] = []
    var clientMutationID: String? = nil
}

struct NotebookCardDeleteRequest: Codable, Hashable, Sendable {
    let auth: BackendAuthContext
    let projectID: String
    let cardID: String
    let expectedVersion: Int
}

struct NotebookCardListResponse: Codable, Hashable, Sendable {
    let schemaVersion: Int
    let projectID: String
    let cards: [ProjectNotebookCardSummary]
    var access: NotebookAccess? = nil
}

struct NotebookCardResponse: Codable, Hashable, Sendable {
    let card: NotebookCard
}

struct NotebookCardDeleteResponse: Codable, Hashable, Sendable {
    let cardID: String
    let deletedAt: String
}

struct NotebookAssetUploadRequest: Codable, Hashable, Sendable {
    let auth: BackendAuthContext
    let projectID: String
    let assetID: String
    let contentType: String
    let width: Int?
    let height: Int?
}

struct NotebookAssetReadRequest: Codable, Hashable, Sendable {
    let auth: BackendAuthContext
    let projectID: String
    let assetID: String
}

struct NotebookAssetUploadResponse: Codable, Hashable, Sendable {
    let asset: NotebookImageAsset
}

struct NotebookImageAsset: Codable, Hashable, Sendable {
    let projectID: String
    let assetID: String
    let url: String
    let storageProvider: String
    let contentType: String
    let size: Int
    let width: Int?
    let height: Int?
    let uploadedAt: String
}

struct NotebookCard: Codable, Hashable, Identifiable, Sendable {
    let id: String
    var version: Int
    let createdAt: String
    var updatedAt: String
    var archivedAt: String? = nil
    var deletedAt: String? = nil
    var projectIDs: [String] = []
    var schemaVersion: Int = 2
    var cardType: String = "finding"
    var title: String
    var document: NotebookDocument
    var evidenceLinks: [NotebookEvidenceLink] = []
    var plainText: String = ""
}

struct NotebookDocument: Codable, Hashable, Sendable {
    var schema: String = "permitext-notebook-card"
    var schemaVersion: Int = 2
    var format: String = "blocknote-json"
    var document: [NotebookBlock]

    static var empty: NotebookDocument {
        NotebookDocument(document: [NotebookBlock.paragraph()])
    }
}

struct NotebookBlock: Codable, Hashable, Identifiable, Sendable {
    var id: String
    var type: String
    var props: NotebookBlockProps
    var content: [NotebookInlineContent]?
    var children: [NotebookBlock]

    static func paragraph(_ text: String = "") -> NotebookBlock {
        NotebookBlock(
            id: UUID().uuidString,
            type: "paragraph",
            props: .text,
            content: text.isEmpty ? [] : [.text(text)],
            children: []
        )
    }

    static func textBlock(type: String, text: String = "", level: Int? = nil) -> NotebookBlock {
        var props = NotebookBlockProps.text
        props.level = level
        return NotebookBlock(
            id: UUID().uuidString,
            type: type,
            props: props,
            content: text.isEmpty ? [] : [.text(text)],
            children: []
        )
    }

    static func reference(kind: String, id: String, label: String) -> NotebookBlock {
        NotebookBlock(
            id: UUID().uuidString,
            type: "paragraph",
            props: .text,
            content: [
                NotebookInlineContent(
                    type: "permitextReference",
                    props: NotebookReferenceProps(
                        referenceKind: kind,
                        referenceID: id,
                        label: label
                    )
                )
            ],
            children: []
        )
    }

    static func image(url: String, name: String, caption: String = "", width: Int? = nil) -> NotebookBlock {
        var props = NotebookBlockProps.text
        props.url = url
        props.name = name
        props.caption = caption
        props.showPreview = true
        props.previewWidth = width
        return NotebookBlock(
            id: UUID().uuidString,
            type: "image",
            props: props,
            content: nil,
            children: []
        )
    }
}

struct NotebookBlockProps: Codable, Hashable, Sendable {
    var backgroundColor: String? = "default"
    var textColor: String? = "default"
    var textAlignment: String? = "left"
    var level: Int? = nil
    var start: Int? = nil
    var isToggleable: Bool? = nil
    var url: String? = nil
    var name: String? = nil
    var caption: String? = nil
    var showPreview: Bool? = nil
    var previewWidth: Int? = nil

    static var text: NotebookBlockProps { NotebookBlockProps() }
}

struct NotebookInlineContent: Codable, Hashable, Sendable {
    var type: String
    var text: String? = nil
    var styles: NotebookTextStyles? = nil
    var href: String? = nil
    var content: [NotebookInlineContent]? = nil
    var props: NotebookReferenceProps? = nil

    static func text(_ value: String, bold: Bool = false, italic: Bool = false) -> NotebookInlineContent {
        NotebookInlineContent(
            type: "text",
            text: value,
            styles: NotebookTextStyles(bold: bold ? true : nil, italic: italic ? true : nil)
        )
    }
}

struct NotebookTextStyles: Codable, Hashable, Sendable {
    var bold: Bool? = nil
    var italic: Bool? = nil
}

struct NotebookReferenceProps: Codable, Hashable, Sendable {
    let referenceKind: String
    let referenceID: String
    let label: String
}

struct NotebookEvidenceLink: Codable, Hashable, Identifiable, Sendable {
    let id: String
    let label: String
    let relationshipRole: String
    let projectID: String
    let notebookCardID: String
    let source: NotebookEvidenceSource
    let passages: [NotebookEvidencePassage]
    let createdAt: String
    let noteTarget: NotebookEvidenceNoteTarget
}

struct NotebookEvidenceSource: Codable, Hashable, Sendable {
    let jurisdiction: String
    let codePrefix: String
    let codeEdition: String
    let codeVersion: String
    let sourceID: String
    let sectionID: String
    let sectionNumber: String
    let sectionTitle: String
    let sourceLibraryVersion: String
}

struct NotebookEvidencePassage: Codable, Hashable, Sendable {
    let exact: String
    let prefix: String
    let suffix: String
    let start: Int?
    let end: Int?
}

struct NotebookEvidenceNoteTarget: Codable, Hashable, Sendable {
    let scope: String
    let blockID: String
    let exact: String
}
