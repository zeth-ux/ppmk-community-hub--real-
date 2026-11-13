import { Navigate, useLocation } from 'react-router-dom'

/** Old address: the organisation page now lives at /ppmk. Keeps old links working. */
export default function AboutPage() {
  const { hash } = useLocation()
  return <Navigate to={`/ppmk${hash}`} replace />
}
