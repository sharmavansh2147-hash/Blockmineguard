import React, { useState } from 'react';
import {
  ShieldCheck,
  Layers,
  Code2,
  Terminal,
  Cpu,
  Boxes,
  Database,
  ExternalLink,
  Copy,
  Check,
  Github,
  Linkedin,
  GraduationCap,
  Sparkles,
  Info
} from 'lucide-react';
import { projectIdentity, teamMembers, projectTechStack } from '../data/teamData';

export function DevelopedByPage() {
  const [copiedId, setCopiedId] = useState(null);

  const handleCopy = (text, id) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="developed-by-page" style={{ paddingBottom: '32px' }}>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0 }}>
            Developed By
          </h1>
          <p className="page-subtitle" style={{ marginTop: '4px', fontSize: '0.85rem' }}>
            The team behind BlockMineGuard
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Section A: Project Identity */}
        <section
          className="card"
          style={{
            padding: '24px',
            background: 'var(--surface-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)'
          }}
          aria-label="Project Identity"
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '18px', flexWrap: 'wrap' }}>
            {/* Project Mark */}
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 'var(--radius)',
                background: 'var(--surface-elevated)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)',
                flexShrink: 0
              }}
            >
              <ShieldCheck size={26} />
            </div>

            <div style={{ flex: 1, minWidth: '260px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
                <span
                  style={{
                    fontSize: '1.15rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    letterSpacing: '-0.01em'
                  }}
                >
                  {projectIdentity.name}
                </span>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--surface-elevated)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-secondary)'
                  }}
                >
                  {projectIdentity.category}
                </span>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 500,
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(88, 166, 255, 0.1)',
                    border: '1px solid rgba(88, 166, 255, 0.25)',
                    color: 'var(--primary)'
                  }}
                >
                  v{projectIdentity.version}
                </span>
              </div>

              <div
                style={{
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: '8px',
                  lineHeight: 1.4
                }}
              >
                {projectIdentity.fullName}
              </div>

              <p
                style={{
                  fontSize: '0.825rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.6,
                  margin: 0,
                  maxWidth: '1000px'
                }}
              >
                {projectIdentity.description}
              </p>
            </div>
          </div>
        </section>

        {/* Section B & C: Development Team & Contributions */}
        <section aria-label="Development Team">
          <div style={{ marginBottom: '14px' }}>
            <h2
              style={{
                fontSize: '0.95rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                letterSpacing: '-0.01em',
                margin: 0
              }}
            >
              Development Team &amp; Core Contributions
            </h2>
            <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Engineers and student researchers responsible for system design, implementation, and evaluation
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
              gap: '20px'
            }}
          >
            {teamMembers.map((member) => {
              const isCopied = copiedId === member.id;
              return (
                <div
                  key={member.id}
                  className="card"
                  style={{
                    background: 'var(--surface-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    padding: '22px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '18px'
                  }}
                >
                  {/* Identity Header */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                    {/* Photograph */}
                    {member.avatar ? (
                      <div
                        style={{
                          width: '76px',
                          height: '76px',
                          borderRadius: 'var(--radius)',
                          overflow: 'hidden',
                          border: '1px solid var(--border)',
                          flexShrink: 0,
                          background: 'var(--surface-elevated)'
                        }}
                      >
                        <img
                          src={member.avatar}
                          alt={member.name}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            display: 'block'
                          }}
                        />
                      </div>
                    ) : (
                      <div
                        style={{
                          width: '76px',
                          height: '76px',
                          borderRadius: 'var(--radius)',
                          background: 'var(--surface-elevated)',
                          border: '1px solid var(--border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.25rem',
                          fontWeight: 700,
                          color: 'var(--text-secondary)',
                          flexShrink: 0
                        }}
                      >
                        {member.name.split(' ').map(n => n[0]).join('')}
                      </div>
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <h3
                          style={{
                            margin: 0,
                            fontSize: '1.1rem',
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                            letterSpacing: '-0.01em'
                          }}
                        >
                          {member.name}
                        </h3>

                        {/* Optional Social Links */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {member.githubUrl && (
                            <a
                              href={member.githubUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: 'var(--text-muted)', display: 'inline-flex', padding: '2px' }}
                              title="GitHub Profile"
                            >
                              <Github size={15} />
                            </a>
                          )}
                          {member.linkedinUrl && (
                            <a
                              href={member.linkedinUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: 'var(--text-muted)', display: 'inline-flex', padding: '2px' }}
                              title="LinkedIn Profile"
                            >
                              <Linkedin size={15} />
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Registration Number Badge with Copy Action */}
                      <div style={{ marginTop: '5px' }}>
                        <button
                          type="button"
                          onClick={() => handleCopy(member.regNo, member.id)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '2px 7px',
                            borderRadius: 'var(--radius-sm)',
                            background: isCopied ? 'rgba(63, 185, 80, 0.12)' : 'var(--surface-elevated)',
                            border: `1px solid ${isCopied ? 'var(--success)' : 'var(--border)'}`,
                            color: isCopied ? 'var(--success)' : 'var(--text-primary)',
                            fontSize: '0.72rem',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                          title="Click to copy Registration Number"
                        >
                          <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Reg.no:</span>
                          <span>{member.regNo}</span>
                          {isCopied ? <Check size={11} style={{ color: 'var(--success)' }} /> : <Copy size={10} style={{ color: 'var(--text-muted)' }} />}
                        </button>
                      </div>

                      {/* Role & Focus Area */}
                      <div style={{ marginTop: '7px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {member.role}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {member.focusArea}
                      </div>
                    </div>
                  </div>

                  {/* Responsibilities & Contributions */}
                  <div
                    style={{
                      background: 'var(--surface-elevated)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '12px 14px'
                    }}
                  >
                    <div
                      style={{
                        fontSize: '0.67rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: 'var(--text-muted)',
                        marginBottom: '8px'
                      }}
                    >
                      Assigned Areas of Contribution
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {member.contributions.map((contrib, cIdx) => (
                        <div key={cIdx} style={{ fontSize: '0.76rem', lineHeight: 1.45 }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {contrib.category}:
                          </span>{' '}
                          <span style={{ color: 'var(--text-secondary)' }}>
                            {contrib.description}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Technical Tags */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: 'auto' }}>
                    {member.technicalHighlights.map((tech) => (
                      <span
                        key={tech}
                        style={{
                          fontSize: '0.68rem',
                          padding: '2px 7px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--surface-elevated)',
                          border: '1px solid var(--border)',
                          color: 'var(--text-secondary)',
                          fontFamily: 'var(--font-mono)'
                        }}
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Section D: Project Technology Stack */}
        <section
          className="card"
          style={{
            padding: '22px',
            background: 'var(--surface-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)'
          }}
          aria-label="Technology Stack"
        >
          <div style={{ marginBottom: '14px' }}>
            <h2
              style={{
                fontSize: '0.95rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                letterSpacing: '-0.01em',
                margin: 0
              }}
            >
              Verified Project Technology Stack
            </h2>
            <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Technologies, runtimes, and libraries actively used in the BlockMineGuard codebase
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '16px'
            }}
          >
            {projectTechStack.map((category) => (
              <div
                key={category.category}
                style={{
                  background: 'var(--surface-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '14px 16px'
                }}
              >
                <div
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: 'var(--text-muted)',
                    marginBottom: '10px'
                  }}
                >
                  {category.category}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                  {category.items.map((item) => (
                    <div
                      key={item.name}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        fontSize: '0.76rem'
                      }}
                    >
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                        {item.name}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textAlign: 'right' }}>
                        {item.role}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section E: Project Acknowledgement */}
        <section
          className="card"
          style={{
            padding: '18px 22px',
            background: 'var(--surface-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '14px'
          }}
          aria-label="Project Acknowledgement"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <GraduationCap size={20} style={{ color: 'var(--primary)', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Academic Capstone Research Project
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Dedicated to the student researchers who authored, engineered, and evaluated BlockMineGuard
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            <span>Program: <strong style={{ color: 'var(--text-primary)' }}>{projectIdentity.academicProgram}</strong></span>
            <span>•</span>
            <span>Academic Year: <strong style={{ color: 'var(--text-primary)' }}>{projectIdentity.academicYear}</strong></span>
          </div>
        </section>
      </div>
    </div>
  );
}

export default DevelopedByPage;
