import Foundation
import Combine

struct NativeReaderHandoffRequest {
    let id = UUID()
    let route: SearchReaderRoute
    let accountID: String?
    let ownerSessionID: UUID
    let ownerRevision: UUID
    let ownerIdentity: ObjectIdentifier

    func permits(_ context: CodeLibraryViewModel.CodeSourceNavigationContext?) -> Bool {
        guard let context else { return false }
        return accountID == context.accountID && ownerSessionID == context.ownerSessionID
            && ownerRevision == context.ownerRevision && ownerIdentity == context.ownerIdentity
    }
}

/// Only an explicit destination choice writes a request. Each permanent Reader
/// consumes its own slot; neither previewing nor opening the other Reader does.
@MainActor
final class NativeReaderHandoff: ObservableObject {
    static let shared = NativeReaderHandoff()
    @Published private(set) var requests: [BrowserContextID: NativeReaderHandoffRequest] = [:]

    func open(_ route: SearchReaderRoute, in destination: BrowserContextID, library: CodeLibraryViewModel) {
        guard route.sourceVersion != nil, let context = library.captureCodeSourceNavigationContext() else { return }
        requests[destination] = NativeReaderHandoffRequest(route: route, accountID: context.accountID,
            ownerSessionID: context.ownerSessionID, ownerRevision: context.ownerRevision, ownerIdentity: context.ownerIdentity)
        library.selectedTab = destination == .primary ? .browse : .browseSecondary
    }

    func shouldRestoreVersion(in destination: BrowserContextID) -> Bool {
        requests[destination] == nil
    }

    func cancel(in destination: BrowserContextID) {
        requests.removeValue(forKey: destination)
    }

    func finish(_ request: NativeReaderHandoffRequest, in destination: BrowserContextID) {
        guard requests[destination]?.id == request.id else { return }
        requests.removeValue(forKey: destination)
    }
}
