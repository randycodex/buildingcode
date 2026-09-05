import ClerkKit
import SwiftUI
import XCTest
@testable import permitext

@MainActor
final class AccountDeletionVerificationTests: XCTestCase {
    private let password = Factor(strategy: .password)
    private let email = Factor(strategy: .emailCode, emailAddressId: "synthetic-email", safeIdentifier: "t***@example.test")
    private let totp = Factor(strategy: .totp)

    private func ready(_ model: AccountDeletionVerificationModel) async throws {
        for _ in 0..<200 {
            if model.isPresented && !model.isBusy { return }
            await Task.yield()
        }
        XCTFail("Verification did not reach an input state")
        throw CancellationError()
    }

    func testPasswordThenSecondFactorDoesNotContinueEarly() async throws {
        let model = AccountDeletionVerificationModel()
        var attempts = 0, continued = false
        let first = SessionVerification(status: .needsFirstFactor, level: .multiFactor, supportedFirstFactors: [password])
        let second = SessionVerification(status: .needsSecondFactor, level: .multiFactor, supportedSecondFactors: [totp])
        let client = AccountDeletionVerificationClient(start: { first }, prepare: { _, _ in XCTFail(); return first }, attempt: { factor, isSecond, _ in
            attempts += 1
            XCTAssertEqual(isSecond, attempts == 2)
            XCTAssertEqual(factor.strategy, attempts == 1 ? .password : .totp)
            return attempts == 1 ? second : .init(status: .complete, level: .multiFactor)
        })
        let pending = Task { try await model.verify(client: client, isCurrent: { true }); continued = true }
        try await ready(model)
        await model.select(password)
        await model.submit("synthetic-password")
        XCTAssertFalse(continued)
        XCTAssertEqual(model.factors, [totp])
        await model.select(totp)
        await model.submit("synthetic-code")
        try await pending.value
        XCTAssertTrue(continued)
        XCTAssertFalse(model.isPresented)
    }

    func testCancelPreventsContinuationAndDropsLateProviderResponse() async throws {
        let model = AccountDeletionVerificationModel()
        var response: CheckedContinuation<SessionVerification, Never>?
        var continued = false
        let client = AccountDeletionVerificationClient(start: {
            await withCheckedContinuation { response = $0 }
        }, prepare: { _, _ in throw CancellationError() }, attempt: { _, _, _ in throw CancellationError() })
        let pending = Task { try await model.verify(client: client, isCurrent: { true }); continued = true }
        for _ in 0..<200 { if response != nil { break }; await Task.yield() }
        XCTAssertNotNil(response)
        model.cancel()
        response?.resume(returning: .init(status: .complete, level: .firstFactor))
        do { try await pending.value; XCTFail("Canceled verification continued") }
        catch { XCTAssertTrue(error is CancellationError) }
        await Task.yield()
        XCTAssertFalse(continued)
        XCTAssertFalse(model.isPresented)
    }

    func testAccountRoundTripDuringVerificationRejectsLateSuccess() async throws {
        let model = AccountDeletionVerificationModel()
        var generation = 1
        var response: CheckedContinuation<SessionVerification, Never>?
        let first = SessionVerification(status: .needsFirstFactor, level: .firstFactor, supportedFirstFactors: [password])
        let client = AccountDeletionVerificationClient(start: { first }, prepare: { _, _ in first }, attempt: { _, _, _ in
            await withCheckedContinuation { response = $0 }
        })
        let pending = Task { try await model.verify(client: client, isCurrent: { generation == 1 }) }
        try await ready(model)
        await model.select(password)
        let submit = Task { await model.submit("synthetic-password") }
        for _ in 0..<200 { if response != nil { break }; await Task.yield() }
        generation = 3 // A -> B -> A still has a different captured generation.
        response?.resume(returning: .init(status: .complete, level: .firstFactor))
        await submit.value
        do { try await pending.value; XCTFail("Account round trip continued") }
        catch { XCTAssertTrue(error is AccountDeletionVerificationError) }
        XCTAssertFalse(model.isPresented)
    }

