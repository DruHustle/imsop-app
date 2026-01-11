import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Activity, 
  AlertTriangle, 
  Box, 
  Clock, 
  TrendingUp, 
  ArrowUpRight,
  ArrowDownRight,
  BrainCircuit
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { MapView } from "@/components/Map";

const data = [
  { name: "00:00", value: 400 },
  { name: "04:00", value: 300 },
  { name: "08:00", value: 550 },
  { name: "12:00", value: 450 },
  { name: "16:00", value: 600 },
  { name: "20:00", value: 750 },
  { name: "24:00", value: 650 },
];

const StatCard = ({ title, value, change, icon: Icon, trend }: any) => (
  <Card className="glass border-white/5 hover:border-primary/50 transition-all duration-300 group">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground group-hover:text-primary transition-colors">
        {title}
      </CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold tracking-tight">{value}</div>
      <p className={`text-[10px] font-bold flex items-center mt-1 ${trend === 'up' ? 'text-green-400' : 'text-red-400'}`}>
        {trend === 'up' ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
        {change}
        <span className="text-muted-foreground ml-1 font-normal">vs last hour</span>
      </p>
    </CardContent>
  </Card>
);

export default function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Condensed Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Operational Overview
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Real-time supply chain monitoring and predictive insights.</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold animate-pulse">
          <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_10px_var(--primary)]" />
          LIVE DATA STREAM
        </div>
      </div>

      {/* Key Metrics Grid - Condensed */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Active Shipments" value="1,284" change="+12.5%" trend="up" icon={Box} />
        <StatCard title="On-Time Delivery" value="98.2%" change="+2.1%" trend="up" icon={Clock} />
        <StatCard title="Predicted Delays" value="14" change="-4" trend="down" icon={AlertTriangle} />
        <StatCard title="System Load" value="42%" change="+5%" trend="up" icon={Activity} />
      </div>

      <div className="grid gap-4 md:grid-cols-7">
        {/* Main Chart - Condensed Height */}
        <Card className="col-span-4 glass border-white/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider">Throughput Analytics</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="name" stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', backdropFilter: 'blur(10px)' }}
                    itemStyle={{ color: '#fff', fontSize: '12px' }}
                  />
                  <Area type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2} fillOpacity={1} fill="url(#colorValue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Interactive Map - Condensed Height */}
        <Card className="col-span-3 glass border-white/5 flex flex-col min-h-[300px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider">Global Activity Map</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-0 relative overflow-hidden rounded-b-xl">
            <MapView className="w-full h-full min-h-[250px]" onMapReady={() => {}} />
            <div className="absolute bottom-3 left-3 right-3 pointer-events-none">
              <div className="glass-panel p-2 rounded-lg flex items-center gap-3 animate-in slide-in-from-bottom-2 fade-in duration-500 pointer-events-auto">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-white">Anomaly: Route 42</p>
                  <p className="text-[8px] text-white/60">Pacific Ocean • 2m ago</p>
                </div>
                <Button size="sm" variant="outline" className="h-6 text-[10px] border-white/20 hover:bg-white/10 px-2">View</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Insights Section - Condensed */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="glass border-white/5 md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
              <BrainCircuit className="w-4 h-4 text-purple-400" />
              Predictive Insights
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-[10px] font-bold text-muted-foreground hover:text-primary">VIEW ALL</Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-start gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-white/5">
                  <div className="w-7 h-7 rounded bg-purple-500/20 flex items-center justify-center shrink-0 text-purple-400">
                    <TrendingUp className="w-3 h-3" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xs font-bold text-white">Demand Spike Predicted</h4>
                    <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                      AI models forecast a 25% increase in demand for electronics in APAC over 14 days.
                    </p>
                  </div>
                  <div className="text-[10px] font-bold text-primary">98% CONF.</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="glass border-white/5 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-purple-500/20" />
          <CardHeader className="relative z-10 pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-white">Ask IMSOP AI</CardTitle>
          </CardHeader>
          <CardContent className="relative z-10 flex flex-col h-[120px] justify-end">
            <p className="text-[10px] text-white/80 mb-3 italic">"What is the status of shipment #12345?"</p>
            <div className="relative">
              <input type="text" placeholder="Query..." className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-primary/50 backdrop-blur-sm" />
              <Button size="icon" className="absolute right-1 top-1 h-5 w-5 bg-primary hover:bg-primary/80 text-primary-foreground">
                <ArrowUpRight className="w-3 h-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
