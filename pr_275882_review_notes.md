# PR #275882 review notes — Workflow Template Library catalog UI

Working notes for shepherding elastic/kibana#275882 and elastic/kibana#276229 to merge for 9.5.
Source: thermo-nuclear-code-quality-review + /deslop passes, cross-checked manually against the code and PR description.

## Status

- [x] Blocker: `filter_catalog.ts` duplicates/diverges from `library_service.ts`'s `filterTemplates` — commented inline, left as follow-up (not fixed in this PR). https://github.com/elastic/kibana/pull/275882#discussion_r3525039880
- [x] Blocker: `TypeIcon` reimplemented `StepIcon`'s icon resolution — fixed by extracting `resolveRegisteredStepIcon` into `kbn-workflows-ui`. Commit b7ba7d0, pushed to semd/kibana workflows/catalog-browser-ui. Thread resolved: https://github.com/elastic/kibana/pull/275882#discussion_r3525046604
- [ ] ~~"Blocker": `library_fetcher.ts` defaults to staging CDN URL~~ — FALSE POSITIVE. Explicitly documented as deliberate/temporary in a `TODO` comment above `DEFAULT_LIBRARY_REGISTRY_URL` and in the PR's own `[!NOTE]`. Do not comment on this.
- [ ] High: bootstrap deep links default `libraryEnabled` to `true` while the uiSetting defaults to `false` (`deep_links.ts` line 31, `plugin.ts` line 112) — reviewed, decided **not interesting**, skipping.
- [x] High: facet counts ignore active solution filter (`catalog_browser.tsx`, `category_facets.tsx`) — fixed via `facetScopedTemplates` memo (scoped by search + solution, not category). Commit 920ab6c, pushed to semd/kibana workflows/catalog-browser-ui. Thread resolved: https://github.com/elastic/kibana/pull/275882#discussion_r3525113187
- [ ] High: `eslint-disable-next-line react-hooks/exhaustive-deps` in `use_catalog.ts` (~39-42) — not yet reviewed.
- [ ] High: `CatalogBrowser` doc says "only depends on core services" but `TypeIcon` requires `WorkflowsUiServicesProvider` — not yet reviewed.
- [ ] High: comments claim library routes are gated when they're always registered (page-level `<Redirect>` gates instead) — not yet reviewed.

## Medium (not yet reviewed)

1. Client API exposes `GetCatalogParams`/`getCatalog(params)` that `useCatalog` never uses (always fetches all, filters client-side).
2. Filter contract mismatch: client `categories` is an array (OR), server `category` is a single string.
3. Trigger icon resolution split: `TypeIcon` uses bare types + `bolt` default + extension override; `getTriggerTypeIconType` uses `trigger_*` prefix + `info` default, no extension override. (Confirmed NOT a duplicate — different behavior, intentional per investigation, but worth a comment noting the split so a third trigger surface doesn't guess wrong.)
4. `@kbn/workflows-ui` now hard-depends on `@kbn/triggers-actions-ui-plugin` and `@kbn/workflows-extensions` — heavier package boundary than "shared UI".
5. Duplicated library-enabled gate + redirect in both `catalog_browser.tsx` and `template_detail.tsx` page wrappers.
6. `buildTemplate` test fixture copy-pasted across 4 test files.
7. Category label inconsistency: facets humanize kebab-case ids, template card badges show raw ids.
8. `useCatalog` return shape mixes react-query `data` with `allTemplates` (redundant) and filtered `templates`.
9. `WorkflowsUiServicesProvider` is passed the full services object relying on structural typing instead of an explicit `{ workflowsExtensions, triggersActionsUi }` pick.
10. `SOLUTION_ID_MAP` (chrome nav id → catalog solution vocabulary) is ad-hoc/inline, could be centralized.

## Low (not yet reviewed)

1. Over-memoization of static-ish JSX in `TemplateCard`.
2. Missing component tests for `category_facets.tsx`, `solution_filter.tsx`, `catalog_template_icons.tsx`.
3. Duplicated page title i18n strings between `catalog_browser.tsx` and `template_detail.tsx` pages.
4. Every step/trigger icon gets its own `EuiToolTip` on dense cards, possible a11y/perf nit.
5. `use_connector_type_decorations_additional.test.ts` mocks the entire `@kbn/workflows-ui` package for one function.

## Reference

- PR: https://github.com/elastic/kibana/pull/275882
- Second PR (template preview, draft, branched off this one): https://github.com/elastic/kibana/pull/276229
- Diff snapshot used for the review: `/tmp/pr275882_updated.diff` (local scratch, not committed)
- Review worktree: `/private/tmp/kibana-pr-275882-review` (branch `tal/library-empty-state-cta`, tracks semd/kibana `workflows/catalog-browser-ui`)
