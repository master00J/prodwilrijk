'use client'

import { use } from 'react'
import { TvDisplay } from '../page'

export default function TvDisplaySlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  return <TvDisplay screenSlug={slug} />
}
