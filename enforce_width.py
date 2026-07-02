import re

with open('components/simulados/PageContent.tsx', 'r') as f:
    content = f.read()

# For full block:
content = content.replace("maxWidth: effectiveWidth ? `${effectiveWidth}px` : '100%'", "width: effectiveWidth ? `${effectiveWidth}px` : '100%'")

with open('components/simulados/PageContent.tsx', 'w') as f:
    f.write(content)
print("done")
