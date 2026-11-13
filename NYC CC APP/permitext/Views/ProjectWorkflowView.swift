import SwiftUI

struct ProjectWorkflowView: View {
    let folderID: Int64
    let section: ProjectOverviewSection

    @EnvironmentObject private var library: CodeLibraryViewModel
    @State private var editingFolder: CodeFolder?
    @State private var editingSessionID: UUID?
    @State private var questions: [ProjectOpenQuestion] = []
    @State private var records: [ProjectChecklistRecord] = []
    @State private var saveError: String?
    @State private var initialSyncFinished = false

    private var isQuestions: Bool { section == .questions }
    private var title: String { isQuestions ? "Questions" : "Checklist" }
    private var isEditing: Bool { editingFolder != nil }
    private var folder: CodeFolder? { library.folder(id: folderID) }
    private var savedQuestions: [ProjectOpenQuestion] { folder?.openQuestions ?? [] }
    private var savedRecords: [ProjectChecklistRecord] { folder?.recordsChecklist ?? [] }
    private var needsInitialSync: Bool {
        isQuestions ? folder?.openQuestions == nil : folder?.recordsChecklist == nil
    }
    private var accent: Color {
        Color(uiColor: PlatformColor(hex: folder?.colorHex ?? CodeFolder.defaultColorHex) ?? library.accentColor())
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                if needsInitialSync {
                    if initialSyncFinished {
                        Text("Connect to load this Project’s \(title.lowercased()) before editing.")
                            .foregroundStyle(.secondary)
                        Button("Try again") { Task { await library.syncNow() } }
                    }
                } else if isQuestions { questionList } else { checklist }
                if let saveError {
                    Text(saveError).font(.subheadline).foregroundStyle(.red)
                        .accessibilityIdentifier("project-workflow-error")
                }
                actions
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, CodeScreenMetrics.screenHorizontalPadding)
            .padding(.top, CodeScreenMetrics.topTitlePadding)
            .padding(.bottom, CodeScreenMetrics.tabBarClearance)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(CodeAppBackdrop(accent: accent).ignoresSafeArea())
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .tint(Color.appChrome)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                if isEditing {
                    Button("Save", action: save).fontWeight(.semibold)
                        .accessibilityIdentifier("project-workflow-save")
                } else {
                    Button("Edit", action: beginEditing)
                        .disabled(folder == nil || (isQuestions ? savedQuestions.isEmpty : savedRecords.isEmpty))
                        .accessibilityIdentifier("project-workflow-edit")
                }
            }
            if isEditing {
                ToolbarItemGroup(placement: .keyboard) {
                    Button("Cancel", action: cancel)
                    Spacer()
                    Button("Save", action: save).fontWeight(.semibold)
                }
            }
        }
        .onChange(of: library.privateSessionID) { _, _ in cancel() }
        .onChange(of: folderID) { _, _ in cancel() }
        .task(id: folderID) {
            if needsInitialSync { await library.syncNow() }
            initialSyncFinished = true
        }
    }

    @ViewBuilder private var questionList: some View {
        if isEditing {
            ForEach($questions) { $question in
                let index = questions.firstIndex { $0.id == question.id } ?? 0
                VStack(alignment: .leading, spacing: 12) {
                    HStack(alignment: .top, spacing: 12) {
                        Text("\(index + 1).").foregroundStyle(.secondary).monospacedDigit()
                        VStack(alignment: .leading, spacing: 12) {
                            TextField("What needs to be answered?", text: $question.question, axis: .vertical)
                                .font(.headline)
                                .accessibilityLabel("Question \(index + 1)")
                                .accessibilityIdentifier("project-question-text-\(index)")
                            TextField("Add an answer", text: $question.answer, axis: .vertical)
                                .accessibilityLabel("Answer \(index + 1)")
                                .accessibilityIdentifier("project-question-answer-\(index)")
                        }
                        Button {
                            questions.removeAll { $0.id == question.id }
                        } label: { Image(systemName: "minus.circle").frame(minWidth: 44, minHeight: 44) }
                            .accessibilityLabel("Remove question \(index + 1)")
                    }
                    Divider()
                }
                .textFieldStyle(.plain)
            }
        } else if savedQuestions.isEmpty {
            Text("No questions yet.").foregroundStyle(.secondary)
        } else {
            ForEach(Array(savedQuestions.enumerated()), id: \.element.id) { index, question in
                HStack(alignment: .top, spacing: 12) {
                    Text("\(index + 1).").foregroundStyle(.secondary).monospacedDigit()
                    VStack(alignment: .leading, spacing: 8) {
                        Text(question.question.isEmpty ? "Untitled question" : question.question).font(.headline)
                        if !question.answer.isEmpty { Text(question.answer).foregroundStyle(.secondary) }
                    }
                }
                .textSelection(.enabled)
                Divider()
            }
        }
    }

    @ViewBuilder private var checklist: some View {
        if isEditing {
            ForEach($records) { $record in
                let index = records.firstIndex { $0.id == record.id } ?? 0
                VStack(alignment: .leading, spacing: 12) {
                    HStack(alignment: .top, spacing: 12) {
                        Text("\(index + 1).").foregroundStyle(.secondary).monospacedDigit()
                        VStack(alignment: .leading, spacing: 12) {
                            TextField("Record name", text: $record.label, axis: .vertical)
                                .font(.headline)
                                .accessibilityLabel("Record \(index + 1)")
                                .accessibilityIdentifier("project-record-label-\(index)")
                            Picker("Status", selection: $record.status) {
                                ForEach(ProjectRecordStatus.allCases) { status in
                                    Text(status.title).tag(status)
                                }
                            }
                            .pickerStyle(.menu)
                            .accessibilityIdentifier("project-record-status-\(index)")
                            TextField("Source, date, or follow-up", text: $record.note, axis: .vertical)
                                .accessibilityLabel("Record notes \(index + 1)")
                                .accessibilityIdentifier("project-record-note-\(index)")
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        Button {
                            records.removeAll { $0.id == record.id }
                        } label: { Image(systemName: "minus.circle").frame(minWidth: 44, minHeight: 44) }
                            .accessibilityLabel("Remove record \(index + 1)")
                    }
                    Divider()
                }
                .textFieldStyle(.plain)
            }
        } else if savedRecords.isEmpty {
            Text("No records yet.").foregroundStyle(.secondary)
        } else {
            ForEach(Array(savedRecords.enumerated()), id: \.element.id) { index, record in
                HStack(alignment: .top, spacing: 12) {
                    Text("\(index + 1).").foregroundStyle(.secondary).monospacedDigit()
                    VStack(alignment: .leading, spacing: 8) {
                        Text(record.label).font(.headline)
                        Text(record.status.title).font(.subheadline).foregroundStyle(.secondary)
                        if !record.note.isEmpty { Text(record.note).foregroundStyle(.secondary) }
                    }
                }
                .textSelection(.enabled)
                Divider()
            }
        }
    }

    private var actions: some View {
        VStack(alignment: .leading, spacing: 20) {
            Button {
                if !isEditing { beginEditing() }
                guard isEditing else { return }
                if isQuestions { questions.append(ProjectOpenQuestion()) }
                else { records.append(ProjectChecklistRecord()) }
            } label: { Label(isQuestions ? "Add question" : "Add record", systemImage: "plus") }
                .disabled(folder == nil || needsInitialSync || (isQuestions ? (isEditing ? questions.count : savedQuestions.count) >= 100 : (isEditing ? records.count : savedRecords.count) >= 50))
                .accessibilityIdentifier("project-workflow-add")
            if !isQuestions {
                Button("Add suggested records") {
                    if !isEditing { beginEditing() }
                    guard isEditing else { return }
                    for label in ProjectChecklistRecord.suggestedLabels where records.count < 50 && !records.contains(where: { $0.label == label }) {
                        records.append(ProjectChecklistRecord(label: label))
                    }
                }
                .disabled(folder == nil || needsInitialSync)
                .accessibilityIdentifier("project-checklist-suggested")
            }
            if isEditing {
                HStack {
                    Button("Cancel", action: cancel).accessibilityIdentifier("project-workflow-cancel")
                    Spacer()
                    Button("Save", action: save).fontWeight(.semibold)
                        .accessibilityIdentifier("project-workflow-bottom-save")
                }
            }
        }
        .buttonStyle(.plain)
        .frame(minHeight: 44)
    }

    private func beginEditing() {
        guard let folder, !needsInitialSync else { return }
        questions = folder.openQuestions ?? []
        records = folder.recordsChecklist ?? []
        editingFolder = folder
        editingSessionID = library.privateSessionID
        saveError = nil
    }

    private func cancel() {
        editingFolder = nil
        editingSessionID = nil
        questions = []
        records = []
        saveError = nil
    }

    private func save() {
        guard let editingFolder, let editingSessionID else { return }
        let succeeded = library.updateProjectWorkflow(expectedFolder: editingFolder, sessionID: editingSessionID,
            openQuestions: isQuestions ? questions : nil,
            recordsChecklist: isQuestions ? nil : records.map {
                var record = $0
                record.label = record.label.trimmingCharacters(in: .whitespacesAndNewlines)
                record.note = record.note.trimmingCharacters(in: .whitespacesAndNewlines)
                return record
            })
        if succeeded { cancel() }
        else { saveError = library.statusMessage ?? "Changes could not be saved. Try again." }
    }
}
