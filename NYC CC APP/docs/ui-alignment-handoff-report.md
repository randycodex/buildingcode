# UI Alignment Handoff Report (Updated)

**Project:** NYC CC APP — `permitext` iOS app  
**Goal:** Align **Saved** and **Settings** tab layouts with **Search** as the visual reference, then fix follow-up spacing, toolbar, Settings typography, and project pager behavior.  
**Last update:** Includes **fixed 2×2 project pager height** (no shrink on swipe when a page has fewer than four projects).

---

## Files changed

| File | Role | Approx. diff |
|------|------|----------------|
| `NYC CC APP/permitext/Views/BrowseView.swift` | Shared metrics + `CodeScreenSectionEyebrow`, `CodeScreenTitleRow` | +122 lines |
| `NYC CC APP/permitext/Views/BookmarksView.swift` | Saved tab — largest change | ~204 lines touched |
| `NYC CC APP/permitext/Views/SearchView.swift` | Reference tab — metrics extraction | ~58 lines removed/refactored |
| `NYC CC APP/permitext/Views/SettingsView.swift` | Settings picker card typography/padding | ~27 lines |

**Not modified:** Browse tab content, ViewModels, `PermitextApp.swift`, duplicate tree `PermiText 1.0 (1)/`, tests.

**Review command:**

```bash
git diff "NYC CC APP/permitext/Views/BrowseView.swift" \
         "NYC CC APP/permitext/Views/BookmarksView.swift" \
         "NYC CC APP/permitext/Views/SearchView.swift" \
         "NYC CC APP/permitext/Views/SettingsView.swift"
```

---

## 1. Original problem (user intent)

Cross-tab screenshots showed vertical misalignment:

- **Search (reference):** “Search” title → “Jump Back In” → tall 2×2 recents tiles.
- **Saved:** Title, “Projects”, tiles, sort/share, and list headers too low or inconsistently spaced.
- **Settings:** Title-to-card gap; “Jurisdiction” clipped at card top; `.title3` rows too large; multi-line values top-aligned to labels.

Follow-ups:

1. Align Saved/Settings to Search (title, eyebrows, spacing).
2. Sort/share inside the **“Saved” word band** (user’s red lines), smaller if needed.
3. “Projects” ↔ “Jump Back In”; keep **57pt** project tiles in a **2×2** grid.
4. Remove spurious gap under tiles / above page dots.
5. **BUILDING CODE** top spacing = dots → filter chips (8pt).
6. Settings: balanced card padding + **body** fonts.
7. **Pager:** Swiping to a page with fewer than 4 projects must **not shrink** height — empty slots hold space.

---

## 2. Architecture

### 2.1 `CodeScreenMetrics` (single source of truth)

**Location:** `BrowseView.swift` (~1050–1118)

Centralizes spacing and grid math for Search + Saved + Settings.

### 2.2 New shared UI (`BrowseView.swift`)

| Type | Purpose |
|------|---------|
| `CodeScreenSectionEyebrow` | Uppercase section labels (“Jump Back In”, “Projects”) |
| `CodeScreenTitleRow<Trailing>` | Title + trailing actions aligned to **title cap-height only** (Saved) |
| `CodeScreenTitle` | Search/Settings title; uses `screenTitleFontSize` |

### 2.3 Two tile height systems (intentional)

| System | Screen | Row/tile behavior |
|--------|--------|-------------------|
| `tileGridHeight` / `twoByTwoTileRowHeight` | **Search** | Tall UIFont-based recents tiles fill each row |
| `savedProjectGridHeight` / `savedProjectTileHeight` (57pt) | **Saved** | Compact project cards; **full page height fixed** via `savedProjectFullPageGridHeight` |

**Rejected:** Forcing Saved rows to Search’s tall row height — caused huge gaps between P1/P2 and P3/P4. Reverted to 57pt tiles.

**Pager history:**

1. `max(height)` across pages → empty gap under tiles on short pages.
2. `currentProjectGridHeight` per page → **shrunk** layout when swiping to 1–2 tiles (user regression).
3. **Current:** `projectGridViewportHeight` = always **full 2×2 page height**; grid always **2 rows × 2 slots**; missing slots = `Color.clear` placeholders.

---

## 3. `CodeScreenMetrics` reference

