import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

const GITHUB_REPO = "https://github.com/siyasathaye/portfolio";

let data = [];
let commits = [];
let xScale;
let yScale;

async function loadData() {
  const loadedData = await d3.csv("loc.csv", (row) => ({
    ...row,
    line: Number(row.line),
    depth: Number(row.depth),
    length: Number(row.length),
    date: new Date(row.date + "T00:00" + row.timezone),
    datetime: new Date(row.datetime),
  }));

  return loadedData;
}

function processCommits(lines) {
  return d3.groups(lines, (d) => d.commit).map(([commit, commitLines]) => {
    const first = commitLines[0];
    const { author, date, time, timezone, datetime } = first;

    const ret = {
      id: commit,
      url: `${GITHUB_REPO}/commit/${commit}`,
      author,
      date,
      time,
      timezone,
      datetime,
      hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
      totalLines: commitLines.length,
    };

    Object.defineProperty(ret, "lines", {
      value: commitLines,
      writable: false,
      configurable: false,
      enumerable: false,
    });

    return ret;
  });
}

function renderCommitInfo(lines, commitData) {
  const container = d3.select("#stats");
  container.html("");

  const fileLengths = d3.rollups(
    lines,
    (values) => d3.max(values, (d) => d.line),
    (d) => d.file,
  );

  const longestFile = d3.greatest(fileLengths, (d) => d[1]);
  const averageFileLength = d3.mean(fileLengths, (d) => d[1]);
  const workByPeriod = d3.rollups(
    commitData,
    (values) => values.length,
    (d) => d.datetime.toLocaleString("en", { dayPeriod: "short" }),
  );
  const busiestPeriod = d3.greatest(workByPeriod, (d) => d[1])?.[0];

  const stats = [
    { label: 'Total <abbr title="Lines of code">LOC</abbr>', value: lines.length },
    { label: "Total commits", value: commitData.length },
    { label: "Number of files", value: d3.group(lines, (d) => d.file).size },
    { label: "Average file length", value: `${d3.format(".1f")(averageFileLength)} lines` },
    { label: "Longest file", value: `${longestFile?.[0] ?? "N/A"} (${longestFile?.[1] ?? 0} lines)` },
    { label: "Longest line length", value: `${d3.max(lines, (d) => d.length)} characters` },
    { label: "Maximum depth", value: d3.max(lines, (d) => d.depth) },
    { label: "Most active time", value: busiestPeriod ?? "N/A" },
  ];

  const dl = container.append("dl").attr("class", "stats");

  stats.forEach((stat) => {
    dl.append("dt").html(stat.label);
    dl.append("dd").text(stat.value);
  });
}

function renderTooltipContent(commit) {
  const link = document.getElementById("commit-link");
  const date = document.getElementById("commit-date");
  const time = document.getElementById("commit-time");
  const author = document.getElementById("commit-author");
  const lines = document.getElementById("commit-lines");

  if (Object.keys(commit).length === 0) {
    return;
  }

  link.href = commit.url;
  link.textContent = commit.id.slice(0, 7);
  date.textContent = commit.datetime?.toLocaleString("en", {
    dateStyle: "full",
  });
  time.textContent = commit.datetime?.toLocaleString("en", {
    timeStyle: "short",
  });
  author.textContent = commit.author;
  lines.textContent = commit.totalLines;
}

function updateTooltipVisibility(isVisible) {
  const tooltip = document.getElementById("commit-tooltip");
  tooltip.hidden = !isVisible;
}

function updateTooltipPosition(event) {
  const tooltip = document.getElementById("commit-tooltip");
  tooltip.style.left = `${event.clientX + 12}px`;
  tooltip.style.top = `${event.clientY + 12}px`;
}

function isCommitSelected(selection, commit) {
  if (!selection) {
    return false;
  }

  const [[x0, y0], [x1, y1]] = selection;
  const x = xScale(commit.datetime);
  const y = yScale(commit.hourFrac);

  return x0 <= x && x <= x1 && y0 <= y && y <= y1;
}

