'use client'
import { performLogout } from "@/lib/auth/logout";
import { useData } from '@/lib/dataContext'
import { memo, useCallback } from 'react'
import { useApp } from '@/lib/context'
import { getInitials } from '@/lib/utils'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import { createPortal } from 'react-dom'
import { Bell, AlertTriangle, Calendar, ChevronRight, Users, Briefcase, ShieldAlert, Sparkles, Loader2, LogOut, ArrowLeft, ShieldCheck, GraduationCap } from 'lucide-react'
import { LoadingGlass } from '@/components/LoadingGlass'
import { ImpactoLoader } from '@/components/ui/ImpactoLoader'
import { hideSplashScreen } from '@/lib/capacitor/splash'

// Helper function to abbreviate Portuguese surnames to fit single line
function formatShortName(name: string): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 2) return name;
  
  const connectors = ['de', 'da', 'do', 'dos', 'das', 'e'];
  
  let firstName = parts[0];
  let startIndex = 1;
  
  if (parts[1] && !connectors.includes(parts[1].toLowerCase()) && parts[1][0] === parts[1][0].toUpperCase()) {
    firstName = `${parts[0]} ${parts[1]}`;
    startIndex = 2;
  }
  
  const lastName = parts[parts.length - 1];
  
  const middleInitials: string[] = [];
  for (let i = startIndex; i < parts.length - 1; i++) {
    const part = parts[i];
    if (connectors.includes(part.toLowerCase())) {
      continue;
    }
    if (part.length > 0) {
      middleInitials.push(`${part[0].toUpperCase()}.`);
    }
  }
  
  if (middleInitials.length > 0) {
    return `${firstName} ${middleInitials.join(' ')} ${lastName}`;
  }
  return `${firstName} ${lastName}`;
}

