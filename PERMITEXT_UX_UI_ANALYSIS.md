# Permitext UX and UI analysis

**Date:** 2026-08-16  
**Scope:** `/Users/randy/Documents/X_CODING/Building Code`  
**Surfaces reviewed:** iPhone app (`NYC CC APP/permitext`), web workspace (`permitext-sync-server/public`)  
**Method:** Source and design-token inspection only. No product changes were made.

This document is two reports.

1. **User experience** — what the product asks people to do, how it is named, and what to cut.
2. **User interface** — how it looks, how the pixels are put together, and what to quiet.

---

# 1. User experience

Permitext is a strong **NYC code reader** that is being asked to also be a **desktop research desk**, a **project file system**, a **governed legal-decision product**, and a **firm collaboration suite**. The reader is the valuable part. Almost everything that needs work is about vocabulary, first-run, and product surface area.

The core job is clear: find a provision, read it, keep it, ask a question against the selected text. A first-time user cannot see that job. They land in a tool with two unlabeled readers, a Saved tab that is also Projects/Folders, a web desk with Workspaces plus columns plus Projects, and professional language like “governed Code Decision,” “Evidence v0,” and “immutable Research answers.”

## The one problem that explains most of the rest

**Too many names for the same work.** A user currently has to keep these distinct:

| What the user is doing | What the product calls it |
|---|---|
| Keep a section | Bookmark / Saved / evidence |
| Group work by job | Folder / Project / Reference folder / Project folder |
| Arrange the screen | Workspace / pane / column / reader |
| Ask about code | Research / Code Question / Code Decision / Analysis |
| Write something down | Note / comment / Notebook / Working Notes |
| Produce a deliverable | Report Draft / Report / Code Memo / Export / PDF |

These are not synonyms in the UI. They are separate objects, often with separate empty states, Pro gates, and web-vs-iPhone rules. The product is teaching a file system instead of helping someone answer a code question.

The naming is also inconsistent **across the two apps**:

- iPhone tab is **Saved**. Web toolbar button is **Projects**. Web rules still say Saved should be the entry.
- iPhone Project Hub still says **Code Questions**. Web is mid-migration to **Code Decisions**.
- Web Settings says **Folders**, then **Clear All Projects**. iPhone chips say **All Projects**.
- iPhone has **notes**. Web has **notes** and **comments**.

Pick one vocabulary and kill the rest in the UI, even if the data model stays richer underneath.

**Suggested user-facing words:** Reader, Search, Saved, Project, Research, Report.  
**Internal-only words:** Code Question, Evidence Set, governed record, issuance, coordination, workspace registry, folder type.

## What to get rid of (or keep permanently buried)

These should leave the product a user can see. Not because the engineering is bad — the contracts are careful — but because they compete with the job.

### 1. Two reader tabs on iPhone

The tab bar is five icons, no titles. The first two are nearly identical SF Symbols (`text.line.first…` / `text.line.last…`) labeled only for VoiceOver as “First reader” and “Second reader.”

Side-by-side comparison is a **desktop** idea. On a phone it costs a tab, looks like a duplicate Browse screen, and is unexplained. Keep **one** Browse tab. Comparison can be a button inside a chapter (“Compare with…”) or wait for iPad/web.

### 2. Workboard

Already hidden. Correct. Do not restore it. A drawing canvas inside a code-research app is a different product. The bundled Excalidraw/Mermaid/locale payload is huge for a feature users are not supposed to find.

### 3. Firm, Coordination, review-thread columns

Also correctly hidden. They belong after a single professional can finish **ask → evidence → conclusion → export** without help. Shipping them now would make Project Hub even more of a dashboard of empty sections.

### 4. Notebook as a peer destination

Notebook is a second writing surface next to section notes, comments, Research answers, and Report Draft. For the release workflow, one writing place is enough: **notes on a saved section**, plus the Research answer / conclusion. Notebook can stay as data; do not put it next to Research.

### 5. Workspace tabs on web (the `+` / `•••` strip)

The product already has:

- **Workspaces** (named desk layouts)
- **Columns** (Reader / Search / Projects / Research)
- **Projects** (job folders)

That is three organization layers before the user has saved a section. Ship **one desk**. Persist the last column layout. Add named workspaces only after people are actually drowning in columns.

### 6. “Reset column widths” and “Close all columns” in the top bar

These are power-user recovery tools sitting at the same rank as Search and Research. Move them into the workspace `•••` menu, or drop “Close all.”

