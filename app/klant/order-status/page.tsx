import { redirect } from 'next/navigation'

/** Oude URL; canonical: /atlas/order-status */
export default function KlantOrderStatusRedirectPage() {
  redirect('/atlas/order-status')
}
