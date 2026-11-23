import Foundation
import JavaScriptCore
import libxml2

struct ProjectCalculatorRow: Decodable, Identifiable {
    enum Method: String, Decodable { case area, fixed, special }

    let id: String
    let label: String
    let factorText: String
    let method: Method
    let factor: String
    let areaBasis: String
    let description: String
}

struct ProjectCalculatorDraft: Codable, Identifiable {
    struct SavedNote: Codable, Sendable {
        let id: String
        let title: String
    }

    let id: String
    let context: String
    let input: [String: String]
    let revision: Int
    let updatedAt: String
    let savedNote: SavedNote?
    let savedFingerprint: String?

    var title: String {
        if let name = input["spaceName"], !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return name }
        let description = [input["spaceFunction"], input["area"].flatMap { $0.isEmpty ? nil : "\($0) ft²" }]
            .compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")
        return description.isEmpty ? "Untitled calculation" : description
    }
}

struct ProjectCalculatorSnapshot: Decodable {
    struct Result: Decodable {
        let valid: Bool
        let errors: [String]
        let previewPeople: Int?
        let fingerprint: String
    }

    let record: ProjectCalculatorDraft
    let recent: [ProjectCalculatorDraft]
    let raw: String
    let result: Result

    var savedTitle: String? {
        record.savedFingerprint == result.fingerprint ? record.savedNote?.title : nil
    }
}

final class ProjectCalculatorEngine {
    private let context: JSContext
    private let operation: JSValue
    let rows: [ProjectCalculatorRow]

    private struct Configuration: Encodable {
        let source: NotebookEvidenceSource
        let blocks: [CodeContentBlock]
        let excerpt: String
        let projectID: String
        let drafts: String?
    }

    private struct DraftSelection: Encodable { let id: String? }
    private struct DraftChange: Encodable {
        let record: ProjectCalculatorDraft
        let input: [String: String]
    }
    private struct SaveReceipt: Encodable {
        let record: ProjectCalculatorDraft
        let note: ProjectCalculatorDraft.SavedNote
        let fingerprint: String
    }
    private struct NoteInput: Encodable {
        let input: [String: String]
        let id: String
        let createdAt: String
    }