    func testInvalidCodeCanRetryWithoutRestartingDeletion() async throws {
        let model = AccountDeletionVerificationModel()
        var prepares = 0, attempts = 0
        let first = SessionVerification(status: .needsFirstFactor, level: .firstFactor, supportedFirstFactors: [email])
        let client = AccountDeletionVerificationClient(start: { first }, prepare: { factor, second in
            XCTAssertEqual(factor.emailAddressId, "synthetic-email"); XCTAssertFalse(second)
            prepares += 1; return first
        }, attempt: { _, _, _ in
            attempts += 1
            if attempts == 1 { throw NSError(domain: "SyntheticVerification", code: 1, userInfo: [NSLocalizedDescriptionKey: "Incorrect code"]) }
            return .init(status: .complete, level: .firstFactor)
        })
        let pending = Task { try await model.verify(client: client, isCurrent: { true }) }
        try await ready(model)
        await model.select(email)
        await model.submit("wrong-code")
        XCTAssertEqual(model.message, "Incorrect code")
        XCTAssertTrue(model.isPresented)
        await model.submit("synthetic-correct-code")
        try await pending.value
        XCTAssertEqual(prepares, 1)
        XCTAssertEqual(attempts, 2)
    }

    func testUnsupportedFactorsStopAndNeverContinue() async throws {
        let model = AccountDeletionVerificationModel()
        let state = SessionVerification(status: .needsFirstFactor, level: .firstFactor, supportedFirstFactors: [])
        let client = AccountDeletionVerificationClient(start: { state }, prepare: { _, _ in XCTFail(); return state }, attempt: { _, _, _ in XCTFail(); return state })
        do { try await model.verify(client: client, isCurrent: { true }); XCTFail("Unsupported verification continued") }
        catch { XCTAssertTrue(error is AccountDeletionVerificationError) }
        XCTAssertFalse(model.isPresented)
    }

    func testCancellationOfTaskStopsPendingVerification() async throws {
        let model = AccountDeletionVerificationModel()
        let state = SessionVerification(status: .needsFirstFactor, level: .firstFactor, supportedFirstFactors: [password])
        let client = AccountDeletionVerificationClient(start: { state }, prepare: { _, _ in state }, attempt: { _, _, _ in state })
        let pending = Task { try await model.verify(client: client, isCurrent: { true }) }
        try await ready(model)
        pending.cancel()
        do { try await pending.value; XCTFail("Canceled task continued") }
        catch { XCTAssertTrue(error is CancellationError) }
        XCTAssertFalse(model.isPresented)
    }

    func testVerificationViewRendersAndKeepsInputOutOfRecoveryState() async throws {
        let model = AccountDeletionVerificationModel()
        let state = SessionVerification(status: .needsFirstFactor, level: .firstFactor, supportedFirstFactors: [email])
        let client = AccountDeletionVerificationClient(start: { state }, prepare: { _, _ in state }, attempt: { _, _, _ in .init(status: .complete, level: .firstFactor) })
        let pending = Task { try await model.verify(client: client, isCurrent: { true }) }
        try await ready(model)
        await model.select(email)
        let host = UIHostingController(rootView: AccountDeletionVerificationView(model: model).padding(24))
        host.view.frame = CGRect(x: 0, y: 0, width: 393, height: 700)
        host.view.backgroundColor = .systemBackground
        let window = UIWindow(frame: host.view.frame)
        window.rootViewController = host
        window.isHidden = false
        host.view.setNeedsLayout()
        host.view.layoutIfNeeded()
        await Task.yield()
        let rendered = UIGraphicsImageRenderer(size: host.view.bounds.size).image { _ in
            host.view.drawHierarchy(in: host.view.bounds, afterScreenUpdates: true)
        }
        let attachment = XCTAttachment(image: rendered)
        attachment.name = "Synthetic account deletion verification"
        attachment.lifetime = .keepAlways
        add(attachment)
        if let data = rendered.pngData() {
            try data.write(to: FileManager.default.temporaryDirectory.appendingPathComponent("permitext-account-verification.png"))
        }
        model.cancel()
        do { try await pending.value; XCTFail() } catch {}
        window.isHidden = true
        XCTAssertNil(model.selectedFactor)
        XCTAssertTrue(model.factors.isEmpty)
    }
}