### 7. Comments *and* notes

Web readers have a Comments pane. Sections also have notes. Saved items have notes. Notebook has cards. Keep **one annotation**: a note attached to a saved section. Comments look like leftover collaboration.

### 8. The five-stage Code Question machine in the UI

The plan already says the user should see **Ask → Investigate → Decide**, not Define / Evidence / Analyze / Review / Issue. The iPhone hub still shows `Q-001`, “Evidence vN”, “Analysis stale”, and a paragraph that work happens on the web. That is implementation leaking into the product.

If Research cannot yet hide that machinery, do not show Code Question records on iPhone at all — just “Open this Project on the web to research.”

### 9. “All Sections” as a browse mode

Mixing Building Code, Plumbing, Fire, Zoning, Local Laws into one chapter grid makes the library feel like a dump. Default to **one code book**. “All codes” belongs in Search, not Browse.

## First-run is the weakest moment

There is no onboarding, no first-use tip, and no “here is what this app is for.”

**iPhone:** after a loading bar, the user gets a 32pt code-book title and a chapter tile grid. The tab bar is unlabeled. Search autofocuses later. Saved is empty. Settings opens with a Free/Pro essay.

**Web:** a dense icon toolbar, workspace tabs, Online, and an empty panel track. The first useful action is “add a reader,” which is an icon of a book with a checkmark. That is not discoverable.

A first session should be:

1. You are looking at the NYC Building Code.
2. Tap a chapter, or search “egress.”
3. Save a section.
4. (Later, if Pro) Put it in a Project and ask Research.

Add a **one-screen first launch** (dismissible, never again): three lines, one button. Not a tour. Not a feature list.

## iPhone-specific issues

**Unlabeled tab bar.** Five icons, two of them twins. Most people will not know which is Browse vs Search vs Saved. Give the three real tabs titles: Browse, Search, Saved. Settings can stay an icon.

**Browse is a library, not a reader.** You pick a code book, then a chapter tile, then (sometimes) a section. That is fine, but the header is a long grouped menu of 2022 Construction, 2025 Energy/Electrical, 1968 Building Code, Fire, Housing, Admin, Local Laws, Zoning. Power users need that. New users need a short list: Building, Plumbing, Mechanical, Fire, Zoning, More.

**Saving is a folder exam.** Bookmarking opens a picker: New project (Pro), New reference, Your folders, Project vs Reference. The user just wanted a star. **Save first**, then optionally “Add to a project.” Tags should not appear until the section is saved (they already hide until bookmarked — good — but the folder picker still arrives too early).

**Project Hub is a web leftover on a phone.** Opening a project shows metrics (Saved / Questions / Notebook / Research / Reports) and this copy:

> Code Questions, Notebook, Research, Working Notes, and issued records are adapted for secure review on iPhone. Governed workflow changes remain on the web.

That sentence should never ship. On iPhone, a Project should be: the saved sections, their notes, and “Continue on the web” for Research/Report. Everything else is a status dashboard for the engineering team.

**Search dock at the bottom** is unusual but workable. Two real problems:

- First search is **auto-scoped to the current code book**. A user who just left Zoning and types “occupancy” may think the app has no Building Code hits.
- Jump Back In / Pinned / Recent is good, but it is a lot of chrome before anyone has history.

**Settings is a billing page with a shredder at the bottom.** Plan, Account, Web workspace, typography, then Delete Selected / Clear All Projects / Clear Bookmarks / Clear Notes / Clear Tags. Destructive bulk actions should not share a scroll with “Upgrade to Pro.” Move data-wipe behind a single “Manage data” screen.

**Research is advertised on iPhone and cannot be done there.** Settings sells a Research add-on. Project Hub shows Research history. The phone cannot start a conversation. Either add Research on iOS, or stop selling it in the iPhone Settings card and send people to the web with a single, honest button.

**No visible reading path from Search vs Browse.** Search pushes a section `ReaderView`. Browse opens a chapter HTML reader. Those are two different reading experiences (section page + notes vs continuous chapter). Users will not know why one has comments/progress and the other feels like a different app.

## Web-specific issues

The desk metaphor is right for desktop. The chrome is too loud.

**Icon-only toolbar.** Reader, Search, Projects, Research, reset widths, close all — plus workspace tabs, `+`, `•••`, settings gear, Online, brand. The official rules say “text/buttons, not large pill bubbles.” The implementation went the other way: icons with titles only on hover. New users will not know the folder icon is Projects or that the flame/tree icon is Research.

