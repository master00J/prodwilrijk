'use client'

import { TvDisplay } from '../TvDisplayContent'

export default function TvDisplaySlugPage({ params }: { params: { slug: string } }) {
  return <TvDisplay screenSlug={params.slug} />
}
