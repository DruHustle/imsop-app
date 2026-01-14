import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Download, Calendar, FileSpreadsheet, FileText, TrendingUp, TrendingDown, DollarSign, Clock } from "lucide-react";
import { toast } from "sonner";
import { exportAnalyticsToCSV, exportAnalyticsToPDF, type AnalyticsData } from "@/lib/export";

const monthlyData = [
  { name: "Jan", shipments: 4000, delays: 240, cost: 2400, onTimeRate: 94, avgDeliveryTime: 4.2 },
  { name: "Feb", shipments: 3000, delays: 139, cost: 2210, onTimeRate: 95.4, avgDeliveryTime: 3.8 },
  { name: "Mar", shipments: 2000, delays: 980, cost: 2290, onTimeRate: 51, avgDeliveryTime: 6.1 },
  { name: "Apr", shipments: 2780, delays: 390, cost: 2000, onTimeRate: 86, avgDeliveryTime: 4.5 },
  { name: "May", shipments: 1890, delays: 480, cost: 2181, onTimeRate: 74.6, avgDeliveryTime: 5.2 },
  { name: "Jun", shipments: 2390, delays: 380, cost: 2500, onTimeRate: 84.1, avgDeliveryTime: 4.8 },
  { name: "Jul", shipments: 3490, delays: 430, cost: 2100, onTimeRate: 87.7, avgDeliveryTime: 4.1 },
];

const pieData = [
  { name: "Sea Freight", value: 400 },
  { name: "Air Freight", value: 300 },
  { name: "Road Transport", value: 300 },
  { name: "Rail", value: 200 },
];

const COLORS = ['#06b6d4', '#8b5cf6', '#10b981', '#f59e0b'];

// Calculate summary metrics
const totalShipments = monthlyData.reduce((sum, d) => sum + d.shipments, 0);
const totalDelays = monthlyData.reduce((sum, d) => sum + d.delays, 0);
const avgOnTimeRate = (monthlyData.reduce((sum, d) => sum + d.onTimeRate, 0) / monthlyData.length).toFixed(1);
const avgCost = (monthlyData.reduce((sum, d) => sum + d.cost, 0) / monthlyData.length).toFixed(0);

export default function AnalyticsPage() {
  const handleExportCSV = () => {
    const exportData: AnalyticsData[] = monthlyData.map(d => ({
      period: d.name,
      shipments: d.shipments,
      revenue: d.cost * d.shipments,
      onTimeRate: d.onTimeRate,
      avgDeliveryTime: d.avgDeliveryTime,
    }));
    exportAnalyticsToCSV(exportData, `analytics-${new Date().toISOString().split('T')[0]}`);
    toast.success("CSV exported successfully", {
      description: "Your analytics data has been downloaded."
    });
  };

  const handleExportPDF = () => {
    const exportData: AnalyticsData[] = monthlyData.map(d => ({
      period: d.name,
      shipments: d.shipments,
      revenue: d.cost * d.shipments,
      onTimeRate: d.onTimeRate,
      avgDeliveryTime: d.avgDeliveryTime,
    }));
    const summaryMetrics = [
      { label: "Total Shipments", value: totalShipments.toLocaleString(), change: "+12.5%" },
      { label: "Avg On-Time Rate", value: `${avgOnTimeRate}%`, change: "+2.1%" },
      { label: "Total Delays", value: totalDelays.toLocaleString(), change: "-8.3%" },
      { label: "Avg Cost/Unit", value: `$${avgCost}`, change: "-5.2%" },
    ];
    exportAnalyticsToPDF(exportData, summaryMetrics, "IMSOP Analytics Report");
    toast.success("PDF export initiated", {
      description: "Your report will open in a new window for printing."
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-bold font-display text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60">
            Analytics & Intelligence
          </h1>
          <p className="text-muted-foreground mt-1">Deep dive into operational performance and trends.</p>
        </div>
        <div className="flex gap-2">
          <Select defaultValue="30d">
            <SelectTrigger className="w-[180px] glass border-white/10">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last Quarter</SelectItem>
              <SelectItem value="ytd">Year to Date</SelectItem>
            </SelectContent>
          </Select>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="glass border-white/10 hover:bg-white/5">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="glass border-white/10">
              <DropdownMenuItem onClick={handleExportCSV} className="cursor-pointer">
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPDF} className="cursor-pointer">
                <FileText className="w-4 h-4 mr-2" />
                Export as PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="glass border-white/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Shipments</p>
                <h3 className="text-2xl font-bold font-display">{totalShipments.toLocaleString()}</h3>
              </div>
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
            </div>
            <p className="text-xs text-green-400 mt-2">+12.5% from last period</p>
          </CardContent>
        </Card>
        <Card className="glass border-white/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg On-Time Rate</p>
                <h3 className="text-2xl font-bold font-display">{avgOnTimeRate}%</h3>
              </div>
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-green-400" />
              </div>
            </div>
            <p className="text-xs text-green-400 mt-2">+2.1% from last period</p>
          </CardContent>
        </Card>
        <Card className="glass border-white/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Delays</p>
                <h3 className="text-2xl font-bold font-display">{totalDelays.toLocaleString()}</h3>
              </div>
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-red-400" />
              </div>
            </div>
            <p className="text-xs text-green-400 mt-2">-8.3% from last period</p>
          </CardContent>
        </Card>
        <Card className="glass border-white/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Cost/Unit</p>
                <h3 className="text-2xl font-bold font-display">${avgCost}</h3>
              </div>
              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-purple-400" />
              </div>
            </div>
            <p className="text-xs text-green-400 mt-2">-5.2% from last period</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="glass border-white/5">
          <CardHeader>
            <CardTitle className="font-display tracking-wide">Shipment Volume vs Delays</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="name" stroke="rgba(255,255,255,0.3)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="rgba(255,255,255,0.3)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(15, 23, 42, 0.9)', 
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      backdropFilter: 'blur(10px)'
                    }}
                    itemStyle={{ color: '#fff' }}
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  />
                  <Legend />
                  <Bar dataKey="shipments" name="Total Shipments" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="delays" name="Delayed" fill="var(--destructive)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="glass border-white/5">
          <CardHeader>
            <CardTitle className="font-display tracking-wide">Cost Efficiency Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="name" stroke="rgba(255,255,255,0.3)" fontSize={12} tickLine={false} axisLine={false} />
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
                  <Line 
                    type="monotone" 
                    dataKey="cost" 
                    name="Cost per Unit ($)" 
                    stroke="var(--accent)" 
                    strokeWidth={3}
                    dot={{ r: 4, fill: "var(--accent)", strokeWidth: 0 }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="glass border-white/5">
          <CardHeader>
            <CardTitle className="font-display tracking-wide">Transport Mode Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0.2)" />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(15, 23, 42, 0.9)', 
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      backdropFilter: 'blur(10px)'
                    }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Legend verticalAlign="middle" align="right" layout="vertical" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="glass border-white/5">
          <CardHeader>
            <CardTitle className="font-display tracking-wide">Regional Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { region: "North America", performance: 98, color: "bg-green-500" },
                { region: "Europe", performance: 94, color: "bg-blue-500" },
                { region: "Asia Pacific", performance: 89, color: "bg-yellow-500" },
                { region: "Latin America", performance: 92, color: "bg-purple-500" },
              ].map((item) => (
                <div key={item.region} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-white">{item.region}</span>
                    <span className="text-muted-foreground">{item.performance}% On-Time</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${item.color} rounded-full`} 
                      style={{ width: `${item.performance}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