**Saved vs Projects is still unresolved in the UI.** There is a `projects-template` *and* a `saved-template`, both titled Projects. Rules say Projects live *inside* Saved. The button says Projects. Users will not find “my bookmarks” if they are looking for Saved, and they will not find “my job” if they are looking for a folder inside a bookmark list.

**Research starts too late and too formally.** Starting Research requires a Project and a Code Decision, then a prompt: “What do you need to decide?” That is the right *trust* model (selected enacted text only). It is the wrong *first* model. Let someone ask from the reader against the open section, then say “Save this into a Project to keep the citations.” Do not make “create Project → create Decision → then talk” the on-ramp.

**Hidden scrollbars everywhere.** The CSS hides every scrollbar on purpose. For a 200-page chapter, users lose their place. The reader has a thin custom thumb, but Search/Saved/Settings/Research do not. Show a discreet scrollbar on long code text. Hide chrome scrollbars if you want; do not hide document scroll.

**Mobile web is a compromised desk.** One pane at a time plus a “More” sheet is the right idea, but it is still the desktop app in a trench coat: workspace tabs, column close buttons, drag handles. If phone web matters, it should feel like the iPhone app (Browse / Search / Saved). If it does not matter, send mobile browsers to “use the iPhone app” and stop pretending the desk works at 390px.

**Command palette / keyboard rules are ahead of the visible UI.** ⌘K, ⌘F, ⌘1–5 are good for people who already live here. They do not replace labels.

## Trust and tone

The trust model is the best thing in the repo: enacted text is sacred, AI is labeled, citations stay visible, private notes stay out of the evidence set. The UI does not sell that clearly.

What leaks instead is **compliance voice**:

- “IDs, citations, hashes, and version lineage are preserved”
- “Governed workflow changes remain on the web”
- “immutable Research answers”
- “selected-evidence Research”
- Plan cards that read like entitlement contracts

Professionals need a short, human version:

- This is unofficial. Always check the official source.
- Research only uses passages you selected.
- Answers are not approvals.

Put that once, the first time someone opens Research or the first time they open the app. Do not put hashes in a Project screen. Keep the shield/source popover on the reader — that one is good.

The Settings disclaimer is correct and currently easy to miss.

## Cross-platform split is a UX bug, not just a roadmap item

Today the products are:

| Job | iPhone | Web |
|---|---|---|
| Read / search / save | Yes | Yes |
| Projects as folders | Yes (Pro) | Yes (and also the main toolbar item) |
| Notes | Yes | Yes, plus comments |
| Research | History only | Full, Project-gated |
| Report / Notebook | Read-only hub | Full |
| Two readers / N readers | Two mystery tabs | Add-reader columns |
| Firm / Coordination / Workboard | Hidden | Hidden |

A user who starts on iPhone and continues on the web does not “continue.” They switch products. Make the **shared loop** identical and tiny: Read → Search → Save → (optional) Project. Everything else is web-only and should be named that way on iPhone, not mirrored as a disabled cockpit.

## What to keep and polish

These are worth the pixels:

- **Continuous chapter reading** with section jump, in-reader search, typography, back-to-top
- **Search that understands section numbers and phrases**, with Jump Back In
- **Saving a section with a note** as the atomic personal object
- **Code-book color / accent** so Building vs Zoning is felt, not labeled
- **AI research that refuses to impersonate the code**, once the on-ramp is simpler
- **Empty states that already exist** on Saved/Search — they are close; first-run needs the same care
- **The visual rules** (no gradients, square panes, tight chrome) — they fit a professional desk

## If cutting to a product people can learn in five minutes

**iPhone**

1. Three tabs with titles: Browse, Search, Saved.
2. One reader. Lose the second tab.
3. Bookmark = save. Project is an optional label after that.
4. Project screen = saved sections + notes + “Research on the web.”
5. Settings: Account, Reading (font/theme), Plan. Data deletion one level down.

**Web**

1. Top bar in words: Reader · Search · Saved · Research · Settings.
2. One workspace. No tab strip until it is earned.
3. Saved is the inbox. A Project is a filter/group inside it, not a second app.
4. Research can start from the open reader section. Creating a Project is a save step, not a prerequisite wall.
5. Hide Notebook, Report Draft, Comments, Workboard, Firm, Coordination from ordinary navigation.

**Kill or freeze for real (not just `hidden`)**

