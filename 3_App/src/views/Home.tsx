import { useEffect, useState } from 'react'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
  TableEmptyState,
} from 'counterfoil-starter-kit'

export type BookEntry = {
  filename: string
  title: string
  author: string
  lastUpdated: string
}

type HomeProps = {
  onSelectBook: (filename: string) => void
}

export default function Home({ onSelectBook }: HomeProps) {
  const [books, setBooks] = useState<BookEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchBooks = async () => {
      setLoading(true)
      try {
        const response = await fetch('/api/working-files/index')
        const data = await response.json()
        setBooks(data.books || [])
      } catch {
        setBooks([])
      } finally {
        setLoading(false)
      }
    }
    void fetchBooks()
  }, [])

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString()
    } catch {
      return iso
    }
  }

  return (
    <div
      className="flex h-full flex-col rounded-lg border-0 bg-white shadow-sm"
      data-component="Home"
    >
      <div className="p-4">
        <h1 className="text-lg font-semibold text-slate-800">Your Books</h1>
        <p className="mt-1 text-sm text-slate-500">
          Select a book to open in the reader.
        </p>
      </div>
      <div className="flex-1 overflow-auto px-4 pb-4">
        {loading ? (
          <div className="flex h-40 items-center justify-center text-sm text-slate-400">
            Loading…
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Book name</TableHeaderCell>
                <TableHeaderCell>Author</TableHeaderCell>
                <TableHeaderCell>Filename</TableHeaderCell>
                <TableHeaderCell>Last Updated</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {books.length === 0 ? (
                <TableEmptyState
                  colSpan={4}
                  title="No books yet"
                  description="Import an EPUB to get started."
                />
              ) : (
                books.map((book) => (
                  <TableRow
                    key={book.filename}
                    interactive
                    onClick={() => onSelectBook(book.filename)}
                  >
                    <TableCell>{book.title}</TableCell>
                    <TableCell>{book.author}</TableCell>
                    <TableCell>{book.filename}</TableCell>
                    <TableCell numeric>{formatDate(book.lastUpdated)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
