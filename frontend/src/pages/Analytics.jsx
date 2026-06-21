import { useEffect, useState } from "react";
import api from "@/lib/api";
import { BarChart, Bar, LineChart, Line, ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";

const Panel = ({ title, hint, children }) => (
  <div className="glass-panel p-5">
    <div className="flex items-center justify-between">
      <div className="data-label">{title}</div>
      {hint && <span className="data-label text-amber-500">{hint}</span>}
    </div>
    <div className="h-64 mt-3">{children}</div>
  </div>
);

const chartProps = { stroke: "#475569", tick: { fontFamily: "JetBrains Mono", fontSize: 11 } };
const tipStyle = { background: "#0B0B0E", border: "1px solid rgba(255,255,255,0.08)", fontFamily: "JetBrains Mono", fontSize: 12 };

export default function Analytics() {
  const [hourly, setHourly] = useState([]);
  const [daily, setDaily] = useState([]);
  const [weekly, setWeekly] = useState([]);
  const [vehicle, setVehicle] = useState([]);
  const [station, setStation] = useState([]);
  const [junction, setJunction] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get("/analytics/hourly"),
      api.get("/analytics/daily"),
      api.get("/analytics/weekly"),
      api.get("/analytics/vehicle"),
      api.get("/analytics/police-station"),
      api.get("/analytics/junction"),
    ]).then(([h,d,w,v,s,j]) => {
      setHourly(h.data.data); setDaily(d.data.data); setWeekly(w.data.data);
      setVehicle(v.data.data); setStation(s.data.data); setJunction(j.data.data);
    });
  }, []);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <div className="data-label text-amber-500">/// CITY ANALYTICS</div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-2">Patterns the city has been blind to</h1>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="Hourly · violations by hour-of-day" hint="0..23">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hourly} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="hour" {...chartProps} />
              <YAxis {...chartProps} />
              <Tooltip contentStyle={tipStyle} cursor={{ fill: "rgba(245,158,11,0.06)" }} />
              <Bar dataKey="violations" fill="#F59E0B" radius={[2,2,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Daily · violations by day-of-week" hint="MON..SUN">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={daily} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="day" {...chartProps} />
              <YAxis {...chartProps} />
              <Tooltip contentStyle={tipStyle} cursor={{ fill: "rgba(239,68,68,0.06)" }} />
              <Bar dataKey="violations" fill="#EF4444" radius={[2,2,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Weekly trend" hint="ISO week">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weekly} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="week" {...chartProps} />
              <YAxis {...chartProps} />
              <Tooltip contentStyle={tipStyle} />
              <Line type="monotone" dataKey="violations" stroke="#F59E0B" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Vehicle type" hint="top 10">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={vehicle} layout="vertical" margin={{ top: 4, right: 8, left: 80, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
              <XAxis type="number" {...chartProps} />
              <YAxis type="category" dataKey="label" {...chartProps} width={120} />
              <Tooltip contentStyle={tipStyle} />
              <Bar dataKey="violations" fill="#10B981" radius={[0,2,2,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Police station" hint="top 10">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={station} layout="vertical" margin={{ top: 4, right: 8, left: 90, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
              <XAxis type="number" {...chartProps} />
              <YAxis type="category" dataKey="label" {...chartProps} width={130} />
              <Tooltip contentStyle={tipStyle} />
              <Bar dataKey="violations" fill="#F59E0B" radius={[0,2,2,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Junction" hint="top 10">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={junction} layout="vertical" margin={{ top: 4, right: 8, left: 90, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
              <XAxis type="number" {...chartProps} />
              <YAxis type="category" dataKey="label" {...chartProps} width={130} />
              <Tooltip contentStyle={tipStyle} />
              <Bar dataKey="violations" fill="#EF4444" radius={[0,2,2,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>
    </div>
  );
}