- Workboard in the user-facing product
- Dual annotation systems
- Code Question stage chrome
- “All Sections” browse
- Workspace multiplication
- iPhone dual-reader tabs

## UX priority order

1. **One vocabulary.** Saved, Project, Research. Stop saying Folder/Workspace/Code Question/Code Decision/Evidence Set in the UI.
2. **iPhone tab bar.** Labels, one Browse tab.
3. **Save without a folder quiz.**
4. **First-run, three lines.**
5. **Web toolbar in words, one desk.**
6. **Honest iPhone boundary** for Research/Report instead of a read-only hub.
7. **Research on-ramp from the current section**, not from a Decision object.
8. **Show scroll on long code.**
9. **Leave Workboard / Firm / Coordination / Notebook where they are** (hidden) until the loop above is obvious.

The product does not need more surfaces. It needs fewer names, a first five minutes that only teach reading and saving, and a Research path that feels like asking a question about the page you are on — not like opening a second professional application.

---

# 2. User interface

The visual system is more considered than most indie apps. There are real tokens, a chrome-versus-reader type split, and per-code color. The problem is that the system is applied as two different products, then over-decorated.

iPhone looks like a **colored tile library**. Web looks like a **compressed uppercase toolbar over square columns**. They share orange Building Code and little else. A user who opens both will not feel they are in the same interface.

## What already works

Keep these. They are the actual design.

- **Enacted text vs chrome.** Web uses Source Serif 4 for the code and Inter for the desk. That is the right split. Legal text should not look like a settings label.
- **Square columns on the web.** Edge-to-edge panes, 1px dividers, no floating cards. That is a professional desk, not a dashboard.
- **Chapter tiles on iPhone.** Big chapter number, short title, tinted fill (`#FFD8C7` for Building, `#D6F6FF` for Plumbing, etc.). This is the strongest object in the whole product. It is how someone should *feel* which book they are in.
- **A shared radius set** that is almost right: cards 14, compact tiles 10, pills for chips only.
- **A 3px reading-progress bar** on the web reader. Quiet and useful.
- **iOS chrome grey** that is not pure black or white (`0.18` / `0.88`). That is a grown-up choice.

## The interface is two brands

| | iPhone | Web |
|---|---|---|
| Type | San Francisco, 16pt screen titles, **32pt** Browse title | Inter 11pt chrome, Source Serif 16.5px reader |
| Shape | Continuous rounded cards, capsules, 16pt chapter tiles | Square panes, 40px circular icon buttons |
| Color | Soft filled tiles + system grouped backgrounds | Cool grey `#f2f2f6`, then flat `#000` in dark mode |
| Chrome | Translucent tab bar, no labels | Uppercase top bar, icon pills, “ONLINE”, workspace tabs |
| Brand | 28pt bold `permitext` on launch | 11pt light `permitext`, letter-spaced plan badge |

Pick **one** and derive the other.

Recommended: the web desk is the identity (serif code, square columns, restrained chrome). iPhone should keep the chapter tiles — they are better than anything on the web — but stop looking like a different app. Same title scale, same accent use, same button language.

## Type: the hierarchy is broken

**iPhone screen titles do not agree with each other.** Browse is 32pt bold. Search, Saved, and Settings are 16pt bold. Browse looks like an editorial magazine. The other three tabs look like a Settings inset. Pick one scale. Use ~22–24pt for the four roots and keep 32pt only if Browse is truly the home, which the tab bar currently denies.

**Web chrome is too small and then shouted.** Base chrome is `11pt`, then the entire top bar is `text-transform: uppercase`. Small + uppercase is the worst pairing: hard to scan, looks like a CAD status strip. Panel titles are `display: none`, so columns are identified only by leftover eyebrows and a row of icons.

**Default iPhone reader size is 10pt with 0 extra line spacing.** That is also the *minimum*. A migration even pushes old 17/5 users down to 10/0. For construction code, 10pt is a footnote. Web’s 16.5px / 1.6 is much closer to a working desk. Make iPhone default ~16–17pt and treat 10pt as an accessibility floor, not the factory setting.

**Secondary text on web fails as UI type.** `--text-secondary: #8f8f96` on `#f2f2f6` is roughly 3:1. Fine for a timestamp. Not fine for the thing that tells you what a control is. Tertiary `#b7b7bf` is decoration, not information.

## Color: too many accents, then the wrong one for money

