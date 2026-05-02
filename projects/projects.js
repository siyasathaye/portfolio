import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";
import { fetchJSON, renderProjects } from "../global.js";

const projects = (await fetchJSON("../lib/projects.json")) ?? [];
const projectsContainer = document.querySelector(".projects");
const projectsTitle = document.querySelector(".projects-title");
const searchInput = document.querySelector(".searchBar");
const svg = d3.select("#projects-pie-plot");
const legend = d3.select(".legend");
const arcGenerator = d3.arc().innerRadius(0).outerRadius(50);
const sliceGenerator = d3.pie().value((d) => d.value);
const colors = d3.scaleOrdinal(d3.schemeTableau10);

let query = "";
let selectedYear = null;
let selectedIndex = -1;

function getQueryFilteredProjects() {
  return projects.filter((project) => {
    const values = Object.values(project).join("\n").toLowerCase();
    return values.includes(query.toLowerCase());
  });
}

function getVisibleProjects() {
  const queryFilteredProjects = getQueryFilteredProjects();

  if (!selectedYear) {
    return queryFilteredProjects;
  }

  return queryFilteredProjects.filter((project) => String(project.year) === selectedYear);
}

function updateProjectsTitle(visibleProjects) {
  if (!projectsTitle) {
    return;
  }

  projectsTitle.textContent = `Projects (${visibleProjects.length})`;
}

function renderPieChart(projectsGiven) {
  const rolledData = d3.rollups(
    projectsGiven,
    (group) => group.length,
    (project) => String(project.year),
  );

  const data = rolledData.map(([year, count]) => ({
    value: count,
    label: year,
  }));

  selectedIndex = selectedYear ? data.findIndex((d) => d.label === selectedYear) : -1;
  if (selectedYear && selectedIndex === -1) {
    selectedYear = null;
  }

  svg.selectAll("path").remove();
  legend.selectAll("li").remove();

  const arcs = sliceGenerator(data).map((d) => arcGenerator(d));

  arcs.forEach((arc, index) => {
    svg
      .append("path")
      .attr("d", arc)
      .attr("fill", colors(index))
      .attr("class", index === selectedIndex ? "selected" : null)
      .on("click", () => {
        selectedYear = selectedYear === data[index].label ? null : data[index].label;
        updateView();
      });
  });

  data.forEach((d, index) => {
    legend
      .append("li")
      .attr("style", `--color:${colors(index)}`)
      .attr("class", index === selectedIndex ? "legend-item selected" : "legend-item")
      .html(`<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`)
      .on("click", () => {
        selectedYear = selectedYear === d.label ? null : d.label;
        updateView();
      });
  });
}

function updateView() {
  const queryFilteredProjects = getQueryFilteredProjects();
  const visibleProjects = getVisibleProjects();

  renderProjects(visibleProjects, projectsContainer, "h2");
  renderPieChart(queryFilteredProjects);
  updateProjectsTitle(visibleProjects);
}

if (searchInput) {
  searchInput.addEventListener("input", (event) => {
    query = event.target.value;
    updateView();
  });
}

updateView();
