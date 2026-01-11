import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Server, 
  Database, 
  Globe, 
  Cpu, 
  HardDrive, 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle,
  RefreshCw
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const services = [
  { name: "Identity Service", status: "healthy", uptime: "99.99%", latency: "45ms", type: "Auth" },
  { name: "Ingestion Service", status: "healthy", uptime: "99.95%", latency: "120ms", type: "Data" },
  { name: "Operations Service", status: "warning", uptime: "99.50%", latency: "350ms", type: "Core" },
  { name: "Analytics Engine", status: "healthy", uptime: "99.90%", latency: "800ms", type: "AI/ML" },
  { name: "Notification Service", status: "healthy", uptime: "99.99%", latency: "30ms", type: "Utility" },
  { name: "Payment Gateway", status: "critical", uptime: "98.20%", latency: "2100ms", type: "Integration" },
];

const integrations = [
  { name: "SAP ERP", status: "connected", lastSync: "2 mins ago" },
  { name: "Salesforce CRM", status: "connected", lastSync: "5 mins ago" },
  { name: "FedEx API", status: "connected", lastSync: "1 min ago" },
  { name: "Maersk Tracking", status: "error", lastSync: "45 mins ago" },
  { name: "Twilio SMS", status: "connected", lastSync: "Real-time" },
];

const performanceData = Array.from({ length: 20 }, (_, i) => ({
  time: `${i}:00`,
  cpu: Math.floor(Math.random() * 40) + 20,
  memory: Math.floor(Math.random() * 30) + 40,
  requests: Math.floor(Math.random() * 1000) + 500,
}));

const StatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case "healthy":
    case "connected":
      return <CheckCircle2 className="w-4 h-4 text-green-400" />;
    case "warning":
      return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
    case "critical":
    case "error":
      return <XCircle className="w-4 h-4 text-red-400" />;
    default:
      return <Activity className="w-4 h-4 text-gray-400" />;
  }
};

export default function Infrastructure() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-bold font-display text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60">
            System Health
          </h1>
          <p className="text-muted-foreground mt-1">Infrastructure monitoring and integration status.</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-medium">
          <Activity className="w-4 h-4 animate-pulse" />
          All Critical Systems Operational
        </div>
      </div>

      {/* Resource Usage */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="glass border-white/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">CPU Usage</CardTitle>
            <Cpu className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-display">42%</div>
            <div className="h-[80px] mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={performanceData}>
                  <defs>
                    <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="cpu" stroke="var(--primary)" fillOpacity={1} fill="url(#colorCpu)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card className="glass border-white/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Memory Usage</CardTitle>
            <HardDrive className="w-4 h-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-display">64%</div>
            <div className="h-[80px] mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={performanceData}>
                  <defs>
                    <linearGradient id="colorMem" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="memory" stroke="#a855f7" fillOpacity={1} fill="url(#colorMem)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card className="glass border-white/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Network Requests</CardTitle>
            <Globe className="w-4 h-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-display">1.2k/s</div>
            <div className="h-[80px] mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={performanceData}>
                  <defs>
                    <linearGradient id="colorReq" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="requests" stroke="#22c55e" fillOpacity={1} fill="url(#colorReq)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Microservices Status */}
        <Card className="col-span-2 glass border-white/5">
          <CardHeader>
            <CardTitle className="font-display tracking-wide flex items-center gap-2">
              <Server className="w-5 h-5 text-primary" />
              Microservices Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {services.map((service) => (
                <div key={service.name} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                  <div className="flex items-center gap-3">
                    <StatusIcon status={service.status} />
                    <div>
                      <p className="font-medium text-sm">{service.name}</p>
                      <p className="text-xs text-muted-foreground">{service.type}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-right">
                      <p className="text-muted-foreground text-xs">Uptime</p>
                      <p className="font-mono">{service.uptime}</p>
                    </div>
                    <div className="text-right w-16">
                      <p className="text-muted-foreground text-xs">Latency</p>
                      <p className={`font-mono ${parseInt(service.latency) > 200 ? 'text-yellow-400' : 'text-green-400'}`}>
                        {service.latency}
                      </p>
                    </div>
                    <Badge variant="outline" className={`capitalize ${
                      service.status === 'healthy' ? 'border-green-500/50 text-green-400' : 
                      service.status === 'warning' ? 'border-yellow-500/50 text-yellow-400' : 
                      'border-red-500/50 text-red-400'
                    }`}>
                      {service.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Integrations Status */}
        <Card className="glass border-white/5">
          <CardHeader>
            <CardTitle className="font-display tracking-wide flex items-center gap-2">
              <Database className="w-5 h-5 text-purple-400" />
              Integrations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {integrations.map((integration) => (
                  <div key={integration.name} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        integration.status === 'connected' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                      }`} />
                      <div>
                        <p className="font-medium text-sm">{integration.name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <RefreshCw className="w-3 h-3" />
                          {integration.lastSync}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs bg-white/10">
                      v1.2
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
