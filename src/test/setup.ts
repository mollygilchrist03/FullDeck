// Extends Vitest's `expect` with jest-dom matchers (toBeDisabled, toBeVisible, …)
// for component tests. Harmless to load for plain-Node logic tests too — the
// matchers only touch `document` when a test actually calls one.
import '@testing-library/jest-dom/vitest'
