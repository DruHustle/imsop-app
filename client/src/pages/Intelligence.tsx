import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BrainCircuit, TrendingUp, AlertTriangle, Zap, ArrowRight } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend } from "recharts";

const predictionData = [
  { time: "00:00", actual: 400, predicted: 410 },
  { time: "04:00", actual: 300, predicted: 320 },
  { time: "08:00", actual: 550, predicted: 540 },
  { time: "12:00", actual: 700, predicted: 720 },
  { time: "16:00", actual: 600, predicted: 590 },
  { time: "20:00", actual: 450, predicted: 460 },
  { time: "24:00", actual: 380, predicted: 390 },
];

const riskData = [
  { subject: 'Weather', A: 120, fullMark: 150 },
  { subject: 'Political', A: 98, fullMark: 150 },
  { subject: 'Traffic', A: 86, fullMark: 150 },
  { subject: 'Supplier', A: 99, fullMark: 150 },
  { subject: 'Demand', A: 85, fullMark: 150 },
  { subject: 'Cyber', A: 65, fullMark: 150 },
];

export default function Intelligence() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-bold font-display text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60">
            Operational Intelligence
          </h1>
          <p className="text-muted-foreground mt-1">AI-driven insights and predictive modeling.</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-sm font-medium">
          <BrainCircuit className="w-4 h-4" />
          Model Accuracy: 98.4%
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Key Insights Cards */}
        <Card className="glass border-white/5 bg-gradient-to-br from-purple-500/10 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-purple-200 flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Optimization Opportunity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-display text-white">Route 42-B</div>
            <p className="text-xs text-purple-200/70 mt-1">
              Switching to rail could save 15% cost with only 2h delay.
            </p>
            <Button size="sm" variant="secondary" className="mt-4 w-full bg-purple-500/20 hover:bg-purple-500/30 text-purple-100 border-0">
              Apply Recommendation
            </Button>
          </CardContent>
        </Card>

        <Card className="glass border-white/5 bg-gradient-to-br from-amber-500/10 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Risk Alert
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-display text-white">Typhoon Warning</div>
            <p className="text-xs text-amber-200/70 mt-1">
              South China Sea routes impacted. 4 vessels affected.
            </p>
            <Button size="sm" variant="secondary" className="mt-4 w-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 border-0">
              View Impact Analysis
            </Button>
          </CardContent>
        </Card>

        <Card className="glass border-white/5 bg-gradient-to-br from-cyan-500/10 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-cyan-200 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Demand Forecast
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-display text-white">+24% Surge</div>
            <p className="text-xs text-cyan-200/70 mt-1">
              Expected in Electronics sector for Q4 based on market trends.
            </p>
            <Button size="sm" variant="secondary" className="mt-4 w-full bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-100 border-0">
              Adjust Inventory
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="glass border-white/5">
          <CardHeader>
            <CardTitle className="font-display tracking-wide">Predictive Throughput Model</CardTitle>
            <CardDescription>Actual vs Predicted shipment volume (24h)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={predictionData}>
                  <defs>
                    <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorPredicted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="time" stroke="rgba(255,255,255,0.3)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="rgba(255,255,255,0.3)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(15, 23, 42, 0.9)', 
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      backdropFilter: 'blur(10px)'
                    }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="actual" stroke="var(--primary)" fillOpacity={1} fill="url(#colorActual)" name="Actual Volume" />
                  <Area type="monotone" dataKey="predicted" stroke="#a855f7" strokeDasharray="5 5" fillOpacity={1} fill="url(#colorPredicted)" name="AI Prediction" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="glass border-white/5">
          <CardHeader>
            <CardTitle className="font-display tracking-wide">Supply Chain Risk Profile</CardTitle>
            <CardDescription>Multi-dimensional risk assessment</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full flex justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={riskData}>
                  <PolarGrid stroke="rgba(255,255,255,0.1)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 150]} tick={false} axisLine={false} />
                  <Radar
                    name="Risk Level"
                    dataKey="A"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    fill="#f59e0b"
                    fillOpacity={0.4}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(15, 23, 42, 0.9)', 
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      backdropFilter: 'blur(10px)'
                    }}
                    itemStyle={{ color: '#fff' }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
