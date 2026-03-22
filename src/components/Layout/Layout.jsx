/**
 * Layout.jsx — ThermalBharat Part 8A
 * ====================================
 * Shared page wrapper: Navbar + children + StatusBar
 * All page-specific content goes inside <Layout>.
 */

import Navbar  from '../Navbar/Navbar'
import StatusBar from '../Dashboard/StatusBar'

export default function Layout({ children, navbarProps }) {
  return (
    <div className="layout-shell">
      <Navbar {...navbarProps} />
      <main className="layout-body">
        {children}
      </main>
      <StatusBar />
    </div>
  )
}
