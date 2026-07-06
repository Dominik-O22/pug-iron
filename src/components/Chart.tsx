import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";

import { tokens, type ColorToken } from "../lib/tokens";

export type ChartPoint = {
  label?: string;
  x: number;
  y: number;
};

export type ChartLineSeries = {
  color: ColorToken;
  dashed?: boolean;
  id: string;
  opacity?: number;
  points: ChartPoint[];
  strokeWidth?: number;
};

export type ChartMarkerSeries = {
  color: ColorToken;
  id: string;
  latestOnly?: boolean;
  opacity?: number;
  points: ChartPoint[];
  radius?: number;
};

export type ChartHorizontalLine = {
  color: ColorToken;
  dashed?: boolean;
  label?: string;
  opacity?: number;
  value: number;
};

type LineChartProps = {
  emptyMessage: string;
  formatValue: (value: number) => string;
  height?: number;
  horizontalLines?: ChartHorizontalLine[];
  lines: ChartLineSeries[];
  markers?: ChartMarkerSeries[];
};

const CHART_HEIGHT = 190;
const PLOT_INSET = {
  bottom: 28,
  left: 42,
  right: 12,
  top: 16
};

export function LineChart({
  emptyMessage,
  formatValue,
  height = CHART_HEIGHT,
  horizontalLines = [],
  lines,
  markers = []
}: LineChartProps) {
  const [width, setWidth] = useState(0);
  const chartModel = useMemo(
    () => buildChartModel({ height, horizontalLines, lines, markers, width }),
    [height, horizontalLines, lines, markers, width]
  );

  return (
    <View
      className="min-h-[190px] w-full"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {width > 0 && chartModel ? (
        <Svg height={height} width={width}>
          {chartModel.yTicks.map((tick) => (
            <Line
              key={`grid-${tick.value}`}
              stroke={tokens.colors.line}
              strokeOpacity={0.75}
              strokeWidth={1}
              x1={PLOT_INSET.left}
              x2={width - PLOT_INSET.right}
              y1={tick.y}
              y2={tick.y}
            />
          ))}

          {chartModel.yTicks.map((tick) => (
            <SvgText
              fill={tokens.colors.textDim}
              fontFamily="IBMPlexMono-Regular"
              fontSize={11}
              key={`y-label-${tick.value}`}
              textAnchor="end"
              x={PLOT_INSET.left - 6}
              y={tick.y + 4}
            >
              {formatValue(tick.value)}
            </SvgText>
          ))}

          {chartModel.xLabels.map((label) => (
            <SvgText
              fill={tokens.colors.textDim}
              fontFamily="IBMPlexMono-Regular"
              fontSize={11}
              key={`x-label-${label.text}-${label.x}`}
              textAnchor={label.anchor}
              x={label.x}
              y={height - 4}
            >
              {label.text}
            </SvgText>
          ))}

          {horizontalLines.map((line) => {
            const y = chartModel.scaleY(line.value);

            return (
              <Line
                key={`horizontal-${line.value}-${line.label ?? ""}`}
                stroke={tokens.colors[line.color]}
                strokeDasharray={line.dashed ? "5 5" : undefined}
                strokeOpacity={line.opacity ?? 1}
                strokeWidth={1}
                x1={PLOT_INSET.left}
                x2={width - PLOT_INSET.right}
                y1={y}
                y2={y}
              />
            );
          })}

          {horizontalLines.map((line) => {
            if (!line.label) {
              return null;
            }

            const y = chartModel.scaleY(line.value);

            return (
              <SvgText
                fill={tokens.colors[line.color]}
                fontFamily="IBMPlexMono-Regular"
                fontSize={11}
                key={`horizontal-label-${line.value}-${line.label}`}
                opacity={line.opacity ?? 1}
                x={PLOT_INSET.left + 5}
                y={Math.max(PLOT_INSET.top + 11, y - 5)}
              >
                {line.label}
              </SvgText>
            );
          })}

          {lines.map((series) => {
            const path = chartModel.pathFor(series.points);

            if (!path) {
              return null;
            }

            return (
              <Path
                d={path}
                fill="none"
                key={series.id}
                opacity={series.opacity ?? 1}
                stroke={tokens.colors[series.color]}
                strokeDasharray={series.dashed ? "5 5" : undefined}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={series.strokeWidth ?? 1.5}
              />
            );
          })}

          {markers.map((series) => {
            const points = series.latestOnly ? latestPoint(series.points) : series.points;

            return points.map((point) => (
              <Circle
                cx={chartModel.scaleX(point.x)}
                cy={chartModel.scaleY(point.y)}
                fill={tokens.colors[series.color]}
                key={`${series.id}-${point.x}-${point.y}`}
                opacity={series.opacity ?? 1}
                r={series.radius ?? 3}
              />
            ));
          })}
        </Svg>
      ) : (
        <View className="min-h-[190px] items-center justify-center rounded-lg border border-line bg-panel-2 px-4">
          <Text className="text-center font-barlow text-[16px] leading-[22px] text-text-dim">
            {emptyMessage}
          </Text>
        </View>
      )}
    </View>
  );
}

