import { ReactNode } from 'react'
import './Table.css'

interface TableProps {
  headers: Array<string | ReactNode>
  children: ReactNode
}

export function Table({ headers, children }: TableProps) {
  return (
    <div className="table-container">
      <table className="table">
        <thead>
          <tr>
            {headers.map((header, i) => (
              <th key={i}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}
