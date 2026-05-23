import re

# 1. Fix ad-mobile-nav-bar width
with open('/Users/ivanrossi/Desktop/Documentos-Backup/Área de Trabalho/EDU-IMPACTO/impacto-edu-app/app/agenda-digital/[slug]/layout.tsx', 'r') as f:
    layout_content = f.read()

layout_content = layout_content.replace(
    "right: 0,",
    "right: 0,\n        width: '100vw',"
)

with open('/Users/ivanrossi/Desktop/Documentos-Backup/Área de Trabalho/EDU-IMPACTO/impacto-edu-app/app/agenda-digital/[slug]/layout.tsx', 'w') as f:
    f.write(layout_content)

# 2. Fix FloatingChat caching and JS window width issue
with open('/Users/ivanrossi/Desktop/Documentos-Backup/Área de Trabalho/EDU-IMPACTO/impacto-edu-app/components/FloatingChat.tsx', 'r') as f:
    fc_content = f.read()

# Remove isMobile
fc_content = re.sub(r'const \[isMobile, setIsMobile\] = useState\(false\)\n\s*useEffect\(\(\) => \{\n.*?\}, \[\]\)', '', fc_content, flags=re.DOTALL)

# Replace div with pure CSS
old_div = '<div className="ad-floating-chat-container" style={{ position: \'fixed\', bottom: isMobile ? 120 : 24, right: isMobile ? 16 : 24, zIndex: 99999, display: \'flex\', flexDirection: \'column\', alignItems: \'flex-end\', transition: \'bottom 0.3s, right 0.3s\' }}>'

new_div = '''<style dangerouslySetInnerHTML={{__html: `
        .ad-floating-btn-v2 { bottom: 24px; right: 24px; transition: bottom 0.3s, right 0.3s; }
        @media (max-width: 768px) {
          .ad-floating-btn-v2 { bottom: 120px !important; right: 16px !important; }
        }
      `}} />
      <div className="ad-floating-btn-v2" style={{ position: 'fixed', zIndex: 99999, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>'''

fc_content = fc_content.replace(old_div, new_div)

with open('/Users/ivanrossi/Desktop/Documentos-Backup/Área de Trabalho/EDU-IMPACTO/impacto-edu-app/components/FloatingChat.tsx', 'w') as f:
    f.write(fc_content)

