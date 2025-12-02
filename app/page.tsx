import Link from 'next/link'

export default function Home() {
  return (
    <div className="container mx-auto px-4 py-16">
      <h1 className="text-4xl font-bold mb-8">Prodwilrijk V2</h1>
      <div className="space-y-4">
        <Link
          href="/prepack"
          className="block px-6 py-4 bg-green-500 text-white rounded-lg hover:bg-green-600 text-xl font-medium"
        >
          1. Prepack - Excel Upload
        </Link>
        <Link
          href="/view-prepack"
          className="block px-6 py-4 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-xl font-medium"
        >
          2. View Prepack - Confirm Items
        </Link>
        <Link
          href="/items-to-pack"
          className="block px-6 py-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-xl font-medium"
        >
          3. Items to Pack
        </Link>
        <Link
          href="/packed-items"
          className="block px-6 py-4 bg-purple-500 text-white rounded-lg hover:bg-purple-600 text-xl font-medium"
        >
          4. Packed Items
        </Link>
      </div>
    </div>
  )
}

