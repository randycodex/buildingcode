import Foundation

// MARK: - Research

struct ResearchConversationListRequest: Codable, Hashable, Sendable {
    let auth: BackendAuthContext
}

struct ResearchConversationGetRequest: Codable, Hashable, Sendable {
    let auth: BackendAuthContext
    let conversationID: String
}

struct ResearchSelectionRequest: Codable, Hashable, Sendable {
    let sectionID: String
    let selectedText: String
    var savedItemID: String? = nil
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
    let createdAt: String
}

struct ResearchAnswer: Codable, Hashable, Sendable {
    var conclusion: String = ""
    var explanation: String = ""
    var supportedPoints: [ResearchSupportedPoint] = []
    var assumptions: [String] = []
    var missingFacts: [String] = []
    var evidenceLimitations: [String] = []
    var followUpQuestions: [String] = []
    var additionalEvidenceNeeded: [String] = []
    var citations: [ResearchCitation] = []
    var disclaimer: String? = nil
}

struct ResearchSupportedPoint: Codable, Hashable, Sendable {
    var heading: String = ""
    var evidenceRole: String? = nil
}

struct ResearchCitation: Codable, Hashable, Identifiable, Sendable {
    var sourceID: String? = nil
    var codePrefix: String? = nil
    var sectionNumber: String? = nil
    var title: String? = nil
    var evidenceRole: String? = nil

    var id: String {
        sourceID ?? [codePrefix, sectionNumber, title].compactMap { $0 }.joined(separator: ":")
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
