const fs = require('fs');

let code = fs.readFileSync('app/agenda-digital/components/agenda/NovoComunicadoModal.tsx', 'utf8');

// 1. Update container styles
code = code.replace(/width: 100vw;\s*height: 100dvh;\s*background: #F8FAFC;\s*display: flex;\s*flex-direction: column;\s*position: relative;/g, 
  "width: 100%;\n          height: 100%;\n          background: #F8FAFC;\n          display: flex;\n          flex-direction: column;\n          position: absolute;\n          top: 0;\n          left: 0;\n          z-index: 99999;");

// Update desktop media query to restore relative positioning for centering
code = code.replace(/max-width: 900px;\s*height: 92vh;/g, 
  "max-width: 900px;\n            height: 92vh;\n            position: relative;\n            top: auto;\n            left: auto;");

// 2. Update Header CSS
const oldHeaderCSS = `        .ad-nc-header {
          height: 72px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 20px;
          background: #FFFFFF;
          border-bottom: 1px solid #E2E8F0;
          flex-shrink: 0;
          z-index: 10;
        }`;
const newHeaderCSS = `        @keyframes waveAnimation {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .ad-nc-header {
          height: 72px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 20px;
          background: linear-gradient(120deg, #6D5DF6, #4F46E5, #8B5CF6, #3B82F6);
          background-size: 300% 300%;
          animation: waveAnimation 8s ease infinite;
          border-bottom: 1px solid rgba(255,255,255,0.2);
          flex-shrink: 0;
          z-index: 10;
          color: white;
        }`;
code = code.replace(oldHeaderCSS, newHeaderCSS);

// 3. Update Footer CSS
code = code.replace(/grid-template-columns: 1fr 1fr;/g, "grid-template-columns: 1fr 1fr 1.3fr;");
code = code.replace(/padding: 12px 20px;/g, "padding: 12px 16px;");
code = code.replace(/height: 72px;/g, "height: 80px;");
code = code.replace(/padding: 24px 20px 100px 20px;/g, "padding: 24px 20px 110px 20px;");

// 4. Update Header JSX
const oldHeaderJSX = `<div className="ad-nc-header">
          <button 
            onClick={onClose}
            style={{ 
              width: 40, height: 40, borderRadius: 20, border: 'none', 
              background: '#F1F5F9', color: '#64748B', display: 'flex', 
              alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#E2E8F0'}
            onMouseLeave={e => e.currentTarget.style.background = '#F1F5F9'}
          >
            <X size={20} />
          </button>
          
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', margin: 0 }}>{initialData ? 'Editar Comunicado' : 'Novo Comunicado'}</h2>
            <p style={{ fontSize: 12, color: '#64748B', margin: 0, fontWeight: 500 }}>Envie um comunicado para sua escola</p>
          </div>
          
          <button className="ad-nc-btn-send" onClick={() => handleAction(false)}>
            {isUploading ? (
              <div style={{ width: 18, height: 18, borderRadius: 9, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 1s linear infinite' }} />
            ) : (
              <SendIcon size={18} fill="currentColor" />
            )}
          </button>
        </div>`;
const newHeaderJSX = `<div className="ad-nc-header">
          <div style={{ width: 40 }} />
          
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#fff', margin: 0 }}>{initialData ? 'Editar Comunicado' : 'Novo Comunicado'}</h2>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', margin: 0, fontWeight: 500 }}>Envie um comunicado para sua escola</p>
          </div>
          
          <button 
            onClick={onClose}
            style={{ 
              width: 40, height: 40, borderRadius: 20, border: 'none', 
              background: 'rgba(255,255,255,0.2)', color: '#fff', display: 'flex', 
              alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              transition: 'all 0.2s', backdropFilter: 'blur(4px)'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
          >
            <X size={20} />
          </button>
        </div>`;
code = code.replace(oldHeaderJSX, newHeaderJSX);

// 5. Update Footer JSX
const oldFooterJSX = `<div className="ad-nc-footer">
          <button 
            className="ad-nc-footer-btn ad-nc-btn-secondary" 
            onClick={() => {
              if (!dataAgendamento) {
                 const nowLocal = new Date();
                 nowLocal.setHours(nowLocal.getHours() + 24);
                 const localString = nowLocal.getFullYear() + '-' + 
                   String(nowLocal.getMonth() + 1).padStart(2, '0') + '-' + 
                   String(nowLocal.getDate()).padStart(2, '0') + 'T' + 
                   String(nowLocal.getHours()).padStart(2, '0') + ':' + 
                   String(nowLocal.getMinutes()).padStart(2, '0');
                 setTempAgendamento(localString);
              } else {
                 setTempAgendamento(dataAgendamento);
              }
              setShowScheduleModal(true);
            }}
          >
            <Calendar size={18} color="#6D5DF6" />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ color: '#0F172A' }}>{dataAgendamento ? 'Agendado' : 'Agendar'}</span>
              <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 500 }}>
                {dataAgendamento ? new Date(dataAgendamento).toLocaleDateString('pt-BR') : 'Programar envio'}
              </span>
            </div>
          </button>

          <button 
            className="ad-nc-footer-btn ad-nc-btn-secondary" 
            onClick={() => handleAction(true)}
          >
            <Save size={18} color="#64748B" />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ color: '#0F172A' }}>Salvar rascunho</span>
              <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 500 }}>Salvar para depois</span>
            </div>
          </button>
        </div>`;

const newFooterJSX = `<div className="ad-nc-footer">
          <button 
            className="ad-nc-footer-btn ad-nc-btn-secondary" 
            style={{ flexDirection: 'column', gap: 4 }}
            onClick={() => handleAction(true)}
          >
            <Save size={18} color="#64748B" />
            <span style={{ color: '#0F172A', fontSize: 12 }}>Rascunho</span>
          </button>

          <button 
            className="ad-nc-footer-btn ad-nc-btn-secondary" 
            style={{ flexDirection: 'column', gap: 4 }}
            onClick={() => {
              if (!dataAgendamento) {
                 const nowLocal = new Date();
                 nowLocal.setHours(nowLocal.getHours() + 24);
                 const localString = nowLocal.getFullYear() + '-' + 
                   String(nowLocal.getMonth() + 1).padStart(2, '0') + '-' + 
                   String(nowLocal.getDate()).padStart(2, '0') + 'T' + 
                   String(nowLocal.getHours()).padStart(2, '0') + ':' + 
                   String(nowLocal.getMinutes()).padStart(2, '0');
                 setTempAgendamento(localString);
              } else {
                 setTempAgendamento(dataAgendamento);
              }
              setShowScheduleModal(true);
            }}
          >
            <Calendar size={18} color="#6D5DF6" />
            <span style={{ color: '#0F172A', fontSize: 12 }}>{dataAgendamento ? 'Agendado' : 'Agendar'}</span>
          </button>
          
          <button 
            className="ad-nc-footer-btn" 
            style={{
              background: 'linear-gradient(135deg, #6D5DF6 0%, #8B5CF6 100%)',
              color: 'white', border: 'none', boxShadow: '0 4px 12px rgba(109, 93, 246, 0.3)'
            }}
            onClick={() => handleAction(false)}
          >
            {isUploading ? (
              <div style={{ width: 18, height: 18, borderRadius: 9, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 1s linear infinite' }} />
            ) : (
              <SendIcon size={18} fill="currentColor" />
            )}
            <span>Enviar</span>
          </button>
        </div>`;
code = code.replace(oldFooterJSX, newFooterJSX);

fs.writeFileSync('app/agenda-digital/components/agenda/NovoComunicadoModal.tsx', code);
