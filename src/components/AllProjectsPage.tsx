import React, { useState, useMemo } from 'react';
import { useTheme, isLightTheme as checkLightTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../styles/colors';
import DeleteConfirmModal from './DeleteConfirmModal';

interface Project {
  id: string;
  name: string;
  thumbnailUrl: string;
  updatedAt: string;
}

interface AllProjectsPageProps {
  projects: Project[];
  onClose: () => void;
  onOpenProject: (projectId: string) => void;
  onCreateProject: () => void;
  onDeleteProject?: (projectId: string) => void;
  onShowDeleteSuccess?: () => void;
}

const AllProjectsPage: React.FC<AllProjectsPageProps> = ({
  projects,
  onClose,
  onOpenProject,
  onCreateProject,
  onShowDeleteSuccess,
  onDeleteProject,
}) => {
  const { themeStyle } = useTheme();
  const isLightTheme = checkLightTheme(themeStyle);
  const colors = useMemo(() => getThemeColors(isLightTheme), [isLightTheme]);

  const [hoveredProjectId, setHoveredProjectId] = useState<string | null>(null);
  const [deleteConfirmProject, setDeleteConfirmProject] = useState<Project | null>(null);

  const handleDelete = () => {
    if (onDeleteProject && deleteConfirmProject) {
      onShowDeleteSuccess?.();
      onDeleteProject(deleteConfirmProject.id);
    }
    setDeleteConfirmProject(null);
  };

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        flex: 1,
      }}
    >
      {/* Page Title with back arrow */}
      <div
        style={{
          padding: '24px 40px 16px 40px',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <button
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M15 18L9 12L15 6"
                stroke={colors.text.primary}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 600,
              color: colors.text.primary,
              margin: 0,
              fontFamily: 'SF Pro Display, -apple-system, sans-serif',
            }}
          >
            全部項目
          </h1>
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '0 40px 40px 40px',
        }}
      >
        {/* Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 24,
          }}
        >
          {/* New Project Card */}
          <div
            onClick={onCreateProject}
            style={{
              cursor: 'pointer',
              transition: 'transform 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}
          >
            <div
              style={{
                aspectRatio: '4/3',
                background: colors.fill.default,
                borderRadius: 12,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                border: `1px solid ${colors.stroke.secondary}`,
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 5V19M5 12H19" stroke={colors.text.tertiary} strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span
                style={{
                  fontSize: 14,
                  color: colors.text.tertiary,
                  fontFamily: 'SF Pro Display, -apple-system, sans-serif',
                }}
              >
                新建項目
              </span>
            </div>
          </div>

          {/* Project Cards */}
          {projects.map((project) => (
            <div
              key={project.id}
              style={{
                cursor: 'pointer',
                transition: 'transform 0.2s',
                transform: hoveredProjectId === project.id ? 'translateY(-2px)' : 'none',
              }}
              onMouseEnter={() => setHoveredProjectId(project.id)}
              onMouseLeave={() => {
                setHoveredProjectId(null);
              }}
              onClick={() => onOpenProject(project.id)}
            >
              {/* Thumbnail */}
              <div
                style={{
                  position: 'relative',
                  aspectRatio: '4/3',
                  background: colors.fill.default,
                  borderRadius: 12,
                  overflow: 'hidden',
                }}
              >
                {project.thumbnailUrl && (
                  <img
                    src={project.thumbnailUrl}
                    alt={project.name}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                )}

                {/* Hover delete button */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteConfirmProject(project);
                  }}
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: 'rgba(60, 60, 60, 0.9)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    opacity: hoveredProjectId === project.id ? 1 : 0,
                    transform: hoveredProjectId === project.id ? 'scale(1)' : 'scale(0.8)',
                    transition: 'all 0.2s ease',
                    backdropFilter: 'blur(8px)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(80, 80, 80, 0.95)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(60, 60, 60, 0.9)';
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 6H5H21" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>

              {/* Info */}
              <div style={{ padding: '10px 0' }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: colors.text.primary,
                    marginBottom: 2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontFamily: 'SF Pro Display, -apple-system, sans-serif',
                  }}
                >
                  {project.name}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: colors.text.tertiary,
                    fontFamily: 'SF Pro Display, -apple-system, sans-serif',
                  }}
                >
                  更新於 {project.updatedAt}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty state */}
        {projects.length === 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '80px 20px',
              gap: 16,
            }}
          >
            <span style={{ fontSize: 16, color: colors.text.tertiary, fontFamily: 'SF Pro Display, -apple-system, sans-serif' }}>
              还没有项目
            </span>
          </div>
        )}
      </div>

      <DeleteConfirmModal
        visible={!!deleteConfirmProject}
        title="删除项目"
        content={`确定要删除「${deleteConfirmProject?.name || ''}」吗？此操作无法撤销。`}
        onOk={handleDelete}
        onCancel={() => setDeleteConfirmProject(null)}
      />

    </div>
  );
};

export default AllProjectsPage;
