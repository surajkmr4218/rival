import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Dimensions,
  PanResponder,
  GestureResponderEvent,
} from 'react-native';
import Svg, { Path, Line, Circle, G, Text as SvgText, Defs, ClipPath, Rect } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../lib/theme';
import { getBalanceHistory } from '../lib/api';
import type { BalanceHistoryResponse, BalanceHistoryPeriod, BalanceDataPoint } from '../lib/types';

const PERIODS: { label: string; value: BalanceHistoryPeriod }[] = [
  { label: '1D', value: '1D' },
  { label: '1W', value: '1W' },
  { label: '1M', value: '1M' },
  { label: '6M', value: '6M' },
  { label: '1Y', value: '1Y' },
  { label: 'ALL', value: 'ALL' },
];

// Chart dimensions
const CHART_HEIGHT = 180;
const CHART_PADDING_LEFT = 55;
const CHART_PADDING_RIGHT = 20;
const CHART_PADDING_TOP = 16;
const CHART_PADDING_BOTTOM = 40;
const Y_AXIS_TICKS = 5;
const X_AXIS_TICKS = 4;

interface BalanceChartProps {
  refreshTrigger?: number;
}

export default function BalanceChart({ refreshTrigger }: BalanceChartProps) {
  const [period, setPeriod] = useState<BalanceHistoryPeriod>('1W');
  const [data, setData] = useState<BalanceHistoryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [chartWidth, setChartWidth] = useState(Dimensions.get('window').width - 48);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getBalanceHistory(period);
      setData(response.data);
    } catch (err: any) {
      console.error('Failed to fetch balance history:', err);
      setError('Failed to load chart');
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshTrigger]);

  // Calculate drawable area
  const drawableWidth = chartWidth - CHART_PADDING_LEFT - CHART_PADDING_RIGHT;
  const drawableHeight = CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM;

  // Process chart data
  const chartData = useMemo(() => {
    if (!data || data.data_points.length === 0) {
      return { points: [], minY: 0, maxY: 100, yTicks: [], xTicks: [] };
    }

    const points = data.data_points;
    const balances = points.map((p) => p.balance_cents);

    // Calculate Y range with padding
    let minY = Math.min(...balances);
    let maxY = Math.max(...balances);

    // Add 10% padding to range
    const range = maxY - minY || 1;
    minY = Math.max(0, minY - range * 0.1);
    maxY = maxY + range * 0.1;

    // Round to nice numbers for ticks
    const yStep = (maxY - minY) / (Y_AXIS_TICKS - 1);
    const yTicks: number[] = [];
    for (let i = 0; i < Y_AXIS_TICKS; i++) {
      yTicks.push(minY + yStep * i);
    }

    // X-axis ticks (timestamps) - evenly distributed
    const xTicks: { value: string; position: number }[] = [];
    const numTicks = Math.min(X_AXIS_TICKS, points.length);
    for (let i = 0; i < numTicks; i++) {
      const pointIndex = Math.floor((i / (numTicks - 1 || 1)) * (points.length - 1));
      const point = points[pointIndex];
      const x = CHART_PADDING_LEFT + (i / (numTicks - 1 || 1)) * drawableWidth;
      xTicks.push({
        value: formatXLabel(point.timestamp, period),
        position: x,
      });
    }

    // Calculate SVG coordinates for each point
    const svgPoints = points.map((point, index) => {
      const x = (index / (points.length - 1 || 1)) * drawableWidth + CHART_PADDING_LEFT;
      const y = CHART_PADDING_TOP + drawableHeight - ((point.balance_cents - minY) / (maxY - minY)) * drawableHeight;
      return { x, y, data: point };
    });

    return { points: svgPoints, minY, maxY, yTicks, xTicks };
  }, [data, drawableWidth, drawableHeight, period]);

  // Generate smooth SVG path
  const linePath = useMemo(() => {
    if (chartData.points.length < 2) return '';

    const points = chartData.points;
    let path = `M ${points[0].x} ${points[0].y}`;

    // Use smooth curves for better visualization
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];

      // Simple line for now (can be upgraded to bezier curves)
      path += ` L ${curr.x} ${curr.y}`;
    }

    return path;
  }, [chartData.points]);

  // Handle touch interactions
  const handleTouch = useCallback((evt: GestureResponderEvent) => {
    if (chartData.points.length === 0) return;

    const { locationX } = evt.nativeEvent;
    const x = locationX;

    // Find closest point
    let closestIndex = 0;
    let closestDist = Infinity;

    chartData.points.forEach((point, index) => {
      const dist = Math.abs(point.x - x);
      if (dist < closestDist) {
        closestDist = dist;
        closestIndex = index;
      }
    });

    setActiveIndex(closestIndex);
  }, [chartData.points]);

  const handleTouchEnd = useCallback(() => {
    setActiveIndex(null);
  }, []);

  // Formatting helpers
  const formatCurrency = (cents: number, short = false) => {
    const dollars = cents / 100;
    if (short && Math.abs(dollars) >= 1000) {
      return `$${(dollars / 1000).toFixed(1)}k`;
    }
    return `$${dollars.toFixed(2)}`;
  };

  const formatChange = (cents: number) => {
    const isPositive = cents >= 0;
    const formatted = formatCurrency(Math.abs(cents));
    return isPositive ? `+${formatted}` : `-${formatted}`;
  };

  const isPositive = data ? data.change_cents >= 0 : true;
  const lineColor = isPositive ? colors.accent : '#ef4444';
  const activePoint = activeIndex !== null ? chartData.points[activeIndex] : null;

  return (
    <View
      style={styles.container}
      onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}
    >
      {/* Period Selector */}
      <View style={styles.periodSelector}>
        {PERIODS.map((p) => (
          <Pressable
            key={p.value}
            style={[styles.periodPill, period === p.value && styles.periodPillActive]}
            onPress={() => setPeriod(p.value)}
          >
            <Text
              style={[styles.periodText, period === p.value && styles.periodTextActive]}
            >
              {p.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Active Point Tooltip */}
      {activePoint && (
        <View style={styles.tooltip}>
          <Text style={styles.tooltipValue}>
            {formatCurrency(activePoint.data.balance_cents)}
          </Text>
          <Text style={styles.tooltipTime}>
            {formatTooltipTime(activePoint.data.timestamp)}
          </Text>
        </View>
      )}

      {/* Chart Area */}
      <View
        style={styles.chartArea}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={handleTouch}
        onResponderMove={handleTouch}
        onResponderRelease={handleTouchEnd}
        onResponderTerminate={handleTouchEnd}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={24} color={colors.textMuted} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : chartData.points.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="analytics-outline" size={32} color={colors.textMuted} />
            <Text style={styles.emptyText}>No balance history yet</Text>
            <Text style={styles.emptySubtext}>Add funds to start tracking</Text>
          </View>
        ) : (
          <Svg width={chartWidth} height={CHART_HEIGHT}>
            {/* Define clipping region */}
            <Defs>
              <ClipPath id="chartClip">
                <Rect
                  x={CHART_PADDING_LEFT}
                  y={CHART_PADDING_TOP}
                  width={drawableWidth}
                  height={drawableHeight}
                />
              </ClipPath>
            </Defs>

            {/* Grid lines */}
            <G>
              {chartData.yTicks.map((tick, i) => {
                const y = CHART_PADDING_TOP + drawableHeight - ((tick - chartData.minY) / (chartData.maxY - chartData.minY)) * drawableHeight;
                return (
                  <Line
                    key={`grid-${i}`}
                    x1={CHART_PADDING_LEFT}
                    y1={y}
                    x2={chartWidth - CHART_PADDING_RIGHT}
                    y2={y}
                    stroke={colors.border}
                    strokeWidth={1}
                    strokeDasharray="4,4"
                    opacity={0.5}
                  />
                );
              })}
            </G>

            {/* Y-axis labels */}
            <G>
              {chartData.yTicks.map((tick, i) => {
                const y = CHART_PADDING_TOP + drawableHeight - ((tick - chartData.minY) / (chartData.maxY - chartData.minY)) * drawableHeight;
                return (
                  <SvgText
                    key={`y-label-${i}`}
                    x={CHART_PADDING_LEFT - 8}
                    y={y + 4}
                    fontSize={10}
                    fill={colors.textMuted}
                    textAnchor="end"
                  >
                    {formatCurrency(tick, true)}
                  </SvgText>
                );
              })}
            </G>

            {/* X-axis labels */}
            <G>
              {chartData.xTicks.map((tick, i) => (
                <SvgText
                  key={`x-label-${i}`}
                  x={tick.position}
                  y={CHART_HEIGHT - 8}
                  fontSize={10}
                  fill={colors.textMuted}
                  textAnchor="middle"
                >
                  {tick.value}
                </SvgText>
              ))}
            </G>

            {/* Chart content with clipping */}
            <G clipPath="url(#chartClip)">
              {/* Main line */}
              <Path
                d={linePath}
                stroke={lineColor}
                strokeWidth={2.5}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Data points (only show if few points) */}
              {chartData.points.length <= 15 && chartData.points.map((point, i) => (
                <Circle
                  key={`point-${i}`}
                  cx={point.x}
                  cy={point.y}
                  r={activeIndex === i ? 6 : 4}
                  fill={activeIndex === i ? lineColor : colors.background}
                  stroke={lineColor}
                  strokeWidth={2}
                />
              ))}

              {/* Active point highlight */}
              {activePoint && (
                <>
                  {/* Vertical line */}
                  <Line
                    x1={activePoint.x}
                    y1={CHART_PADDING_TOP}
                    x2={activePoint.x}
                    y2={CHART_HEIGHT - CHART_PADDING_BOTTOM}
                    stroke={lineColor}
                    strokeWidth={1}
                    strokeDasharray="4,4"
                    opacity={0.6}
                  />
                  {/* Highlight circle */}
                  <Circle
                    cx={activePoint.x}
                    cy={activePoint.y}
                    r={8}
                    fill={lineColor}
                    opacity={0.3}
                  />
                  <Circle
                    cx={activePoint.x}
                    cy={activePoint.y}
                    r={5}
                    fill={lineColor}
                  />
                </>
              )}
            </G>
          </Svg>
        )}
      </View>

      {/* Summary Footer */}
      {data && !isLoading && !error && chartData.points.length > 0 && (
        <View style={styles.summary}>
          <View style={styles.changeContainer}>
            <Ionicons
              name={isPositive ? 'trending-up' : 'trending-down'}
              size={18}
              color={lineColor}
            />
            <Text style={[styles.changeAmount, { color: lineColor }]}>
              {formatChange(data.change_cents)}
            </Text>
            <Text style={[styles.changePercent, { color: lineColor }]}>
              ({isPositive ? '+' : ''}{data.change_percent.toFixed(1)}%)
            </Text>
          </View>
          <Text style={styles.periodLabel}>
            {getPeriodLabel(period)}
          </Text>
        </View>
      )}
    </View>
  );
}