const SELECTOR_STYLES = `
        /* Make parent wrappers transparent so portal background shows through */
        .ad-main-scroll {
          background: transparent !important;
        }

        .premium-selector-container {
          max-width: 800px;
          width: 100%;
          box-sizing: border-box;
          margin: 0 auto;
          padding: 40px 24px 80px 24px;
          font-family: 'Outfit', 'Inter', sans-serif;
          min-height: 90vh;
          display: flex;
          flex-direction: column;
          gap: 36px;
          position: relative;
          z-index: 1;
        }

        /* Animations */
        @keyframes revealUp {
          0% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes orbRotate {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes avatarPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4); }
          50% { transform: scale(1.02); box-shadow: 0 0 20px 4px rgba(99, 102, 241, 0.15); }
        }

        .animate-reveal {
          animation: revealUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          opacity: 0;
        }
        .delay-1 { animation-delay: 0.1s; }
        .delay-2 { animation-delay: 0.2s; }
        .delay-3 { animation-delay: 0.3s; }

        /* Premium Welcome Header Card */
        .premium-welcome-card {
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.75) 0%, rgba(255, 255, 255, 0.4) 100%);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.5);
          border-radius: 32px;
          padding: 32px;
          display: flex;
          align-items: center;
          gap: 28px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.8);
          position: relative;
          overflow: hidden;
          margin-top: 24px;
        }

        .dark .premium-welcome-card {
          background: linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.5) 100%);
          border-color: rgba(255, 255, 255, 0.08);
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }

        .welcome-avatar-wrapper {
          position: relative;
          width: 96px;
          height: 96px;
          flex-shrink: 0;
          animation: avatarPulse 4s ease-in-out infinite;
        }

        .welcome-avatar-glow {
          position: absolute;
          inset: -4px;
          border-radius: 28px;
          background: linear-gradient(135deg, #6366f1, #a855f7);
          padding: 2px;
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          opacity: 0.85;
        }

        .welcome-avatar-img {
          width: 100%;
          height: 100%;
          border-radius: 26px;
          object-fit: cover;
          border: 2px solid white;
          background: white;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
        }
        .dark .welcome-avatar-img {
          border-color: #1e293b;
          background: #1e293b;
        }

        .welcome-initials {
          width: 100%;
          height: 100%;
          border-radius: 26px;
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          color: white;
          font-size: 32px;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid white;
          box-shadow: 0 8px 24px rgba(99, 102, 241, 0.2);
        }
        .dark .welcome-initials {
          border-color: #1e293b;
        }

        .welcome-content {
          flex: 1;
        }

        .welcome-greeting {
          font-size: 32px;
          fontWeight: 900;
          margin: 0 0 6px;
          letter-spacing: -0.03em;
          line-height: 1.1;
          color: #0f172a;
        }
        .dark .welcome-greeting {
          color: #f8fafc;
        }

        .welcome-tagline {
          font-size: 15px;
          color: #64748b;
          margin: 0;
          line-height: 1.5;
          font-weight: 500;
        }
        .dark .welcome-tagline {
          color: #94a3b8;
        }

        .welcome-sparkle {
          position: absolute;
          top: 16px;
          right: 16px;
          color: rgba(99, 102, 241, 0.35);
          animation: orbRotate 6s linear infinite;
        }

        /* Portal Sections Grid Layout */
        .portal-sections-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 36px;
          width: 100%;
          box-sizing: border-box;
        }

        .portal-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
          padding: 0 8px;
        }

        .portal-section-title {
          font-size: 15px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #64748b;
          margin: 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .dark .portal-section-title {
          color: #94a3b8;
        }

        .portal-section-badge {
          font-size: 12px;
          font-weight: 700;
          color: #6366f1;
          background: rgba(99, 102, 241, 0.08);
          padding: 4px 12px;
          border-radius: 20px;
          border: 1px solid rgba(99, 102, 241, 0.12);
        }

        .cards-column {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        /* ── High-End Ultra Modern Cards ── */
        .portal-modern-card {
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(250, 245, 255, 0.88) 100%);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          border: 1.5px solid rgba(139, 92, 246, 0.18);
          border-left: 4px solid #8b5cf6;
          border-radius: 20px;
          padding: 16px 18px;
          display: flex;
          align-items: center;
          gap: 16px;
          cursor: pointer;
          transition: all 0.28s cubic-bezier(0.16, 1, 0.3, 1);
          position: relative;
          overflow: hidden;
          box-shadow: 0 4px 18px -2px rgba(139, 92, 246, 0.07), 0 2px 6px rgba(0, 0, 0, 0.02), inset 0 1px 0 rgba(255, 255, 255, 1);
          text-decoration: none !important;
          width: 100%;
          box-sizing: border-box;
        }

        .dark .portal-modern-card {
          background: linear-gradient(135deg, rgba(30, 41, 59, 0.85) 0%, rgba(15, 23, 42, 0.75) 100%);
          border-color: rgba(139, 92, 246, 0.25);
          border-left-color: #8b5cf6;
          box-shadow: 0 6px 24px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.06);
        }

        .portal-modern-card:hover {
          transform: translateY(-2.5px);
          border-color: rgba(139, 92, 246, 0.45);
          border-left-color: #7c3aed;
          box-shadow: 0 14px 32px -4px rgba(139, 92, 246, 0.16), 0 4px 10px rgba(0, 0, 0, 0.03), inset 0 1px 0 #ffffff;
        }
        .dark .portal-modern-card:hover {
          border-color: rgba(139, 92, 246, 0.55);
          border-left-color: #a78bfa;
          box-shadow: 0 16px 36px rgba(139, 92, 246, 0.25);
        }

        .portal-modern-card:active {
          transform: scale(0.985);
        }

        /* Collaborator Card Specifics */
        .portal-modern-card.collaborator-theme {
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(240, 247, 255, 0.88) 100%);
          border-color: rgba(59, 130, 246, 0.18);
          border-left: 4px solid #3b82f6;
          box-shadow: 0 4px 18px -2px rgba(59, 130, 246, 0.08), 0 2px 6px rgba(0, 0, 0, 0.02), inset 0 1px 0 rgba(255, 255, 255, 1);
        }
        .dark .portal-modern-card.collaborator-theme {
          background: linear-gradient(135deg, rgba(30, 41, 59, 0.85) 0%, rgba(15, 23, 42, 0.75) 100%);
          border-color: rgba(59, 130, 246, 0.25);
          border-left-color: #3b82f6;
        }
        .portal-modern-card.collaborator-theme:hover {
          border-color: rgba(59, 130, 246, 0.45);
          border-left-color: #2563eb;
          box-shadow: 0 14px 32px -4px rgba(59, 130, 246, 0.18), 0 4px 10px rgba(0, 0, 0, 0.03), inset 0 1px 0 #ffffff;
        }
        .dark .portal-modern-card.collaborator-theme:hover {
          border-color: rgba(59, 130, 246, 0.55);
          border-left-color: #60a5fa;
        }

        /* ── Avatar Styling with Micro-Badges ── */
        .card-avatar-container {
          position: relative;
          width: 66px;
          height: 66px;
          flex-shrink: 0;
        }

        .card-avatar-inner {
          width: 100%;
          height: 100%;
          border-radius: 20px;
          overflow: hidden;
          background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 800;
          font-size: 24px;
          box-shadow: 0 4px 14px rgba(139, 92, 246, 0.25);
          border: 2px solid #ffffff;
          transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .dark .card-avatar-inner {
          border-color: rgba(255, 255, 255, 0.15);
        }

        .portal-modern-card:hover .card-avatar-inner {
          transform: scale(1.05);
        }

        .card-avatar-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .collaborator-avatar .card-avatar-inner {
          background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%);
          box-shadow: 0 4px 14px rgba(37, 99, 235, 0.28);
        }

        .avatar-micro-badge {
          position: absolute;
          bottom: -2px;
          right: -2px;
          width: 22px;
          height: 22px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
          z-index: 2;
          transition: transform 0.25s ease;
        }
        .dark .avatar-micro-badge {
          border-color: #1e293b;
        }
        .portal-modern-card:hover .avatar-micro-badge {
          transform: scale(1.12);
        }

        .student-micro-badge {
          background: #8b5cf6;
        }
        .colab-micro-badge {
          background: #2563eb;
        }

        /* ── Card Info & Typography ── */
        .card-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .card-title {
          font-size: 15.5px;
          font-weight: 800;
          color: #0f172a;
          margin: 0 0 5px 0;
          letter-spacing: -0.02em;
          line-height: 1.25;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .dark .card-title {
          color: #f8fafc;
        }

        .card-tags-row {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: nowrap;
          overflow: hidden;
        }

        .card-badge-pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 8px;
          border-radius: 8px;
          font-size: 11.5px;
          font-weight: 700;
          letter-spacing: -0.01em;
          line-height: 1.3;
          white-space: nowrap;
        }

        .badge-colab {
          background: rgba(37, 99, 235, 0.1);
          color: #1d4ed8;
          border: 1px solid rgba(37, 99, 235, 0.2);
        }
        .dark .badge-colab {
          background: rgba(59, 130, 246, 0.2);
          color: #93c5fd;
          border-color: rgba(59, 130, 246, 0.35);
        }

        .badge-cargo {
          background: rgba(37, 99, 235, 0.08);
          color: #1d4ed8;
          border: 1px solid rgba(37, 99, 235, 0.18);
          font-weight: 700;
          flex-shrink: 0;
        }
        .dark .badge-cargo {
          background: rgba(59, 130, 246, 0.18);
          color: #93c5fd;
          border-color: rgba(59, 130, 246, 0.3);
        }

        .badge-turma {
          background: rgba(139, 92, 246, 0.1);
          color: #6d28d9;
          border: 1px solid rgba(139, 92, 246, 0.2);
          flex-shrink: 0;
        }
        .dark .badge-turma {
          background: rgba(139, 92, 246, 0.2);
          color: #c4b5fd;
          border-color: rgba(139, 92, 246, 0.35);
        }

        .badge-integral {
          background: rgba(16, 185, 129, 0.1);
          color: #047857;
          border: 1px solid rgba(16, 185, 129, 0.22);
          font-weight: 700;
          flex-shrink: 0;
        }
        .dark .badge-integral {
          background: rgba(16, 185, 129, 0.2);
          color: #6ee7b7;
          border-color: rgba(16, 185, 129, 0.35);
        }

        .badge-ano {
          background: rgba(100, 116, 139, 0.08);
          color: #64748b;
          border: 1px solid rgba(100, 116, 139, 0.14);
          font-weight: 600;
          flex-shrink: 0;
        }
        .dark .badge-ano {
          background: rgba(148, 163, 184, 0.12);
          color: #94a3b8;
          border-color: rgba(148, 163, 184, 0.2);
        }

        .badge-inativo {
          background: rgba(239, 68, 68, 0.1);
          color: #dc2626;
          border: 1px solid rgba(239, 68, 68, 0.2);
          font-weight: 700;
        }

        /* ── Actions & Chevron ── */
        .card-actions-wrapper {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }

        .unread-indicator-badge {
          width: 36px;
          height: 36px;
          border-radius: 12px;
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.18);
          color: #ef4444;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          transition: all 0.2s ease;
        }
        .dark .unread-indicator-badge {
          background: rgba(239, 68, 68, 0.18);
          border-color: rgba(239, 68, 68, 0.3);
          color: #f87171;
        }

        .badge-count-bubble {
          position: absolute;
          top: -5px;
          right: -5px;
          background: linear-gradient(135deg, #ef4444, #f43f5e);
          color: white;
          font-size: 10.5px;
          font-weight: 800;
          min-width: 17px;
          height: 17px;
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 4px;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 6px rgba(239, 68, 68, 0.35);
        }
        .dark .badge-count-bubble {
          border-color: #1e293b;
        }

        .pending-warning-badge {
          width: 36px;
          height: 36px;
          border-radius: 12px;
          background: #fffbeb;
          border: 1px solid rgba(217, 119, 6, 0.2);
          color: #d97706;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .dark .pending-warning-badge {
          background: rgba(217, 119, 6, 0.2);
          color: #fbbf24;
        }

        .chevron-circle-btn {
          width: 36px;
          height: 36px;
          border-radius: 12px;
          border: 1px solid rgba(0, 0, 0, 0.06);
          background: rgba(0, 0, 0, 0.03);
          color: #94a3b8;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .dark .chevron-circle-btn {
          border-color: rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.04);
          color: #64748b;
        }

        .portal-modern-card:hover .chevron-circle-btn.student-chevron {
          transform: translateX(3px);
          color: #ffffff;
          background: #8b5cf6;
          border-color: #8b5cf6;
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.35);
        }

        .portal-modern-card.collaborator-theme:hover .chevron-circle-btn.colab-chevron {
          transform: translateX(3px);
          color: #ffffff;
          background: #2563eb;
          border-color: #2563eb;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);
        }

        /* Empty state styling */
        .empty-results-card {
          padding: 48px 32px;
          text-align: center;
          background: rgba(255, 255, 255, 0.45);
          border: 1px dashed rgba(0, 0, 0, 0.1);
          border-radius: 28px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }
        .dark .empty-results-card {
          background: rgba(30, 41, 59, 0.2);
          border-color: rgba(255, 255, 255, 0.08);
        }

        .empty-icon-circle {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: rgba(239, 68, 68, 0.04);
          border: 1px solid rgba(239, 68, 68, 0.15);
          color: #f43f5e;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 10px 25px rgba(244, 63, 94, 0.05);
        }

        /* ── Modern Side-by-Side Action Buttons ── */
        .ad-footer-actions {
          margin-top: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          width: 100%;
          max-width: 480px;
          padding: 0 16px 48px 16px;
          position: relative;
          z-index: 10;
          margin-left: auto;
          margin-right: auto;
          box-sizing: border-box;
        }

        .ad-action-btn {
          flex: 1;
          height: 50px;
          min-width: 0;
          max-width: 230px;
          padding: 0 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          border-radius: 16px;
          font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 13.5px;
          font-weight: 700;
          letter-spacing: -0.01em;
          white-space: nowrap;
          cursor: pointer;
          transition: all 0.24s cubic-bezier(0.16, 1, 0.3, 1);
          user-select: none;
          outline: none;
          box-sizing: border-box;
          text-decoration: none;
        }

        .ad-btn-icon-wrap {
          width: 30px;
          height: 30px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all 0.24s cubic-bezier(0.16, 1, 0.3, 1);
        }

        /* Botão Trocar Módulo */
        .ad-btn-switch {
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1.5px solid rgba(99, 102, 241, 0.2);
          color: #4f46e5;
          box-shadow: 0 4px 16px -2px rgba(99, 102, 241, 0.1), 0 2px 6px rgba(0, 0, 0, 0.02), inset 0 1px 0 rgba(255, 255, 255, 0.9);
        }
        .ad-btn-switch .ad-btn-icon-wrap {
          background: rgba(99, 102, 241, 0.08);
          border: 1px solid rgba(99, 102, 241, 0.16);
          color: #6366f1;
        }
        .ad-btn-switch:hover {
          background: #ffffff;
          border-color: rgba(99, 102, 241, 0.45);
          transform: translateY(-2px);
          box-shadow: 0 8px 24px -4px rgba(99, 102, 241, 0.22), 0 3px 8px rgba(0, 0, 0, 0.04), inset 0 1px 0 #ffffff;
        }
        .ad-btn-switch:hover .ad-btn-icon-wrap {
          transform: translateX(-2px);
          background: rgba(99, 102, 241, 0.15);
        }
        .ad-btn-switch:active {
          transform: translateY(0) scale(0.97);
        }

        /* Botão Sair da Conta */
        .ad-btn-logout {
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1.5px solid rgba(244, 63, 94, 0.22);
          color: #e11d48;
          box-shadow: 0 4px 16px -2px rgba(244, 63, 94, 0.1), 0 2px 6px rgba(0, 0, 0, 0.02), inset 0 1px 0 rgba(255, 255, 255, 0.9);
        }
        .ad-btn-logout .ad-btn-icon-wrap {
          background: rgba(244, 63, 94, 0.08);
          border: 1px solid rgba(244, 63, 94, 0.16);
          color: #f43f5e;
        }
        .ad-btn-logout:hover {
          background: #fff5f6;
          border-color: rgba(244, 63, 94, 0.45);
          transform: translateY(-2px);
          box-shadow: 0 8px 24px -4px rgba(244, 63, 94, 0.22), 0 3px 8px rgba(0, 0, 0, 0.04), inset 0 1px 0 #ffffff;
        }
        .ad-btn-logout:hover .ad-btn-icon-wrap {
          transform: translateX(2px);
          background: rgba(244, 63, 94, 0.15);
        }
        .ad-btn-logout:active {
          transform: translateY(0) scale(0.97);
        }

        /* Dark mode */
        .dark .ad-btn-switch {
          background: rgba(30, 41, 59, 0.85);
          border-color: rgba(99, 102, 241, 0.32);
          color: #a5b4fc;
          box-shadow: 0 4px 16px -2px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.08);
        }
        .dark .ad-btn-switch .ad-btn-icon-wrap {
          background: rgba(99, 102, 241, 0.18);
          border-color: rgba(99, 102, 241, 0.25);
          color: #818cf8;
        }
        .dark .ad-btn-switch:hover {
          background: rgba(30, 41, 59, 0.98);
          border-color: rgba(99, 102, 241, 0.5);
          box-shadow: 0 8px 24px -4px rgba(99, 102, 241, 0.3);
        }

        .dark .ad-btn-logout {
          background: rgba(30, 41, 59, 0.85);
          border-color: rgba(244, 63, 94, 0.32);
          color: #fb7185;
          box-shadow: 0 4px 16px -2px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.08);
        }
        .dark .ad-btn-logout .ad-btn-icon-wrap {
          background: rgba(244, 63, 94, 0.18);
          border-color: rgba(244, 63, 94, 0.25);
          color: #fb7185;
        }
        .dark .ad-btn-logout:hover {
          background: rgba(244, 63, 94, 0.15);
          border-color: rgba(244, 63, 94, 0.5);
          box-shadow: 0 8px 24px -4px rgba(244, 63, 94, 0.3);
        }

        /* Mobile Adjustments */
        @media (max-width: 768px) {
          .premium-selector-container::before {
            display: none !important;
          }
          .premium-selector-container {
            padding: 24px 12px 64px 12px;
            gap: 28px;
            width: 100%;
            box-sizing: border-box;
          }
          .premium-welcome-card {
            padding: 20px;
            gap: 14px;
            border-radius: 24px;
            margin-top: 16px;
          }
          .ad-has-banner .premium-welcome-card {
            margin-top: 8px !important;
          }
          .ad-footer-actions {
            gap: 10px;
            padding: 0 12px 42px 12px;
            margin-top: 28px;
          }
          .ad-action-btn {
            height: 48px;
            padding: 0 10px;
            font-size: 13px;
            gap: 8px;
            border-radius: 14px;
          }
          .ad-btn-icon-wrap {
            width: 28px !important;
            height: 28px !important;
            border-radius: 9px !important;
          }
          .welcome-avatar-wrapper {
            width: 82px;
            height: 82px;
          }
          .welcome-initials {
            font-size: 28px !important;
          }
          .welcome-greeting {
            font-size: 22px;
          }
          .welcome-tagline {
            font-size: 13px;
          }
          .portal-sections-grid {
            gap: 28px;
            width: 100%;
            box-sizing: border-box;
          }
          .portal-modern-card {
            padding: 14px 15px;
            gap: 14px;
            border-radius: 18px;
            width: 100%;
            box-sizing: border-box;
          }
          .card-avatar-container {
            width: 62px;
            height: 62px;
          }
          .card-avatar-inner {
            border-radius: 18px !important;
            font-size: 22px !important;
          }
          .avatar-micro-badge {
            width: 20px !important;
            height: 20px !important;
            border-radius: 7px !important;
            bottom: -2px !important;
            right: -2px !important;
          }
          .card-title {
            font-size: 15px;
          }
          .card-badge-pill {
            font-size: 11px;
            padding: 2.5px 7px;
          }
          .chevron-circle-btn {
            width: 34px !important;
            height: 34px !important;
            border-radius: 11px !important;
          }
          .chevron-circle-btn svg {
            width: 16px !important;
            height: 16px !important;
          }
        }
`;