```swift
enum CodeScreenMetrics {
    static let topTitlePadding: CGFloat = 18
    static let contentSpacingBelowTitle: CGFloat = 16
    static let sectionSpacingBelowEyebrow: CGFloat = 8

    // Screen title band (“Saved”, “Search”, “Settings”)
    static let screenTitleFontSize: CGFloat = 16
    static var screenTitleLineHeight: CGFloat          // UIFont 16 bold
    static var screenHeaderActionSlotSize: CGFloat     // == screenTitleLineHeight
    static let screenHeaderActionPointSize: CGFloat = 13

    // Search recents grid
    static let tileGridSectionBottomPadding: CGFloat = 2
    static let tileGridRowSpacing: CGFloat = 8
    static let tileGridPageSize = 4
    static var jumpBackInPreviewBlockHeight: CGFloat
    static var jumpBackInTileContentHeight: CGFloat
    static var twoByTwoTileRowHeight: CGFloat
    static func tileGridRowCount(forItemCount:) -> Int   // ≤2 → 1 row, else 2
    static func tileGridHeight(forItemCount:) -> CGFloat

    // Saved projects grid
    static let savedProjectTileHeight: CGFloat = 57
    static func savedProjectGridHeight(forItemCount:) -> CGFloat
    static var savedProjectFullPageGridHeight: CGFloat   // always 4-slot page height

    // Settings picker card
    static let settingsPickerRowVerticalPadding: CGFloat = 12
    static let settingsPickerRowHorizontalPadding: CGFloat = 16
}
```

**Full Saved page grid height:**  
`savedProjectFullPageGridHeight` = `57 × 2 + 8` = **122pt** (two rows + row gap).

---

## 4. `BookmarksView.swift` (Saved) — detailed

### 4.1 Removed

- `fixedHeaderTitleTopCompensation` (20pt) on header and toolbar overlay.

### 4.2 Scroll structure

**Before:** Fixed header `VStack` + nested `ScrollView` for bookmark list only.  
**After:** One `ScrollView` → `savedScreenHeader` + `savedBookmarkList`.

Matches Search scroll/safe-area behavior.

### 4.3 Title + toolbar

- `CodeScreenTitleRow(title: "Saved")` with sort + export.
- Icons: **13pt** semibold, frame **`screenHeaderActionSlotSize`** (~title line height).
- Was 36×36 `.headline` in overlay — sat below “Saved” band.
- **Clarification:** Red lines bracket the word **“Saved”** only; `CodeScreenTitleRow` uses a fixed `titleBandHeight` + 8pt spacer **below** the band (icons not aligned using that spacer).

### 4.4 `savedScreenHeader` spacing

```text
VStack(spacing: 16)  // contentSpacingBelowTitle
  CodeScreenTitleRow "Saved" + sort/share
  VStack(spacing: 0)
    projectTilesSection?
    savedInlineFilters?
      .padding.top: 8 if folders exist
      .padding.bottom: 8
```

### 4.5 Projects section (`projectTilesSection`)

| Piece | Implementation |
|-------|----------------|
| Eyebrow | `CodeScreenSectionEyebrow("Projects")` + **overlay** `+` (avoids 28pt HStack height) |
| Eyebrow → grid | 8pt |
| Grid | `TabView`, page size 4, 2 columns |
| Tile | 57pt height, unchanged width from `(pageWidth - 8) / 2` |
| **Viewport height** | **`projectGridViewportHeight`** → `savedProjectFullPageGridHeight` (always full page) |
| **Page layout** | **Always 2 rows** (`tileGridRowCount(forItemCount: 4)`); slots 0–3, `nil` → clear placeholder |
| Page dots | +4pt top padding; unchanged |
| Height animation on swipe | **Removed** (height no longer changes) |

**`projectPageGrid` (current logic):**

```swift
let pageSlots = Array(page.prefix(4))
ForEach(0..<2) { rowIndex in
  projectTileRow(
    left:  pageSlots[safe leftIndex],
    right: pageSlots[safe rightIndex],
    ...
  )
}
.frame(height: projectGridViewportHeight, alignment: .top)
```

Example: page with P5, P6 only → row 0: P5, P6; row 1: two clear 57pt slots; **total block height unchanged**.

### 4.6 Bookmark list spacing (`codeSectionHeader`)

New parameter: `hasFiltersAbove: Bool`.

| First header top padding | Condition |
|--------------------------|-----------|
| 18 | Not first group |
| 16 | First, no header content above list |
| 0 | First, filters above (filters already have 8pt bottom) |
| 8 | First, projects/dots only (no filters) |

Ensures **BUILDING CODE** is 8pt below filter chips (same as dots → filters).

### 4.7 Helpers

- `showsSavedInlineFilters`
- `hasSavedHeaderContentBelowTitle`
- `savedScreenHeader` / `savedBookmarkList` (split views)

---

## 5. `SearchView.swift`

Reference screen; layout unchanged visually.

- Uses `CodeScreenMetrics` for spacing, page size, tile heights.
- `CodeScreenSectionEyebrow` for “Jump Back In”.
- Jump-back-in height math moved to `CodeScreenMetrics` (removed private duplicates).
- `jumpBackInTileRow` gets explicit `twoByTwoTileRowHeight` frame.

**Note:** Search can still use **variable** `tileGridHeight(forItemCount:)` per page for **tall** tiles; Saved uses **fixed full-page** height for **compact** tiles.

