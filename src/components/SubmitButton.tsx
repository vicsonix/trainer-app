'use client'

import { useFormStatus } from 'react-dom'
import Spinner from '@/components/Spinner'
import { Button } from '@/components/ui/button'

interface SubmitButtonProps {
  label: string
}

export default function SubmitButton({ label }: SubmitButtonProps) {
  const { pending } = useFormStatus()

  return (
    <Button
      type="submit"
      variant="gradient"
      disabled={pending}
      className="w-full min-h-[48px]"
    >
      {pending ? <Spinner /> : label}
    </Button>
  )
}
