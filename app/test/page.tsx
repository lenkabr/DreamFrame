import { notFound } from 'next/navigation';
import TestPageClient from './TestPageClient';

export default function TestPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <TestPageClient />;
}
