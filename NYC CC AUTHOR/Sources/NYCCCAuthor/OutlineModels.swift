import Foundation

struct OutlineItem: Identifiable, Hashable, Sendable {
    enum Kind: String, Hashable, Sendable {
        case file
        case chapter
        case section
        case title
        case table
    }

    let id: String
    let documentID: UUID
    let kind: Kind
    let level: Int
    let sortOrder: Int
    let title: String
    let marker: String?
    let rawHTML: String?
    var children: [OutlineItem]
}
