"use client";

import React, { useEffect, useState } from "react";
import ProjectCard from "./ProjectCard";
import Pagination from "@/components/common/Pagination";
import { type ProjectWithFounder } from "@/lib/redux/services/profileApi";
import { PROJECT_CATEGORY_OPTIONS } from "@/lib/constants/options";

/**
 * Project data types
 */
interface ProjectsListProps {
  projects: ProjectWithFounder[];
  activeFilter: string;
  selectedTag: string | null;
}

/**
 * Client component for displaying projects with pagination
 */
export default function ProjectsList({
  projects,
  activeFilter,
  selectedTag,
}: ProjectsListProps) {
  const [currentPage, setCurrentPage] = useState(1);

  const filteredProjects = projects.filter((project) => {
    const typeFilter = (activeFilter === "all" || project.profiles?.type?.includes(activeFilter));

    const tagValue = selectedTag
      ? PROJECT_CATEGORY_OPTIONS.find((opt) => opt.label === selectedTag)?.value
      : null;
    const tagFilter = (!tagValue || (project.tags && project.tags.includes(tagValue)));

    return typeFilter && tagFilter;
  });

  const projectsPerPage = 12;
  const totalPages = Math.ceil(filteredProjects.length / projectsPerPage);

  // Get current projects for the page
  const indexOfLastProject = currentPage * projectsPerPage;
  const indexOfFirstProject = indexOfLastProject - projectsPerPage;
  const currentProjects = filteredProjects.slice(
    indexOfFirstProject,
    indexOfLastProject
  );

  // Reset to first page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter]);

  return (
    <>
      {/* Project Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {currentProjects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        setCurrentPage={setCurrentPage}
      />
    </>
  );
}
