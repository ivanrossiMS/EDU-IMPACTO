import re

with open('/Users/ivanrossi/Desktop/Documentos-Backup/Área de Trabalho/EDU-IMPACTO/impacto-edu-app/components/FloatingChat.tsx', 'r') as f:
    content = f.read()

# Add isMobile state
if 'const [isMobile' not in content:
    content = content.replace(
        'const [isOpen, setIsOpen] = useState(false)',
        'const [isOpen, setIsOpen] = useState(false)\n  const [isMobile, setIsMobile] = useState(false)\n  useEffect(() => {\n    const checkMobile = () => setIsMobile(window.innerWidth <= 768)\n    checkMobile()\n    window.addEventListener(\'resize\', checkMobile)\n    return () => window.removeEventListener(\'resize\', checkMobile)\n  }, [])'
    )

# Replace the div
old_div = '<div className="ad-floating-chat-container" style={{ position: \'fixed\', zIndex: 99999, display: \'flex\', flexDirection: \'column\', alignItems: \'flex-end\' }}>'
new_div = '<div className="ad-floating-chat-container" style={{ position: \'fixed\', bottom: isMobile ? 120 : 24, right: isMobile ? 16 : 24, zIndex: 99999, display: \'flex\', flexDirection: \'column\', alignItems: \'flex-end\', transition: \'bottom 0.3s, right 0.3s\' }}>'

content = content.replace(old_div, new_div)

with open('/Users/ivanrossi/Desktop/Documentos-Backup/Área de Trabalho/EDU-IMPACTO/impacto-edu-app/components/FloatingChat.tsx', 'w') as f:
    f.write(content)
