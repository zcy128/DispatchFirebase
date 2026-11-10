import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Stats from './components/Stats'
import EcosystemShowcase from './components/EcosystemShowcase'
import EditionsSection from './components/EditionsSection'
import HighlightsSection from './components/HighlightsSection'
import DemoAccessSection from './components/DemoAccessSection'
import About from './components/About'
import Contact from './components/Contact'
import Footer from './components/Footer'
import { LanguageProvider } from './i18n/LanguageContext'

function App() {
  return (
    <LanguageProvider>
      <Navbar />
      <main>
        <Hero />
        <Stats />
        <EcosystemShowcase />
        <EditionsSection />
        <HighlightsSection />
        <DemoAccessSection />
        <About />
        <Contact />
      </main>
      <Footer />
    </LanguageProvider>
  )
}

export default App
