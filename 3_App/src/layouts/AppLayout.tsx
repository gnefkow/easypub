import { useEffect, useState, type ReactNode } from 'react'

type AppLayoutProps = {
  header: ReactNode
  leftSidebar: ReactNode | null
  rightSidebar: ReactNode | null
  children: ReactNode
  showComponents?: boolean
}

export default function AppLayout({
  header,
  leftSidebar,
  rightSidebar,
  children,
  showComponents = false,
}: AppLayoutProps) {
  const [componentPath, setComponentPath] = useState('')

  useEffect(() => {
    if (!showComponents) {
      setComponentPath('')
      return
    }
    const handleMove = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) {
        setComponentPath('')
        return
      }
      const names: string[] = []
      let node: HTMLElement | null = target
      while (node) {
        const name = node.getAttribute('data-component')
        if (name) {
          names.push(name)
        }
        node = node.parentElement
      }
      const unique = Array.from(new Set(names)).reverse()
      setComponentPath(unique.join(' > '))
    }
    window.addEventListener('mousemove', handleMove)
    return () => window.removeEventListener('mousemove', handleMove)
  }, [showComponents])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-uiTypeface">
      {header}
      <main className="mx-auto flex h-[calc(100vh-80px)] max-w-7xl gap-6 px-6 py-6">
        {leftSidebar}
        <div className="flex-1 h-full">{children}</div>
        {rightSidebar}
      </main>
      {showComponents && componentPath && (
        <div className="fixed bottom-4 right-4 z-50 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-lg">
          {componentPath}
        </div>
      )}
    </div>
  )
}
