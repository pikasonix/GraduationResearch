import React from "react";
import { Button } from "@/components/ui/button";

interface ProjectHeaderSectionProps {
  projectTitle: string;
  projectTags: string[];
  onEditProject: () => void;
}

const ProjectHeaderSection: React.FC<ProjectHeaderSectionProps> = ({
  projectTitle,
  projectTags,
  onEditProject,
}) => {
  return (
    <section aria-labelledby="project-header-heading">
      <div className="flex items-start gap-4">
        <div className="flex-grow">
          <h2
            id="project-header-heading"
            className="text-xl font-semibold text-gray-900"
          >
            {projectTitle || "Project Title Not Set"}
          </h2>
        </div>
        <Button
          variant="outline"
          onClick={onEditProject}
          className="flex-shrink-0"
        >
          Chỉnh sửa
        </Button>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {projectTags && projectTags.length > 0 ? (
          projectTags.map((tag, index) => (
            <span
              key={index}
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground border border-border"
            >
              {tag}
            </span>
          ))
        ) : (
          <span className="text-sm text-gray-500 italic">No tags added</span>
        )}
      </div>
    </section>
  );
};

export default ProjectHeaderSection;