There are **sixteen code accents** (Building rust, Fire crimson, Admin violet, Electrical indigo, Zoning teal…). That is justified **on the reader and on chapter tiles**. It is not justified on every chip, every eyebrow, and every selected toolbar button.

What to do:

- One **product chrome** color (the current iOS grey / Building rust, not both).
- Code color only on: the open reader, the chapter tile, a 4px book mark, the progress bar.
- Filter chips: quiet grey capsules, **dot** of the book color. A row of fully filled orange / red / purple / cyan pills is a candy store, not a code library.

**Pro is painted in a random cyan** (`#66d9f2` / `#00b9e8`). It does not exist in the code palette. It looks like a third-party “Premium” sticker. If Pro needs a badge, use the same rust/grey system, or a small wordmark. Do not introduce a new hue for billing.

**Web dark mode collapses depth.** Background, surface, muted, and raised are all `#000`. Menus become `#121213`. There is no layer. iOS at least keeps grouped materials. OLED black is fine for the page; it is not fine for every panel. You need at least two elevations or the desk disappears.

**Tinted pane backgrounds** (search blue wash, project green wash, research purple wash) fight the code accents and make columns look like different apps snapped together. Neutral surfaces, one accent, done.

**Notes use yet another family** (`#00636d` / `#91e8ef`). That is a fourth brand.

## Shape and chrome: the rules and the pixels disagree

The web UI rules say: square panes, no oversized pills, text buttons, no card-like main columns.

The pixels do this:

- Top-bar tools are **40×40 pills**.
- Icon buttons in panes are **42×42 bordered circles** with an inset highlight (`box-shadow: inset`).
- Close is a circled X. Drag is a 2×3 dot grid. Both always visible.
- `--radius-panel: 28px` is defined and unused. Panes are radius 0. Dead token.
- iOS Settings primary actions are **full-width capsules** (Upgrade, Research, Sign Out). That is App Store chrome, not the same language as the tile library.

Recommended:

- Web toolbar: **text** — Reader, Search, Saved, Research — 13–14pt, no fill until pressed.
- Pane controls: 28px quiet glyphs, no circular border, no inset shine.
- Hide drag handles until hover/focus. Close can stay, but as a text “Close” or a small ×, not a 42px target that competes with the code picker.
- iOS: keep capsules for chips if you want; do not use them for every Settings verb. Grouped rows already exist (`CodeSurface`).

**Always-on uppercase on the top bar** should go. Brand can stay lowercase `permitext`. Tools should be sentence case.

## iPhone: the library is beautiful; the chrome around it is timid

**Chapter tiles are the UI.** Protect them. Two problems:

1. `minHeight: 110` with a 28pt number and a wrapping 14pt title means some tiles become posters and some look empty. Cap title to 2–3 lines or give appendix/short chapters a compact variant.
2. “Reading started” is an 11pt `circle.inset.filled` in the corner. Invisible. A 2pt bar along the bottom of the tile, in the book color, would match the web progress bar.

**Two tile languages on adjacent tabs.** Search “Jump Back In” tiles are tall (caption stack + preview). Saved project tiles are a hard 57pt. Same 2×2 pager, different object. They should share one compact tile: book color strip, title, one line of meta.

**The tab bar is a row of unlabeled symbols** on ultra-thin material. Selected state is `appChrome` grey, 10pt if a title existed. Five icons, two of them twins, no words. Visually this is a music app with the labels stripped. If you keep five tabs, show titles. If you drop to three, the icons can stay.

**Bottom chrome is huge.** Saved reserves 104pt; Search reserves **168pt** so the dock and tab bar do not collide. That is a lot of dead canvas. The search field at the bottom is a valid pattern (Safari, Maps) but the stacked filter + field + tab bar becomes a slab. Collapse filters into one “Building Code ▾” control until they are needed.

**Browse vs everything else is a different app.** Browse: 32pt title, colored masonry, no card chrome. Search/Saved/Settings: 16pt title, fade overlay, grouped cards, hairlines. The fade (`ultraThinMaterial` + 86% black in dark) is heavy. A simple grouped background is enough.

**`CodeAppBackdrop` takes an `accent` and ignores it.** It is just `systemGroupedBackground`. Either use a whisper of the book color behind Browse, or delete the parameter. Dead API in the visual system is how drift starts.

**Settings is a stack of marketing blocks.** Checkmark rows, full-width capsules, cyan Pro, Sign in with Apple, then a reader preview that tries to look like code. The preview is the one piece that belongs. The rest should look like iOS Settings: rows, not landing-page cards.

