"use client";

import React from 'react';
import AddInstanceBuilder from '@/components/add-instance/AddInstanceBuilder';
import { useRouter } from 'next/navigation';

export default function AddInstancePage() {
    const router = useRouter();
    return <AddInstanceBuilder onBack={() => router.back()} />;
}

