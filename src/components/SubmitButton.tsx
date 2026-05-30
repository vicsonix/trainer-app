'use client'

import { useFormStatus } from 'react-dom'
import Spinner from '@/components/Spinner'

interface SubmitButtonProps {
  label: string
}

export default function SubmitButton({ label }: SubmitButtonProps) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="flex items-center justify-center gap-2 w-full min-h-[48px] rounded-lg bg-gradient-to-r from-lobster-pink-500 to-lobster-pink-600 hover:from-lobster-pink-600 hover:to-lobster-pink-700 text-white font-medium shadow-sm disabled:opacity-60 transition-all"
    >
      {pending ? <Spinner /> : label}
    </button>
  )
}
