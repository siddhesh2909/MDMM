'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CollaborationIndexPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/collaboration/direct-messages');
    }, [router]);

    return null;
}
