'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function GlobalFeedPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/feed?scope=global'); }, [router]);
  return null;
}
