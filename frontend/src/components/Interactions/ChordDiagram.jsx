import { useEffect, useState, useRef, useMemo } from "react";
import * as d3 from "d3";
import { ChordSquares } from "./MatrixComponent";
import Tippy from "@tippyjs/react";
import { followCursor } from "tippy.js";
import { InteractionMap } from "./InteractionMap";
import useMeasure from "react-use-measure";
import { FiUserCheck } from 'react-icons/fi';

const stateAbbrevToName = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
};

const MARGIN = 30;
const NODE_THICKNESS = 15;
const NODE_CONNECTION_PADDING = 5;

const partyColor = (party) => {
  if (party === "D") return "#1f77b4"; // Blue
  if (party === "R") return "#d62728"; // Red
  return "#999999";
};

export const ChordDiagram = ({
  width,
  height,
  startDate,
  endDate,
  legislator,
  geojson,
  setLegislator
}) => {
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [ref ] = useMeasure();
  const svgRef = useRef(null);
  const [matrixChordData, setMatrixChordData] = useState([]);
  const [matrixChordNames, setMatrixChordNames] = useState([]);
  const [connectionColors, setConnectionColors] = useState({});
  const [legCivility, setLegCivility] = useState({});
  const [legMisinfo, setLegMisinfo] = useState({});
  const [legInteractionScore, setLegInteractionScore] = useState({});
  const [allIds, setAllIds] = useState([]);
  const [tooltipContent, setTooltipContent] = useState([]);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [connections, setConnections] = useState([]);
  const [topicMap, setTopicMap] = useState(new Map());
  const [hoveredChordIndex, setHoveredChordIndex] = useState(null);
  const [legStates, setLegStates] = useState([]);
  const [isMapHovered, setIsMapHovered] = useState(false);

  const url = "/api/chord/chord_interactions/?";

  useEffect(() => {
    if (!legislator) return;

    console.log("Legislator", legislator)

    const params = {
      start_date: startDate.format("YYYY-MM-DD"),
      end_date: endDate.format("YYYY-MM-DD"),
      legislator: legislator.legislator_id,
    };

    const queryParams = new URLSearchParams(params).toString();
    const query = `${url}${queryParams}`;

    function includesPair(arr, pair) {
      return arr.some((item) => item[0] === pair[0] && item[1] === pair[1]);
    }

    fetch(query)
      .then((response) => response.json())
      .then((data) => {
        console.log("INTERACTION DATA", data);
        const filteredData = data.filter(
          (d) => d.count > 0 && d.source_name != d.target_name
        );

        if (filteredData.length === 0) {
          console.log("No data after filtering");
          return;
        }

        const filteredConnections = [];

        filteredData.forEach((d, i) => {
          let toAdd = [
            stateAbbrevToName[d.source_state],
            stateAbbrevToName[d.target_state],
          ];

          if (
            !includesPair(filteredConnections, toAdd) &&
            d.source_state != d.target_state
          ) {
            filteredConnections[i] = toAdd;
          }
        });

        console.log("filtered connections", filteredConnections);

        const sourceIds = filteredData.map((d) => d.source_legislator_id);
        const targetIds = filteredData.map((d) => d.target_legislator_id);
        const allIds = Array.from(new Set([...sourceIds, ...targetIds]));

        const idToIndex = Object.fromEntries(
          allIds.map((id, idx) => [id, idx])
        );

        const n = allIds.length;
        const matrix = Array.from({ length: n }, () => Array(n).fill(0));

        filteredData.forEach((d) => {
          const source = idToIndex[d.source_legislator_id];
          const target = idToIndex[d.target_legislator_id];
          matrix[source][target] += d.count;
          matrix[target][source] += d.count;
        });

        const idToName = {};
        filteredData.forEach((d) => {
          idToName[d.source_legislator_id] = d.source_name;
          idToName[d.target_legislator_id] = d.target_name;
        });
        const allNames = allIds.map((id) => idToName[id]);

        const idToCivility = {};
        filteredData.forEach((d) => {
          idToCivility[d.source_legislator_id] = d.source_civility;
          idToCivility[d.target_legislator_id] = d.target_civility;
        });
        const allCivilities = allIds.map((id) => idToCivility[id]);

        const idToMisinfo = {};
        filteredData.forEach((d) => {
          console.log("D", d)
          idToMisinfo[d.source_legislator_id] = d.source_misinfo_count;
          idToMisinfo[d.target_legislator_id] = d.target_misinfo_count;
        });

        const allMisinfo = allIds.map((id) => idToMisinfo[id]);

        const idToInteractionScore = {};
        filteredData.forEach((d) => {
          idToInteractionScore[d.source_legislator_id] =
            d.source_interaction_score;
          idToInteractionScore[d.target_legislator_id] =
            d.target_interaction_score;
        });

        const allInteractionScores = allIds.map(
          (id) => idToInteractionScore[id]
        );

        const idToParty = {};
        filteredData.forEach((d) => {
          idToParty[d.source_legislator_id] = d.source_party;
          idToParty[d.target_legislator_id] = d.target_party;
        });

        const topicMapT = new Map();
        filteredData.forEach((d) => {
          const key = `${d.source_legislator_id}-${d.target_legislator_id}`;
          topicMapT.set(key, d.topics || []);
        });

        const idToState = {}

        filteredData.forEach((d) => {
          idToState[d.source_legislator_id] =
            d.source_state;
          idToState[d.target_legislator_id] =
            d.target_state;
        });

        const allStates = allIds.map((id) => idToState[id]);

        setMatrixChordData(matrix);
        setMatrixChordNames(allNames);
        setConnectionColors(idToParty);
        setLegCivility(allCivilities);
        setLegMisinfo(allMisinfo);
        setLegInteractionScore(allInteractionScores);
        setAllIds(allIds);
        setConnections(filteredConnections);
        setTopicMap(topicMapT);
        setLegStates(allStates)
      })
      .catch((error) => console.error("error fetching chord data", error));
  }, [startDate, endDate, legislator]);

  const allNodes = useMemo(() => {
    if (!legislator) return;
    if (!matrixChordData || matrixChordData.length === 0) return null;

    try {
      const radius = Math.min(width, height) / 2 - MARGIN;
      const chordGenerator = d3
        .chord()
        .padAngle(0.05)
        .sortSubgroups(d3.descending);

      const chords = chordGenerator(matrixChordData);

      const arcGenerator = d3
        .arc()
        .innerRadius(radius - NODE_THICKNESS)
        .outerRadius(radius);

      const outerArc = d3
        .arc()
        .innerRadius(radius + 5)
        .outerRadius(radius + 20);

      return chords.groups.map((group, i) => {
        const angle = (group.startAngle + group.endAngle) / 2;
        const rotate = (angle * 180) / Math.PI - 90;
        const isFlipped = angle > Math.PI;
        const textAnchor = isFlipped ? "end" : "start";
        const transform = `
    rotate(${rotate})
    translate(${Math.min(width, height) / 2 - 78 + 10})
    ${isFlipped ? "rotate(180)" : ""}
  `;

        const radius = Math.min((width, height / 2) - MARGIN + 10);
        const offset = 15;

        const cx = Math.cos(angle - Math.PI / 2) * (radius + offset);
        const cy = Math.sin(angle - Math.PI / 2) * (radius + offset);

        const maxMis = d3.max(legMisinfo);

        const maxCiv = d3.max(legCivility);

        const maxInt = d3.max(legInteractionScore);

        const nodeId = allIds[group.index];
        const party = connectionColors[nodeId];
        const arcFill = partyColor(party);

        return (
          <g key={i}>
            <path
              d={arcGenerator(group)}
              fill={arcFill}
              stroke={
                matrixChordNames[i] === legislator.name ? "#FFFF00" : arcFill
              }
              strokeWidth={2}
              onMouseOver={(e) => {
                const legislatorState = legStates[group.index]
                console.log("hovered");
                setTooltipContent(
                  <div
                    style={{
                      color: "gray",
                      borderRadius: "1px",
                      padding: "0.5px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      textAlign: "center",
                      height: "100%",
                      width: "100%",
                      lineHeight: "0.8em",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "1px",
                      }}
                    >
                      <strong style={{ fontSize: "1em", color: "white" }}>
                        {matrixChordNames[i]} ({legislatorState})
                      </strong>
                    </div>
                  </div>
                );
                setTooltipVisible(true);
              }}
              onMouseOut={(e) => {
                setTooltipVisible(false);
              }}
              onClick={() => {
                try {
                  console.log("clicked");
                  const legislatorId = allIds[group.index];
                  const legislatorName = matrixChordNames[group.index];
                  const legislatorState = legStates[group.index];
                  console.log("legStates", legStates)
                  console.log("state", legislatorState)
                  setLegislator({
                    legislator_id: legislatorId,
                    name: legislatorName,
                    party: connectionColors[legislatorId],
                    state: legislatorState,
                  });
                } catch (e) {
                  console.error("Error on click:", e);
                }
              }}
            />
            <ChordSquares
              x={cx}
              y={cy}
              rotate={rotate}
              legCivility={legCivility[i]}
              legMisinfo={legMisinfo[i]}
              maxMis={maxMis}
              maxCiv={maxCiv}
              maxInt={maxInt}
              legInteractionScore={legInteractionScore[i]}
            />
          </g>
        );
      });
    } catch (error) {
      console.error("Error generating chord diagram:", error);
      return null;
    }
  }, [matrixChordData, matrixChordNames, height, width, setLegislator, legislator?.name, legislator]);

  const allConnections = useMemo(() => {
    if (!matrixChordData || matrixChordData.length === 0) return null;

    try {
      const radius =
        Math.min(width, height) / 2 -
        MARGIN -
        NODE_THICKNESS -
        NODE_CONNECTION_PADDING;

      const chordGenerator = d3
        .chordDirected()
        .padAngle(0.05)
        .sortSubgroups(d3.descending);

      const chords = chordGenerator(matrixChordData);

      const ribbonGenerator = d3
        .ribbonArrow()
        .radius(radius)
        .source((d) => d.source)
        .target((d) => d.target);

      return chords.map((connection, i) => {
        const sourceIndex = connection.source.index;
        const targetIndex = connection.target.index;
        const sourceId = allIds[sourceIndex]
        const targetId = allIds[targetIndex]
        const party = connectionColors[sourceId];
        const fillColor = partyColor(party);
        const d = ribbonGenerator(connection);
        const key = `${allIds[sourceIndex]}-${allIds[targetIndex]}`;
        const topics = topicMap.get(key) || [];
        console.log("hoverd index", hoveredChordIndex)

        
        const sourceState = legStates[sourceIndex];
        const targetState = legStates[targetIndex];
        const isOutOfState = sourceState !== targetState;

        // Determine stroke color
        let strokeColor = fillColor;
        let strokeWidth = 0.5;

        if (hoveredChordIndex === i) {
          strokeColor = "#FFFF00";
          strokeWidth = 1.5;
        } else if (isOutOfState) {
          strokeColor = "#FFFF00"; 
          strokeWidth = 1; 
        }

        return (
          <path
            key={i}
            d={d}
            fill={fillColor}
            opacity={hoveredChordIndex === i || isOutOfState ? 0.75 : 0.3} // Increased opacity for out-of-state
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            onMouseOut={(e) => {
              setHoveredChordIndex(null)
              setTooltipVisible(false);
            }}
            onMouseOver={() => {
              console.log("I", i)
              setHoveredChordIndex(i)
              setTooltipContent(
                <div
                  style={{
                    color: "gray",
                    borderRadius: "1px",
                    padding: "0.5px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    height: "100%",
                    width: "100%",
                    lineHeight: "0.8em",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "5px",
                    }}
                  >
                    <strong style={{ fontSize: "1em", color: "white" }}>
                      From: {matrixChordNames[connection.source.index]}
                    </strong>
                    <strong style={{ fontSize: "1em", color: "white" }}>
                      To: {matrixChordNames[connection.target.index]}
                    </strong>
                    <strong style={{ fontSize: "1em", color: "white" }}>
                      Interactions: {matrixChordData[sourceIndex][targetIndex]}
                    </strong>

                    {topics.length > 0 && (
                      <>
                        <strong style={{ fontSize: "1em", color: "white" }}>
                          Topics:
                        </strong>
                        <ul
                          style={{
                            margin: 0,
                            paddingLeft: "1em",
                            color: "white",
                          }}
                        >
                          {topics.map((topic, j) => (
                            <li key={j} style={{ fontSize: "0.9em" }}>
                              {topic}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                </div>
              );
              setTooltipVisible(true);
            }}
          />
        );
      });
    } catch (error) {
      console.error("Error generating connections:", error);
      return null;
    }
  }, [matrixChordData, width, height, hoveredChordIndex, legStates]);

  const toggleMapSize = () => {
    setIsMapExpanded(!isMapExpanded);
  };

  if (!legislator) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full p-6 text-center rounded-lg">
        <div className="max-w-md">
          <FiUserCheck
            size={56}
            className="text-primary dark:text-primary-focus mx-auto mb-5"
            aria-hidden="true"
          />
          <h2 className="text-2xl font-semibold text-base-content mb-3">
            Legislator Interaction Data
          </h2>
          <p className="text-base text-base-content/80">
            Please select a legislator from the sidebar to display detailed interaction data and analytics.
          </p>
        </div>
      </div>
    );
  }

  const mapSize = isMapExpanded
    ? Math.min(width, height) * 0.9
    : Math.min(width, height) / 2;

  return (
    <div
      style={{
        width: `100%`,
        height: `${height}px`,
        position: "relative",
      }}
    >

      <div
        ref={ref}
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: `${mapSize}px`,
          height: `${mapSize}px`,
          opacity: 0.9,
          zIndex: isMapExpanded ? 20 : 10,
          transform: "translate(-50%, -50%)",
          cursor: "pointer",
          transition: "all 0.3s ease",

        }}
        onClick={toggleMapSize}
        onMouseEnter={() => setIsMapHovered(true)}
        onMouseLeave={() => setIsMapHovered(false)}

      >
        <InteractionMap
          height={mapSize}
          width={mapSize}
          data={geojson}
          connections={connections}
          isMapHovered={isMapHovered}
        />
      </div>


      <Tippy
        content={tooltipContent}
        visible={tooltipVisible}
        arrow={false}
        placement="top"
        followCursor={true}
        appendTo={() => document.body}
        plugins={[followCursor]}
        style={{ pointerEvents: "none" }}
      >
        <svg
          ref={svgRef}
          width={width}
          height={height}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            zIndex: isMapExpanded ? 10 : 0,
            opacity: isMapExpanded ? 0.5 : 1,
          }}
        >
          {matrixChordData.length > 0 && (
            <g transform={`translate(${width / 2}, ${height / 2})`}>
              {allConnections}
              {allNodes}
            </g>
          )}
        </svg>
      </Tippy>
    </div>
  );
};