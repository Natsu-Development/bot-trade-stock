import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Icons } from '../icons/Icons'

interface SearchBoxProps {
  placeholder?: string
  onSearch?: (query: string) => void
}

export function SearchBox({
  placeholder = 'Enter symbol (e.g., VCB, VIC, FPT...)',
  onSearch
}: SearchBoxProps) {
  const [query, setQuery] = useState('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)
    onSearch?.(value)
  }

  return (
    <Input
      type="text"
      placeholder={placeholder}
      value={query}
      onChange={handleChange}
      startIcon={<Icons.Search className="w-[18px] h-[18px]" />}
      inputContainerClassName="w-full !mb-0"
      className="py-3"
    />
  )
}
