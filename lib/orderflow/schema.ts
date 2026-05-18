import { z } from 'zod'

const orderflowWarningObjectSchema = z.object({
  field: z.string().nullable().default(null),
  message: z.string(),
  source_quote: z.string().nullable().default(null),
})

export const orderflowWarningSchema = z.preprocess((value) => {
  if (typeof value === 'string') {
    return {
      field: null,
      message: value,
      source_quote: null,
    }
  }
  return value
}, orderflowWarningObjectSchema)

export const orderflowWarningsSchema = z.preprocess((value) => {
  if (value === null || value === undefined) return []
  return Array.isArray(value) ? value : [value]
}, z.array(orderflowWarningSchema))

export const orderflowSourceValueSchema = <T extends z.ZodTypeAny>(valueSchema: T) =>
  z.object({
    value: valueSchema.nullable(),
    source_quote: z.string().nullable().default(null),
    warnings: orderflowWarningsSchema,
  })

export const orderflowOrderHeaderSchema = z.object({
  customer_name: orderflowSourceValueSchema(z.string()),
  customer_order_number: orderflowSourceValueSchema(z.string()),
  order_date: orderflowSourceValueSchema(z.string()),
  requested_delivery_date: orderflowSourceValueSchema(z.string()),
  delivery_address: orderflowSourceValueSchema(z.string()),
  currency: orderflowSourceValueSchema(z.string()),
})

export const orderflowOrderLineSchema = z.object({
  line_number: z.number().int().positive(),
  sku: orderflowSourceValueSchema(z.string()),
  sku_raw: orderflowSourceValueSchema(z.string()),
  description: orderflowSourceValueSchema(z.string()),
  quantity: orderflowSourceValueSchema(z.number()),
  unit_of_measure: orderflowSourceValueSchema(z.string()),
  unit_price: orderflowSourceValueSchema(z.number()),
  requested_delivery_date: orderflowSourceValueSchema(z.string()),
  raw_source_text: z.string().nullable().default(null),
  validation_status: z.enum(['unvalidated', 'matched', 'unmatched', 'ambiguous']).default('unvalidated'),
  validation_notes: z.string().nullable().default(null),
  _warnings: orderflowWarningsSchema,
})

export const orderflowExtractedOrderSchema = z.object({
  schema_version: z.literal('orderflow.v1').default('orderflow.v1'),
  header: orderflowOrderHeaderSchema,
  lines: z.array(orderflowOrderLineSchema),
  _warnings: orderflowWarningsSchema,
})

export const orderflowUploadResponseSchema = z.object({
  success: z.literal(true),
  document: z.object({
    id: z.string().uuid(),
    status: z.string(),
    original_filename: z.string(),
    mime_type: z.string(),
    file_path: z.string(),
    raw_text_available: z.boolean(),
    created_at: z.string(),
  }),
})

export type OrderflowWarning = z.infer<typeof orderflowWarningSchema>
export type OrderflowOrderHeader = z.infer<typeof orderflowOrderHeaderSchema>
export type OrderflowOrderLine = z.infer<typeof orderflowOrderLineSchema>
export type OrderflowExtractedOrder = z.infer<typeof orderflowExtractedOrderSchema>
export type OrderflowUploadResponse = z.infer<typeof orderflowUploadResponseSchema>
