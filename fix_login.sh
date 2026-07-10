sed -i '' -e '/export default function LoginPage/i\
const ModernLoadingSpinner = () => (\
  <div style={{ width: 64, height: 64, borderRadius: 20, background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>\
    <div style={{ width: 24, height: 24, border: "3px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 1s linear infinite" }} />\
    <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>\
  </div>\
);\
' app/login/page.tsx