function renderSelectionCount(selection) {
  const selectedCommits = selection
    ? commits.filter((commit) => isCommitSelected(selection, commit))
    : [];

  const countElement = document.querySelector("#selection-count");
  countElement.textContent = `${selectedCommits.length || "No"} commits selected`;

  return selectedCommits;
}

function renderLanguageBreakdown(selection) {
  const selectedCommits = selection
    ? commits.filter((commit) => isCommitSelected(selection, commit))
    : [];

  const container = document.getElementById("language-breakdown");

  if (selectedCommits.length === 0) {
    container.innerHTML = "";
    return;
  }

  const selectedLines = selectedCommits.flatMap((commit) => commit.lines);
  const breakdown = d3.rollups(
    selectedLines,
    (values) => values.length,
    (d) => d.type || "Unknown",
  );

  container.innerHTML = "";

  breakdown.forEach(([language, count]) => {
    const proportion = count / selectedLines.length;
    const formatted = d3.format(".1~%")(proportion);

    container.innerHTML += `
      <dt>${language}</dt>
      <dd>${count} lines (${formatted})</dd>
    `;
  });
}

function brushed(event) {
  const selection = event.selection;

  d3.selectAll("#chart circle").classed("selected", (d) =>
    isCommitSelected(selection, d),
  );

  renderSelectionCount(selection);
  renderLanguageBreakdown(selection);
}

function createBrushSelector(svg) {
  svg.call(d3.brush().on("start brush end", brushed));
  svg.selectAll(".dots, .overlay ~ *").raise();
}

function renderScatterPlot(lines, commitData) {
  const width = 1000;
  const height = 600;
  const margin = { top: 10, right: 10, bottom: 30, left: 50 };
  const usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };

  const chart = d3.select("#chart");
  chart.html("");

  const svg = chart
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .style("overflow", "visible");

  xScale = d3
    .scaleTime()
    .domain(d3.extent(commitData, (d) => d.datetime))
    .range([usableArea.left, usableArea.right])
    .nice();

  yScale = d3
    .scaleLinear()
    .domain([0, 24])
    .range([usableArea.bottom, usableArea.top]);

  const [minLines, maxLines] = d3.extent(commitData, (d) => d.totalLines);
  const rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([2, 30]);
  const sortedCommits = d3.sort(commitData, (d) => -d.totalLines);

  const gridlines = svg
    .append("g")
    .attr("class", "gridlines")
    .attr("transform", `translate(${usableArea.left}, 0)`);

  gridlines.call(d3.axisLeft(yScale).tickFormat("").tickSize(-usableArea.width));

  const dots = svg.append("g").attr("class", "dots");

  dots
    .selectAll("circle")
    .data(sortedCommits)
    .join("circle")
    .attr("cx", (d) => xScale(d.datetime))
    .attr("cy", (d) => yScale(d.hourFrac))
    .attr("r", (d) => rScale(d.totalLines))
    .attr("fill", "steelblue")
    .style("fill-opacity", 0.7)
    .on("mouseenter", (event, commit) => {
      d3.select(event.currentTarget).style("fill-opacity", 1);
      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on("mousemove", (event) => {
      updateTooltipPosition(event);
    })
    .on("mouseleave", (event) => {
      d3.select(event.currentTarget).style("fill-opacity", 0.7);
      updateTooltipVisibility(false);
    });

  const xAxis = d3.axisBottom(xScale);
  const yAxis = d3
    .axisLeft(yScale)
    .tickFormat((d) => `${String(d % 24).padStart(2, "0")}:00`);

  svg
    .append("g")
    .attr("transform", `translate(0, ${usableArea.bottom})`)
    .call(xAxis);

  svg
    .append("g")
    .attr("transform", `translate(${usableArea.left}, 0)`)
    .call(yAxis);

  createBrushSelector(svg);
}

data = await loadData();
commits = processCommits(data);

renderCommitInfo(data, commits);
renderScatterPlot(data, commits);
