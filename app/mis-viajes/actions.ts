'use server'

import { getDriverAppPoolStatus } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'

export async function getPoolStatusAction(poolId: string) {
  try {
    return await getDriverAppPoolStatus(poolId)
  } catch (error: any) {
    console.error("Error in getPoolStatusAction Server Action:", error)
    throw new Error(error.message || "Failed to fetch status")
  }
}

export async function saveProfileAction(formData: FormData) {
  const { userId } = await auth()
  if (!userId) throw new Error("No autenticado")

  const fullName = formData.get('fullName') as string
  const phone = formData.get('phone') as string
  const companyCode = formData.get('companyCode') as string

  if (!fullName || fullName.trim().length < 3) {
    throw new Error("El nombre completo debe tener al menos 3 caracteres.")
  }
  if (!phone || phone.trim().length < 6) {
    throw new Error("El teléfono ingresado es inválido.")
  }

  await prisma.passenger.upsert({
    where: { clerk_user_id: userId },
    update: {
      full_name: fullName.trim(),
      phone: phone.trim(),
      company_code: companyCode?.trim() || null
    },
    create: {
      clerk_user_id: userId,
      full_name: fullName.trim(),
      phone: phone.trim(),
      company_code: companyCode?.trim() || null
    }
  })

  revalidatePath('/')
  revalidatePath('/mis-viajes')
  revalidatePath('/reservar')
}
