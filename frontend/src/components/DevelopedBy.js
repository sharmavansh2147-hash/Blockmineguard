import React, { useState } from 'react';
import {
  ShieldCheck,
  Award,
  Terminal,
  Cpu,
  Layers,
  Lock,
  Copy,
  Check,
  Sparkles,
  GraduationCap,
  Fingerprint
} from 'lucide-react';
import vanshImg from '../assets/developers/vansh-sharma.jpg';
import divyanshImg from '../assets/developers/divyansh-bhatia.jpg';

export function DevelopedBy({ className = '', style = {} }) {
  const [copiedId, setCopiedId] = useState(null);

  const copyToClipboard = (text, id) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2200);
  };

  const developers = [
    {
      id: 'vansh',
      name: 'Vansh Sharma',
      regNo: '25BCE1567',
      role: 'Lead System Architect & Core Researcher',
      focus: 'Detection Heuristics & EVM Smart Contracts',
      photo: vanshImg,
      badgeText: 'Lead Researcher',
      badgeColor: 'var(--primary)',
      contributions: [
        'Evasion-resistant sliding-window statistical detection engine',
        'ThreatRegistry.sol smart contract & EVM on-chain anchoring',
        'Deterministic canonical SHA-256 evidence hashing pipeline',
        'Non-destructive process containment & incident response guardrails'
      ],
      tags: ['Solidity 0.8.24', 'Python Flask', 'Hardhat / EVM', 'Web3.py', 'Sliding Window', 'Ethers.js']
    },
    {
      id: 'divyansh',
      name: 'Divyansh Bhatia',
      regNo: '25BCE1414',
      role: 'Lead Security & Full-Stack Systems Engineer',
      focus: 'SOC Console Architecture & Threat Intelligence',
      photo: divyanshImg,
      badgeText: 'Systems & Security',
      badgeColor: 'var(--accent-blockchain)',
      contributions: [
        'Enterprise React SOC threat operations console & analytics',
        '100-workload empirical research evaluation lab benchmark',
        'Containerized cgroup v2 resource monitoring & attribution',
        'Sybil-resistant threat intelligence reputation mechanics'
      ],
      tags: ['React 18', 'Threat Intel', 'Chart.js', 'Cgroup v2 Telemetry', 'Research Lab', 'REST APIs']
    }
  ];

  return (
    <section
      id="developed-by"
      className={`card developed-by-section ${className}`}
      style={{
        marginTop: '28px',
        overflow: 'hidden',
        position: 'relative',
        background: 'linear-gradient(180deg, var(--surface-card) 0%, var(--surface-elevated) 100%)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow)',
        ...style
      }}
      aria-label="Developed By Section"
    >
      {/* Decorative subtle ambient header accent */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: 'linear-gradient(90deg, #388BFD 0%, #58A6FF 50%, #3FB950 100%)'
        }}
      />

      {/* Header */}
      <div
        className="card-header"
        style={{
          padding: '16px 20px',
          background: 'transparent',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--radius)',
              background: 'rgba(88, 166, 255, 0.12)',
              border: '1px solid rgba(88, 166, 255, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary)'
            }}
          >
            <GraduationCap size={20} />
          </div>
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexWrap: 'wrap'
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.015em'
                }}
              >
                Developed By
              </h3>
              <span
                className="badge"
                style={{
                  fontSize: '0.68rem',
                  padding: '2px 8px',
                  background: 'rgba(63, 185, 80, 0.12)',
                  color: 'var(--success)',
                  border: '1px solid rgba(63, 185, 80, 0.25)',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Sparkles size={11} /> BTech CSE Capstone
              </span>
            </div>
            <p
              style={{
                margin: '3px 0 0',
                fontSize: '0.78rem',
                color: 'var(--text-secondary)'
              }}
            >
              BlockMineGuard Research & Engineering Team • Academic Project
            </p>
          </div>
        </div>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.74rem',
            color: 'var(--text-muted)',
            padding: '4px 10px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border)'
          }}
        >
          <Fingerprint size={13} style={{ color: 'var(--primary)' }} />
          <span>Verified Student Authors</span>
        </div>
      </div>

      {/* Developer Profiles Grid */}
      <div className="card-body" style={{ padding: '22px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '20px'
          }}
        >
          {developers.map((dev) => {
            const isCopied = copiedId === dev.id;
            return (
              <div
                key={dev.id}
                className="developer-profile-card"
                style={{
                  background: 'var(--surface-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
              >
                {/* Top Section: Avatar & Identity */}
                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                  {/* Photo with frame & status badge */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div
                      style={{
                        width: '84px',
                        height: '84px',
                        borderRadius: 'var(--radius-lg)',
                        overflow: 'hidden',
                        border: '2px solid var(--border-light)',
                        boxShadow: 'var(--shadow)',
                        background: 'var(--background)'
                      }}
                    >
                      <img
                        src={dev.photo}
                        alt={`${dev.name} - ${dev.regNo}`}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          display: 'block'
                        }}
                        loading="lazy"
                      />
                    </div>
                    {/* Active online dot indicator */}
                    <span
                      title="Verified Author"
                      style={{
                        position: 'absolute',
                        bottom: -3,
                        right: -3,
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        background: 'var(--success)',
                        border: '2px solid var(--surface-elevated)',
                        display: 'block'
                      }}
                    />
                  </div>

                  {/* Name, Reg. No & Role */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <h4
                        style={{
                          margin: 0,
                          fontSize: '1.1rem',
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                          letterSpacing: '-0.01em',
                          lineHeight: 1.2
                        }}
                      >
                        {dev.name}
                      </h4>
                      <span
                        className="badge"
                        style={{
                          fontSize: '0.625rem',
                          padding: '2px 6px',
                          background: 'rgba(88, 166, 255, 0.1)',
                          color: dev.badgeColor,
                          border: `1px solid ${dev.badgeColor}33`,
                          fontWeight: 600,
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {dev.badgeText}
                      </span>
                    </div>

                    {/* Registration Number Pill with Copy Action */}
                    <div style={{ marginTop: '6px' }}>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(dev.regNo, dev.id)}
                        title="Click to copy Registration Number"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-sm)',
                          background: isCopied ? 'rgba(63, 185, 80, 0.15)' : 'var(--background)',
                          border: `1px solid ${isCopied ? 'var(--success)' : 'var(--border)'}`,
                          color: isCopied ? 'var(--success)' : 'var(--text-primary)',
                          fontSize: '0.74rem',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'var(--transition)'
                        }}
                      >
                        <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Reg.no:</span>
                        <span>{dev.regNo}</span>
                        {isCopied ? (
                          <Check size={12} style={{ color: 'var(--success)' }} />
                        ) : (
                          <Copy size={11} style={{ color: 'var(--text-muted)' }} />
                        )}
                      </button>
                    </div>

                    {/* Role / Focus */}
                    <div
                      style={{
                        marginTop: '8px',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        color: 'var(--text-secondary)'
                      }}
                    >
                      {dev.role}
                    </div>
                    <div
                      style={{
                        fontSize: '0.71rem',
                        color: 'var(--text-muted)',
                        marginTop: '2px'
                      }}
                    >
                      {dev.focus}
                    </div>
                  </div>
                </div>

                {/* Core Contributions Bullet List */}
                <div
                  style={{
                    background: 'var(--background)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '10px 12px',
                    border: '1px solid var(--border)'
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.66rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: 'var(--text-muted)',
                      marginBottom: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <Terminal size={11} /> Key Technical Research Focus
                  </div>
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: '16px',
                      fontSize: '0.74rem',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.55,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}
                  >
                    {dev.contributions.map((item, idx) => (
                      <li key={idx} style={{ paddingLeft: '2px' }}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Tech Stack Badges */}
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '5px',
                    marginTop: 'auto',
                    paddingTop: '4px'
                  }}
                >
                  {dev.tags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        fontSize: '0.67rem',
                        padding: '2px 7px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--surface-card)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-muted)',
                        fontWeight: 500,
                        fontFamily: 'var(--font-mono)'
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Academic Project Footnote */}
        <div
          style={{
            marginTop: '20px',
            padding: '12px 16px',
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            fontSize: '0.76rem',
            color: 'var(--text-secondary)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Award size={15} style={{ color: 'var(--primary)', flexShrink: 0 }} />
            <span>
              <strong>Project:</strong> BlockMineGuard — Cryptojacking Detection, Prevention & Tamper-Evident Threat Intelligence
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span>Degree: <strong>B.Tech Computer Science & Engineering</strong></span>
            <span>Academic Year: <strong>2026</strong></span>
          </div>
        </div>
      </div>
    </section>
  );
}

export default DevelopedBy;