## Web: the desk is right; the header is noise

The pane track is the product. The 55px header is doing too much in one strip:

Icons (Reader, Search, Projects, Research, reset, close-all) · workspace tabs · `+` · `•••` · gear · ONLINE pill · brand · plan

Visually that is three toolbars mashed into one. Recommended:

1. Left: `permitext`
2. Center or left-adjacent: four **words**
3. Right: Settings, and connection **only when it is not “Online”**

“ONLINE” as a 40px-tall pill, always, is status theater. Show Offline / Pending / Conflict. Hide healthy.

**Reader chrome floats over the page** (absolute header). Then: code picker, trust shield, hidden “Reader” title, Comments, A− A+, spacing, in-reader search, drag, close, plus a chapter/section stack underneath. That is a HUD, not a reader. Collapse typography into one “Aa”, trust into the picker, Comments into the note sheet. The code should start higher.

**Hidden scrollbars** are a visual choice that hurts the main object. A chapter is a long document. A 6–8px thumb on the reader only is enough. Do not hide document scroll.

**Mobile web already has a better chrome than desktop.** Five labeled tabs, icons + `data-mobile-label`, 10px names. Ironic: the phone web bar is more legible than the desktop bar. Desktop should steal that (words), not the other way around.

**`styles.css` is enormous** (reader, research, notebook, workboard, settings, mobile, overrides on overrides). That is why you get `!important` on panel titles, 14px `!important` on toolbar type, and notebook line-height locked with `!important`. The UI cannot stay consistent at that size. Visual cleanup is deleting unused surfaces, not adding a new token.

## Two readers, two interfaces

iPhone has a **chapter HTML WebView** and a **native section `ReaderView`**. They cannot look the same: one is authored HTML, one is SwiftUI blocks + notes + tags. Users will feel the seam (margins, type, how figures sit, whether there is a progress bar).

Make the **chapter reader** the visual standard (serif or New York, generous measure, figures full-bleed, progress bar) and make the section page a framed excerpt of that, not a different card layout.

Web is closer to one renderer, which is why the desk feels more like “a place to read.”

Default type should match across platforms. Today web starts readable; iPhone starts at 10pt.

## Contrast, hit targets, motion

- Secondary/tertiary greys on light grey fail WCAG for UI text.
- Dark-mode code accents go neon (`#FFB067`, `#67E8F9`, `#C4A1FF`). Good on a tile; harsh as filled chip text.
- Web icon-only buttons are 40px (ok). Some pane glyphs shrink to the title-row height, which is `11pt * 1.2` — too small.
- iOS header actions are sized to the 16pt title cap-height (~19px). That is a visual alignment trick that makes sort/export feel like footnote icons.
- Collapse-on-scroll scale/opacity on titles is leftover large-title theater for a 16pt label. Kill the animation.
- Focus styles are inconsistent: some 3px outlines, top-bar buttons `outline: 0`, inputs `outline: 0`. Keyboard users get a different product.

## What to get rid of visually

- Uppercase lock on the web top bar
- Always-visible Online pill
- 40/42px circular bordered icon buttons
- Cyan Pro
- Fully filled rainbow filter chips
- Tinted Search / Project / Research pane backgrounds
- Hidden panel titles (`display: none`)
- `--radius-panel: 28px` and other unused tokens
- Inset “gloss” on buttons
- Dual tile height systems
- 32pt-only-on-Browse title
- Title collapse animations
- `CodeAppBackdrop`’s unused accent
- Notebook/Workboard visual worlds (they pull in their own fonts and densities)
- Dark mode that paints every surface `#000`

## If tightening the interface, in order

1. **One type scale.** Root titles the same size on every iPhone tab. Web chrome 13–14pt, sentence case. Reader default ~16–17pt on both.
2. **One chrome, one accent.** Grey interface. Book color only on the open code and its tile.
3. **Quiet the web header.** Words, not pills. Status only when unhealthy.
4. **Starve the reader HUD.** One “Aa”, one search, one close. Code starts immediately.
5. **Show a scrollbar on the chapter.**
6. **Give dark mode two elevations.**
7. **Make Settings look like Settings**, not a paywall card stack.
8. **Align chapter tiles and recents tiles** to one compact object.

The UI does not need a new look. It needs to stop running three looks at once: the tile library, the uppercase desk, and the cyan/capsule store kit. Keep the tiles and the serif code. Make everything else get out of the way.