---

## 6. `SettingsView.swift`

### `SettingsRowTypography` (file-private)

```swift
label       = .body.weight(.medium)
value       = .body
toggleTitle = .body.weight(.medium)
```

Replaces `.title3` on picker labels/values and Comparison Mode title.

### `expandableSettingsRow`

- **Removed** `isFirstRow` and **0pt top padding** (caused Jurisdiction clipping).
- Uniform **`padding(.vertical, 12)`** and horizontal 16.
- `HStack(alignment: .center)` + `fixedSize(horizontal: false, vertical: true)` on label for wrapped values (e.g. “2022 Construction Codes”).

### Main stack

- `VStack(spacing: CodeScreenMetrics.contentSpacingBelowTitle)` under `CodeScreenTitle("Settings")`.
- Comparison toggle uses same 12/16 padding as picker rows.

---

## 7. Saved tab spacing diagram (final)

```text
topTitlePadding (18)
┌─ CodeScreenTitleRow: "Saved" + sort/share (band = screenTitleLineHeight)
└─ 8pt below band
contentSpacingBelowTitle (16)
┌─ PROJECTS eyebrow (+ overlay)
└─ 8pt
┌─ 2×2 grid (ALWAYS 122pt tall viewport)
│    • filled tiles: 57pt cards
│    • empty slots: Color.clear 57×tileWidth
└─ page dots (+4pt top)
8pt → filter chips (if shown)
8pt bottom on filters
┌─ BUILDING CODE (first codeSectionHeader; top 0 if filters)
└─ bookmark rows…
```

---

## 8. Timeline of changes (chronological)

| # | Change |
|---|--------|
| 1 | Remove 20pt `fixedHeaderTitleTopCompensation`; unify 16pt below title |
| 2 | Saved: `CodeScreenTitleRow`, smaller sort/share |
| 3 | Shared eyebrows + Search metrics extraction |
| 4 | Attempt Search-tall rows on Saved → **reverted** (57pt tiles) |
| 5 | Single `ScrollView` on Saved |
| 6 | `currentProjectGridHeight` per page → fixed gap on short pages |
| 7 | Filters → BUILDING CODE 8pt spacing |
| 8 | Settings: body fonts + 12pt uniform row padding |
| 9 | **`projectGridViewportHeight` always full 2×2; always 2 rows + empty slots** |

---

## 9. Design tradeoffs (reviewer notes)

| Topic | Decision |
|-------|----------|
| Saved vs Search tile **bottom** edge | Saved block is **shorter** (57pt×2); tops/eyebrows align, bottoms need not match Search tall tiles |
| Fixed pager height | Stable filters/dots position; empty slots on sparse pages |
| `GeometryReader` in pager | Still used for width; height clamped to `projectGridViewportHeight` |
| Search single-tile-last-page | Search still moves lone tile right on last page; **Saved does not** — always fixed 2×2 slot positions |

---

## 10. Review checklist

### Saved / pager

- [ ] Page 1: four projects (P1–P4) — normal 2×2.
- [ ] Page 2: two projects (P5–P6) — **same vertical space**; row 2 empty placeholders.
- [ ] Page with one project — three clear slots; no layout jump.
- [ ] Page dots and filter chips **do not move** when swiping.

### Saved / alignment

- [ ] Sort/share centered on “Saved” word band.
- [ ] 8pt: dots → filters, filters → BUILDING CODE.

### Settings

- [ ] Jurisdiction not clipped; Version 2-line value centers label.

### Search

- [ ] Jump Back In unchanged in behavior.

### Regression

- [ ] No bookmarks / no folders / filters-only states.
- [ ] Export/sort still work.

---

## 11. Grep / symbols

```bash
rg "CodeScreenMetrics|CodeScreenTitleRow|CodeScreenSectionEyebrow|SettingsRowTypography|projectGridViewportHeight|savedProjectFullPageGridHeight|hasFiltersAbove|showsSavedInlineFilters" "NYC CC APP/permitext"
```

**Removed / do not expect:**

- `fixedHeaderTitleTopCompensation`
- `currentProjectGridHeight`

---

## 12. Not changed

- Browse, Reader, HTML views, tab bar, ViewModels, tests, `PermiText 1.0 (1)/` duplicate.
- No git commits assumed in this session.

---

## 13. Optional follow-ups

1. Dynamic Type pass on Settings + Saved toolbar.
2. Replace `GeometryReader` with `containerRelativeFrame` for pager width.
3. Mirror Search “single tile on right” on Saved last page — **not requested**; current spec is fixed slot grid.
4. Sync duplicate codebase copy if still built from `PermiText 1.0 (1)/`.

---

*Generated for handoff to another agent. For line-level truth, run `git diff` on the four Swift files listed in § Files changed.*
