"use client";
import { Button } from "@/components/ui/button";
import { max } from "d3-array";
import { axisBottom, axisLeft } from "d3-axis"; // D3 is a JavaScript library for data visualization: https://d3js.org/
import { csv } from "d3-fetch";
import { scaleBand, scaleLinear, scaleOrdinal } from "d3-scale";
import { select } from "d3-selection";
import { useEffect, useMemo, useRef, useState } from "react";

const DIETS = ["carnivore", "herbivore", "omnivore"] as const;
type Diet = (typeof DIETS)[number];

interface AnimalDatum {
  name: string;
  speed: number; // km/h
  diet: Diet;
}

const isDiet = (value: string): value is Diet => (DIETS as readonly string[]).includes(value);

// 148 bars can't be read (or labelled) on one chart, so we show the fastest animals only. The diet filter re-ranks
// within the chosen diet, and the summary underneath is computed from every animal.
const TOP_N = 20;
const MIN_WIDTH = 600;
const HEIGHT = 520;
const MARGIN = { top: 70, right: 30, bottom: 130, left: 70 };
const MAX_BAR_WIDTH = 24;

// One fixed colour per diet (colour follows the category, never its rank, so filtering doesn't repaint bars).
// These are the first three slots of a colour-blind-checked categorical palette; the values live in Tailwind
// arbitrary CSS variables on the wrapper below so each has a light and a dark-mode step.
const DIET_COLOR: Record<Diet, string> = {
  carnivore: "var(--diet-carnivore)",
  herbivore: "var(--diet-herbivore)",
  omnivore: "var(--diet-omnivore)",
};

