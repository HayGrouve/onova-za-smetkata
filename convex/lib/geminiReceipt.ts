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
                text: `Extract line items from this restaurant receipt. The receipt may be in any language printed on the paper; amounts in EUR. Return purchasable food/drink items only. EXCLUDE totals, tax (ДДС/VAT), tips (бакшиш), payment lines. Default quantity 1. Prices as EUR decimals in unitPriceEur. If a grand total is visible, set receiptTotalEur as EUR decimal (e.g. 328.21), not cents.

Write each item name in English only. Do not include the original wording in parentheses. Use the common English menu name when one exists; otherwise a short descriptive translation. Keep brand names as printed. Translate each line independently on mixed-language receipts. Leave restaurantName exactly as printed.

quantity is how many identical units were ordered. Do not put the order count in name. Keep serving size and distinguishing size words in name (dish first, then size). Keep the size number as printed; write metric units in Latin (л→l, мл→ml, гр/г→g, кг→kg). Do not convert 0.5л to 500ml or to imperial units. Drop generic portion marks (порц., порция) that do not distinguish the dish. Drop opaque kitchen or POS codes. Expand truncated or abbreviated dish words into the English name when recognizable.

If the printed line is unreadable and a usable price exists, set name to exactly "Unknown item" and confidence "low". Do not invent a price to keep a row. If the line is readable but the English name is a guess, write the short English guess and set confidence "low". Also mark confidence "low" when price or quantity is uncertain. Use confidence "high" only when the printed line is readable, the English name is confident, and price and quantity are not uncertain.`,
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
