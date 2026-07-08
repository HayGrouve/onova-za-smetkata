// gemini-2.0-flash was shut down 2026-06-01; override via GEMINI_MODEL in Convex env if needed.
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-3.5-flash'

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    restaurantName: { type: 'string' },
    receiptTotalEur: { type: 'number' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          unitPriceEur: { type: 'number' },
          quantity: { type: 'number' },
          confidence: { type: 'string', enum: ['high', 'low'] },
        },
        required: ['name', 'unitPriceEur', 'quantity', 'confidence'],
      },
    },
  },
  required: ['items'],
}

interface GeminiRawItem {
  name: string
  unitPriceEur: number
  quantity: number
  confidence: 'high' | 'low'
}

interface GeminiRawResponse {
  restaurantName?: string
  receiptTotalEur?: number
  items: GeminiRawItem[]
}

export interface ScannedReceiptItem {
  name: string
  unitPriceCents: number
  quantity: number
  confidence: 'high' | 'low'
}

export interface ScannedReceiptResult {
  restaurantName?: string
  receiptTotalCents?: number
  items: ScannedReceiptItem[]
}

export async function scanReceiptImage(
  apiKey: string,
  imageBase64: string,
  mimeType: string,
): Promise<ScannedReceiptResult> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Extract line items from this restaurant receipt. Receipt may be Bulgarian (Cyrillic) or English; amounts in EUR. Return purchasable food/drink items only. EXCLUDE totals, tax (ДДС/VAT), tips (бакшиш), payment lines. Default quantity 1. Mark uncertain lines confidence "low". Prices as EUR decimals in unitPriceEur. If a grand total is visible, set receiptTotalEur as EUR decimal (e.g. 328.21), not cents.`,
              },
              { inline_data: { mime_type: mimeType, data: imageBase64 } },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
    },
  )
  if (!response.ok) {
    throw new Error(
      `Gemini API error: ${response.status} ${await response.text()}`,
    )
  }
  const json = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Empty Gemini response')
  const parsed = JSON.parse(text) as GeminiRawResponse
  return {
    restaurantName: parsed.restaurantName,
    receiptTotalCents:
      parsed.receiptTotalEur !== undefined
        ? Math.round(parsed.receiptTotalEur * 100)
        : undefined,
    items: parsed.items.map((i) => ({
      name: i.name.trim(),
      unitPriceCents: Math.round(i.unitPriceEur * 100),
      quantity: Math.max(1, Math.round(i.quantity)),
      confidence: i.confidence === 'low' ? 'low' : 'high',
    })),
  }
}
