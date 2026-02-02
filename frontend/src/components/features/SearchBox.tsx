import { useState } from 'react'
import { Icons } from '../icons/Icons'
import './SearchBox.css'

interface SearchBoxProps {
  placeholder?: string
  onSearch?: (query: string) => void
}

export function SearchBox({ placeholder = 'Enter symbol (e.g., VCB, VIC, FPT...)', onSearch }: SearchBoxProps) {
  const [query, setQuery] = useState('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)
    onSearch?.(value)
  }

  return (
    <div className="search-box">
      <Icons.Search />
      <input
        type="text"
        className="form-input"
        placeholder={placeholder}
        value={query}
        onChange={handleChange}
      />
    </div>
  )
}