const StudentCard = memo(({ student, loadingCardId, redirectTarget, getForwardParams, setLoadingCardId }: any) => {
  const pendingAlerts = student.pendenciasAtrasadas || 0;
  
  let rawName = student.turmaNome || student.turma || 'S/T'
  
  const activeHist = Array.isArray(student.historicoTurmas || student.dados?.historicoTurmas)
    ? (student.historicoTurmas || student.dados.historicoTurmas)[(student.historicoTurmas || student.dados.historicoTurmas).length - 1]
    : null;

  const isIntegral = Boolean(
    student.isIntegralIntermediario ||
    student.modalidade === 'INTEGRAL/INTERMEDIÁRIO' ||
    student.dados?.isIntegralIntermediario ||
    student.dados?.modalidade === 'INTEGRAL/INTERMEDIÁRIO' ||
    activeHist?.isIntegralIntermediario ||
    activeHist?.modalidade === 'INTEGRAL/INTERMEDIÁRIO' ||
    student.turno_nome === 'Integral/Intermediário' ||
    String(student.turno || '').toLowerCase().includes('integral') ||
    String(student.turno || '').toLowerCase().includes('intermediario') ||
    rawName.toUpperCase().includes('INTEGRAL') ||
    rawName.toUpperCase().includes('INTERMEDIÁRIO')
  );

  const baseTurma = rawName.split('-')[0].trim()
  const cleanTurma = baseTurma.replace(/^Turma\s+/i, '').trim()
  const displayTurma = isIntegral ? (baseTurma.toUpperCase().includes('INTEGRAL') ? baseTurma : `${baseTurma} - INTEGRAL/INTERMEDIÁRIO`) : baseTurma
  const anoLetivo = student.anoLetivo || new Date().getFullYear()

  const s = student.status?.toLowerCase();
  const isInativo = s === 'inativo' || s === 'cancelado' || s === 'transferido' || student.dados?.ativo === 'Não' || student.dados?.ativo === false;

  const content = (
    <>
      <div className="card-avatar-container student-avatar">
        <div className="card-avatar-inner">
          {student.foto ? (
            <img src={student.foto} alt={student.nome} className="card-avatar-img" />
          ) : (
            getInitials(student.nome)
          )}
        </div>
        <div className="avatar-micro-badge student-micro-badge" title="Aluno">
          <GraduationCap size={10} strokeWidth={2.8} />
        </div>
      </div>

      <div className="card-info">
        <h3 className="card-title">{formatShortName(student.nome)}</h3>
        {isInativo ? (
          <div className="card-tags-row">
            <span className="card-badge-pill badge-inativo">Aluno Inativo</span>
          </div>
        ) : (
          <div className="card-tags-row">
            <span className="card-badge-pill badge-turma">
              <GraduationCap size={11} strokeWidth={2.5} />
              {cleanTurma}
            </span>
            {isIntegral && (
              <span className="card-badge-pill badge-integral">
                Integral
              </span>
            )}
            <span className="card-badge-pill badge-ano">
              {anoLetivo}
            </span>
          </div>
        )}
      </div>

      <div className="card-actions-wrapper">
        {isInativo ? (
          <div className="inactive-badge" title="Aluno Inativo">
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.5px' }}>INATIVO</span>
          </div>
        ) : (
          <>
            {pendingAlerts > 0 && (
              <div className="pending-warning-badge" title={`${pendingAlerts} Ocorrências ou pendências`}>
                <AlertTriangle size={16} strokeWidth={2.4} />
              </div>
            )}

            <div className="chevron-circle-btn student-chevron">
              {loadingCardId === student.id ? (
                <Loader2 size={18} strokeWidth={2.5} className="animate-spin" style={{ color: '#7c3aed' }} />
              ) : (
                <ChevronRight size={18} strokeWidth={2.5} />
              )}
            </div>
          </>
        )}
      </div>
    </>
  )

  if (isInativo) {
    return (
      <div className="portal-modern-card disabled-card">
        {content}
      </div>
    )
  }

  return (
    <Link href={`/agenda-digital/${student.id}/${redirectTarget}${getForwardParams()}`} onClick={() => setLoadingCardId(student.id)} className="portal-modern-card">
      {content}
    </Link>
  )
})

