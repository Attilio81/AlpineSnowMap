import { useEffect, useState } from 'react'

export default function App() {
  const [theme, setTheme] = useState('dark')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  return <div style={{ height: '100vh' }}>AlpineSnowMap — theme: {theme}</div>
}
