'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

function validateContent(brand: string, content: string) {
    const lowerContent = content.toLowerCase();

    if (brand === 'WSWD') {
        if (!lowerContent.includes('watchdogs')) {
            throw new Error('Wall Street Watchdogs messages must contain the word "Watchdogs".');
        }
    } else if (brand === 'TA') {
        if (!lowerContent.includes("trader's alley") && !lowerContent.includes("traders alley")) {
            throw new Error('Trader\'s Alley messages must contain the phrase "Trader\'s Alley".');
        }
    }
}

export async function createMessage(formData: FormData) {
    const content = formData.get('content') as string;
    const brand = formData.get('brand') as string;
    const name = (formData.get('name') as string)?.trim();
    const cooldown = parseInt(formData.get('cooldown') as string) || 14;

    if (!content || !brand) {
        throw new Error('Content and brand are required');
    }

    // Name is now required
    if (!name) {
        throw new Error('Message name is required');
    }

    // Content Validation
    validateContent(brand, content);

    // Check for uniqueness
    const existing = await prisma.message.findUnique({
        where: { name }
    });

    if (existing) {
        throw new Error(`A message with the name "${name}" already exists. Please choose a unique name.`);
    }

    await prisma.message.create({
        data: {
            content,
            name,
            brand,
            cooldownDays: cooldown,
            active: true
        }
    });

    revalidatePath('/messages');
}

export async function updateMessage(id: number, formData: FormData) {
    const content = formData.get('content') as string;
    const brand = formData.get('brand') as string;
    // Name is intentionally NOT updated - it's immutable after creation
    const cooldown = parseInt(formData.get('cooldown') as string) || 14;

    // Content Validation
    validateContent(brand, content);

    await prisma.message.update({
        where: { id },
        data: {
            content,
            // name is omitted - immutable
            brand,
            cooldownDays: cooldown
        }
    });

    revalidatePath('/messages');
}

export async function deleteMessage(id: number) {
    // Soft Delete: Set active = false
    await prisma.message.update({
        where: { id },
        data: { active: false }
    });
    revalidatePath('/messages');
}