function buildChartModel({
  height,
  horizontalLines,
  lines,
  markers,
  width
}: {
  height: number;
  horizontalLines: ChartHorizontalLine[];
  lines: ChartLineSeries[];
  markers: ChartMarkerSeries[];
  width: number;
}) {
  if (width <= 0) {
    return null;
  }

  const allPoints = [
    ...lines.flatMap((series) => series.points),
    ...markers.flatMap((series) => series.points)
  ];
  const yValues = [
    ...allPoints.map((point) => point.y),
    ...horizontalLines.map((line) => line.value)
  ];

  if (allPoints.length === 0 && yValues.length === 0) {
    return null;
  }

  const xValues = allPoints.map((point) => point.x);
  const xMin = xValues.length > 0 ? Math.min(...xValues) : 0;
  const xMax = xValues.length > 0 ? Math.max(...xValues) : xMin + 1;
  const xPadding = xMin === xMax ? 1 : 0;
  const yMinRaw = Math.min(...yValues);
  const yMaxRaw = Math.max(...yValues);
  const yRange = yMaxRaw - yMinRaw;
  const yPadding = yRange === 0 ? 1 : yRange * 0.12;
  const yMin = yMinRaw - yPadding;
  const yMax = yMaxRaw + yPadding;
  const plotWidth = Math.max(1, width - PLOT_INSET.left - PLOT_INSET.right);
  const plotHeight = Math.max(1, height - PLOT_INSET.top - PLOT_INSET.bottom);

  function scaleX(value: number): number {
    return (
      PLOT_INSET.left +
      ((value - (xMin - xPadding)) / (xMax + xPadding - (xMin - xPadding))) * plotWidth
    );
  }

  function scaleY(value: number): number {
    return PLOT_INSET.top + ((yMax - value) / (yMax - yMin)) * plotHeight;
  }

  return {
    pathFor(points: ChartPoint[]): string | null {
      const sorted = [...points].sort((left, right) => left.x - right.x);

      if (sorted.length === 0) {
        return null;
      }

      return sorted
        .map((point, index) => {
          const command = index === 0 ? "M" : "L";

          return `${command}${scaleX(point.x).toFixed(2)} ${scaleY(point.y).toFixed(2)}`;
        })
        .join(" ");
    },
    scaleX,
    scaleY,
    xLabels: buildXLabels(allPoints, scaleX),
    yTicks: buildYTicks(yMinRaw, yMaxRaw, scaleY)
  };
}

function buildYTicks(
  yMin: number,
  yMax: number,
  scaleY: (value: number) => number
): Array<{ value: number; y: number }> {
  if (yMin === yMax) {
    return [{ value: yMin, y: scaleY(yMin) }];
  }

  const middle = (yMin + yMax) / 2;

  return [yMax, middle, yMin].map((value) => ({
    value,
    y: scaleY(value)
  }));
}

function buildXLabels(
  points: ChartPoint[],
  scaleX: (value: number) => number
): Array<{ anchor: "start" | "end"; text: string; x: number }> {
  const labeledPoints = points
    .filter((point) => point.label)
    .sort((left, right) => left.x - right.x);

  if (labeledPoints.length === 0) {
    return [];
  }

  const first = labeledPoints[0];
  const last = labeledPoints[labeledPoints.length - 1];

  if (first.x === last.x) {
    return [{ anchor: "start", text: first.label ?? "", x: scaleX(first.x) }];
  }

  return [
    { anchor: "start", text: first.label ?? "", x: scaleX(first.x) },
    { anchor: "end", text: last.label ?? "", x: scaleX(last.x) }
  ];
}

function latestPoint(points: ChartPoint[]): ChartPoint[] {
  if (points.length === 0) {
    return [];
  }

  return [[...points].sort((left, right) => right.x - left.x)[0]];
}