function SelecionarAlunoContent() {
  const { turmas = [] } = useData();
  const { currentUser, hydrated } = useApp()
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTarget = searchParams.get('redirect') || 'comunicados'

  const getForwardParams = useCallback(() => {
    if (typeof window === 'undefined') return ''
    const p = new URLSearchParams(window.location.search)
    p.delete('redirect')
    const str = p.toString()
    return str ? `?${str}` : ''
  }, [])

  // ─── Fast-path data fetching with localStorage cache to eliminate empty-state flash ───
  const [meusAlunos, setMeusAlunos] = useState<any[]>([])
  // Track whether we've completed at least one successful fetch
  const [hasFetched, setHasFetched] = useState(false)
  const isStillLoading = !hydrated || !hasFetched || (currentUser === undefined)

  const [loadingCardId, setLoadingCardId] = useState<string | null>(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // 1. Obter metadados do responsável autenticado
  const respId = (currentUser as any)?.responsavel_id || (currentUser as any)?.user_metadata?.responsavel_id || '';
  const emailBusca = (currentUser?.email || '').toLowerCase().trim();
  const nomeBusca = (currentUser?.nome || '').toLowerCase().trim();

  useEffect(() => {
    if (hydrated) {
      hideSplashScreen(300);
    }
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated || !currentUser) return;

    const cacheKey = `edu-meus-alunos-${respId || emailBusca}`;

    // Step 1: Serve from localStorage cache INSTANTLY (zero latency)
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const { data, ts } = JSON.parse(cached);
        if (Array.isArray(data) && data.length > 0) {
          setMeusAlunos(data);
          setHasFetched(true); // Show data immediately, no spinner
        }
      }
    } catch (_) {}

    // Step 2: Always fire a fresh network request in background
    const url = `/api/agenda/meus-alunos?respId=${encodeURIComponent(respId)}&email=${encodeURIComponent(emailBusca)}&nome=${encodeURIComponent(nomeBusca)}`;

    fetch(url, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        if (!Array.isArray(data)) return;
        setMeusAlunos(data);
        setHasFetched(true);
        // Update localStorage cache with fresh data
        try {
          localStorage.setItem(cacheKey, JSON.stringify({ data, ts: Date.now() }));
        } catch (_) {}
      })
      .catch(() => {
        setHasFetched(true); // Even on error, stop the spinner
      });
  }, [hydrated, currentUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Redirecionamento de alunos normais
  useEffect(() => {
    if (currentUser && currentUser.perfil === 'Aluno') {
      if (typeof window !== 'undefined') {
        const u = currentUser as any;
        if (u && u.perfilReal !== 'Família' && u.perfilReal !== 'Responsável' && !u.hasDualRole && u.perfil === 'Aluno') {
          setTimeout(() => { window.location.href = `/agenda-digital/aluno/${redirectTarget}` }, 50)
          return
        }
      }
      if (currentUser.id) {
        setTimeout(() => { window.location.href = `/agenda-digital/aluno/${redirectTarget}` }, 50)
      }
    }
  }, [isStillLoading, currentUser, redirectTarget])

  const firstName = currentUser?.nome ? currentUser.nome.split(' ')[0] : 'Responsável';

  return (
    <>
      {/* Overlay de loading em tela cheia via Portal — cobre 100% da viewport e exibe a animação oficial da logo */}
      {isLoggingOut && mounted && typeof document !== 'undefined' && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 99999999,
            background: 'rgba(10, 15, 36, 0.50)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'all',
          }}
        >
          <ImpactoLoader
            isLoading={true}
            style={{
              position: 'relative',
              inset: 'auto',
              background: 'transparent',
              backdropFilter: 'none',
              WebkitBackdropFilter: 'none',
              pointerEvents: 'none',
              opacity: 1,
              zIndex: 1,
            }}
          />
        </div>,
        document.body
      )}
      <div className="premium-selector-container">
        {/* Dynamic styles block for modern theme design */}
      <style dangerouslySetInnerHTML={{__html: SELECTOR_STYLES}} />


      {/* Header section */}
      <header className="premium-welcome-card animate-reveal">
        <Sparkles className="welcome-sparkle" size={24} />
        <div className="welcome-avatar-wrapper">
          <div className="welcome-avatar-glow" />
          {currentUser?.foto ? (
            <img src={currentUser.foto} alt="Mascot Avatar" className="welcome-avatar-img" />
          ) : (
            <div className="welcome-initials">
              {getInitials(currentUser?.nome || 'User')}
            </div>
          )}
        </div>
        <div className="welcome-content">
          <h1 className="welcome-greeting">
            Olá, {firstName}!
          </h1>
          <p className="welcome-tagline">
            Seja bem-vindo(a) à Agenda Digital do Impacto. Selecione um perfil para gerenciar comunicados e relatórios.
          </p>
        </div>
      </header>

      {/* Main content Area */}
      <main className="portal-sections-grid">
        {/* SECTION 1: COLABORADOR / STAFF (Somente visível se o usuário for colaborador) */}
        {currentUser && currentUser.perfil !== 'Família' && currentUser.perfil !== 'Responsável' && currentUser.cargo !== 'Aluno' && (
          <section className="animate-reveal delay-1">
            <div className="portal-section-header">
              <h2 className="portal-section-title">
                <Briefcase size={16} strokeWidth={2.5} style={{ color: 'hsl(var(--primary))' }} />
                Acesso Institucional
              </h2>
              <span className="portal-section-badge" style={{ color: '#3b82f6', background: 'rgba(59, 130, 246, 0.08)', borderColor: 'rgba(59, 130, 246, 0.15)' }}>
                Colaborador
              </span>
            </div>

            <div className="cards-column">
              <Link 
                href={`/agenda-digital/colaborador/${redirectTarget}${getForwardParams()}`} 
                onClick={() => setLoadingCardId('colaborador')}
                className="portal-modern-card collaborator-theme"
              >
                <div className="card-avatar-container collaborator-avatar">
                  <div className="card-avatar-inner">
                    {currentUser.foto ? (
                      <img src={currentUser.foto} alt={currentUser.nome} className="card-avatar-img" />
                    ) : (
                      getInitials(currentUser.nome || 'Colaborador')
                    )}
                  </div>
                  <div className="avatar-micro-badge colab-micro-badge" title="Equipe Escolar">
                    <ShieldCheck size={10} strokeWidth={2.8} />
                  </div>
                </div>

                <div className="card-info">
                  <h3 className="card-title">{formatShortName(currentUser.nome)}</h3>
                  <div className="card-tags-row">
                    <span className="card-badge-pill badge-cargo">
                      <Briefcase size={12} strokeWidth={2.2} />
                      {currentUser.cargo || currentUser.perfil}
                    </span>
                  </div>
                </div>

                <div className="card-actions-wrapper">
                  <div className="chevron-circle-btn colab-chevron">
                    {loadingCardId === 'colaborador' ? (
                      <Loader2 size={18} strokeWidth={2.5} className="animate-spin" style={{ color: '#2563eb' }} />
                    ) : (
                      <ChevronRight size={18} strokeWidth={2.5} />
                    )}
                  </div>
                </div>
              </Link>
            </div>
          </section>
        )}

        {/* SECTION 2: ESTUDANTES / FAMÍLIA */}
        <section className="animate-reveal delay-2">
          <div className="portal-section-header">
            <h2 className="portal-section-title">
              <Users size={16} strokeWidth={2.5} style={{ color: 'hsl(var(--primary))' }} />
              Acesso Familiar
            </h2>
            {meusAlunos.length > 0 && (
              <span className="portal-section-badge">
                {meusAlunos.length} Aluno{meusAlunos.length !== 1 && 's'}
              </span>
            )}
          </div>

          <div className="cards-column">
            {isStillLoading ? (
              <div style={{ padding: 48, textAlign: 'center' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid rgba(99,102,241,0.15)', borderTopColor: '#6366f1', animation: 'orbRotate 1s linear infinite', margin: '0 auto 16px' }} />
                <p style={{ color: 'hsl(var(--text-muted))', fontSize: 14, fontWeight: 500, margin: 0 }}>Procurando alunos vinculados...</p>
              </div>
            ) : meusAlunos.length === 0 ? (
              <div className="empty-results-card">
                <div className="empty-icon-circle">
                  <AlertTriangle size={32} />
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 800, margin: '8px 0 4px', color: 'hsl(var(--text-main))' }}>Nenhum aluno encontrado</h3>
                <p style={{ color: 'hsl(var(--text-muted))', fontSize: 14, maxWidth: 360, margin: '0 auto', lineHeight: 1.5 }}>
                  Certifique-se de que sua conta de e-mail ou CPF esteja corretamente associada ao cadastro de seus filhos na secretaria da escola.
                </p>
              </div>
            ) : (
              meusAlunos.map((student) => (
                <StudentCard 
                  key={student.id} 
                  student={student} 
                  loadingCardId={loadingCardId} 
                  redirectTarget={redirectTarget} 
                  getForwardParams={getForwardParams} 
                  setLoadingCardId={setLoadingCardId} 
                />
              ))
            )}
          </div>
        </section>
      </main>

      <footer className="ad-footer-actions">
        {currentUser && currentUser.perfil !== 'Família' && currentUser.perfil !== 'Responsável' && currentUser.cargo !== 'Aluno' && (
          <button 
            onClick={() => window.location.href = '/login?step=choose_system'}
            className="ad-action-btn ad-btn-switch"
            title="Trocar Módulo do Sistema"
          >
            <div className="ad-btn-icon-wrap">
              <ArrowLeft size={16} strokeWidth={2.5} />
            </div>
            <span>Trocar Módulo</span>
          </button>
        )}
        <button 
          onClick={async () => {
            setIsLoggingOut(true);
            try {
              await performLogout();
            } catch (err) {
              window.location.replace('/login');
            }
          }}
          className="ad-action-btn ad-btn-logout"
          title="Sair da Conta com segurança"
          disabled={isLoggingOut}
        >
          <div className="ad-btn-icon-wrap">
            <LogOut size={16} strokeWidth={2.5} />
          </div>
          <span>Sair da Conta</span>
        </button>
      </footer>
    </div>
    </>
  )
}

export default function SelecionarAluno() {
  return (
    <Suspense fallback={<LoadingGlass />}>
      <SelecionarAlunoContent />
    </Suspense>
  )
}
