import Link from 'next/link'

export default function Home() {
  return (
    <div className="container mx-auto px-4 py-16">
      <h1 className="text-4xl font-bold mb-8">Prodwilrijk V2</h1>
      <div className="space-y-4">
        <Link
          href="/items-to-pack"
          className="block px-6 py-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-xl font-medium"
        >
          Items to Pack
        </Link>
      </div>
    </div>
  )
}

