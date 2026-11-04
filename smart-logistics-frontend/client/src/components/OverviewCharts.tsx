import { useId, useState } from "react";
import {
  Area,
  ComposedChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { ActivityPoint, statusGroups, statusColor } from "@/lib/overview";
import { Shipment } from "@/lib/workspace";
const shortDate = (date: string) =>
  new Date(date + "T12:00:00Z").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
export function ActivityChart({
  points,
  deliveryEvidence,
  bucket,
  onBucket,
}: {
  points: ActivityPoint[];
  deliveryEvidence: number;
  bucket: string;
  onBucket: (date: string) => void;
}) {
  const id = useId().replace(/:/g, ""),
    [showCreated, setCreated] = useState(true),
    [showDelivered, setDelivered] = useState(true),
    [inspect, setInspect] = useState("");
  const selected = points.find(p => p.date === inspect);
  return (
    <figure
      className="overview-activity"
      aria-label={`Shipment activity by UTC ${bucket}. ${points.reduce((n, p) => n + p.created, 0)} created and ${points.reduce((n, p) => n + p.delivered, 0)} explicitly dated deliveries.`}
    >
      <div className="activity-plot">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            accessibilityLayer
            onClick={(state: any) => {
              if (state?.activeLabel) setInspect(String(state.activeLabel));
            }}
            data={points}
            margin={{ top: 12, right: 16, bottom: 0, left: -22 }}
          >
            <defs>
              <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--primary)"
                  stopOpacity={0.32}
                />
                <stop
                  offset="100%"
                  stopColor="var(--primary)"
                  stopOpacity={0.015}
                />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={date =>
                bucket === "year" ? date.slice(0, 4) : shortDate(date)
              }
              tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
              minTickGap={24}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={({ active, payload, label }: any) =>
                active && payload?.length ? (
                  <div className="overview-tooltip">
                    <strong>
                      {String(label)} · UTC {bucket}
                    </strong>
                    {payload.map((p: any) => (
                      <p key={p.dataKey}>
                        {p.name}: <b>{p.value}</b>
                      </p>
                    ))}
                  </div>
                ) : null
              }
            />
            {showCreated && (
              <Area
                type="linear"
                name="Created shipments"
                dataKey="created"
                stroke="var(--primary)"
                strokeWidth={2.4}
                fill={`url(#${id})`}
                isAnimationActive={false}
                activeDot={{ r: 5 }}
              />
            )}
            {deliveryEvidence > 0 && showDelivered && (
              <Line
                type="linear"
                name="Delivered with actual arrival"
                dataKey="delivered"
                stroke="var(--color-chart-5)"
                strokeDasharray="4 5"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <figcaption>
        {selected && (
          <div className="actions text-xs">
            <span>
              {selected.date}: {selected.created} created
            </span>
            <button
              className="record-link"
              disabled={!selected.created}
              onClick={() => onBucket(selected.date)}
            >
              Open created shipments →
            </button>
          </div>
        )}
        <div className="chart-legend">
          <button
            type="button"
            aria-pressed={showCreated}
            onClick={() => setCreated(v => !v)}
          >
            <i style={{ background: "var(--primary)" }} />
            Created shipments
          </button>
          {deliveryEvidence > 0 ? (
            <button
              type="button"
              aria-pressed={showDelivered}
              onClick={() => setDelivered(v => !v)}
            >
              <i style={{ background: "var(--color-chart-5)" }} />
              Delivered with actual arrival
            </button>
          ) : (
            <span className="muted text-xs">
              No actual delivery timestamps in this selection
            </span>
          )}
        </div>
        <details className="chart-values">
          <summary>Inspect chart values</summary>
          <label className="field">
            Activity bucket
            <select value={inspect} onChange={e => setInspect(e.target.value)}>
              <option value="">Choose a UTC {bucket}</option>
              {points.map(p => (
                <option key={p.date} value={p.date}>
                  {p.date}
                </option>
              ))}
            </select>
          </label>
          {selected && (
            <p role="status">
              {selected.date}: {selected.created} created · {selected.delivered}{" "}
              explicitly dated deliveries
            </p>
          )}
          <div className="compact-table-wrap">
            <table className="data-table compact-table">
              <caption className="sr-only">All plotted values</caption>
              <thead>
                <tr>
                  <th>UTC {bucket}</th>
                  <th>Created</th>
                  <th>Actual deliveries</th>
                </tr>
              </thead>
              <tbody>
                {points.map(p => (
                  <tr key={p.date}>
                    <td>{p.date}</td>
                    <td>{p.created}</td>
                    <td>{p.delivered}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </figcaption>
    </figure>
  );
}
export function StatusDonut({
  items,
  selected,
  onSelect,
}: {
  items: Shipment[];
  selected: string;
  onSelect: (status: string) => void;
}) {
  const groups = statusGroups(items);
  return (
    <figure
      className="overview-status"
      aria-label={`Status distribution, ${items.length} shipments. ${groups.map(g => g.status + ": " + g.count).join("; ")}`}
    >
      <div className="donut-plot">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={groups}
              dataKey="count"
              nameKey="status"
              innerRadius="62%"
              outerRadius="90%"
              paddingAngle={2}
              stroke="var(--card)"
              isAnimationActive={false}
              onClick={(data: any) => onSelect(data.status)}
            >
              {groups.map(g => (
                <Cell key={g.status} fill={statusColor(g.status)} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }: any) =>
                active && payload?.length ? (
                  <div className="overview-tooltip">
                    {payload[0].name}: <b>{payload[0].value}</b>
                  </div>
                ) : null
              }
            />
            <text
              x="50%"
              y="47%"
              textAnchor="middle"
              fill="var(--foreground)"
              fontSize="28"
              fontWeight="700"
            >
              {items.length}
            </text>
            <text
              x="50%"
              y="59%"
              textAnchor="middle"
              fill="var(--muted-foreground)"
              fontSize="11"
            >
              shipments
            </text>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="donut-legend">
        {groups.map(g => (
          <button
            key={g.status}
            type="button"
            aria-pressed={selected === g.status}
            onClick={() => onSelect(g.status)}
          >
            <i style={{ background: statusColor(g.status) }} />
            <span>{g.status}</span>
            <strong>{g.count}</strong>
          </button>
        ))}
      </figcaption>
    </figure>
  );
}
