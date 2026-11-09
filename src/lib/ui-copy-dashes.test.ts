import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { CLAIM_MESSAGES } from '../../shared/claim-messages.ts'
import { COMBINED_PAYMENT_MESSAGES } from '../../shared/combined-payment-messages.ts'
import { GUEST_FLOW_MESSAGES } from '../../shared/guest-flow-messages.ts'
import * as hostOnboardingMessages from '../../shared/host-onboarding-messages.ts'
import {
  HOST_FREE_PLAN_SUMMARY,
  HOST_PRO_DISCLOSURES,
  HOST_PRO_PLANS,
} from '../../shared/host-pro-plans.ts'
import { RECEIPT_IMAGE_MESSAGES } from '../../shared/receipt-image.ts'
import { SUBSCRIPTION_MESSAGES } from '../../shared/subscription-messages.ts'
import * as destructiveActionCopy from './destructive-action-copy.ts'
import { buildHomeHead, buildJoinShareHead } from './site-meta.ts'

const DASH = /[–—]/

const ROOT = join(import.meta.dirname, '..', '..')

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value)
  else if (typeof value === 'function') {
    // Copy getters take a name or a count; either reads fine as text.
    collectStrings((value as (arg: string) => unknown)('Иван'), out)
  } else if (value && typeof value === 'object') {
    for (const inner of Object.values(value)) collectStrings(inner, out)
  }
  return out
}

function sourceFiles(dir: string): string[] {
  return readdirSync(join(ROOT, dir), {
    recursive: true,
    encoding: 'utf8',
  })
    .filter((file) => /\.tsx?$/.test(file))
    .filter((file) => !/\.test\.tsx?$/.test(file))
    .map((file) => join(dir, file).split('\\').join('/'))
    .filter((file) => !file.startsWith('convex/_generated/'))
    .filter((file) => file !== 'src/routeTree.gen.ts')
}

/** String literals, template text and JSX text: what can reach a screen. Comments are skipped. */
function textWithDashes(file: string): string[] {
  const path = join(ROOT, file)
  const source = ts.createSourceFile(
    path,
    readFileSync(path, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
  const found: string[] = []
  const visit = (node: ts.Node) => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node) ||
      ts.isJsxText(node)
    ) {
      if (DASH.test(node.text)) {
        const { line } = source.getLineAndCharacterOfPosition(node.getStart())
        found.push(`${relative(ROOT, path)}:${line + 1}: ${node.text.trim()}`)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

describe('UI copy', () => {
  it('keeps em and en dashes out of the copy modules', () => {
    const copy = collectStrings([
      CLAIM_MESSAGES,
      COMBINED_PAYMENT_MESSAGES,
      GUEST_FLOW_MESSAGES,
      hostOnboardingMessages,
      HOST_FREE_PLAN_SUMMARY,
      HOST_PRO_DISCLOSURES,
      HOST_PRO_PLANS,
      RECEIPT_IMAGE_MESSAGES,
      SUBSCRIPTION_MESSAGES,
      destructiveActionCopy,
      buildHomeHead('https://example.test'),
      buildJoinShareHead('b1', 'https://example.test'),
    ])

    expect(copy.length).toBeGreaterThan(50)
    expect(copy.filter((text) => DASH.test(text))).toEqual([])
  })

  it('keeps em and en dashes out of every string in src, shared and convex', () => {
    const files = [
      ...sourceFiles('src'),
      ...sourceFiles('shared'),
      ...sourceFiles('convex'),
    ]

    expect(files.length).toBeGreaterThan(100)
    expect(files.flatMap(textWithDashes)).toEqual([])
  })

  it('keeps em and en dashes out of the web app manifest', () => {
    const manifest = readFileSync(join(ROOT, 'public/manifest.json'), 'utf8')
    expect(manifest).not.toMatch(DASH)
  })
})
