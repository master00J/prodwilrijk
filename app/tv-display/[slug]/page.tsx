'use client'

import { use } from 'react'
import TvDisplayPage from '../page'

export default function TvDisplaySlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  return <TvDisplayPage screenSlug={slug} />
}
