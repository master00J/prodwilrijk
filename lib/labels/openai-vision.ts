// Gedeelde helper om labels via de OpenAI Chat Completions API (vision) te
// analyseren. Wordt gebruikt door de scan-label endpoints voor Prepack en Airtec
// als alternatief voor Claude Haiku, zodat we kunnen vergelijken welk model in
// de praktijk accurater is.

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
// gpt-5.4-mini = sneller/goedkoper reasoning model met goede vision-kwaliteit.
// Kan via env-var overschreven worden zonder code-deploy.
const OPENAI_MODEL = process.env.OPENAI_LABEL_MODEL || 'gpt-5.4-mini'

export async function callOpenAIVision(
  prompt: string,
  base64Image: string,
  mediaType: string
): Promise<unknown> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY niet geconfigureerd op de server')
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mediaType};base64,${base64Image}`,
                detail: 'high',
              },
            },
          ],
        },
      ],
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    const errBody = await response.text()
    throw new Error(`OpenAI API error ${response.status}: ${errBody}`)
  }

  const result = await response.json()
  const text: string = result.choices?.[0]?.message?.content || ''

  // response_format: json_object dwingt valid JSON af, maar sommige modellen
  // kunnen leading whitespace toevoegen — daarom regex-extract ter veiligheid.
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('OpenAI gaf geen geldige JSON terug')
  }

  return JSON.parse(jsonMatch[0])
}

export type LabelProvider = 'haiku' | 'gpt5'

export function isLabelProvider(value: unknown): value is LabelProvider {
  return value === 'haiku' || value === 'gpt5'
}