    init(source: ProjectOccupantLoadSource, projectID: String, drafts: String?) throws {
        guard let context = JSContext() else { throw ProjectCalculatorError.sourceUnavailable }
        let scripts = try ["occupant-load-calculation", "calculation-drafts", "ProjectCalculator"].map { name in
            guard let url = Bundle.main.url(forResource: name, withExtension: "js") else {
                throw ProjectCalculatorError.sourceUnavailable
            }
            return try String(contentsOf: url, encoding: .utf8)
                .replacingOccurrences(of: #"(?m)^export "#, with: "", options: .regularExpression)
        }
        let uuid: @convention(block) () -> String = { UUID().uuidString.lowercased() }
        let parseHTML: @convention(block) (String) -> String? = { CalculatorHTMLDocument.json($0) }
        context.setObject(uuid, forKeyedSubscript: "nativeCalculatorUUID" as NSString)
        context.evaluateScript("""
            (() => {
                const crypto = {randomUUID: nativeCalculatorUUID};
                const structuredClone = value => JSON.parse(JSON.stringify(value));
                \(scripts.joined(separator: "\n"))
            })();
            """)
        let configuration = Configuration(source: source.source, blocks: source.blocks, excerpt: source.excerpt,
            projectID: projectID, drafts: drafts)
        let config = String(decoding: try JSONEncoder().encode(configuration), as: UTF8.self)
        guard context.exception == nil,
              let factory = context.objectForKeyedSubscript("makeProjectCalculator"),
              let operation = factory.call(withArguments: [config, parseHTML]),
              !operation.isUndefined, !operation.isNull else {
            throw Self.failure(in: context)
        }
        self.context = context
        self.operation = operation
        self.rows = try Self.run("rows", payload: DraftSelection(id: nil), context: context, operation: operation)
    }

    func open(_ id: String? = nil) throws -> ProjectCalculatorSnapshot {
        try run("open", payload: DraftSelection(id: id))
    }

    func create() throws -> ProjectCalculatorSnapshot {
        try run("create", payload: DraftSelection(id: nil))
    }

    func update(_ record: ProjectCalculatorDraft, input: [String: String]) throws -> ProjectCalculatorSnapshot {
        try run("update", payload: DraftChange(record: record, input: input))
    }

    func markSaved(_ record: ProjectCalculatorDraft, note: ProjectCalculatorDraft.SavedNote,
                   fingerprint: String) throws -> ProjectCalculatorSnapshot {
        try run("saved", payload: SaveReceipt(record: record, note: note, fingerprint: fingerprint))
    }

    func note(input: [String: String], id: UUID, createdAt: String) throws -> ProjectCalculatorNote {
        try run("note", payload: NoteInput(input: input, id: id.uuidString.lowercased(), createdAt: createdAt))
    }

    private func run<Payload: Encodable, Result: Decodable>(_ action: String, payload: Payload) throws -> Result {
        try Self.run(action, payload: payload, context: context, operation: operation)
    }

    private static func run<Payload: Encodable, Result: Decodable>(
        _ action: String, payload: Payload, context: JSContext, operation: JSValue
    ) throws -> Result {
        context.exception = nil
        let json = String(decoding: try JSONEncoder().encode(payload), as: UTF8.self)
        let value = operation.call(withArguments: [action, json])
        guard context.exception == nil, let value, value.isString, let result = value.toString() else {
            throw failure(in: context)
        }
        return try JSONDecoder().decode(Result.self, from: Data(result.utf8))
    }

    private static func failure(in context: JSContext) -> Error {
        if let message = context.exception?.objectForKeyedSubscript("message")?.toString() {
            return ProjectCalculatorError.engine(message)
        }
        return ProjectCalculatorError.sourceUnavailable
    }
}

// Supply the HTML tree shape expected by the shared table parser without a browser.
private enum CalculatorHTMLDocument {
    struct Node: Encodable {
        struct Attribute: Encodable {
            let name: String
            let value: String
        }

        let nodeName: String
        var value: String? = nil
        var attrs: [Attribute]? = nil
        var childNodes: [Node]? = nil
    }

    static func json(_ html: String) -> String? {
        let options = HTML_PARSE_NONET.rawValue | HTML_PARSE_NOERROR.rawValue | HTML_PARSE_NOWARNING.rawValue
        guard let document = html.withCString({
            htmlReadMemory($0, Int32(html.utf8.count), nil, "UTF-8", Int32(options))
        }) else { return nil }
        defer { xmlFreeDoc(document) }
        guard let root = xmlDocGetRootElement(document), let element = node(root),
              let data = try? JSONEncoder().encode(Node(nodeName: "#document", childNodes: [element])) else { return nil }
        return String(decoding: data, as: UTF8.self)
    }

    private static func node(_ pointer: xmlNodePtr) -> Node? {
        let raw = pointer.pointee
        if raw.type == XML_TEXT_NODE, let content = raw.content {
            return Node(nodeName: "#text", value: String(cString: content))
        }
        guard raw.type == XML_ELEMENT_NODE, let name = raw.name else { return nil }
        var children: [Node] = []
        var next = raw.children
        while let child = next {
            if let element = node(child) { children.append(element) }
            next = child.pointee.next
        }
        let attributes = ["class", "style"].compactMap { name -> Node.Attribute? in
            let value = name.withCString { characters in
                characters.withMemoryRebound(to: xmlChar.self, capacity: name.utf8.count + 1) {
                    xmlGetProp(pointer, $0)
                }
            }
            guard let value else { return nil }
            defer { xmlFree(value) }
            return Node.Attribute(name: name, value: String(cString: value))
        }
        return Node(nodeName: String(cString: name), attrs: attributes.isEmpty ? nil : attributes,
            childNodes: children.isEmpty ? nil : children)
    }
}