// Path for a bar whose top corners are rounded (radius r) and whose bottom sits square on the baseline.
const barPath = (x: number, y: number, w: number, h: number, r: number) => {
  const radius = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + radius}Q${x},${y} ${x + radius},${y}H${x + w - radius}Q${x + w},${y} ${x + w},${
    y + radius
  }V${y + h}Z`;
};

export default function AnimalSpeedGraph() {
  // useRef creates a reference to the div where D3 will draw the chart.
  // https://react.dev/reference/react/useRef
  const graphRef = useRef<HTMLDivElement>(null);

  const [animalData, setAnimalData] = useState<AnimalDatum[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dietFilter, setDietFilter] = useState<Diet | "all">("all");
  const [containerWidth, setContainerWidth] = useState(0);

  // Load and tidy the CSV that was cleaned in Python (public/sample_animals.csv is served at /sample_animals.csv).
  useEffect(() => {
    void csv<AnimalDatum>("/sample_animals.csv", (row) => {
      const speed = Number(row.speed);
      const diet = (row.diet ?? "").trim().toLowerCase();
      const name = (row.name ?? "").trim();
      // Returning null skips the row: drop anything without a name, a finite speed, or a valid diet.
      if (!name || !Number.isFinite(speed) || !isDiet(diet)) return null;
      return { name, speed, diet };
    })
      .then((rows) => {
        // The bar chart uses one band per animal name, so a name that appears twice would draw two bars on top of
        // each other. Keep each animal's fastest recorded speed (this is a "top speed" chart).
        const byName = new Map<string, AnimalDatum>();
        for (const row of rows) {
          const existing = byName.get(row.name);
          if (!existing || row.speed > existing.speed) byName.set(row.name, row);
        }
        setAnimalData([...byName.values()]);
      })
      .catch(() => setLoadError("Couldn't load the animal speed data."));
  }, []);

  // Track the container width so the chart re-draws to fit when the window is resized.
  useEffect(() => {
    const el = graphRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setContainerWidth(entry?.contentRect.width ?? 0));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Memoized so the drawing effect below only re-runs when the data or filter actually changes.
  const shown = useMemo(
    () =>
      animalData
        .filter((d) => dietFilter === "all" || d.diet === dietFilter)
        .sort((a, b) => b.speed - a.speed)
        .slice(0, TOP_N),
    [animalData, dietFilter],
  );

  useEffect(() => {
    // Clear any previous SVG to avoid duplicates when React hot-reloads
    if (graphRef.current) {
      graphRef.current.innerHTML = "";
    }

    if (shown.length === 0) return;

    // Set up chart dimensions and margins
    const width = Math.max(containerWidth, MIN_WIDTH);
    const innerWidth = width - MARGIN.left - MARGIN.right;
    const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;

    // Create the SVG element where D3 will draw the chart
    // https://github.com/d3/d3-selection
    const svg = select(graphRef.current!)
      .append<SVGSVGElement>("svg")
      .attr("width", width)
      .attr("height", HEIGHT)
      .attr("role", "img")
      .attr(
        "aria-label",
        `Bar chart of the ${shown.length} fastest ${
          dietFilter === "all" ? "animals" : dietFilter + "s"
        } by top speed in km/h. ` + `A data table follows the chart.`,
      );

    const chart = svg.append("g").attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    // Scales: band for the animal names, linear for speed, ordinal for diet colour.
    // https://github.com/d3/d3-scale#band-scales
    const x = scaleBand()
      .domain(shown.map((d) => d.name))
      .range([0, innerWidth])
      .padding(0.3);
    // https://github.com/d3/d3-scale#linear-scales
    const y = scaleLinear()
      .domain([0, max(shown, (d) => d.speed) ?? 0])
      .nice()
      .range([innerHeight, 0]);
    // https://github.com/d3/d3-scale#ordinal-scales
    const color = scaleOrdinal<Diet, string>()
      .domain([...DIETS])
      .range(DIETS.map((d) => DIET_COLOR[d]));

    // Horizontal gridlines: hairline and recessive (tick lines that span the plot).
    chart
      .append("g")
      .call(
        axisLeft(y)
          .ticks(6)
          .tickSize(-innerWidth)
          .tickFormat(() => ""),
      )
      .call((g) => g.select(".domain").remove())
      .selectAll("line")
      .attr("class", "stroke-border");

    // Bars: one per animal, capped at MAX_BAR_WIDTH and centred in its band, rounded at the top only.
    const barWidth = Math.min(x.bandwidth(), MAX_BAR_WIDTH);
    const bars = chart.append("g").selectAll("g").data(shown).join("g");
    bars
      .append("path")
      .attr("d", (d) =>
        barPath((x(d.name) ?? 0) + (x.bandwidth() - barWidth) / 2, y(d.speed), barWidth, innerHeight - y(d.speed), 4),
      )
      .attr("fill", (d) => color(d.diet))
      // Native hover tooltip; the values are also always visible (labels below) and in the table.
      .append("title")
      .text((d) => `${d.name} (${d.diet}): ${d.speed} km/h`);

    // Value at the tip of each bar. Also the accessibility "relief" for colours with lower contrast on light backgrounds.
    bars
      .append("text")
      .attr("class", "fill-foreground")
      .attr("x", (d) => (x(d.name) ?? 0) + x.bandwidth() / 2)
      .attr("y", (d) => y(d.speed) - 6)
      .attr("text-anchor", "middle")
      .attr("font-size", 11)
      .text((d) => Number(d.speed.toFixed(1)));

    // Axes: names along the bottom (rotated so they don't overlap), speed up the left.
    // https://github.com/d3/d3-axis
    const xAxis = chart
      .append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(axisBottom(x).tickSize(0))
      .call((g) => g.select(".domain").attr("class", "stroke-border"));
    xAxis
      .selectAll("text")
      .attr("class", "fill-muted-foreground")
      .attr("font-size", 12)
      .attr("transform", "rotate(-45)")
      .attr("text-anchor", "end")
      .attr("dx", "-0.4em")
      .attr("dy", "0.6em");

    chart
      .append("g")
      .call(axisLeft(y).ticks(6).tickSize(0).tickPadding(8))
      .call((g) => g.select(".domain").remove())
      .selectAll("text")
      .attr("class", "fill-muted-foreground")
      .attr("font-size", 12);

    // Axis titles
    svg
      .append("text")
      .attr("class", "fill-foreground")
      .attr("x", MARGIN.left + innerWidth / 2)
      .attr("y", HEIGHT - 8)
      .attr("text-anchor", "middle")
      .attr("font-size", 13)
      .text("Animal");
    svg
      .append("text")
      .attr("class", "fill-foreground")
      .attr("transform", `translate(16,${MARGIN.top + innerHeight / 2}) rotate(-90)`)
      .attr("text-anchor", "middle")
      .attr("font-size", 13)
      .text("Speed (km/h)");

    // Legend (top-right): a colour square + a label in normal text colour for each diet.
    const legend = svg.append("g").attr("transform", `translate(${width - MARGIN.right - 260},20)`);
    DIETS.forEach((diet, i) => {
      const item = legend.append("g").attr("transform", `translate(${i * 88},0)`);
      item.append("rect").attr("width", 12).attr("height", 12).attr("rx", 2).attr("fill", color(diet));
      item
        .append("text")
        .attr("class", "fill-foreground")
        .attr("x", 18)
        .attr("y", 10)
        .attr("font-size", 12)
        .text(diet[0]!.toUpperCase() + diet.slice(1));
    });
  }, [shown, dietFilter, containerWidth]);

  // Summary over every (de-duplicated) animal, so the chart's "fastest only" view doesn't mislead about diet overall.
  const summary = DIETS.map((diet) => {
    const group = animalData.filter((d) => d.diet === diet);
    const fastest = group.reduce<AnimalDatum | undefined>(
      (best, d) => (!best || d.speed > best.speed ? d : best),
      undefined,
    );
    const mean = group.length ? group.reduce((sum, d) => sum + d.speed, 0) / group.length : 0;
    return { diet, count: group.length, mean, fastest };
  });

  if (loadError) return <p className="text-destructive">{loadError}</p>;

  return (
    <div className="[--diet-carnivore:#eb6834] [--diet-herbivore:#1baf7a] [--diet-omnivore:#2a78d6] dark:[--diet-carnivore:#d95926] dark:[--diet-herbivore:#199e70] dark:[--diet-omnivore:#3987e5]">
      {/* Diet filter */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm text-muted-foreground">Show the {TOP_N} fastest:</span>
        {(["all", ...DIETS] as const).map((option) => (
          <Button
            key={option}
            size="sm"
            variant={dietFilter === option ? "default" : "outline"}
            aria-pressed={dietFilter === option}
            onClick={() => setDietFilter(option)}
          >
            {option === "all" ? "All diets" : option[0]!.toUpperCase() + option.slice(1) + "s"}
          </Button>
        ))}
      </div>

      {/* The chart scrolls sideways on narrow screens instead of squashing the labels */}
      <div className="overflow-x-auto">
        <div ref={graphRef} className="w-full" style={{ minHeight: HEIGHT }} />
      </div>
      {animalData.length === 0 && <p className="text-sm text-muted-foreground">Loading animal data...</p>}

      {/* Whole-dataset summary: the actual answer to "does diet predict speed?" */}
      {animalData.length > 0 && (
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {summary.map(({ diet, count, mean, fastest }) => (
            <div key={diet} className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-sm font-medium capitalize">
                <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: DIET_COLOR[diet] }} />
                {diet}s ({count})
              </div>
              <p className="mt-2 text-2xl font-semibold">{mean.toFixed(1)} km/h</p>
              <p className="text-sm text-muted-foreground">
                average speed{fastest ? ` · fastest: ${fastest.name} (${Number(fastest.speed.toFixed(1))})` : ""}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Table view of exactly what the chart shows, for screen readers and anyone who wants exact numbers */}
      {shown.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer text-sm font-medium">View chart data as a table</summary>
          <div className="overflow-x-auto">
            <table className="mt-2 w-full max-w-md text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-1 pr-4">Animal</th>
                  <th className="py-1 pr-4">Diet</th>
                  <th className="py-1">Speed (km/h)</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((d) => (
                  <tr key={d.name} className="border-b">
                    <td className="py-1 pr-4">{d.name}</td>
                    <td className="py-1 pr-4 capitalize">{d.diet}</td>
                    <td className="py-1">{Number(d.speed.toFixed(1))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