// Helper functions
function formatXLabel(timestamp: string, period: BalanceHistoryPeriod): string {
  const date = new Date(timestamp);

  switch (period) {
    case '1D':
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    case '1W':
    case '1M':
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    case '6M':
    case '1Y':
    case 'ALL':
      return date.toLocaleDateString([], { month: 'short', year: '2-digit' });
    default:
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
}

function formatTooltipTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getPeriodLabel(period: BalanceHistoryPeriod): string {
  switch (period) {
    case '1D': return 'today';
    case '1W': return 'this week';
    case '1M': return 'this month';
    case '6M': return 'past 6 months';
    case '1Y': return 'this year';
    case 'ALL': return 'all time';
  }
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  periodSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  periodPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'transparent',
  },
  periodPillActive: {
    backgroundColor: 'rgba(0, 255, 136, 0.15)',
  },
  periodText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  periodTextActive: {
    color: colors.accent,
  },
  tooltip: {
    position: 'absolute',
    top: 50,
    right: 16,
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: colors.border,
    zIndex: 10,
  },
  tooltipValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  tooltipTime: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  chartArea: {
    height: CHART_HEIGHT,
    marginBottom: 8,
    overflow: 'hidden',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
  emptySubtext: {
    color: colors.textMuted,
    fontSize: 12,
    opacity: 0.7,
  },
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  changeAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  changePercent: {
    fontSize: 14,
    fontWeight: '500',
  },
  periodLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
});
